import { createRemoteJWKSet, jwtVerify } from 'jose';

// Single-user D1 API. JWT verification protects data even if an alternate
// Worker hostname accidentally bypasses Cloudflare Access.
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const json=(body,status=200)=>Response.json(body,{status,headers});
const problem=(message,status)=>json({error:message},status);
const jwksByIssuer=new Map();

async function authorized(request,env){
 const team=(env.ACCESS_TEAM_DOMAIN||'').replace(/^https?:\/\//,'').replace(/\.cloudflareaccess\.com$/,'').replace(/\/$/,'');
 if(!/^[a-z0-9-]+$/i.test(team))throw Error('Invalid team domain');
 const issuer='https://'+team+'.cloudflareaccess.com';
 if(!jwksByIssuer.has(issuer)){
  jwksByIssuer.set(issuer,createRemoteJWKSet(new URL(issuer+'/cdn-cgi/access/certs')));
 }
 const assertion=request.headers.get('Cf-Access-Jwt-Assertion');
 if(!assertion)return false;
 try{
  const verified=await jwtVerify(assertion,jwksByIssuer.get(issuer),{
   issuer,audience:env.ACCESS_AUD,algorithms:['RS256']
  });
  return typeof verified.payload.email==='string' &&
   verified.payload.email.toLowerCase()===env.ALLOWED_EMAIL.trim().toLowerCase();
 }catch{return false;}
}
function validStore(store){
 return store && typeof store==='object' && store.version===2 &&
  Array.isArray(store.goals)&&store.goals.length<=2000 &&
  Array.isArray(store.categories)&&store.categories.length<=150 &&
  Array.isArray(store.history)&&store.history.length<=10000;
}
export default {
 async fetch(request,env){
  const path=new URL(request.url).pathname;
  if(path!=='/api/store')return problem('Not found',404);
  if(!env.GOALS_DB)return problem('Database binding not configured',503);
  if(!env.ACCESS_AUD||!env.ACCESS_TEAM_DOMAIN||!env.ALLOWED_EMAIL)
   return problem('Access configuration missing',503);
  let permitted;
  try{permitted=await authorized(request,env);}
  catch{return problem('Invalid Access configuration',503);}
  if(!permitted)return problem('Access denied',403);

  if(request.method==='GET'){
   const row=await env.GOALS_DB.prepare('SELECT payload, revision FROM dashboard_state WHERE id=?').bind('owner').first();
   return json({store:row?JSON.parse(row.payload):null,revision:row?row.revision:0});
  }
  if(request.method!=='PUT')return new Response('Method not allowed',{status:405,headers:{...headers,Allow:'GET, PUT'}});
  if(!(request.headers.get('Content-Type')||'').includes('application/json'))
   return problem('Expected JSON',415);
  if(Number(request.headers.get('Content-Length')||'0')>1000000)
   return problem('Payload too large',413);
  let input;
  try{
   const body=await request.text();
   if(body.length>1000000)return problem('Payload too large',413);
   input=JSON.parse(body);
  }catch{return problem('Malformed JSON',400);}
  const {store,expectedRevision}=input||{};
  if(!validStore(store)||!Number.isSafeInteger(expectedRevision)||expectedRevision<0)
   return problem('Invalid goals data or revision',400);
  const payload=JSON.stringify(store),now=new Date().toISOString();
  let result;
  if(expectedRevision===0){
   result=await env.GOALS_DB.prepare(
    'INSERT INTO dashboard_state (id,payload,revision,updated_at) VALUES (?,?,1,?) ON CONFLICT(id) DO NOTHING'
   ).bind('owner',payload,now).run();
  }else{
   result=await env.GOALS_DB.prepare(
    'UPDATE dashboard_state SET payload=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?'
   ).bind(payload,now,'owner',expectedRevision).run();
  }
  if((result?.meta?.changes??0)!==1)
   return problem('Another device has newer changes; refresh before saving',409);
  return json({ok:true,revision:expectedRevision+1});
 }
};
