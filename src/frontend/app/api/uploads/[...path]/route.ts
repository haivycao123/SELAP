const BACKEND_API_URL =
  process.env.BACKEND_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:3001";

type RouteContext = {
  params: Promise<{
    path: string[];
  }>;
};

async function proxyUpload(request: Request, context: RouteContext) {
  const { path } = await context.params;
  const requestUrl = new URL(request.url);
  const uploadPath = path.map(encodeURIComponent).join("/");
  const backendUrl = new URL(`${BACKEND_API_URL}/uploads/${uploadPath}`);
  backendUrl.search = requestUrl.search;

  const backendResponse = await fetch(backendUrl, {
    method: request.method
  });

  const headers = new Headers();

  [
    "Cache-Control",
    "Content-Length",
    "Content-Type",
    "ETag",
    "Last-Modified"
  ].forEach((name) => {
    const value = backendResponse.headers.get(name);
    if (value) {
      headers.set(name, value);
    }
  });

  return new Response(backendResponse.body, {
    headers,
    status: backendResponse.status,
    statusText: backendResponse.statusText
  });
}

export function GET(request: Request, context: RouteContext) {
  return proxyUpload(request, context);
}

export function HEAD(request: Request, context: RouteContext) {
  return proxyUpload(request, context);
}
