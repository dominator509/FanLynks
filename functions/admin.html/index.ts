export const onRequestGet: PagesFunction<Env> = async (context) => {
  const assetUrl = new URL(context.request.url);
  assetUrl.pathname = '/admin-shell';
  const response = await context.env.ASSETS.fetch(new Request(assetUrl.toString(), context.request));
  const headers = new Headers(response.headers);
  headers.set('Content-Type', 'text/html; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  headers.set('Pragma', 'no-cache');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
};
