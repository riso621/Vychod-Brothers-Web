const assets: Record<string, { file: string; contentType: string }> = {
  '': { file: 'new-video-electric-bg.jpg', contentType: 'image/jpeg' },
  'background': { file: 'new-video-electric-bg.jpg', contentType: 'image/jpeg' },
  'thumbnail-frame': { file: 'new-video-thumbnail-electric.png', contentType: 'image/png' },
  'cta-frame': { file: 'new-video-cta-electric.png', contentType: 'image/png' },
  'icon-youtube': { file: 'icon-youtube.png', contentType: 'image/png' },
  'icon-instagram': { file: 'icon-instagram.png', contentType: 'image/png' },
  'icon-tiktok': { file: 'icon-tiktok.png', contentType: 'image/png' },
  'icon-facebook': { file: 'icon-facebook.png', contentType: 'image/png' },
}

Deno.serve(async (request) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } })
  }

  try {
    const key = new URL(request.url).pathname.split('/').filter(Boolean).at(-1) ?? ''
    const asset = assets[key] ?? assets['']
    const body = request.method === 'HEAD' ? null : await Deno.readFile(new URL(`./${asset.file}`, import.meta.url))
    return new Response(body, {
      headers: {
        'Content-Type': asset.contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return new Response('Asset unavailable', { status: 404 })
  }
})
