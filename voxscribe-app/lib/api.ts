export const DEFAULT_API_BASE_URL = "http://localhost:8000";

export const API_BASE_URL =
  process.env.NODE_ENV === "development"
    ? DEFAULT_API_BASE_URL
    : process.env.NEXT_PUBLIC_API_URL?.trim() || DEFAULT_API_BASE_URL;

export const buildApiUrl = (path: string): string => {
  return `${API_BASE_URL.replace(/\/$/, "")}${path}`;
};

export const fetchBackend = async (
  path: string,
  options: RequestInit = {},
  accessToken?: string | null
): Promise<Response> => {
  const url = buildApiUrl(path);
  const headers = new Headers(options.headers);
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  return await fetch(url, { ...options, headers });
};

/** An error response from the backend (as opposed to a network failure). */
export class BackendError extends Error {}

const errorMessage = (data: unknown, status: number): string => {
  const detail = (data as { detail?: unknown; message?: unknown } | null)?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg);
  const message = (data as { message?: unknown } | null)?.message;
  if (typeof message === "string") return message;
  return `Request failed with status ${status}.`;
};

/**
 * Calls a JSON backend endpoint and returns the parsed body.
 * Throws BackendError with the server's `detail` message on non-2xx responses.
 */
export const apiJson = async <T,>(
  path: string,
  accessToken: string | null,
  options: RequestInit = {}
): Promise<T> => {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetchBackend(path, { ...options, headers }, accessToken);
  } catch {
    throw new Error(
      `Failed to connect to backend (${API_BASE_URL}). Ensure the backend server is running.`
    );
  }
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: text };
  }

  if (!response.ok) throw new BackendError(errorMessage(data, response.status));
  return data as T;
};

/**
 * POSTs JSON to a Server-Sent Events endpoint and invokes `onEvent` for each
 * `data:` payload as it arrives. Resolves when the stream ends.
 */
export const streamBackend = async <T,>(
  path: string,
  body: unknown,
  accessToken: string | null,
  onEvent: (event: T) => void
): Promise<void> => {
  const response = await fetchBackend(
    path,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify(body),
    },
    accessToken
  );

  if (!response.ok || !response.body) {
    let data: unknown = null;
    try {
      data = await response.json();
    } catch {
      // Non-JSON error body; fall back to the generic message
    }
    throw new BackendError(errorMessage(data, response.status));
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const raw of events) {
      const data = raw
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .join("");
      if (data) onEvent(JSON.parse(data) as T);
    }
  }
};
