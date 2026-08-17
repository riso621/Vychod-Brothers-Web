const assetUrl = new URL('./new-video-electric-bg.jpg', import.meta.url)

Deno.serve(async (request) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } })
  }

  try {
    const body = request.method === 'HEAD' ? null : await Deno.readFile(assetUrl)
    return new Response(body, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return new Response('Asset unavailable', { status: 404 })
  }
})
