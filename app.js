(() => {
  const modal = document.getElementById('request-modal');
  const openButton = document.getElementById('open-request-form');
  const form = document.getElementById('request-form');
  const formStatus = document.getElementById('form-status');
  const heroPickup = document.getElementById('pickup-address');
  const heroDestination = document.getElementById('destination-address');
  const formPickup = document.getElementById('form-pickup');
  const formDestination = document.getElementById('form-destination');

  function openModal() {
    formPickup.value = heroPickup.value.trim();
    formDestination.value = heroDestination.value.trim();
    modal.hidden = false;
    document.body.classList.add('modal-open');
    window.setTimeout(() => {
      (formPickup.value ? formDestination : formPickup).focus();
    }, 0);
  }

  function closeModal() {
    modal.hidden = true;
    document.body.classList.remove('modal-open');
    closeAllSuggestions();
    openButton.focus();
  }

  openButton.addEventListener('click', openModal);
  modal.querySelectorAll('[data-close-modal]').forEach((el) => el.addEventListener('click', closeModal));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.hidden) closeModal();
  });

  function closeAllSuggestions(except) {
    document.querySelectorAll('.place-suggestions').forEach((box) => {
      if (box !== except) {
        box.hidden = true;
        box.innerHTML = '';
      }
    });
  }

  function debounce(fn, wait = 280) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
  }

  async function fetchPlaces(query) {
    const response = await fetch('/api/places/autocomplete?q=' + encodeURIComponent(query), {
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data.suggestions) ? data.suggestions : [];
  }

  function renderSuggestions(input, box, suggestions) {
    box.innerHTML = '';
    if (!suggestions.length) {
      box.hidden = true;
      return;
    }

    suggestions.slice(0, 5).forEach((item) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'place-option';
      button.setAttribute('role', 'option');

      const main = document.createElement('strong');
      main.textContent = item.mainText || item.text;
      const secondary = document.createElement('small');
      secondary.textContent = item.secondaryText || '';

      button.append(main, secondary);
      button.addEventListener('mousedown', (event) => {
        event.preventDefault();
        input.value = item.text;
        box.hidden = true;
        box.innerHTML = '';
      });
      box.appendChild(button);
    });

    const credit = document.createElement('div');
    credit.className = 'places-credit';
    credit.textContent = 'Powered by Google';
    box.appendChild(credit);
    box.hidden = false;
  }

  document.querySelectorAll('.place-field input').forEach((input) => {
    const box = document.querySelector('.place-suggestions[data-for="' + input.id + '"]');
    if (!box) return;

    const search = debounce(async () => {
      const query = input.value.trim();
      if (query.length < 3) {
        box.hidden = true;
        box.innerHTML = '';
        return;
      }
      try {
        const suggestions = await fetchPlaces(query);
        renderSuggestions(input, box, suggestions);
      } catch {
        box.hidden = true;
      }
    });

    input.addEventListener('input', search);
    input.addEventListener('focus', () => closeAllSuggestions(box));
    input.addEventListener('blur', () => {
      window.setTimeout(() => {
        box.hidden = true;
      }, 150);
    });
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.place-field')) closeAllSuggestions();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    formStatus.className = 'form-status';
    formStatus.textContent = '';

    if (!form.reportValidity()) return;

    const submitButton = form.querySelector('.request-submit');
    submitButton.disabled = true;
    submitButton.textContent = 'Wird gesendet …';

    const payload = Object.fromEntries(new FormData(form).entries());
    payload.consent = form.elements.consent.checked;

    try {
      const response = await fetch('/api/ride-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Die Anfrage konnte nicht gesendet werden.');

      formStatus.className = 'form-status success';
      formStatus.textContent = 'Vielen Dank. Ihre Krankenfahrt-Anfrage wurde gesendet. Wir melden uns zur Bestätigung bei Ihnen.';
      form.reset();
      heroPickup.value = '';
      heroDestination.value = '';
    } catch (error) {
      formStatus.className = 'form-status error';
      formStatus.textContent = error.message || 'Beim Senden ist ein Fehler aufgetreten. Bitte rufen Sie uns unter 06031-6868187 an.';
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Krankenfahrt senden →';
    }
  });
})();