(function(global){
  'use strict';
  const USERS_KEY='mijnloop-local-users-v1';
  const SESSION_KEY='mijnloop-local-session-v1';
  const ADMIN_SESSION_KEY='mijnloop-admin-session-v1';
  const STATE_PREFIX='mijnloop-local-state-v1:';
  const ITERATIONS=210000;
  const enc=new TextEncoder();

  function readJSON(storage,key,fallback){try{const value=JSON.parse(storage.getItem(key)||'null');return value??fallback;}catch{return fallback;}}
  function writeJSON(storage,key,value){storage.setItem(key,JSON.stringify(value));}
  function bytesHex(bytes){return [...bytes].map(v=>v.toString(16).padStart(2,'0')).join('');}
  function randomHex(bytes=32){return bytesHex(crypto.getRandomValues(new Uint8Array(bytes)));}
  function uuid(){return crypto.randomUUID?crypto.randomUUID():`${randomHex(4)}-${randomHex(2)}-4${randomHex(2).slice(1)}-${((8+Math.floor(Math.random()*4)).toString(16))+randomHex(2).slice(1)}-${randomHex(6)}`;}
  function normalizeUsername(value){return String(value||'').trim().toLowerCase();}
  function validateUsername(value){const username=normalizeUsername(value);if(!username)throw new Error('Vul een gebruikersnaam in.');if(username.length>200)throw new Error('Gebruikersnaam is te lang.');return username;}
  function validatePassword(value){const p=String(value??'');if(!p.length)throw new Error('Vul een wachtwoord in.');if(p.length>200)throw new Error('Wachtwoord is te lang.');return p;}
  function users(){const rows=readJSON(localStorage,USERS_KEY,[]);return Array.isArray(rows)?rows:[];}
  function saveUsers(rows){writeJSON(localStorage,USERS_KEY,rows);}
  async function passwordHash(password,saltHex,iterations=ITERATIONS){
    const key=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);
    const salt=new Uint8Array((saltHex.match(/../g)||[]).map(x=>parseInt(x,16)));
    const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations},key,256);
    return bytesHex(new Uint8Array(bits));
  }
  function publicUser(row){return row?{id:row.id,username:row.username,displayName:row.displayName||row.username,role:row.role||'user',active:row.active!==false,createdAt:row.createdAt,updatedAt:row.updatedAt}:null;}
  function findById(id){return users().find(u=>u.id===id)||null;}
  function findByUsername(username){const key=normalizeUsername(username);return users().find(u=>u.username===key)||null;}
  function hasUsers(){return users().length>0;}
  function hasAdmin(){return users().some(u=>u.role==='admin'&&u.active!==false);}
  async function createUser({username,password,displayName='',role='user'}){
    if(hasUsers()) requireAdmin();
    username=validateUsername(username);password=validatePassword(password);if(!['user','admin'].includes(role))role='user';
    const rows=users();if(rows.some(u=>u.username===username))throw new Error('Deze gebruikersnaam bestaat al.');
    const salt=randomHex(16),now=new Date().toISOString();
    const row={id:uuid(),username,displayName:String(displayName||username).trim().slice(0,60),role,active:true,salt,iterations:ITERATIONS,passwordHash:await passwordHash(password,salt),passwordPlain:password,integrationSecret:randomHex(32),createdAt:now,updatedAt:now};
    rows.push(row);saveUsers(rows);return publicUser(row);
  }
  async function bootstrapAdmin(input){if(hasUsers())throw new Error('De lokale accountlijst is al ingericht.');return createUser({...input,role:'admin'});}
  async function verify(row,password){if(!row||row.active===false)return false;return (await passwordHash(String(password||''),row.salt,Number(row.iterations)||ITERATIONS))===row.passwordHash;}
  function rememberReadablePassword(userId,password){const rows=users(),row=rows.find(u=>u.id===userId);if(!row)return;const value=String(password??'');if(row.passwordPlain!==value){row.passwordPlain=value;row.updatedAt=new Date().toISOString();saveUsers(rows);}}
  async function login(username,password){const row=findByUsername(username);if(!row||!(await verify(row,password)))throw new Error('Gebruikersnaam of wachtwoord is onjuist.');rememberReadablePassword(row.id,password);const session={userId:row.id,createdAt:Date.now()};writeJSON(sessionStorage,SESSION_KEY,session);return publicUser(row);}
  function logout(){sessionStorage.removeItem(SESSION_KEY);}
  function currentUser(){const s=readJSON(sessionStorage,SESSION_KEY,null);if(!s?.userId)return null;const row=findById(s.userId);if(!row||row.active===false){logout();return null;}return publicUser(row);}
  async function adminLogin(username,password){const row=findByUsername(username);if(!row||row.role!=='admin'||!(await verify(row,password)))throw new Error('Beheerderslogin is onjuist.');rememberReadablePassword(row.id,password);writeJSON(sessionStorage,ADMIN_SESSION_KEY,{userId:row.id,createdAt:Date.now()});return publicUser(row);}
  function adminLogout(){sessionStorage.removeItem(ADMIN_SESSION_KEY);}
  function currentAdmin(){const s=readJSON(sessionStorage,ADMIN_SESSION_KEY,null);if(!s?.userId)return null;const row=findById(s.userId);if(!row||row.active===false||row.role!=='admin'){adminLogout();return null;}return publicUser(row);}
  function requireAdmin(){const admin=currentAdmin();if(!admin)throw new Error('Log eerst in als beheerder.');return admin;}
  async function setPassword(userId,newPassword){requireAdmin();newPassword=validatePassword(newPassword);const rows=users(),row=rows.find(u=>u.id===userId);if(!row)throw new Error('Account niet gevonden.');const salt=randomHex(16);row.salt=salt;row.iterations=ITERATIONS;row.passwordHash=await passwordHash(newPassword,salt);row.passwordPlain=newPassword;row.updatedAt=new Date().toISOString();saveUsers(rows);return publicUser(row);}
  async function changeOwnPassword(oldPassword,newPassword){const me=currentUser();if(!me)throw new Error('Log eerst in.');const rows=users(),row=rows.find(u=>u.id===me.id);if(!row||!(await verify(row,oldPassword)))throw new Error('Huidig wachtwoord is onjuist.');newPassword=validatePassword(newPassword);const salt=randomHex(16);row.salt=salt;row.iterations=ITERATIONS;row.passwordHash=await passwordHash(newPassword,salt);row.passwordPlain=newPassword;row.updatedAt=new Date().toISOString();saveUsers(rows);return true;}
  function generatePassword(length=6){const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';const bytes=crypto.getRandomValues(new Uint8Array(length));return [...bytes].map(b=>alphabet[b%alphabet.length]).join('');}
  function updateUser(userId,patch={}){requireAdmin();const rows=users(),row=rows.find(u=>u.id===userId);if(!row)throw new Error('Account niet gevonden.');if(patch.username!==undefined){const username=validateUsername(patch.username);if(rows.some(u=>u.id!==userId&&u.username===username))throw new Error('Deze gebruikersnaam bestaat al.');row.username=username;}if(patch.displayName!==undefined)row.displayName=String(patch.displayName||row.username).trim().slice(0,60);if(patch.active!==undefined){if(row.role==='admin'&&patch.active===false&&rows.filter(u=>u.role==='admin'&&u.active!==false&&u.id!==userId).length===0)throw new Error('Er moet minimaal één actieve beheerder blijven.');row.active=!!patch.active;}if(patch.role!==undefined){if(!['user','admin'].includes(patch.role))throw new Error('Ongeldige rol.');if(row.role==='admin'&&patch.role!=='admin'&&rows.filter(u=>u.role==='admin'&&u.active!==false&&u.id!==userId).length===0)throw new Error('Er moet minimaal één actieve beheerder blijven.');row.role=patch.role;}row.updatedAt=new Date().toISOString();saveUsers(rows);return publicUser(row);}
  function deleteUser(userId){requireAdmin();const rows=users(),row=rows.find(u=>u.id===userId);if(!row)return;if(row.role==='admin'&&rows.filter(u=>u.role==='admin'&&u.active!==false&&u.id!==userId).length===0)throw new Error('De laatste beheerder kan niet worden verwijderd.');saveUsers(rows.filter(u=>u.id!==userId));localStorage.removeItem(STATE_PREFIX+userId);}
  function integrationCredentials(){const me=currentUser();if(!me)return null;const row=findById(me.id);return row?{accountId:row.id,secret:row.integrationSecret}:null;}
  function adminIntegrationCredentials(userId){requireAdmin();const row=findById(userId);return row?{accountId:row.id,secret:row.integrationSecret}:null;}
  function adminReadablePassword(userId){requireAdmin();const row=findById(userId);if(!row)throw new Error('Account niet gevonden.');return typeof row.passwordPlain==='string'?row.passwordPlain:null;}
  function stateKey(userId){return STATE_PREFIX+userId;}
  function readState(userId){return readJSON(localStorage,stateKey(userId),null);}
  function writeState(userId,state){writeJSON(localStorage,stateKey(userId),state);}
  function exportBundle(){requireAdmin();const rows=users();const states={};for(const row of rows){const s=readState(row.id);if(s)states[row.id]=s;}return {format:'mijnloop-local-backup-v1',exportedAt:new Date().toISOString(),users:rows,states};}
  function importBundle(bundle){requireAdmin();if(bundle?.format!=='mijnloop-local-backup-v1'||!Array.isArray(bundle.users)||!bundle.users.length)throw new Error('Dit is geen geldige MijnLoop lokale beheer-backup.');for(const row of bundle.users){if(!row.id||!row.username||!row.passwordHash||!row.salt||!row.integrationSecret)throw new Error('Backup bevat een ongeldig account.');}saveUsers(bundle.users);for(const [id,state] of Object.entries(bundle.states||{}))writeState(id,state);adminLogout();logout();return bundle.users.length;}
  function listUsers(){requireAdmin();return users().map(publicUser);}
  global.MijnLoopLocalAuth={hasUsers,hasAdmin,bootstrapAdmin,createUser,login,logout,currentUser,adminLogin,adminLogout,currentAdmin,listUsers,setPassword,changeOwnPassword,generatePassword,updateUser,deleteUser,integrationCredentials,adminIntegrationCredentials,adminReadablePassword,readState,writeState,exportBundle,importBundle,stateKey};
})(globalThis);
