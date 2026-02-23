export const config = { runtime: 'edge' };

const API_BASE = 'https://api.renaissblock.com';
const SITE_URL = 'https://renaissblock.com';

interface MetaTags {
  title: string;
  description: string;
  canonical: string;
  ogType: string;
  ogImage: string;
  jsonLd?: Record<string, unknown>;
}

function escapeAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function truncate(str: string, max: number): string {
  if (!str) return '';
  return str.length > max ? str.slice(0, max) + '...' : str;
}

async function fetchWithTimeout(url: string, ms = 3000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function getContentMeta(id: string): Promise<MetaTags | null> {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/api/content/${id}/preview/`);
    if (!res.ok) return null;
    const data = await res.json();

    const title = `${data.title} by @${data.creator_username} | renaissBlock`;
    const description = truncate(data.authors_note, 155) ||
      `Read ${data.title}, a ${data.content_type || 'comic'} by @${data.creator_username} on renaissBlock.`;
    const image = data.teaser_link || `${SITE_URL}/logo512.png`;
    const canonical = `${SITE_URL}/content/${id}`;

    return {
      title,
      description,
      canonical,
      ogType: 'article',
      ogImage: image,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'CreativeWork',
        name: data.title,
        description,
        image,
        url: canonical,
        author: {
          '@type': 'Person',
          name: data.creator_username,
          url: `${SITE_URL}/profile/${data.creator_username}`,
        },
        publisher: {
          '@type': 'Organization',
          name: 'renaissBlock',
          url: SITE_URL,
        },
        datePublished: data.created_at,
        genre: data.genre,
        ...(data.price_usd > 0
          ? { offers: { '@type': 'Offer', price: String(data.price_usd), priceCurrency: 'USD', availability: 'https://schema.org/InStock' } }
          : {}),
      },
    };
  } catch {
    return null;
  }
}

async function getProfileMeta(username: string): Promise<MetaTags | null> {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/api/users/${username}/public/`);
    if (!res.ok) return null;
    const data = await res.json();
    const p = data.profile;

    const displayName = p.display_name || p.username;
    const title = `${displayName} (@${p.username}) | renaissBlock`;
    const description = truncate(p.bio, 155) ||
      `${displayName} is a creator on renaissBlock.${p.roles?.length ? ' ' + p.roles.join(', ') + '.' : ''}`;
    const image = p.avatar || `${SITE_URL}/logo512.png`;
    const canonical = `${SITE_URL}/profile/${p.username}`;

    return {
      title,
      description,
      canonical,
      ogType: 'profile',
      ogImage: image,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: displayName,
        url: canonical,
        image,
        description,
        ...(p.roles?.length ? { jobTitle: p.roles.join(', ') } : {}),
      },
    };
  } catch {
    return null;
  }
}

function injectMetaTags(html: string, meta: MetaTags): string {
  const e = escapeAttr;

  const tags = [
    `<title>${e(meta.title)}</title>`,
    `<meta name="description" content="${e(meta.description)}" />`,
    `<link rel="canonical" href="${e(meta.canonical)}" />`,
    `<meta property="og:title" content="${e(meta.title)}" />`,
    `<meta property="og:description" content="${e(meta.description)}" />`,
    `<meta property="og:type" content="${meta.ogType}" />`,
    `<meta property="og:url" content="${e(meta.canonical)}" />`,
    `<meta property="og:image" content="${e(meta.ogImage)}" />`,
    `<meta property="og:site_name" content="renaissBlock" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${e(meta.title)}" />`,
    `<meta name="twitter:description" content="${e(meta.description)}" />`,
    `<meta name="twitter:image" content="${e(meta.ogImage)}" />`,
  ];

  if (meta.jsonLd) {
    tags.push(`<script type="application/ld+json">${JSON.stringify(meta.jsonLd)}</script>`);
  }

  const injection = tags.join('\n    ');

  // Remove default title and description, then inject dynamic ones
  html = html.replace('<title>renaissBlock</title>', '');
  html = html.replace(/<meta name="description" content="[^"]*" \/>/, '');
  html = html.replace('</head>', `    ${injection}\n  </head>`);

  return html;
}

export default async function handler(request: Request) {
  const url = new URL(request.url);
  const type = url.searchParams.get('type');
  const id = url.searchParams.get('id');
  const username = url.searchParams.get('username');

  // Fetch metadata from API
  let meta: MetaTags | null = null;
  if (type === 'content' && id) {
    meta = await getContentMeta(id);
  } else if (type === 'profile' && username) {
    meta = await getProfileMeta(username);
  }

  // Fetch the static index.html from the same deployment
  const htmlRes = await fetch(new URL('/index.html', url.origin));
  let html = await htmlRes.text();

  if (meta) {
    html = injectMetaTags(html, meta);
  }

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
