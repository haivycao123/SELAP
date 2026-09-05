import { getApiBaseUrl } from "./api";

const ABSOLUTE_URL_PATTERN = /^[a-z][a-z\d+\-.]*:\/\//i;

export function resolvePropertyImageUrl(value: string | null | undefined) {
  const url = value?.trim();

  if (!url) {
    return "";
  }

  if (url.startsWith("//")) {
    return `https:${url}`;
  }

  if (
    ABSOLUTE_URL_PATTERN.test(url) ||
    url.startsWith("data:") ||
    url.startsWith("blob:")
  ) {
    return url;
  }

  const uploadPath = url.startsWith("uploads/") ? `/${url}` : url;

  if (uploadPath.startsWith("/uploads/")) {
    const apiBaseUrl = getApiBaseUrl();
    return apiBaseUrl ? `${apiBaseUrl}${uploadPath}` : `/api${uploadPath}`;
  }

  return url;
}
