export const config = { runtime: 'edge' };

import { getContentMeta, injectMetaTags, fetchShellHtml } from '../_shared';

export default async function handler(request: Request) {
  const url = new URL(request.url);
  // Extract content ID from the path: /api/content/123
  const id = url.pathname.split('/').pop();

  let meta = null;
  if (id && /^\d+$/.test(id)) {
    meta = await getContentMeta(id);
  }

  const html = await fetchShellHtml(url.origin);

  return new Response(meta ? injectMetaTags(html, meta) : html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
