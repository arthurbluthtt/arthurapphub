import type { APIRoute } from 'astro';
import data from '../../data/apps.json';

export const prerender = false;

interface App {
  id: string;
  url: string;
}

interface Result {
  id: string;
  ok: boolean;
  status: number;
  ms: number;
}

export const GET: APIRoute = async () => {
  const list = (data.apps ?? []) as App[];
  const results: Result[] = await Promise.all(
    list.map(async (app) => {
      const t0 = Date.now();
      try {
        const r = await fetch(app.url, {
          method: 'HEAD',
          redirect: 'follow',
          signal: AbortSignal.timeout(5000),
        });
        return { id: app.id, ok: r.ok, status: r.status, ms: Date.now() - t0 };
      } catch {
        return { id: app.id, ok: false, status: 0, ms: Date.now() - t0 };
      }
    })
  );
  return new Response(JSON.stringify({ results, ts: Date.now() }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300',
      'Access-Control-Allow-Origin': '*',
    },
  });
};
