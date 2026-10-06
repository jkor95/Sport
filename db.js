(function(SK){
  'use strict';
  let client,connecting,revision=0,user=null;
  const configured=()=>!!(SPORT_CONFIG.supabaseUrl&&SPORT_CONFIG.supabasePublishableKey);
  async function connect(){
    if(client)return client;if(connecting)return connecting;
    if(!configured())throw new Error('Vul eerst de twee publieke Supabase-gegevens in config.js in. De demo werkt al zonder koppeling.');
    const url=new URL(SPORT_CONFIG.supabaseUrl);
    if(url.protocol!=='https:')throw new Error('Gebruik de HTTPS-project-URL van Supabase.');
    const key=SPORT_CONFIG.supabasePublishableKey;
    if(key.startsWith('sb_secret_'))throw new Error('Stop: dit is een geheime Supabase-sleutel. Verwijder en roteer deze. Gebruik alleen de publishable/anon-sleutel.');
    try { const payload=JSON.parse(atob(key.split('.')[1]||''));if(payload.role==='service_role')throw new Error('PRIVATE_KEY'); }catch(e){if(e.message==='PRIVATE_KEY')throw new Error('Stop: service_role mag nooit in de browser. Verwijder en roteer deze sleutel.');}
    connecting=(async()=>{
      if(!globalThis.supabase)await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=SPORT_CONFIG.sdkUrl;script.crossOrigin='anonymous';script.onload=resolve;script.onerror=()=>reject(new Error('De beveiligde inlogbibliotheek kon niet worden geladen. Controleer je verbinding.'));document.head.appendChild(script);});
      client=globalThis.supabase.createClient(SPORT_CONFIG.supabaseUrl,key,{auth:{storage:sessionStorage,storageKey:'sportkompas-auth-'+location.pathname,persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
      return client;
    })();
    try{return await connecting;}catch(e){connecting=null;throw e;}
  }
  async function checkedUser(){const c=await connect();const {data,error}=await c.auth.getUser();if(error||!data.user)throw new Error('Je sessie is verlopen. Log opnieuw in.');user=data.user;return user;}
  async function load(){
    const c=await connect(),u=await checkedUser();
    const {data,error}=await c.from('sport_states').select('data,revision').eq('user_id',u.id).maybeSingle();
    if(error)throw new Error('Gegevens laden mislukt: '+error.message);
    revision=Number(data?.revision||0);const state=data?.data||SK.freshState();SK.validateState(state);return {state,user:u};
  }
  async function save(state){
    if(!navigator.onLine)throw new Error('Je bent offline. De wijziging is niet opgeslagen. Maak opnieuw verbinding en probeer nogmaals.');
    SK.validateState(state);const c=await connect();
    const {data,error}=await c.rpc('sport_save_state',{p_data:state,p_expected_revision:revision});
    if(error){if(error.code==='40001'||error.message?.includes('SPORT_CONFLICT')){const e=new Error('Je schema is op een ander apparaat gewijzigd. De nieuwste versie is geladen. Controleer je invoer en sla opnieuw op.');e.code='CONFLICT';throw e;}throw new Error('Opslaan mislukt: '+error.message);}
    const row=Array.isArray(data)?data[0]:data;revision=Number(row.revision);return row.data;
  }
  async function login(email,password){const c=await connect();const {error}=await c.auth.signInWithPassword({email,password});if(error)throw new Error('Inloggen is niet gelukt. Controleer je e-mailadres en wachtwoord.');return load();}
  async function logout(){if(client)await client.auth.signOut({scope:'local'});revision=0;user=null;}
  async function recover(email){const c=await connect();const {error}=await c.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});if(error)throw new Error('De aanvraag kon niet worden verstuurd. Probeer het later opnieuw.');}
  async function password(password){if(password.length<12)throw new Error('Kies een wachtwoord van minimaal 12 tekens.');const c=await connect();const {error}=await c.auth.updateUser({password});if(error)throw new Error('Wachtwoord instellen mislukt: '+error.message);}
  async function invoke(name,body){const c=await connect();const {data,error}=await c.functions.invoke(name,{body});if(error){let detail;try{detail=await error.context.json();}catch{}throw new Error(detail?.error||'Deze serverfunctie is nog niet ingesteld of kon niet worden bereikt. Controleer de installatiehandleiding.');}return data;}
  Object.assign(SK,{DB:{configured,connect,load,save,login,logout,recover,password,invoke,get user(){return user;}}});
})(globalThis.SK ||= {});
