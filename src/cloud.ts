import type { Store } from './model';

// Browser variables must never contain credentials. Cloudflare Access provides
// a signed login token for the same-origin API.
export const CLOUD_API = import.meta.env.VITE_GOALS_CLOUD_ENABLED === 'true'
 ? 'same-origin' : (import.meta.env.VITE_GOALS_API_URL as string | undefined || '').replace(/\/$/,'');
const base=CLOUD_API==='same-origin'?'':CLOUD_API;
export type CloudSnapshot={store:unknown;revision:number};
function revisionOf(value:unknown):number{
 if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0)throw Error('Invalid cloud revision');
 return value;
}
export async function readCloud():Promise<CloudSnapshot>{
 const response=await fetch(base+'/api/store',{credentials:'same-origin',cache:'no-store'});
 if(!response.ok)throw Error('Cloud read failed (HTTP '+response.status+')');
 const value:unknown=await response.json();
 if(!value||typeof value!=='object'||!('store' in value)||!('revision' in value))
  throw Error('Unexpected cloud response');
 return {store:(value as CloudSnapshot).store,revision:revisionOf((value as CloudSnapshot).revision)};
}
export async function writeCloud(store:Store,expectedRevision:number):Promise<number>{
 const response=await fetch(base+'/api/store',{
  method:'PUT',credentials:'same-origin',cache:'no-store',
  headers:{'Content-Type':'application/json'},
  body:JSON.stringify({store,expectedRevision})
 });
 if(response.status===409)throw Error('Another device changed the goals. Export your local JSON backup before reloading.');
 if(!response.ok)throw Error('Cloud save failed (HTTP '+response.status+')');
 const value:unknown=await response.json();
 if(!value||typeof value!=='object'||!('revision' in value))
  throw Error('Save did not include a revision confirmation');
 return revisionOf((value as {revision:unknown}).revision);
}
