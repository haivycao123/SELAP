const BACKEND_API_URL =
  process.env.BACKEND_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:3001";

type RouteContext = {
  params: Promise<{
    path: string[];
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { path } = await context.params;
  const backendResponse = await fetch(`${BACKEND_API_URL}/auth/${path.join("/")}`, {
    body: await request.text(),
    headers: {
      "Content-Type": request.headers.get("Content-Type") ?? "application/json"
    },
    method: "POST"
  });

  return new Response(await backendResponse.text(), {
    headers: {
      "Content-Type":
        backendResponse.headers.get("Content-Type") ?? "application/json"
    },
    status: backendResponse.status
  });
}
