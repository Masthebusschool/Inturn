// Tiny fetch wrapper: JSON bodies, FormData passthrough, friendly errors.
// Errors carry .status and .code (server error code, e.g. 'ai_daily_quota'); aborts rethrow unchanged.
export async function api(path, { method = 'GET', body, signal } = {}) {
  const opts = { method, headers: {}, signal }
  if (body instanceof FormData) {
    opts.body = body // browser sets multipart boundary
  } else if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json'
    opts.body = JSON.stringify(body)
  }
  let res
  try {
    res = await fetch(path, opts)
  } catch (e) {
    if (e?.name === 'AbortError') throw e
    throw new Error("Can't reach the server. Is it running?")
  }
  let data = null
  try {
    data = await res.json()
  } catch (e) {
    if (e?.name === 'AbortError') throw e // aborted mid-body: still an abort, not an empty response
    if (!res.ok) throw Object.assign(new Error(res.status >= 500 ? "Can't reach the server. Is it running?" : `Request failed (${res.status})`), { status: res.status })
  }
  if (!res.ok) throw Object.assign(new Error(data?.error || data?.errors?.[0] || `Request failed (${res.status})`), { status: res.status, code: data?.code })
  return data
}
