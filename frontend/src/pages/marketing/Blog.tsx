import { Link } from 'react-router-dom';
import SEOHead from './SEOHead';
import MarketingLayout from './MarketingLayout';
import { blogPosts } from './blogData';

const blogSchema = {
  "@type": "Blog",
  "name": "renaissBlock Blog",
  "description": "Guides, insights, and stories for independent comic creators.",
  "url": "https://renaissblock.com/blog",
  "publisher": {
    "@type": "Organization",
    "name": "renaissBlock"
  },
  "blogPost": blogPosts.filter(p => p.published).map(p => ({
    "@type": "BlogPosting",
    "headline": p.title,
    "description": p.excerpt,
    "url": `https://renaissblock.com/blog/${p.slug}`,
    "datePublished": p.date,
  })),
};

export default function Blog() {
  return (
    <MarketingLayout>
      <SEOHead
        title="Blog | renaissBlock — Guides for Comic Creators"
        description="Guides, insights, and stories for independent comic creators. Learn about revenue splits, finding collaborators, and building a creative business."
        canonicalPath="/blog"
        schemas={[blogSchema]}
      />

      <div className="mk-page-hero">
        <h1>Blog</h1>
        <p>Guides, insights, and stories for independent comic creators.</p>
      </div>

      <section className="mk-section">
        <div className="mk-container">
          <div className="mk-blog-list">
            {blogPosts.map((post) => {
              const inner = (
                <>
                  <div className="mk-blog-card-top">
                    <span className="mk-blog-tag">{post.tag}</span>
                    <span className="mk-blog-card-date">{post.date}</span>
                    <span className="mk-blog-card-dot">&middot;</span>
                    <span className="mk-blog-card-read">{post.readTime}</span>
                  </div>
                  <h3 className="mk-blog-card-title">{post.title}</h3>
                  <p className="mk-blog-card-excerpt">{post.excerpt}</p>
                </>
              );

              return post.published ? (
                <Link to={`/blog/${post.slug}`} key={post.slug} className="mk-blog-card">
                  {inner}
                </Link>
              ) : (
                <div key={post.slug} className="mk-blog-card mk-blog-card--upcoming">
                  {inner}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
