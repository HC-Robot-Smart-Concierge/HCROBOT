/**
 * Cloudflare Pages Function: Reverse Proxy /api/* to Tailscale Funnel Backend
 * Backend Target: https://yungwhore.taila9018b.ts.net
 */
export async function onRequest(context) {
  const url = new URL(context.request.url);
  const targetUrl = new URL(`https://yungwhore.taila9018b.ts.net${url.pathname}${url.search}`);

  // Clone headers and remove host to prevent SNI/Host mismatch
  const headers = new Headers(context.request.headers);
  headers.set('host', 'yungwhore.taila9018b.ts.net');

  const forwardRequest = new Request(targetUrl.toString(), {
    method: context.request.method,
    headers: headers,
    body: ['GET', 'HEAD'].includes(context.request.method) ? null : context.request.body,
    redirect: 'follow',
  });

  try {
    const response = await fetch(forwardRequest);
    return response;
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Backend Gateway Error', message: error.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

