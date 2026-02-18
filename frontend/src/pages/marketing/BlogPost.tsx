import { useParams, Link, Navigate } from 'react-router-dom';
import SEOHead from './SEOHead';
import MarketingLayout from './MarketingLayout';
import { getPostBySlug } from './blogData';
import { ArrowLeft } from 'lucide-react';

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const post = slug ? getPostBySlug(slug) : undefined;
  const ContentComponent = slug ? articleContent[slug] : undefined;

  if (!post || !post.published || !ContentComponent) {
    return <Navigate to="/blog" replace />;
  }

  const articleSchema = {
    "@type": "Article",
    "headline": post.title,
    "description": post.excerpt,
    "datePublished": post.isoDate,
    "dateModified": post.isoDate,
    "author": { "@type": "Organization", "name": "renaissBlock", "url": "https://renaissblock.com" },
    "publisher": { "@type": "Organization", "name": "renaissBlock", "url": "https://renaissblock.com", "logo": { "@type": "ImageObject", "url": "https://renaissblock.com/rb-logo.png" } },
    "mainEntityOfPage": { "@type": "WebPage", "@id": `https://renaissblock.com/blog/${post.slug}` },
    "url": `https://renaissblock.com/blog/${post.slug}`,
    "articleSection": post.tag,
    "wordCount": 2800,
    "inLanguage": "en-US",
  };

  const breadcrumbSchema = {
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Blog", "item": "https://renaissblock.com/blog" },
      { "@type": "ListItem", "position": 2, "name": post.title, "item": `https://renaissblock.com/blog/${post.slug}` },
    ],
  };

  return (
    <MarketingLayout>
      <SEOHead
        title={`${post.title} | renaissBlock Blog`}
        description={post.excerpt}
        canonicalPath={`/blog/${post.slug}`}
        ogType="article"
        schemas={[articleSchema, breadcrumbSchema]}
      />

      <article className="mk-article">
        <div className="mk-article-header">
          <Link to="/blog" className="mk-article-back">
            <ArrowLeft size={16} />
            Back to Blog
          </Link>
          <div className="mk-article-meta-top">
            <span className="mk-blog-tag">{post.tag}</span>
            <span className="mk-article-date">{post.date}</span>
            <span className="mk-article-dot">&middot;</span>
            <span className="mk-article-read">{post.readTime}</span>
          </div>
          <h1>{post.title}</h1>
        </div>

        <div className="mk-article-body">
          <ContentComponent />
        </div>

        <div className="mk-article-cta">
          <h3>Ready to start your first collaboration?</h3>
          <p>Browse creator profiles, send a proposal, and publish your first chapter — with revenue splits enforced automatically.</p>
          <a href="https://renaissblock.com" className="mk-btn-primary">Browse Creators on renaissBlock</a>
        </div>

        <div className="mk-article-footer">
          <Link to="/blog" className="mk-article-back">
            <ArrowLeft size={16} />
            Back to all posts
          </Link>
        </div>
      </article>
    </MarketingLayout>
  );
}

/* ================================================================
   ARTICLE: Writer + Artist — A Step-by-Step Guide
   ================================================================ */
function WriterArtistGuide() {
  return (
    <>
      <p className="mk-article-lead">
        Your first comic collaboration will be messy. That's normal. Every successful creative partnership started with two strangers figuring out how to work together — navigating different creative instincts, different schedules, and the always-uncomfortable money conversation. This guide walks you through the entire process, from finding a partner to publishing your first chapter and getting paid.
      </p>

      <hr className="mk-article-divider" />

      <h2>Before You Start — Know What You're Bringing</h2>

      <p>The biggest mistake in any collaboration is showing up unprepared. Before you reach out to anyone, get your own house in order.</p>

      <p><strong>If you're a writer</strong>, have these ready before approaching an artist: a synopsis of your story (even a rough one), at least a few pages of script so you can show your writing style, visual references or mood boards for the tone you're going for, and a clear sense of the genre. An artist can't evaluate your project if all you have is "I have this idea for a comic." The more concrete you are, the more seriously you'll be taken.</p>

      <p><strong>If you're an artist</strong>, have these ready before committing to a project: a portfolio that shows your range (or your niche — both work), samples in the style relevant to the project, a realistic sense of your availability and page output speed, and clarity on what kind of arrangement you're looking for — upfront payment, revenue share, or a hybrid. There's no wrong answer here, but knowing your preference before the conversation starts will save everyone time.</p>

      <p><strong>What each side underestimates:</strong> Writers tend to underestimate how long a single page takes to draw, ink, color, and letter. Artists tend to underestimate how much revision goes into a script before it's panel-ready. Respecting each other's time investment from the start sets the right tone for everything that follows.</p>

      <p><strong>On renaissBlock</strong>, your profile is your pitch. Upload your best work, list your genres and skills, and signal whether you're currently open to collaborations. The right partner can find you without you posting a single ad.</p>

      <h2>Finding the Right Partner</h2>

      <p>The traditional approach to finding a collaborator is scattered. You post on Reddit's r/ComicBookCollabs and hope the right person scrolls past at the right time. You cold-DM people on Twitter or Discord and mostly get ignored. You network at conventions, which is great if you can afford to attend them.</p>

      <p>These channels work — people do find partners this way — but it's inefficient. You're casting a wide net into a noisy ocean.</p>

      <p><strong>What to look for beyond raw skill:</strong> Talent matters, but it's not the only thing. Look for communication responsiveness (do they reply within a reasonable timeframe?), genre alignment (an artist who draws slice-of-life romance may not be excited about your grimdark fantasy), and evidence that they finish things. A portfolio full of half-completed projects is a red flag, regardless of how good the art is.</p>

      <p><strong>Red flags for writers looking for artists:</strong> Anyone who wants you to pay for "test pages" before you've even discussed the project. Artists who can't show you finished sequential work (single illustrations are different from sequential storytelling). Unwillingness to discuss timeline or output expectations.</p>

      <p><strong>Red flags for artists evaluating writers:</strong> Vague pitches with no script or synopsis. Writers who describe their project as "the next One Piece" or "better than anything Marvel is doing." Resistance to discussing compensation upfront. Anyone who says "I'll pay you when it blows up."</p>

      <p><strong>On renaissBlock</strong>, you can browse creator profiles filtered by genre, style, and whether they're actively looking for collaborators. You can see their published work directly on their profile — not just sample images, but actual chapters. When you find someone promising, you send them a project proposal instead of an awkward cold DM.</p>

      <h2>The Conversation That Makes or Breaks It</h2>

      <p>You've found someone whose work you like. Now comes the conversation that determines whether this becomes a real project or another "let's totally do this" that fades into nothing.</p>

      <p><strong>If you're the writer reaching out:</strong> Be specific. "Hey, I love your style and I think it'd be perfect for my project" is fine as an opener, but follow it immediately with substance: what the story is about, how long you envision it being, what format (webtoon vertical scroll vs. traditional page layout), and — critically — what you're proposing for the revenue split. Don't make the artist ask. That's their least favorite conversation and your willingness to bring it up first signals that you're serious.</p>

      <p><strong>If you're the artist evaluating a pitch:</strong> Ask to see the script, even if it's rough. Ask how many chapters or pages they're envisioning for the first arc. Ask what their publishing timeline looks like. And ask directly about the revenue split — what percentage is the writer proposing, and does it feel fair given the workload?</p>

      <h3>The money conversation</h3>

      <p>This is where most collaborations die, so let's be direct about it.</p>

      <p>In the traditional freelance world, artists often prefer upfront payment — and for good reason. They've been burned by rev-share promises that never materialized because the project died, the audience never came, or the writer disappeared. When someone offers you "exposure" instead of money, you learn to demand cash upfront.</p>

      <p>But upfront payment has a fundamental tradeoff: you get paid once, and that's it. The comic you drew could go on to earn thousands, and you'll never see another dollar from it. You were labor for hire, not a partner.</p>

      <p><strong>Equity — owning a share of what you create — is a different bet entirely.</strong> It means that if the comic takes off, you earn alongside it. Not once, but every time someone buys a chapter, for as long as people are reading it. A 40% revenue share on a comic that sells consistently is worth far more over time than a one-time page rate.</p>

      <p>The reason equity gets a bad reputation isn't because the model is broken — it's because enforcement is broken. "I'll pay you your share" is a promise. Promises get forgotten, renegotiated, or ignored when real money shows up. That's not an equity problem. That's a trust problem.</p>

      <p><strong>renaissBlock was built specifically to solve this.</strong> Revenue splits on renaissBlock are enforced automatically by smart contracts. The moment a reader buys a chapter, your percentage hits your wallet instantly. Not next month. Not after the writer remembers to send it. Instantly, every time, enforced by code. This is what makes equity work — not trust between strangers, but a system that makes trust unnecessary.</p>

      <p>Common splits for collaborative comics range from 50/50 (writer/artist) to 40/60 favoring the artist, reflecting the typically heavier time investment in art production. But every project is different, and the right split is whatever both partners genuinely agree is fair.</p>

      <p><strong>On renaissBlock</strong>, the project proposal includes your proposed revenue split upfront. No ambiguity, no dancing around the topic. Both sides see exactly what they're agreeing to before any work starts — and once accepted, that split is locked in and enforced automatically.</p>

      <h2>Agreeing on Terms</h2>

      <p>You've had the conversation. You're both excited. Before anyone touches pen to tablet or opens a script doc, lock down the terms.</p>

      <p><strong>What to define before any work starts:</strong></p>
      <ul>
        <li>Revenue split (who gets what percentage of each sale)</li>
        <li>Credit (how each person is credited on the published work)</li>
        <li>Scope (how many chapters are you committing to? Is it "let's do one chapter and see how it goes" or "we're doing a 10-chapter arc"?)</li>
        <li>Timeline (rough deadlines for drafts, feedback, and publication)</li>
        <li>Ownership (who owns the IP? Can either party continue the project solo if the collaboration ends?)</li>
      </ul>

      <p><strong>Why handshake deals fail:</strong> It's not that people are dishonest. It's that memory is unreliable and circumstances change. "We agreed on 50/50" means nothing when one person remembers it as 50/50 of gross and the other remembers it as 50/50 after expenses. Write it down, at minimum. Get it enforced, ideally.</p>

      <p>The old way to enforce a collaboration agreement is a legal contract — which costs money, takes time, and feels like overkill when you're two indie creators making a webcomic. Most people skip this step entirely, and that's where problems start months later when real money is on the table.</p>

      <p><strong>On renaissBlock</strong>, once both sides accept a project proposal, the revenue split is locked into a smart contract. It can't be changed unilaterally. There's no "I thought we agreed on something different" six months later. The code enforces the deal, every single transaction, automatically. No lawyers, no contracts, no trust required.</p>

      <h2>Working Together — The First Chapter</h2>

      <p>Here's the most important advice in this entire guide: <strong>start with one chapter.</strong></p>

      <p>Not a 200-page graphic novel. Not a 50-chapter epic. One chapter. Maybe 15–25 pages. This is your pilot episode. It lets both of you test the working relationship with minimal risk. If it goes great, you continue. If it doesn't work out, you've lost weeks, not months or years.</p>

      <h3>Communication cadence</h3>

      <p>Find a rhythm that works for both of you. Some partnerships thrive on daily check-ins. Others work best with a weekly sync and async communication in between. The key is agreeing on expectations upfront. Nothing kills a collaboration faster than one person wondering "are they still working on this?" for two weeks straight.</p>

      <h3>The script-to-page workflow</h3>

      <p>Typically, the writer delivers a script (panel descriptions, dialogue, pacing notes), the artist creates rough layouts or thumbnails for feedback, the writer reviews and flags any misinterpretations before detailed work begins, the artist produces final pages (pencils, inks, colors, letters — depending on who handles what), and both review the finished pages before publication.</p>

      <p>Build in review stages. It's much easier to adjust a rough layout than to redraw a finished page.</p>

      <h3>Giving and receiving feedback</h3>

      <p>Be specific. "I don't like this" is useless. "The pacing on page 3 feels rushed — can we add a beat between the reveal and the reaction?" is actionable. And when receiving feedback, assume good intent. Your partner wants the project to succeed as much as you do.</p>

      <p><strong>On renaissBlock</strong>, chapter-by-chapter publishing is built into the platform. Upload pages, review them together, and publish when you're both satisfied. If the collaboration isn't working after chapter one, you've only invested one chapter — and that chapter still earns for both of you.</p>

      <h2>Publishing and Getting Paid</h2>

      <p>You've finished your first chapter. It's time to put it in front of readers.</p>

      <h3>Why chapter-by-chapter publishing beats waiting</h3>

      <p>Releasing a finished 200-page book means months or years of work before any audience feedback or income. Releasing chapter by chapter lets you build an audience incrementally, get reader feedback that shapes the story, generate income while you're still creating, and prove the concept works before committing to a massive run. Serialized publishing has worked for manga, webtoons, and webcomics for decades. There's a reason for that.</p>

      <h3>Where to publish</h3>

      <p>You have options. Webtoon Canvas is free but takes a significant revenue cut through ad revenue sharing. Tapas is similar. Self-hosting gives you full control but zero built-in audience. And you can publish on multiple platforms simultaneously — there's no rule that says you have to pick one.</p>

      <h3>The revenue problem most collaborators face</h3>

      <p>Even after you publish, the money question doesn't go away. On most platforms, revenue goes to one account — usually whoever set up the page. That person is then responsible for manually calculating the split and sending their partner's share. This works fine when both people are motivated and organized. It falls apart when someone forgets, gets busy, or quietly decides they deserve a bigger cut.</p>

      <p>This is the exact problem that kills collaborations that already survived every other challenge. The work was good. The audience showed up. But the business side broke.</p>

      <p><strong>On renaissBlock</strong>, every sale distributes revenue instantly according to your agreement. Your collaborator sees their share hit their wallet the moment a reader purchases. There's no invoicing. No PayPal requests. No "hey, can you send me my share from last month?" Cash out to your bank account whenever you want, typically within 1–3 business days.</p>

      <h2>Your First Chapter Is the Hardest</h2>

      <p>Everything after this gets easier. The awkwardness of working with someone new fades. The workflow gets smoother. The feedback gets sharper. The trust — the real kind, built through shared work and shared success — grows with every chapter you publish together.</p>

      <p>The hardest part isn't the writing or the drawing. It's taking the leap to work with someone you don't know yet, trusting the process, and committing to at least one chapter.</p>

      <p>The best creative partnerships in comics — the ones that produced the work you grew up reading — all started somewhere. Usually with two people who barely knew each other deciding to make something together.</p>

      <p>Your chapter one is out there waiting to be made. Go find your partner.</p>
    </>
  );
}

/* ---- Article content keyed by slug ---- */
const articleContent: Record<string, () => JSX.Element> = {
  'writer-artist-first-collaboration-guide': WriterArtistGuide,
};
