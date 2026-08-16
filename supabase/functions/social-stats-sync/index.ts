function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

Deno.serve(() => json({ error: 'Automatic social synchronization is disabled. Values are managed in the admin panel.' }, 410))
