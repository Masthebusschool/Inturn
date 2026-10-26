// Shared fetch wrapper for the Express API (Vite proxies /api to the server).
// Throws an Error with `status` and an `errors` list when the response is not OK.
// `body` is sent as JSON, except FormData (file uploads), which is sent as is.
export async function request(path, { method = 'GET', body } = {}) {
  // The browser sets the multipart Content-Type for FormData itself
  const isJson = body !== undefined && !(body instanceof FormData)
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'include', // send the session cookie
    headers: isJson ? { 'Content-Type': 'application/json' } : undefined,
    body: isJson ? JSON.stringify(body) : body,
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
