// Server-only: personal project credentials never leave the backend.
export function createProjectSettings({env=process.env,fetchImpl=fetch,now=Date.now}={}) {
  let key='', expires=0, pending;
  const configured=()=>Boolean(env.VERWALTUNG_API_URL||env.VERWALTUNG_PROJECT_TOKEN);
  async function getKey() {
    if(!configured())return env.GOOGLE_PLACES_API_KEY||'';
    if(now()<expires)return key;
    if(pending)return pending;
    pending=(async()=>{
      key='';expires=0;
      const endpoint='https://verwaltung.tariq-itconsulting.de/api/project-config';
      if(env.VERWALTUNG_API_URL!==endpoint||!/^tv_[A-Za-z0-9_-]{43}$/.test(env.VERWALTUNG_PROJECT_TOKEN||''))throw new Error('Zentrale Konfiguration nicht verfügbar.');
      const r=await fetchImpl(endpoint,{headers:{Authorization:'Bearer '+env.VERWALTUNG_PROJECT_TOKEN},redirect:'error',signal:AbortSignal.timeout(10000)});
      if(!r.ok)throw new Error('Zentrale Konfiguration nicht verfügbar.');
      const d=await r.json();
      key=typeof d.values?.GOOGLE_MAPS_SERVER_KEY==='string'?d.values.GOOGLE_MAPS_SERVER_KEY:'';
      expires=now()+60000;return key;
    })();
    try{return await pending;}finally{pending=null;}
  }
  return {getKey,configured};
}
