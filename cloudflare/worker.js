// Example backend: deploy only behind a correctly configured Cloudflare Access
// policy that protects BOTH the web application and Worker endpoint.
// This Worker deliberately refuses requests unless the trusted Access identity
// header is present. Do not expose this Worker publicly or rely on the header
// alone if the backend can be reached without an Access policy.
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname!=='/api/store')return new Response('Not found',{status:404});
  if(!env.GOALS_DB)return new Response('Database not configured',{status:503});
  if(!env.ALLOWED_EMAIL)return new Response('Access policy configuration missing',{status:503});
  const email=request.headers.get('Cf-Access-Authenticated-User-Email');
  if(!email || email.toLowerCase()!==env.ALLOWED_EMAIL.toLowerCase())return new Response('Forbidden',{status:403});
  if(request.method==='GET'){
   const row=await env.GOALS_DB.prepare('SELECT payload FROM dashboard_state WHERE id = ?').bind('owner').first();
   return Response.json({store:row?JSON.parse(row.payload):null},{headers:{'Cache-Control':'no-store'}});
  }
  if(request.method==='PUT'){
   const type=request.headers.get('Content-Type')||'';
   if(!type.includes('application/json'))return new Response('Expected JSON',{status:415});
   const payload=await request.text();
   if(payload.length>1_000_000)return new Response('Backup too large',{status:413});
   let result;
   try{result=JSON.parse(payload);}catch{return new Response('Malformed JSON',{status:400});}
   const store=result?.store;
   if(store?.version!==2 || !Array.isArray(store.goals) || !Array.isArray(store.categories) || !Array.isArray(store.history))return new Response('Invalid store',{status:400});
   const contents=JSON.stringify(store);
   await env.GOALS_DB.prepare('INSERT INTO dashboard_state (id,payload,updated_at) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload, updated_at=excluded.updated_at').bind('owner',contents,new Date().toISOString()).run();
   return Response.json({ok:true});
  }
  return new Response('Method not allowed',{status:405,headers:{Allow:'GET, PUT'}});
 }
};
