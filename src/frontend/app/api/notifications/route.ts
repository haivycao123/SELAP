const BACKEND_API_URL =
  process.env.BACKEND_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function proxy(request: Request) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const authorization = request.headers.get('Authorization');
  if (authorization) headers.Authorization = authorization;
  const response = await fetch(`${BACKEND_API_URL}/notifications`, { headers, method: request.method });
  return new Response(await response.text(), {
    headers: { 'Content-Type': response.headers.get('Content-Type') ?? 'application/json' },
    status: response.status,
  });
}

export function GET(request: Request) {
  return proxy(request);
}
