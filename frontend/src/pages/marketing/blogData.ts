export interface BlogPost {
  slug: string;
  title: string;
  tag: string;
  excerpt: string;
  date: string;
  isoDate: string;
  readTime: string;
  published: boolean;
}

export const blogPosts: BlogPost[] = [
  {
    slug: 'writer-artist-first-collaboration-guide',
    title: 'Writer + Artist: A Step-by-Step Guide to Your First Collaboration',
    tag: 'Tutorial',
    excerpt: 'From concept to published chapter — everything you need to know about working with a creative partner for the first time.',
    date: 'Feb 3, 2026',
    isoDate: '2026-02-03',
    readTime: '7 min read',
    published: true,
  },
];

export function getPostBySlug(slug: string): BlogPost | undefined {
  return blogPosts.find(p => p.slug === slug);
}
