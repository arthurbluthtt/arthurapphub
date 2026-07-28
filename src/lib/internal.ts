function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function readJsonBody<T>(request: Request): Promise<T | null> {
  const ct = request.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    try {
      return (await request.json()) as T;
    } catch {
      return null;
    }
  }
  try {
    const text = await request.text();
    if (!text) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export function verifyInternal(request: Request, secret: string): boolean {
  const header = request.headers.get('authorization') || '';
  const prefix = 'Bearer ';
  if (!header.startsWith(prefix)) return false;
  const token = header.substring(prefix.length).trim();
  if (!token) return false;
  return constantTimeEqual(token, secret);
}

export function internalError(message: string, status = 401): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function jsonOk(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}