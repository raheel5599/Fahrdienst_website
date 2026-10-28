// Public end-to-end test. Prints booleans/status only, never configuration values.
const origin=process.argv[2];
if(!['https://tariq-taxizentrale.de','https://tariq-fahrdienst.de'].includes(origin))throw Error('Unexpected test origin');
const h=await fetch(origin+'/api/health',{signal:AbortSignal.timeout(15000)});
const health=await h.json();
if(!h.ok||!health.ok)throw Error('Website health check failed');
if(!health.placesConfigured){console.log(JSON.stringify({health:true,places:'not-configured'}));}
else{
 const r=await fetch(origin+'/api/places/autocomplete?q=Friedberg',{signal:AbortSignal.timeout(20000)});
 const d=await r.json();const count=Array.isArray(d.suggestions)?d.suggestions.length:0;
 console.log(JSON.stringify({health:true,placesHttp:r.status,suggestions:count}));
 if(!r.ok||count===0)throw Error('Places end-to-end check failed');
}
