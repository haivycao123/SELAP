type ApiOptions = {
  body?: unknown;
};

export async function apiPost<T>(path: string, options: ApiOptions = {}) {
  const response = await fetch(`/api${path}`, {
    body: JSON.stringify(options.body ?? {}),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
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
