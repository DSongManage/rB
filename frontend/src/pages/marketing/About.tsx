import SEOHead from './SEOHead';
import MarketingLayout from './MarketingLayout';

const aboutFaqSchema = {
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is renaissBlock?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "renaissBlock is a comic collaboration platform where writers and artists find each other, agree on revenue splits, and publish together. Every sale automatically distributes earnings to each collaborator's wallet — no invoicing, no chasing payments."
      }
    },
    {
      "@type": "Question",
      "name": "How does trustless revenue sharing work?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "When collaborators agree on a revenue split, that agreement is enforced by smart contracts on the Solana blockchain. Every time a reader purchases your work, earnings are automatically divided and deposited into each partner's wallet instantly. No one can change the split after it's set."
      }
    },
    {
      "@type": "Question",
      "name": "Is renaissBlock free to use?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes. It's free to sign up, create a profile, and publish your work. renaissBlock takes a 10% platform fee on sales. Founding creators — the first 50 to complete a project earning $100+ in sales — get a permanent 1% fee instead, keeping 99% of every sale."
      }
    }
  ]
};

export default function About() {
  return (
    <MarketingLayout>
      <SEOHead
        title="About renaissBlock | Comic Collaboration Platform"
        description="renaissBlock is where writers and artists find each other, agree on terms, and publish together — with every sale splitting revenue automatically."
        canonicalPath="/about"
        schemas={[aboutFaqSchema]}
      />

      <div className="mk-page-hero">
        <h1>The Creative Renaissance</h1>
        <p>Why we're building renaissBlock — and who it's for.</p>
      </div>

      <section className="mk-section">
        <div className="mk-container">
          <div className="mk-about-narrative">
            <div className="mk-about-block">
              <h2>Who We Are</h2>
              <p>
                renaissBlock is where writers and artists find each other and build something together.
              </p>
              <p>
                Finding the right creative partner is hard. Reddit posts, Discord servers, convention networking — it's scattered and inefficient. And even when you find someone, agreeing on money is awkward and enforcing that agreement is harder.
              </p>
              <p>
                We built a place where creators come together, agree on terms, and publish — with every sale splitting revenue automatically. No invoicing. No chasing payments. No trust required.
              </p>
            </div>

            <div className="mk-about-block">
              <h2>What We Do</h2>
              <p>
                Browse profiles. Find someone whose work resonates. Send them a proposal with your pitch and your split. If they accept, you're partners.
              </p>
              <p>
                Every sale distributes revenue instantly according to your agreement, enforced by code. The technology behind it is completely invisible — you just create, publish, and get paid.
              </p>
            </div>

            <blockquote className="mk-about-quote">
              renaissBlock exists so that collaboration never dies because of money.
            </blockquote>

            <div className="mk-about-block">
              <h2>The Name</h2>
              <p>
                We named it <em>renaissBlock</em> because we believe we're at the beginning of a creative renaissance. A new era where independent creators don't need publishers, agents, or lawyers to build sustainable creative businesses together. Where the tools of trustless collaboration — once reserved for finance and tech — become the invisible infrastructure of art.
              </p>
            </div>
          </div>
        </div>
      </section>

    </MarketingLayout>
  );
}
