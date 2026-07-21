type ApiOptions = {
  body?: unknown;
  token?: string | null;
};

export async function apiPost<T>(path: string, options: ApiOptions = {}) {
  return apiRequest<T>(path, {
    body: options.body,
    method: "POST",
    token: options.token
  });
}

export async function apiGet<T>(path: string, options: ApiOptions = {}) {
  return apiRequest<T>(path, {
    method: "GET",
    token: options.token
  });
}

export async function apiPatch<T>(path: string, options: ApiOptions = {}) {
  return apiRequest<T>(path, {
    body: options.body,
    method: "PATCH",
    token: options.token
  });
}

export async function apiDelete<T>(path: string, options: ApiOptions = {}) {
  return apiRequest<T>(path, {
    method: "DELETE",
    token: options.token
  });
}

async function apiRequest<T>(
  path: string,
  options: ApiOptions & { method: "DELETE" | "GET" | "PATCH" | "POST" }
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const response = await fetch(`/api${path}`, {
    body:
      options.method === "GET" || options.method === "DELETE"
        ? undefined
        : JSON.stringify(options.body ?? {}),
    headers,
    method: options.method
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      typeof data.message === "string"
        ? data.message
        : "Something went wrong. Please try again.";

    throw new Error(message);
  }

  return data as T;
}

export function getOtpCode(formData: FormData, namePrefix: string) {
  return [1, 2, 3, 4]
    .map((index) => String(formData.get(`${namePrefix}-${index}`) ?? ""))
    .join("");
}
