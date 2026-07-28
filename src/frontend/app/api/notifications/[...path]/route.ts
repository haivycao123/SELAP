const BACKEND_API_URL =
  process.env.BACKEND_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type RouteContext = { params: Promise<{ path: string[] }> };

export async function PATCH(request: Request, context: RouteContext) {
  const { path } = await context.params;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const authorization = request.headers.get('Authorization');
  if (authorization) headers.Authorization = authorization;
  const response = await fetch(`${BACKEND_API_URL}/notifications/${path.join('/')}`, {
    headers,
    method: 'PATCH',
  });
  return new Response(await response.text(), {
    headers: { 'Content-Type': response.headers.get('Content-Type') ?? 'application/json' },
    status: response.status,
  });
}
