import SEOHead from './SEOHead';
import MarketingLayout from './MarketingLayout';

export default function About() {
  return (
    <MarketingLayout>
      <SEOHead
        title="About | renaissBlock — The Creative Renaissance"
        description="renaissBlock exists so that collaboration never dies because of money. Learn the story behind the comic collaboration platform built for writers and artists."
        canonicalPath="/about"
      />

      <div className="mk-page-hero">
        <h1>The Creative Renaissance</h1>
        <p>Why we're building renaissBlock — and who it's for.</p>
      </div>

      <section className="mk-section">
        <div className="mk-container">
          <div className="mk-about-narrative">
            <div className="mk-about-block">
              <h2>The Problem</h2>
              <p>
                There's a writer with a story that would make an incredible comic. They can see every panel in their head — the splash pages, the quiet moments, the cliffhangers. But they can't draw.
              </p>
              <p>
                There's an artist with extraordinary talent who's tired of drawing other people's ideas on Fiverr for $50 a pop. They want to build something they <em>own</em>.
              </p>
            </div>

            <div className="mk-about-block">
              <h2>The Insight</h2>
              <p>
                These two people need each other. But finding each other is hard. Trusting each other is harder. And figuring out how to share money fairly? That's where most collaborations die.
              </p>
              <p>
                One person does the work, the other handles payments. Someone forgets. Someone feels shorted. The awkwardness builds, the creative energy drains, and the project dies — not because the work wasn't good, but because the business side was broken.
              </p>
            </div>

            <blockquote className="mk-about-quote">
              renaissBlock exists so that collaboration never dies because of money.
            </blockquote>

            <div className="mk-about-block">
              <h2>The Mission</h2>
              <p>
                We built a platform where writers and artists can find each other, agree on terms, and publish together — with every sale splitting revenue automatically, enforced by smart contracts. No invoicing, no chasing payments, no trust required.
              </p>
              <p>
                The technology that powers this — blockchain, smart contracts, digital wallets — is completely invisible to our users. They never see it, never need to understand it. They just create, publish, and get paid.
              </p>
            </div>

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
