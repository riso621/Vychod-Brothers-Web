let sdkPromise

export function loadCloudflarePlayerSdk() {
  if (window.Stream) return Promise.resolve(window.Stream)
  if (sdkPromise) return sdkPromise

  sdkPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-cloudflare-stream-sdk]')
    const script = existing || document.createElement('script')
    const handleLoad = () => window.Stream ? resolve(window.Stream) : reject(new Error('Cloudflare Stream SDK sa nenačítalo.'))
    script.addEventListener('load', handleLoad, { once: true })
    script.addEventListener('error', () => reject(new Error('Cloudflare Stream SDK sa nenačítalo.')), { once: true })
    if (!existing) {
      script.src = 'https://embed.cloudflarestream.com/embed/sdk.latest.js'
      script.async = true
      script.dataset.cloudflareStreamSdk = 'true'
      document.head.append(script)
    }
  }).catch((error) => {
    sdkPromise = null
    throw error
  })
  return sdkPromise
}

