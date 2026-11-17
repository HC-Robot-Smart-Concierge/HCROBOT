export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1. Chuyển tiếp toàn bộ API calls (/api/*) và static uploads (/static/*) về Tailscale Funnel Backend trên Laptop
    if (url.pathname.startsWith('/api') || url.pathname.startsWith('/static')) {
      const targetUrl = new URL(`https://yungwhore.taila9018b.ts.net${url.pathname}${url.search}`);

      // Hỗ trợ WebSocket Upgrade nguyên bản qua Cloudflare Worker
      if (request.headers.get('Upgrade') === 'websocket') {
        return fetch(targetUrl.toString(), request);
      }

      const headers = new Headers(request.headers);
      headers.set('host', 'yungwhore.taila9018b.ts.net');

      const proxyRequest = new Request(targetUrl.toString(), {
        method: request.method,
        headers: headers,
        body: ['GET', 'HEAD'].includes(request.method) ? null : request.body,
        redirect: 'follow',
      });

      try {
        return await fetch(proxyRequest);
      } catch (err) {
        return new Response(
          JSON.stringify({
            error: 'Backend Gateway Error',
            message: 'Khong the ket noi toi Backend Laptop qua Tailscale Funnel',
            details: err.message,
          }),
          {
            status: 502,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // 2. Các assets tĩnh (HTML, CSS, JS, ảnh) được phục vụ từ thư mục dist của Vite
    return env.ASSETS.fetch(request);
  },
};

