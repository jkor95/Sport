(function(SK){
  'use strict';
  let user=null,revision=0;
  const Auth=globalThis.MijnLoopLocalAuth;
  const configured=()=>!!Auth;
  async function connect(){if(!Auth)throw new Error('Lokale accountmodule ontbreekt.');return {local:true};}
  async function checkedUser(){const u=Auth.currentUser();if(!u)throw new Error('Je lokale sessie is verlopen. Log opnieuw in.');user=u;return u;}
  async function load(){const u=await checkedUser();let state=Auth.readState(u.id)||SK.freshState();SK.validateState(state);revision=Number(state.__localRevision||0);if('__localRevision'in state){state=structuredClone(state);delete state.__localRevision;}return {state,user:u};}
  async function save(state){SK.validateState(state);const u=await checkedUser();const stored=structuredClone(state);revision+=1;stored.__localRevision=revision;Auth.writeState(u.id,stored);return state;}
  async function login(username,password){user=await Auth.login(username,password);return load();}
  async function logout(){Auth.logout();revision=0;user=null;}
  async function password(oldPassword,newPassword){return Auth.changeOwnPassword(oldPassword,newPassword);}
  async function invoke(name,body){
    const cred=Auth.integrationCredentials();
    if(!cred)throw new Error('Log eerst lokaal in.');
    if(!SPORT_CONFIG?.supabaseUrl||!SPORT_CONFIG?.supabasePublishableKey)throw new Error('De optionele Supabase-koppeling is niet ingesteld.');
    const res=await fetch(`${SPORT_CONFIG.supabaseUrl}/functions/v1/${encodeURIComponent(name)}`,{method:'POST',headers:{'Content-Type':'application/json','apikey':SPORT_CONFIG.supabasePublishableKey,'X-Local-Account':cred.accountId,'X-Local-Secret':cred.secret},body:JSON.stringify(body||{})});
    let data=null;try{data=await res.json();}catch{}
    if(!res.ok)throw new Error(data?.error||'Deze optionele serverfunctie is niet ingesteld of kon niet worden bereikt.');return data;
  }
  Object.assign(SK,{DB:{configured,connect,load,save,login,logout,password,invoke,get user(){return user||Auth?.currentUser()||null;}}});
})(globalThis.SK ||= {});
