// Shared fetch wrapper for the Express API (Vite proxies /api to the server).
// Throws an Error with `status` and an `errors` list when the response is not OK.
export async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'include', // send the session cookie
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    const errors = data.errors ?? (data.error ? [data.error] : [`Request failed (${res.status})`])
    const error = new Error(errors[0])
    error.status = res.status
    error.errors = errors
    throw error
  }
  return data
}
