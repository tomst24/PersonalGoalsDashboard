import type { Store } from './model';

// Optional: configure a protected same-origin or Cloudflare Access-backed API.
// Never put permanent API tokens in a VITE_ variable: browser bundles are public.
export const CLOUD_API = (import.meta.env.VITE_GOALS_API_URL as string | undefined || '').replace(/\/$/, '');

export async function readCloud(): Promise<unknown> {
  const response = await fetch(`${CLOUD_API}/api/store`, { credentials: 'include', cache: 'no-store' });
  if (!response.ok) throw new Error(`Could not read cloud storage (HTTP ${response.status})`);
  const result = await response.json() as {store:unknown};
  return result.store;
}
export async function writeCloud(store:Store):Promise<void> {
  const response = await fetch(`${CLOUD_API}/api/store`, {
    method:'PUT',credentials:'include',headers:{'content-type':'application/json'},
    body: JSON.stringify({store})
  });
  if (!response.ok) throw new Error(`Could not save to cloud (HTTP ${response.status})`);
}
