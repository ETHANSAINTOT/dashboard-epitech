const TOKEN_KEY = "dashboard.token";

export type WidgetInstance = {
  id: number;
  serviceName: string;
  widgetName: string;
  config: Record<string, unknown>;
  refreshSeconds: number;
  // stacking order, the highest is drawn on top
  position: number;
  // px from the canvas top-left corner, null = never placed (created before free placement)
  x: number | null;
  y: number | null;
  // zoom of the card on a computer, 1 (normal) to 2
  scale: number;
};

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// FastAPI returns `detail` as a string for HTTPException, but as an array of objects for Pydantic validation errors (422). Without this the user would read [object Object]
function extractMessage(payload: unknown, status: number): string {
  const detail = (payload as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as { msg?: string };
    if (first.msg) return first.msg;
  }
  return `Request failed (${status})`;
}

type Options = { method?: string; body?: unknown; auth?: boolean };

export async function api<T>(path: string, options: Options = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  // Relative /api path: Vite proxies it to the backend, so front and back share one origin and there is no CORS to configure
  const response = await fetch(`/api${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new ApiError(extractMessage(payload, response.status), response.status);
  }
  // A 204 carries no body; calling .json() on it would throw
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}
