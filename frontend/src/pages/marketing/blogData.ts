export interface BlogPost {
  slug: string;
  title: string;
  tag: string;
  excerpt: string;
  date: string;
  isoDate: string;
  readTime: string;
  wordCount: number;
  published: boolean;
}

export const blogPosts: BlogPost[] = [
  {
    slug: 'how-to-price-webcomic-indie-comic',
    title: 'How to Price Your Webcomic or Indie Comic — A First Principles Guide',
    tag: 'Tutorial',
    excerpt: 'No hand-waving, no "it depends." The math, logic, and strategy behind every dollar — from chapter pricing to revenue splits to royalties.',
    date: 'Feb 20, 2026',
    isoDate: '2026-02-20',
    readTime: '10 min read',
    wordCount: 3800,
    published: true,
  },
  {
    slug: 'writer-artist-first-collaboration-guide',
    title: 'Writer + Artist: A Step-by-Step Guide to Your First Collaboration',
    tag: 'Tutorial',
    excerpt: 'From concept to published chapter — everything you need to know about working with a creative partner for the first time.',
    date: 'Feb 3, 2026',
    isoDate: '2026-02-03',
    readTime: '7 min read',
    wordCount: 2800,
    published: true,
  },
];

export function getPostBySlug(slug: string): BlogPost | undefined {
  return blogPosts.find(p => p.slug === slug);
}
