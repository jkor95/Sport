'use strict';
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {Pool}=require('pg');
const pool=new Pool({connectionString:process.env.DATABASE_URL,max:5,connectionTimeoutMillis:5000});
const root=path.resolve(__dirname,'..');
const ttl=30*86400000;
const allowed=['status','login','logout','load','save','change-password','admin-list','admin-state','admin-create','admin-update','admin-password','admin-delete'];
const sha=v=>crypto.createHash('sha256').update(v).digest('hex');
const norm=v=>String(v??'').trim().toLowerCase();
const password=v=>{v=String(v??'');if(!v||v.length>200)throw err('Ongeldig wachtwoord',400);return v};
const valid=v=>{v=String(v??'').trim();if(!v||v.length>200)throw err('Ongeldige gebruikersnaam',400);return v};
const hash=p=>{const salt=crypto.randomBytes(16);return 'scrypt$'+salt.toString('hex')+'$'+crypto.scryptSync(p,salt,64).toString('hex')};
const verify=(p,h)=>{if(!h||!h.startsWith('scrypt$'))return false;const [,s,v]=h.split('$');const x=crypto.scryptSync(p,Buffer.from(s,'hex'),64);const y=Buffer.from(v,'hex');return x.length===y.length&&crypto.timingSafeEqual(x,y)};
const err=(message,status=400)=>Object.assign(new Error(message),{status});
const pub=u=>({id:u.id,username:u.username,displayName:u.display_name||u.username,role:u.role,active:u.active,createdAt:u.created_at,updatedAt:u.updated_at,lastLoginAt:u.last_login_at});
const adm=u=>({...pub(u),passwordPlain:null,lastSavedAt:u.last_saved_at||null});
async function init(){
 await pool.query(`CREATE TABLE IF NOT EXISTS sport_accounts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),username text NOT NULL,username_key text NOT NULL UNIQUE,display_name text NOT NULL,role text NOT NULL DEFAULT 'user' CHECK(role IN ('admin','user')),active boolean NOT NULL DEFAULT true,password_hash text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),last_login_at timestamptz)`);
 await pool.query(`CREATE TABLE IF NOT EXISTS sport_sessions(token_hash text PRIMARY KEY,account_id uuid NOT NULL REFERENCES sport_accounts(id) ON DELETE CASCADE,expires_at timestamptz NOT NULL)`);
 await pool.query(`CREATE TABLE IF NOT EXISTS sport_states(account_id uuid PRIMARY KEY REFERENCES sport_accounts(id) ON DELETE CASCADE,data jsonb NOT NULL,revision integer NOT NULL DEFAULT 0,updated_at timestamptz NOT NULL DEFAULT now())`);
 const username=process.env.INITIAL_ADMIN_USERNAME,passwordValue=process.env.INITIAL_ADMIN_PASSWORD;
 if(username&&passwordValue){
  const c=await pool.query('SELECT count(*)::int AS n FROM sport_accounts');
  if(c.rows[0].n===0)await pool.query("INSERT INTO sport_accounts(username,username_key,display_name,role,password_hash) VALUES($1,$2,$1,'admin',$3)",[valid(username),norm(username),hash(password(passwordValue))]);
 }
}
async function session(req,admin=false){
 const raw=req.headers['x-mijnloop-session'];
 if(!raw)throw err('Je sessie is verlopen. Log opnieuw in.',401);
 const r=await pool.query('SELECT a.* FROM sport_sessions s JOIN sport_accounts a ON a.id=s.account_id WHERE s.token_hash=$1 AND s.expires_at>now()',[sha(raw)]);
 const u=r.rows[0];if(!u||!u.active)throw err('Je sessie is verlopen. Log opnieuw in.',401);
 if(admin&&u.role!=='admin')throw err('Alleen een beheerder mag dit doen.',403);return u;
}
async function action(req,b){
 const type=String(b.action||'');
 if(!allowed.includes(type))throw err('Deze actie is nog niet ondersteund.',400);
 if(type==='status'){const r=await pool.query('SELECT count(*)::int n FROM sport_accounts');return {hasUsers:r.rows[0].n>0}}
 if(type==='login'){
  const r=await pool.query('SELECT * FROM sport_accounts WHERE username_key=$1',[norm(b.username)]);const u=r.rows[0];
  if(!u||!u.active||!verify(String(b.password||''),u.password_hash))throw err('Gebruikersnaam of wachtwoord is onjuist.',401);
  await pool.query('UPDATE sport_accounts SET last_login_at=now() WHERE id=$1',[u.id]);
  const token=crypto.randomBytes(32).toString('hex');
  await pool.query("INSERT INTO sport_sessions(token_hash,account_id,expires_at) VALUES($1,$2,now()+interval '30 days')",[sha(token),u.id]);
  return {token,user:pub({...u,last_login_at:new Date()})};
 }
 if(type==='logout'){const t=req.headers['x-mijnloop-session'];if(t)await pool.query('DELETE FROM sport_sessions WHERE token_hash=$1',[sha(t)]);return {ok:true}}
 const u=await session(req,type.startsWith('admin-'));
 if(type==='load'){const r=await pool.query('SELECT data,revision FROM sport_states WHERE account_id=$1',[u.id]);return {user:pub(u),state:r.rows[0]?.data||null,revision:r.rows[0]?.revision||0}}
 if(type==='save'){
  const expected=Number(b.revision||0);if(!Number.isSafeInteger(expected)||expected<0||typeof b.state!=='object'||b.state===null)throw err('Ongeldige gegevens');
  const r=expected===0 ? await pool.query(`INSERT INTO sport_states(account_id,data,revision) VALUES($1,$2::jsonb,1) ON CONFLICT(account_id) DO NOTHING RETURNING data,revision`,[u.id,JSON.stringify(b.state)]) : await pool.query(`UPDATE sport_states SET data=$2::jsonb,revision=revision+1,updated_at=now() WHERE account_id=$1 AND revision=$3 RETURNING data,revision`,[u.id,JSON.stringify(b.state),expected]);
  if(!r.rowCount)throw Object.assign(err('CONFLICT',409),{code:'CONFLICT'});return {state:r.rows[0].data,revision:r.rows[0].revision};
 }
 if(type==='change-password'){
  if(!verify(String(b.oldPassword||''),u.password_hash))throw err('Huidig wachtwoord is onjuist.');
  await pool.query('UPDATE sport_accounts SET password_hash=$1,updated_at=now() WHERE id=$2',[hash(password(b.newPassword)),u.id]);
  await pool.query('DELETE FROM sport_sessions WHERE account_id=$1 AND token_hash<>$2',[u.id,sha(req.headers['x-mijnloop-session'])]);return {ok:true};
 }
 if(type==='admin-list'){
  const r=await pool.query('SELECT a.*,s.updated_at last_saved_at FROM sport_accounts a LEFT JOIN sport_states s ON a.id=s.account_id ORDER BY a.created_at');
  const now=Date.now();
  return {users:r.rows.map(x=>{const last=[x.last_login_at,x.last_saved_at,x.created_at].map(v=>v&&new Date(v).getTime()).filter(Boolean);const t=Math.max(...last);return {...adm(x),lastActivityAt:new Date(t).toISOString(),inactive30Days:x.role==='user'&&x.active&&now-t>=30*86400000}})};
 }
 if(type==='admin-state'){const r=await pool.query('SELECT data FROM sport_states WHERE account_id=$1',[b.userId]);return {state:r.rows[0]?.data||null}}
 if(type==='admin-create'){
  const n=valid(b.username);try{const r=await pool.query("INSERT INTO sport_accounts(username,username_key,display_name,role,password_hash) VALUES($1,$2,$3,$4,$5) RETURNING *",[n,norm(n),String(b.displayName||n).slice(0,60),b.role==='admin'?'admin':'user',hash(password(b.password))]);return {user:adm(r.rows[0])}}catch(e){if(e.code==='23505')throw err('Deze gebruikersnaam bestaat al.');throw e}
 }
 if(type==='admin-update'){
  const target=await pool.query('SELECT * FROM sport_accounts WHERE id=$1',[b.userId]);if(!target.rowCount)throw err('Account niet gevonden.');
  const old=target.rows[0],role=b.role===undefined?old.role:(b.role==='admin'?'admin':'user'),active=b.active===undefined?old.active:!!b.active;
  if(old.role==='admin'&&(role!=='admin'||!active)){const r=await pool.query("SELECT count(*)::int n FROM sport_accounts WHERE role='admin' AND active=true AND id<>$1",[old.id]);if(!r.rows[0].n)throw err('Er moet minimaal één actieve beheerder blijven.')}
  const n=b.username===undefined?old.username:valid(b.username);
  try{const r=await pool.query('UPDATE sport_accounts SET username=$1,username_key=$2,display_name=$3,role=$4,active=$5,updated_at=now() WHERE id=$6 RETURNING *',[n,norm(n),String(b.displayName===undefined?old.display_name:b.displayName||n).slice(0,60),role,active,old.id]);if(!active)await pool.query('DELETE FROM sport_sessions WHERE account_id=$1',[old.id]);return {user:adm(r.rows[0])}}catch(e){if(e.code==='23505')throw err('Deze gebruikersnaam bestaat al.');throw e}
 }
 if(type==='admin-password'){
  const r=await pool.query('UPDATE sport_accounts SET password_hash=$1,updated_at=now() WHERE id=$2 RETURNING id',[hash(password(b.password)),b.userId]);if(!r.rowCount)throw err('Account niet gevonden.');await pool.query('DELETE FROM sport_sessions WHERE account_id=$1',[b.userId]);return {ok:true};
 }
 if(type==='admin-delete'){
  const r=await pool.query('SELECT * FROM sport_accounts WHERE id=$1',[b.userId]);if(!r.rowCount)return {ok:true};
  if(r.rows[0].role==='admin'){const n=await pool.query("SELECT count(*)::int n FROM sport_accounts WHERE role='admin' AND active=true AND id<>$1",[b.userId]);if(!n.rows[0].n)throw err('De laatste beheerder kan niet worden verwijderd.')}
  await pool.query('DELETE FROM sport_accounts WHERE id=$1',[b.userId]);return {ok:true};
 }
}
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};
function respond(res,status,obj){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(obj))}
const server=http.createServer(async(req,res)=>{
 try{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/health'){respond(res,200,{ok:true});return}
 if(url.pathname==='/functions/v1/mijnloop-sync'){
  if(req.method!=='POST'){respond(res,405,{error:'POST vereist'});return}
  let buf='';for await(const part of req){buf+=part;if(buf.length>2_000_000)throw err('Aanvraag te groot',413)}
  const body=JSON.parse(buf||'{}');const out=await action(req,body);respond(res,200,out);return;
 }
 if(req.method!=='GET'&&req.method!=='HEAD'){respond(res,405,{error:'Ongeldige methode'});return}
 const requested=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname);
 // Never expose server-side code, deployment files, or hidden paths via HTTP.
 const parts=requested.split('/').filter(Boolean);
 if(parts.some(x=>x.startsWith('.'))||['server','supabase','node_modules'].includes(parts[0])||['Dockerfile','package.json','package-lock.json'].includes(parts[0])){respond(res,404,{error:'Niet gevonden'});return}
 const p=path.resolve(root,'.'+requested);
 if(!p.startsWith(root+path.sep)||!fs.existsSync(p)||!fs.statSync(p).isFile()){respond(res,404,{error:'Niet gevonden'});return}
 res.writeHead(200,{'Content-Type':types[path.extname(p)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':p.endsWith('config.js')?'no-store':'public, max-age=60'});if(req.method==='HEAD')res.end();else fs.createReadStream(p).pipe(res);
 }catch(e){if(e instanceof SyntaxError){respond(res,400,{error:'Ongeldige JSON'});return}if(e.code==='23505'){respond(res,409,{error:'Bestaat al'});return}if(e.status){respond(res,e.status,{error:e.message,code:e.code});return}console.error(e);respond(res,500,{error:'Interne serverfout'})}
});
init().then(()=>server.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('Sport backend ready'))).catch(e=>{console.error(e);process.exit(1)});
