const BACKEND_API_URL =
  process.env.BACKEND_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:3001";

type RouteContext = {
  params: Promise<{
    path: string[];
  }>;
};

async function proxy(request: Request, context: RouteContext) {
  const { path } = await context.params;
  const url = new URL(request.url);
  const backendUrl = new URL(`${BACKEND_API_URL}/leads/${path.join("/")}`);
  backendUrl.search = url.search;

  const headers: Record<string, string> = {};
  const contentType = request.headers.get("Content-Type");
  const authorization = request.headers.get("Authorization");

  if (contentType) {
    headers["Content-Type"] = contentType;
  }

  if (authorization) {
    headers.Authorization = authorization;
  }

  const backendResponse = await fetch(backendUrl, {
    body: request.method === "GET" ? undefined : await request.arrayBuffer(),
    headers,
    method: request.method,
  });

  return new Response(await backendResponse.text(), {
    headers: {
      "Content-Type":
        backendResponse.headers.get("Content-Type") ?? "application/json",
    },
    status: backendResponse.status,
  });
}

export function GET(request: Request, context: RouteContext) {
  return proxy(request, context);
}

export function POST(request: Request, context: RouteContext) {
  return proxy(request, context);
}

export function PATCH(request: Request, context: RouteContext) {
  return proxy(request, context);
}

export function DELETE(request: Request, context: RouteContext) {
  return proxy(request, context);
}