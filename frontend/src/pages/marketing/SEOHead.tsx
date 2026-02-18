import { Helmet } from 'react-helmet-async';

interface SEOHeadProps {
  title: string;
  description: string;
  canonicalPath: string;
  ogType?: string;
  schemas?: Record<string, unknown>[];
}

const BASE_URL = 'https://renaissblock.com';

const orgSchema = {
  "@type": "Organization",
  "name": "renaissBlock",
  "url": BASE_URL,
  "logo": `${BASE_URL}/rb-logo.png`,
  "description": "A comic collaboration platform where writers and artists create together with automatic, trustless revenue sharing.",
  "foundingDate": "2026",
  "founder": {
    "@type": "Person",
    "name": "David Song"
  },
  "sameAs": []
};

const webSiteSchema = {
  "@type": "WebSite",
  "name": "renaissBlock",
  "url": BASE_URL,
  "description": "Comic collaboration platform with automatic revenue sharing for writers and artists"
};

export default function SEOHead({ title, description, canonicalPath, ogType = 'website', schemas = [] }: SEOHeadProps) {
  const url = `${BASE_URL}${canonicalPath}`;
  const graphData = {
    "@context": "https://schema.org",
    "@graph": [orgSchema, webSiteSchema, ...schemas]
  };

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={`${BASE_URL}/logo512.png`} />
      <meta property="og:site_name" content="renaissBlock" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={`${BASE_URL}/logo512.png`} />
      <script type="application/ld+json">{JSON.stringify(graphData)}</script>
    </Helmet>
  );
}
