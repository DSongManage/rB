export const config = { runtime: 'edge' };

import { getProfileMeta, injectMetaTags, fetchShellHtml } from '../_shared';

export default async function handler(request: Request) {
  const url = new URL(request.url);
  // Extract username from the path: /api/profile/username
  const username = url.pathname.split('/').pop();

  let meta = null;
  if (username && /^[A-Za-z0-9_]+$/.test(username)) {
    meta = await getProfileMeta(username);
  }

  const html = await fetchShellHtml(url.origin);

  return new Response(meta ? injectMetaTags(html, meta) : html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
