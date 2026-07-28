const BACKEND_API_URL =
  process.env.BACKEND_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function proxy(request: Request) {
  const backendResponse = await fetch(`${BACKEND_API_URL}/favorites`, {
    headers: forwardHeaders(request),
    method: request.method,
  });
  return responseFrom(backendResponse);
}

function forwardHeaders(request: Request) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const authorization = request.headers.get('Authorization');
  if (authorization) headers.Authorization = authorization;
  return headers;
}

async function responseFrom(response: Response) {
  return new Response(await response.text(), {
    headers: { 'Content-Type': response.headers.get('Content-Type') ?? 'application/json' },
    status: response.status,
  });
}

export function GET(request: Request) {
  return proxy(request);
}
