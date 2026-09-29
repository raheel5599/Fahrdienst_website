import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import nodemailer from 'nodemailer';

const app = express();
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '40kb' }));

const placesLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 40,
  standardHeaders: 'draft-8',
  legacyHeaders: false
});

const formLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 8,
  standardHeaders: 'draft-8',
  legacyHeaders: false
});

const clean = (value, max = 300) => String(value ?? '').trim().slice(0, max);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const escapeHtml = (value) => clean(value, 2000)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    placesConfigured: Boolean(process.env.GOOGLE_PLACES_API_KEY),
    mailConfigured: Boolean(process.env.SMTP_PASS)
  });
});

app.get('/places/autocomplete', placesLimiter, async (req, res) => {
  const input = clean(req.query.q, 120);
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (input.length < 3) return res.json({ suggestions: [] });
  if (!apiKey) return res.status(503).json({ suggestions: [], message: 'Google Places ist noch nicht konfiguriert.' });

  try {
    const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat'
      },
      body: JSON.stringify({
        input,
        includedRegionCodes: ['de'],
        languageCode: 'de',
        locationBias: {
          circle: {
            center: { latitude: 50.32, longitude: 8.75 },
            radius: 80000
          }
        }
      })
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error('Google Places error', response.status, detail.slice(0, 500));
      return res.status(502).json({ suggestions: [], message: 'Adresssuche momentan nicht verfügbar.' });
    }

    const data = await response.json();
    const suggestions = (data.suggestions || [])
      .map((item) => item.placePrediction)
      .filter(Boolean)
      .map((prediction) => ({
        placeId: prediction.placeId,
        text: prediction.text?.text || '',
        mainText: prediction.structuredFormat?.mainText?.text || prediction.text?.text || '',
        secondaryText: prediction.structuredFormat?.secondaryText?.text || ''
      }))
      .filter((item) => item.text);

    res.json({ suggestions });
  } catch (error) {
    console.error('Places request failed', error);
    res.status(502).json({ suggestions: [], message: 'Adresssuche momentan nicht verfügbar.' });
  }
});

app.post('/ride-request', formLimiter, async (req, res) => {
  const body = req.body || {};

  if (clean(body.companyWebsite, 200)) {
    return res.json({ ok: true });
  }

  const data = {
    pickup: clean(body.pickup, 300),
    destination: clean(body.destination, 300),
    date: clean(body.date, 30),
    time: clean(body.time, 20),
    rideType: clean(body.rideType, 80),
    tripMode: clean(body.tripMode, 80),
    insurance: clean(body.insurance, 160),
    insuranceNumber: clean(body.insuranceNumber, 80),
    firstName: clean(body.firstName, 100),
    lastName: clean(body.lastName, 100),
    phone: clean(body.phone, 80),
    email: clean(body.email, 160),
    notes: clean(body.notes, 1200),
    consent: body.consent === true || body.consent === 'true' || body.consent === 'on'
  };

  const required = ['pickup','destination','date','time','rideType','tripMode','insurance','firstName','lastName','phone','email'];
  const missing = required.filter((key) => !data[key]);
  if (missing.length || !data.consent || !emailPattern.test(data.email)) {
    return res.status(400).json({ message: 'Bitte füllen Sie alle Pflichtfelder korrekt aus.' });
  }

  const smtpPass = process.env.SMTP_PASS;
  if (!smtpPass) {
    return res.status(503).json({ message: 'Der E-Mail-Versand ist noch nicht konfiguriert. Bitte rufen Sie uns unter 06031-6868187 an.' });
  }

  const smtpUser = process.env.SMTP_USER || 'info@taxi5599.de';
  const mailTo = process.env.MAIL_TO || 'info@taxi5599.de';

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.ionos.de',
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE || 'true') !== 'false',
    auth: {
      user: smtpUser,
      pass: smtpPass
    }
  });

  const fullName = data.firstName + ' ' + data.lastName;
  const rows = [
    ['Name', fullName],
    ['Telefon', data.phone],
    ['E-Mail', data.email],
    ['Krankenkasse', data.insurance],
    ['Versichertennummer', data.insuranceNumber || '–'],
    ['Fahrtart', data.rideType],
    ['Fahrt', data.tripMode],
    ['Datum', data.date],
    ['Uhrzeit', data.time],
    ['Abholadresse', data.pickup],
    ['Zieladresse', data.destination],
    ['Bemerkung', data.notes || '–']
  ];

  const htmlRows = rows.map(([label, value]) =>
    '<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:700">' +
    escapeHtml(label) +
    '</td><td style="padding:8px 12px;border-bottom:1px solid #eee">' +
    escapeHtml(value) +
    '</td></tr>'
  ).join('');

  const text = rows.map(([label, value]) => label + ': ' + value).join('\n');

  try {
    await transporter.sendMail({
      from: '"TARIQ Krankenfahrdienst Website" <' + smtpUser + '>',
      to: mailTo,
      replyTo: data.email,
      subject: 'Neue Krankenfahrt-Anfrage – ' + fullName + ' – ' + data.date,
      text,
      html:
        '<div style="font-family:Arial,sans-serif;color:#111">' +
        '<h2 style="color:#b47a14">Neue Krankenfahrt-Anfrage</h2>' +
        '<table style="border-collapse:collapse;width:100%;max-width:720px">' + htmlRows + '</table>' +
        '<p style="margin-top:18px;color:#666;font-size:12px">Gesendet über tariq-fahrdienst.de</p>' +
        '</div>'
    });

    res.json({ ok: true });
  } catch (error) {
    console.error('Mail send failed', error);
    res.status(502).json({ message: 'Die Anfrage konnte nicht per E-Mail gesendet werden. Bitte rufen Sie uns unter 06031-6868187 an.' });
  }
});

app.listen(Number(process.env.PORT || 3000), '0.0.0.0', () => {
  console.log('TARIQ Fahrdienst API listening on port ' + (process.env.PORT || 3000));
});