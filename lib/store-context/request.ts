/** The server's error shape, so a 409 can name the task that's already running. */
export type ApiError = { error: string; runningTaskId?: string };

export class RequestFailed extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly runningTaskId?: string,
  ) {
    super(message);
  }
}

/**
 * Every client call goes through here, so a failed mutation always arrives as
 * a `RequestFailed` carrying the server's own message rather than a generic
 * "something went wrong" — the panels show that message verbatim.
 */
export async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: init?.body ? { "Content-Type": "application/json", ...init?.headers } : init?.headers,
    });
  } catch {
    throw new RequestFailed(0, "You appear to be offline");
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiError | null;
    throw new RequestFailed(res.status, body?.error ?? "That didn't save", body?.runningTaskId);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
