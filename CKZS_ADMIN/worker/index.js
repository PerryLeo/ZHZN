const API_ORIGIN = 'http://47.236.100.138.nip.io'

function createApiRequest(request) {
  const sourceUrl = new URL(request.url)
  const targetUrl = new URL(`${sourceUrl.pathname}${sourceUrl.search}`, API_ORIGIN)
  const headers = new Headers(request.headers)

  headers.delete('host')
  headers.delete('cf-connecting-ip')
  headers.delete('cf-ipcountry')
  headers.delete('cf-ray')
  headers.delete('cf-visitor')

  return new Request(targetUrl, {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    redirect: 'manual',
  })
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      return fetch(createApiRequest(request))
    }

    return env.ASSETS.fetch(request)
  },
}
