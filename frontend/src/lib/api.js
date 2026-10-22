// Talks to the Express API under /api (same origin; Vite forwards it in development).
// Every response has the shape { ok: true, data, message? } | { ok: false, error, fieldErrors?, code? }.

/** Thrown by getData() so React Query and error screens can react to the status. */
export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

/** Sends a request and returns the API's result object; never throws for 4xx/5xx. */
export async function request(method, path, body) {
  const isForm = body instanceof FormData;
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: "same-origin",
      headers: body === undefined || isForm ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    });
  } catch {
    return { ok: false, error: "Cannot reach the server. Check your connection and try again.", status: 0 };
  }
  try {
    return { ...(await res.json()), status: res.status };
  } catch {
    return { ok: false, error: `The server returned an unexpected response (${res.status}).`, status: res.status };
  }
}

export const api = {
  get: (path) => request("GET", path),
  post: (path, body = {}) => request("POST", path, body),
  put: (path, body = {}) => request("PUT", path, body),
  delete: (path) => request("DELETE", path),
};

/** For data loading (React Query): returns `data`, or throws ApiError. */
export async function getData(path) {
  const result = await request("GET", path);
  if (!result.ok) throw new ApiError(result.error, result.status, result.code);
  return result.data;
}
