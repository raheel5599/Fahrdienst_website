const origin=process.argv[2];
if(!['https://tariq-taxizentrale.de','https://tariq-fahrdienst.de'].includes(origin))throw Error('Unexpected test origin');
async function ready(path) {
 for(let attempt=0;attempt<12;attempt++){
  try{const r=await fetch(origin+path,{signal:AbortSignal.timeout(12000)});const d=await r.json();if(r.ok)return {r,d};}catch{}
  if(attempt<11)await new Promise(resolve=>setTimeout(resolve,3000));
 }
 throw Error('Public endpoint did not become ready: '+path.split('?')[0]);
}
const {d:health}=await ready('/api/health');
if(!health.ok)throw Error('Website health failed');
if(!health.placesConfigured)console.log(JSON.stringify({health:true,places:'not-configured'}));
else{
 const {r,d}=await ready('/api/places/autocomplete?q=Friedberg');
 const count=Array.isArray(d.suggestions)?d.suggestions.length:0;
 console.log(JSON.stringify({health:true,placesHttp:r.status,suggestions:count}));
 if(!count)throw Error('No address suggestions');
}
