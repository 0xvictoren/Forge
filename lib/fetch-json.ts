/** Safely parse a fetch response body as JSON (avoids "Unexpected end of JSON input"). */
export async function parseJsonResponse<T = Record<string, unknown>>(
  res: Response
): Promise<T> {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(
      res.ok
        ? "Empty response from server"
        : `Request failed (${res.status} ${res.statusText})`
    );
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      text.startsWith("<")
        ? `Server error (${res.status}) — check API logs`
        : text.slice(0, 240)
    );
  }
}
