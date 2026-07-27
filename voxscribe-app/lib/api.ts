export const DEFAULT_API_BASE_URL = "http://localhost:8000";

export const API_BASE_URL =
  process.env.NODE_ENV === "development"
    ? DEFAULT_API_BASE_URL
    : process.env.NEXT_PUBLIC_API_URL?.trim() || DEFAULT_API_BASE_URL;

export const buildApiUrl = (path: string): string => {
  return `${API_BASE_URL.replace(/\/$/, "")}${path}`;
};

export const fetchBackend = async (path: string, options?: RequestInit): Promise<Response> => {
  const url = buildApiUrl(path);
  return await fetch(url, options);
};
