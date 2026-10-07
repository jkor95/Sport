/** Parse/load Edge modules and check unauthenticated guards with mocked Deno.
 * No network, credentials or real Supabase are involved. Not a live RLS test.
 * Run: node --experimental-transform-types tools/test_edge_smoke.mjs
 */
import assert from 'node:assert/strict';
let handler;
globalThis.Deno={
  env:{get:(name)=>name==='APP_ORIGIN'?'https://example.github.io':undefined},
  serve:(fn)=>{handler=fn;}
};
globalThis.fetch=async()=>{throw new Error('Unexpected network request during guard test');};
const origin='https://example.github.io';
for(const name of ['calendar-link','strava']){
  await import('../supabase/functions/'+name+'/index.ts');
  let r=await handler(new Request('https://project.supabase.co/functions/v1/'+name,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'}));
  assert.equal(r.status,401,name+' rejects missing user JWT');
  r=await handler(new Request('https://project.supabase.co/functions/v1/'+name,{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:'{}'}));
  assert.equal(r.status,403,name+' rejects unexpected browser origin');
  r=await handler(new Request('https://project.supabase.co/functions/v1/'+name,{method:'OPTIONS',headers:{Origin:origin}}));
  assert.equal(r.status,204,name+' allows expected preflight');
  console.log(name+': module load and 3 guard checks passed (mocked runtime).');
}
await import('../supabase/functions/calendar-feed/index.ts');
for(const query of ['', '?token=invalid']){
  const r=await handler(new Request('https://project.supabase.co/functions/v1/calendar-feed'+query));
  assert.equal(r.status,404,'feed rejects malformed or missing token');
}
const post=await handler(new Request('https://project.supabase.co/functions/v1/calendar-feed',{method:'POST'}));
assert.equal(post.status,405);
console.log('calendar-feed: module load and 3 guard checks passed (mocked runtime).');
