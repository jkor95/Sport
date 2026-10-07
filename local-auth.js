(function(global){
  'use strict';
  const USER_SESSION='mijnloop-remote-session-v1';
  const ADMIN_SESSION='mijnloop-remote-admin-session-v1';
  const OLD_USERS='mijnloop-local-users-v1';
  const OLD_STATE='mijnloop-local-state-v1:';
  let hasUsersCache=true;
  const cfg=()=>global.SPORT_CONFIG||{};
  const endpoint=()=>`${cfg().supabaseUrl}/functions/v1/mijnloop-sync`;
  function read(storage,key,fallback=null){try{return JSON.parse(storage.getItem(key)||'null')??fallback;}catch{return fallback;}}
  function write(storage,key,value){storage.setItem(key,JSON.stringify(value));}
  function validateUsername(v){const s=String(v??'').trim();if(!s)throw new Error('Vul een gebruikersnaam in.');if(s.length>200)throw new Error('Gebruikersnaam is te lang.');return s;}
  function validatePassword(v){const s=String(v??'');if(!s)throw new Error('Vul een wachtwoord in.');if(s.length>200)throw new Error('Wachtwoord is te lang.');return s;}
  async function api(action,body={},admin=false){
    if(!cfg().supabaseUrl||!cfg().supabasePublishableKey)throw new Error('Online synchronisatie is niet ingesteld.');
    const s=read(admin?sessionStorage:localStorage,admin?ADMIN_SESSION:USER_SESSION,null);
    const headers={'Content-Type':'application/json','apikey':cfg().supabasePublishableKey};
    if(s?.token)headers['x-mijnloop-session']=s.token;
    const res=await fetch(endpoint(),{method:'POST',headers,body:JSON.stringify({action,...body})});
    let data={};try{data=await res.json();}catch{}
    if(!res.ok){const e=new Error(data.error||'Online synchronisatie kon niet worden bereikt.');if(data.code)e.code=data.code;if(res.status===401){if(admin)sessionStorage.removeItem(ADMIN_SESSION);else localStorage.removeItem(USER_SESSION);}throw e;}
    return data;
  }
  function oldBundle(){
    const users=read(localStorage,OLD_USERS,[]);if(!Array.isArray(users)||!users.length)return null;
    const states={};for(const u of users){const s=read(localStorage,OLD_STATE+u.id,null);if(s){const c=structuredClone(s);delete c.__localRevision;states[u.id]=c;}}
    const valid=users.filter(u=>u?.id&&u?.username&&typeof u.passwordPlain==='string'&&u.passwordPlain.length);
    return valid.length===users.length?{users,states}:null;
  }
  async function connect(){
    const status=await api('status');hasUsersCache=!!status.hasUsers;
    if(!hasUsersCache){const bundle=oldBundle();if(bundle){const r=await api('migrate-local',bundle);if(r.migrated){hasUsersCache=true;for(const u of bundle.users)localStorage.removeItem(OLD_STATE+u.id);localStorage.removeItem(OLD_USERS);}}}
    return {online:true,hasUsers:hasUsersCache};
  }
  function hasUsers(){return hasUsersCache;}
  function currentUser(){return read(localStorage,USER_SESSION,null)?.user||null;}
  function currentAdmin(){const admin=read(sessionStorage,ADMIN_SESSION,null);if(admin?.user?.role==='admin')return admin.user;const userSession=read(localStorage,USER_SESSION,null);if(userSession?.user?.role==='admin'){write(sessionStorage,ADMIN_SESSION,userSession);return userSession.user;}return null;}
  async function bootstrapAdmin({username,password,displayName=''}){username=validateUsername(username);password=validatePassword(password);const r=await api('bootstrap',{username,password,displayName});hasUsersCache=true;return r.user;}
  async function login(username,password){username=validateUsername(username);password=validatePassword(password);const r=await api('login',{username,password});write(localStorage,USER_SESSION,r);if(r?.user?.role==='admin')write(sessionStorage,ADMIN_SESSION,r);else sessionStorage.removeItem(ADMIN_SESSION);return r.user;}
  async function logout(){try{await api('logout');}catch{}localStorage.removeItem(USER_SESSION);}
  async function adminLogout(){try{await api('logout',{},true);}catch{}sessionStorage.removeItem(ADMIN_SESSION);const userSession=read(localStorage,USER_SESSION,null);if(userSession?.user?.role==='admin')localStorage.removeItem(USER_SESSION);}
  async function listUsers(){const r=await api('admin-list',{},true);return r.users||[];}
  async function adminState(userId){const r=await api('admin-state',{userId},true);return r.state||null;}
  async function createUser({username,password,displayName='',role='user'}){username=validateUsername(username);password=validatePassword(password);const r=await api('admin-create',{username,password,displayName,role},true);hasUsersCache=true;return r.user;}
  async function updateUser(userId,patch={}){const r=await api('admin-update',{userId,...patch},true);return r.user;}
  async function setPassword(userId,password){password=validatePassword(password);await api('admin-password',{userId,password},true);return true;}
  async function deleteUser(userId){await api('admin-delete',{userId},true);}
  async function changeOwnPassword(oldPassword,newPassword){newPassword=validatePassword(newPassword);await api('change-password',{oldPassword:String(oldPassword??''),newPassword});return true;}
  async function loadState(){return api('load');}
  async function saveState(state,revision){return api('save',{state,revision});}
  function generatePassword(length=6){const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789',bytes=crypto.getRandomValues(new Uint8Array(length));return [...bytes].map(b=>alphabet[b%alphabet.length]).join('');}
  global.MijnLoopLocalAuth={connect,hasUsers,bootstrapAdmin,login,logout,currentUser,adminLogout,currentAdmin,listUsers,adminState,createUser,updateUser,setPassword,deleteUser,changeOwnPassword,loadState,saveState,generatePassword};
})(globalThis);
