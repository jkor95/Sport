export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new HttpError(503, 'Serverconfiguratie ontbreekt. Controleer de installatiehandleiding.');
  return value;
}
export function cors(): HeadersInit {
  return {'Access-Control-Allow-Origin':Deno.env.get('APP_ORIGIN')||'https://invalid.invalid',
    'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods':'POST, OPTIONS', 'Vary':'Origin'};
}
export function json(body: unknown, status=200): Response {
  return new Response(JSON.stringify(body), {status,headers:{...cors(),'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
}
export function preflight(req: Request): Response | null {
  const origin=req.headers.get('Origin');
  if(origin && origin !== env('APP_ORIGIN')) throw new HttpError(403,'Deze website is niet toegelaten.');
  if(req.method==='OPTIONS') return new Response(null,{status:204,headers:cors()});
  if(req.method!=='POST') throw new HttpError(405,'Alleen POST is toegestaan.');
  return null;
}
export async function bodyJSON(req:Request,max=8192):Promise<Record<string,unknown>> {
  if(Number(req.headers.get('content-length')||0)>max) throw new HttpError(413,'Verzoek te groot.');
  // Read with a bound even if Content-Length is absent or inaccurate.
  const reader=req.body?.getReader();if(!reader)throw new HttpError(400,'Verzoek ontbreekt.');
  let n=0;const parts:Uint8Array[]=[];
  while(true){const {done,value}=await reader.read();if(done)break;n+=value.length;if(n>max){await reader.cancel();throw new HttpError(413,'Verzoek te groot.');}parts.push(value);}
  const bytes=new Uint8Array(n);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}
  try{const data=JSON.parse(new TextDecoder().decode(bytes));if(!data||Array.isArray(data)||typeof data!=='object')throw new Error();return data;}
  catch{throw new HttpError(400,'Ongeldige JSON.');}
}
export async function adminRest(path: string, options: RequestInit = {}): Promise<any> {
  const key=env('SUPABASE_SERVICE_ROLE_KEY');
  const res=await fetch(env('SUPABASE_URL')+'/rest/v1/'+path,{...options,headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(15000)});
  if(!res.ok)throw new HttpError(503,'Databasebewerking mislukt. Controleer de serverinstallatie.');
  const text=await res.text();return text?JSON.parse(text):null;
}
export async function authenticate(req:Request):Promise<{id:string;token:string}> {
  const header=req.headers.get('Authorization')||'';if(!/^Bearer [A-Za-z0-9._-]+$/.test(header))throw new HttpError(401,'Log eerst in.');
  const token=header.slice(7);
  const res=await fetch(env('SUPABASE_URL')+'/auth/v1/user',{headers:{apikey:env('SUPABASE_ANON_KEY'),Authorization:header},signal:AbortSignal.timeout(10000)});
  if(!res.ok)throw new HttpError(401,'Je sessie is verlopen. Log opnieuw in.');
  const user=await res.json();if(!user.id||user.is_anonymous||!/^[a-f0-9-]{36}$/.test(user.id))throw new HttpError(401,'Geen geldig persoonlijk account.');
  return {id:user.id,token};
}
export async function ownState(user:{id:string;token:string}):Promise<any> {
  // The authenticated user's JWT is used here: RLS still applies.
  const res=await fetch(env('SUPABASE_URL')+'/rest/v1/sport_states?user_id=eq.'+user.id+'&select=data',{headers:{apikey:env('SUPABASE_ANON_KEY'),Authorization:'Bearer '+user.token},signal:AbortSignal.timeout(15000)});
  if(!res.ok)throw new HttpError(403,'Gegevens niet toegankelijk.');
  const rows=await res.json();if(!rows[0]?.data?.profile)throw new HttpError(400,'Maak eerst je persoonlijke schema.');return rows[0].data;
}
export async function sha256(value:string):Promise<string> {
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
export function failure(error:unknown):Response {
  if(error instanceof HttpError)return json({error:error.message},error.status);
  // Never return or log tokens, complete requests, profiles, keys, or model errors.
  return json({error:'Serverfout. Probeer later opnieuw of controleer de serverconfiguratie.'},500);
}
