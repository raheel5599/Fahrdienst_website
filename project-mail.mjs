// Server-only central mail adapter. No SMTP password is fetched by projects.
export function createProjectMail({env=process.env,fetchImpl=fetch}={}) {
 const configured=()=>Boolean(env.VERWALTUNG_API_URL||env.VERWALTUNG_PROJECT_TOKEN);
 async function request(path,body){
  if(env.VERWALTUNG_API_URL!=='https://verwaltung.tariq-itconsulting.de/api/project-config'||!/^tv_[A-Za-z0-9_-]{43}$/.test(env.VERWALTUNG_PROJECT_TOKEN||''))throw Error('Verwaltungszugang fehlt.');
  const r=await fetchImpl('https://verwaltung.tariq-itconsulting.de/api/project-mail/'+path,{method:body?'POST':'GET',redirect:'error',signal:AbortSignal.timeout(45000),headers:{Authorization:'Bearer '+env.VERWALTUNG_PROJECT_TOKEN,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  const d=await r.json();if(!r.ok||body&&!d.ok)throw Error('Zentraler E-Mail-Versand nicht verfügbar.');return d;
 }
 return {configured,status:()=>request('status'),send:message=>request('send',{subject:message.subject,text:message.text,...(message.replyTo?{replyTo:message.replyTo}:{})})};
}
