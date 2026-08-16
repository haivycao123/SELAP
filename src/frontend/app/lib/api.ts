type ApiOptions = {
  body?: unknown;
  timeoutMs?: number;
  token?: string | null;
};

type UploadOptions = {
  file: File;
  timeoutMs?: number;
  token?: string | null;
};

const DEFAULT_TIMEOUT_MS = 15000;
const PUBLIC_API_BASE_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");

export function getApiBaseUrl() {
  return PUBLIC_API_BASE_URL ?? "";
}

function toApiUrl(path: string) {
  return `/api${path}`;
}

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

export async function apiUploadImage<T>(
  path: string,
  options: UploadOptions
) {
  const formData = new FormData();
  formData.append("image", options.file);

  const headers: Record<string, string> = {};

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const response = await fetchWithTimeout(
    toApiUrl(path),
    {
      body: formData,
      headers,
      method: "POST"
    },
    options.timeoutMs
  );

  const data = await parseJsonResponse(response);

  if (!response.ok) {
    const message =
      typeof data.message === "string"
        ? data.message
        : "Image upload failed. Please try again.";

    throw new Error(message);
  }

  return data as T;
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

  const response = await fetchWithTimeout(
    toApiUrl(path),
    {
      body:
        options.method === "GET" || options.method === "DELETE"
          ? undefined
          : JSON.stringify(options.body ?? {}),
      headers,
      method: options.method
    },
    options.timeoutMs
  );

  const data = await parseJsonResponse(response);

  if (!response.ok) {
    const message =
      typeof data.message === "string"
        ? data.message
        : "Something went wrong. Please try again.";

    throw new Error(message);
  }

  return data as T;
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS
) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal
    });
  } finally {
    window.clearTimeout(timeout);
  }
}

async function parseJsonResponse(response: Response) {
  const contentType = response.headers.get("Content-Type") ?? "";

  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error("API returned an unexpected response. Please make sure the backend server is running.");
  }

  return response.json().catch(() => {
    throw new Error("API returned invalid JSON. Please try again.");
  });
}

export function getOtpCode(formData: FormData, namePrefix: string) {
  return [1, 2, 3, 4]
    .map((index) => String(formData.get(`${namePrefix}-${index}`) ?? ""))
    .join("");
}
