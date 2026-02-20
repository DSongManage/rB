import { useState } from 'react';
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
    "wordCount": post.wordCount,
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
          <h3>Ready to publish your comic?</h3>
          <p>Automatic revenue splits, instant payments, and built-in royalties on every sale. Start publishing on renaissBlock today.</p>
          <a href="https://renaissblock.com" className="mk-btn-primary">Get Started on renaissBlock</a>
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

/* ================================================================
   ARTICLE: How to Price Your Webcomic or Indie Comic
   ================================================================ */
function PricingGuide() {
  return (
    <>
      <p className="mk-article-lead">
        Most pricing advice for indie comics boils down to "look at what everyone else charges and do something similar." That's not terrible advice, but it skips the part that actually matters — understanding <em>why</em> a chapter should cost what it costs, and how to build a pricing strategy that makes you money over time rather than just matching the market.
      </p>
      <p>
        This guide breaks down comic pricing from the ground up. No hand-waving, no "it depends." Just the math, the logic, and the strategy behind every dollar.
      </p>

      <hr className="mk-article-divider" />

      <h2>Start With What the Reader Is Actually Buying</h2>

      <p>Before you pick a number, think about what a reader gets when they buy your chapter — and what they <em>don't</em> get.</p>

      <p>A physical comic book is a thing. It exists. It has paper, ink, a cover you can hold. A standard print issue costs $3.99–$4.99 at a comic shop in 2026, and even at that price, the margins are razor-thin after printing, distribution, and retail cuts. The reader is paying for the story, yes, but also for the object.</p>

      <p>A digital chapter is not an object. There's no paper. No shipping. No shelf space. No print run to finance. The marginal cost of delivering one more copy to one more reader is essentially zero.</p>

      <p>This matters because your reader knows it too. They intuitively understand that a digital chapter shouldn't cost the same as a physical comic, even if the creative work behind it is identical. You're not competing with print pricing — you're competing with every other form of digital entertainment that costs a dollar or two.</p>

      <p><strong>The anchor price your reader carries in their head</strong> is probably somewhere between a song on iTunes ($1.29), a mobile game purchase ($0.99–$4.99), and a WEBTOON Fast Pass episode (roughly $0.50 in coins). That's the neighborhood you're operating in, whether you like it or not.</p>

      <h2>The Math That Most Creators Skip</h2>

      <p>Here's a thought experiment that cuts straight to the right price range.</p>

      <p>Imagine your comic is a complete story told across 10 chapters. If a reader bought the entire series as a collected print volume, they'd probably pay around $10–$15 for a paperback or $15–$25 for a hardcover. That's the ceiling — the maximum a reader would pay for the complete experience in its most premium form.</p>

      <p>Now work backwards. If the whole story is worth $10–$15 to a reader in print, and you're selling individual digital chapters — no printing costs, no binding, no shipping — each chapter needs to come in <em>well under</em> $1.50. Probably closer to $0.99 or even $0.49 for shorter chapters.</p>

      <p>Here's the logic laid out plainly:</p>

      <p>A 10-chapter story priced at $0.99 per chapter costs the reader $9.90 total. That's roughly the same as a print paperback, but the reader got no physical object. They might feel like they overpaid. Drop it to $0.49 per chapter and the full story costs $4.90 — a price that feels fair for a digital-only experience and leaves room for a premium collected edition later.</p>

      <p>If your chapters are longer (30+ pages of dense, full-color work), you can push toward $0.99–$1.99 per chapter. If they're shorter webtoon-style episodes (15–20 panels in vertical scroll), $0.25–$0.69 is more realistic for what the market will bear.</p>

      <p><strong>The point isn't to undervalue your work.</strong> The point is that pricing too high per chapter kills your readership before it starts. A reader who hesitates at $1.99 per chapter might never try your comic. A reader who picks it up for $0.49 might binge-read ten chapters in a sitting.</p>

      <h2>Volume Is the Strategy, Not Price</h2>

      <p>The creators who actually make money from digital comics aren't the ones charging the most per chapter. They're the ones with the most chapters for sale.</p>

      <p>Think of it this way: if you have 5 chapters at $0.99 each, your maximum revenue per reader is $4.95. But if you have 40 chapters at $0.49 each, your maximum revenue per reader is $19.60. The lower price per chapter made each purchase easier, and the larger catalog made the total spend higher.</p>

      <p>This is why serialized publishing is the dominant model in digital comics. Manga magazines in Japan understood this decades ago — individual chapters are cheap, but readers who follow a series for years spend far more in total than they would on a single book.</p>

      <p><strong>The practical implication:</strong> Don't agonize over squeezing an extra $0.50 out of each chapter. Focus on building a catalog. Every new chapter you publish is a new thing that can be sold — not just to new readers, but to existing fans who are already bought in.</p>

      <h2>How Many Chapters Should You Release?</h2>

      <p>This is the part most pricing guides ignore entirely, but it's inseparable from your pricing strategy.</p>

      <p>If you're starting a new series with no audience, your first arc needs to be long enough to hook readers but short enough that you (and your collaborator, if you have one) can actually finish it. A good target for a first arc is 8–12 chapters. Here's why:</p>

      <p><strong>Too few chapters (under 5)</strong> and readers can't tell if your story has legs. They might enjoy what's there but won't commit emotionally or financially to something that might never continue. It also gives you very little catalog to generate meaningful revenue.</p>

      <p><strong>Too many chapters planned upfront (30+)</strong> and you're betting months or years of work on an unproven concept. If the story doesn't land, you've sunk enormous effort into something that isn't finding its audience. And if you're collaborating with an artist, that's months of their time too.</p>

      <p><strong>8–12 chapters as a first arc</strong> gives you enough room to establish characters, build tension, and deliver a satisfying payoff. It's a complete experience that justifies asking readers to pay. And critically, it's achievable — a writer and artist working together can reasonably produce this in 3–6 months, depending on page count and complexity.</p>

      <p>After your first arc, you have real data. You know how many readers you have. You know your sell-through rate. You know whether the story has momentum. That's when you decide whether to continue, adjust, or start something new.</p>

      <p><strong>Release cadence matters as much as chapter count.</strong> Weekly or biweekly releases keep readers engaged and create a habit. Monthly releases work but require each chapter to deliver more value (longer, more polished) to justify the wait. Anything slower than monthly and you're fighting against readers forgetting you exist.</p>

      <h2>The Price Tiers That Actually Work</h2>

      <p>Based on what the market currently supports and the first-principles math above, here are the price ranges that make sense for indie digital comics in 2026:</p>

      <p><strong>$0.25–$0.49 per chapter</strong> works for shorter episodes (10–15 pages or vertical scroll format), new series building an audience, creators prioritizing readership growth over immediate revenue, and the first few chapters of any new series (consider making chapter one free).</p>

      <p><strong>$0.49–$0.99 per chapter</strong> works for standard-length chapters (20–30 pages), series with an established readership, full-color work with high production value, and genre work with dedicated fanbases (fantasy, horror, romance).</p>

      <p><strong>$0.99–$1.99 per chapter</strong> works for premium-length chapters (30+ pages), series with proven demand and strong sell-through, work from creators with an existing following, and chapters that include bonus content (behind-the-scenes, creator commentary).</p>

      <p><strong>$1.99+ per chapter</strong> is difficult to sustain for most indie creators unless you have a devoted fanbase. At this price point, you're competing with major publishers' digital offerings and you need production quality to match.</p>

      <p><strong>The free chapter strategy:</strong> Making your first chapter free is almost always the right move. It's the single most effective thing you can do to get readers into your funnel. A reader who enjoyed a free first chapter and sees chapter two for $0.49 is far more likely to buy than someone encountering a $0.99 paywall with no idea what they're getting.</p>

      <h2>What You Actually Take Home</h2>

      <p>Price is only half the equation. What matters is what lands in your pocket after the platform takes its cut.</p>

      <p>On most platforms, the creator's share varies dramatically. Ad-supported models like WEBTOON Canvas pay unpredictable amounts based on views, with many creators reporting fractions of a cent per read. Subscription models pool revenue and distribute based on reading time, which favors high-volume output over quality. Direct sales platforms take anywhere from 30% to 50% — Apple and Google each take 30% from app purchases, and many platforms take an additional cut on top of that.</p>

      <p>On a platform like ComiXology (now integrated into Amazon Kindle), a comic priced at $0.99 might net the creator as little as $0.35 after Amazon's cut — and that's before splitting with a collaborator.</p>

      <p><strong>This is why the platform you choose matters as much as the price you set.</strong> A comic priced at $0.49 on a platform where you keep 90% nets you $0.44. That same comic priced at $0.99 on a platform that takes 65% nets you $0.35. You made less money at the higher price.</p>

      <p><strong>On renaissBlock</strong>, the platform fee is 10% — and that's it. No app store middleman. No ad revenue guessing game. A chapter priced at $0.49 puts $0.44 directly into the creators' wallets, split automatically between collaborators according to their agreement. At $0.99, you keep $0.89. The math is simple because the system is simple.</p>

      <h2>Pricing With a Collaborator — Where It Gets Interesting</h2>

      <p>If you're a solo creator, pricing is straightforward. Everything you earn is yours. But most comic collaborations involve at least a writer and an artist, and the pricing conversation gets more nuanced when two people need to eat from the same plate.</p>

      <p><strong>The first-principles question:</strong> If you're splitting revenue 50/50 with your collaborator and pricing chapters at $0.49, each of you earns roughly $0.22 per sale after a 10% platform fee. At 100 sales per chapter, that's $22 each. At 1,000 sales, it's $220 each. At 10,000 sales, it's $2,200 each per chapter — and every chapter you've ever published keeps earning.</p>

      <p>This is where the long-term math of equity partnerships starts to look very different from one-time page rates. An artist who gets paid $200 per page for a 20-page chapter earns $4,000 once. An artist with a 50% revenue share on that same chapter earns nothing upfront — but if the series builds an audience, the cumulative earnings over months and years can far exceed the page rate.</p>

      <p>The risk is real. Revenue share means you earn nothing if nobody buys. But the upside is uncapped, and every chapter you add to the catalog increases the total earning potential of the entire series.</p>

      <p><strong>Here's what makes this work in practice:</strong> automatic, instant payment splitting. The reason revenue share has a bad reputation isn't the model — it's the enforcement. When one person controls the payment account and is responsible for manually sending their partner's share, things go wrong. Not always out of malice, but out of friction, forgetfulness, and human nature.</p>

      <p>On renaissBlock, this problem doesn't exist. Revenue splits are written into the transaction itself. When a reader buys a chapter, the writer's share and the artist's share are separated and delivered in the same moment. There's no delay, no invoice, no "I'll send your share this weekend." The deal you agreed to is the deal that executes, every time, automatically.</p>

      <p>This changes the pricing conversation between collaborators. Instead of negotiating who gets paid what and when, you're just agreeing on a percentage — and then focusing on making the work good enough that people want to buy it.</p>

      <h2>The Royalty Advantage — Earning From Every Future Sale</h2>

      <p>Here's something most creators don't think about when pricing their chapters: the difference between selling a comic and selling a <em>digital asset that keeps earning</em>.</p>

      <p>When you sell a print comic, the transaction is done. The reader owns the book. If they lend it to a friend, give it away, or resell it, you see nothing from that. You earned once.</p>

      <p>Digital comics on most platforms work similarly — one sale, one payment. But on renaissBlock, your published chapters are minted as digital collectibles on the blockchain. This sounds technical, but what it means for you is simple: if a reader decides to resell or transfer their copy, you — the creator — automatically receive a royalty from that secondary sale. Not because someone remembered to pay you. Because it's built into the asset itself.</p>

      <p>This is a fundamental shift in how creative work generates value. Traditional pricing assumes each chapter earns once. With automatic royalties on resale, each chapter can earn multiple times over its lifetime. A reader who buys your chapter today and resells it to another reader in two years still sends money back to you and your collaborator — split automatically, according to the same agreement you set up from the beginning.</p>

      <p><strong>How this affects your pricing strategy:</strong> If your chapters have ongoing earning potential beyond the initial sale, you can afford to price them lower upfront. A $0.49 chapter that earns you $0.44 on the first sale, plus a percentage of every future resale, is worth more over time than a $1.99 chapter that earns once and sits in someone's library forever.</p>

      <p>You don't need to understand blockchain to benefit from this. You don't need a crypto wallet or any technical knowledge. You just set your price, set your revenue split, and publish. The system handles the rest.</p>

      <h2>Pricing Strategy for Your First Series — A Practical Roadmap</h2>

      <p>If you're launching your first comic, here's a concrete pricing approach that balances audience growth with revenue:</p>

      <p><strong>Chapter 1: Free.</strong> No exceptions. This is your hook. Remove every barrier to entry. Let readers discover your work with zero risk.</p>

      <p><strong>Chapters 2–4: $0.49 each.</strong> Low enough that readers who enjoyed chapter one won't hesitate. This is where you convert free readers into paying readers. The transition from free to paid is the hardest jump — make it as small as possible.</p>

      <p><strong>Chapters 5+: $0.49–$0.99 each.</strong> By chapter five, readers are invested. They've committed time and money to your story. You can increase the price slightly, especially if your chapters are getting longer or more polished as you hit your stride.</p>

      <p><strong>Collected arc (chapters 1–10): $3.99–$5.99.</strong> Bundle your first arc at a slight discount compared to buying chapters individually. This gives new readers a low-friction way to catch up and gives you a premium product to promote.</p>

      <p><strong>Adjust based on data, not instinct.</strong> After your first arc, look at your actual numbers. What's your conversion rate from free to paid? Where do readers drop off? If chapter three has a steep drop, the price isn't the problem — the story is. If readers are buying every chapter but you're not growing, your marketing needs work, not your pricing.</p>

      <h2>The Uncomfortable Truth About Comic Pricing</h2>

      <p>Here's the thing nobody in the indie comics world wants to say out loud: <strong>most comics, at any price, don't sell enough copies to matter.</strong></p>

      <p>The difference between a comic priced at $0.49 and one priced at $1.99 is irrelevant if only 12 people buy it. The creators who succeed aren't the ones who found the perfect price point — they're the ones who found an audience.</p>

      <p>Pricing is a lever, but it's not the biggest lever. The biggest levers are the quality of your work, the consistency of your output, and your ability to get the right readers to see chapter one. Get those right, and almost any reasonable price will work. Get those wrong, and no price — not even free — will save you.</p>

      <p>So price your work fairly, keep it accessible, and then pour your energy into the things that actually move the needle: making comics people want to read, and making sure people know they exist.</p>

      <p>Your first chapter is worth whatever it takes to get someone to read it. Everything after that is worth whatever your story earns.</p>

      <p><strong><a href="https://renaissblock.com">Publish your first chapter on renaissBlock &rarr;</a></strong></p>
    </>
  );
}

/* ================================================================
   ARTICLE: Anatomy of a Comic — Visual Guide
   ================================================================ */

/* Color palette for SVG diagrams (matching marketing CSS variables) */
const D = {
  gold: '#FF9500', bg: '#0a0f1a', surface: '#0e1527', surfaceLight: '#253a50',
  text: '#e5e7eb', textSec: '#94a3b8', textMuted: '#64748b',
  border: '#334155', borderAlpha: 'rgba(51,65,85,0.5)',
  bleed: '#C0392B', gutter: '#2E86AB', panel: '#FF9500',
  balloon: '#27AE60', caption: '#8E44AD', sfx: '#E74C3C',
};

function DiagramCallout(props: {
  x: number; y: number; labelX: number; labelY: number;
  label: string; color: string; align?: 'right' | 'left'; dotSize?: number;
}) {
  const { x, y, labelX, labelY, label, color, align = 'right', dotSize = 6 } = props;
  const lineEndX = align === 'right' ? labelX - 6 : labelX + 6;
  return (
    <g>
      <circle cx={x} cy={y} r={dotSize} fill={color} opacity={0.9} />
      <circle cx={x} cy={y} r={dotSize + 3} fill={color} opacity={0.2} />
      <line x1={x} y1={y} x2={lineEndX} y2={labelY} stroke={color} strokeWidth={1.5} strokeDasharray="4,3" opacity={0.6} />
      <text x={labelX} y={labelY + 4} fill={color} fontSize={14} fontWeight={600} fontFamily="Inter, sans-serif" textAnchor={align === 'right' ? 'start' : 'end'}>{label}</text>
    </g>
  );
}

function PageAnatomyDiagram() {
  return (
    <div className="mk-diagram-content">
      <p className="mk-diagram-desc">
        A traditional comic page broken down into its core components.
        Every element serves a purpose in guiding the reader's eye through the story.
      </p>
      <svg viewBox="0 0 620 520" width="100%" style={{ maxWidth: 620 }}>
        <rect x={60} y={20} width={360} height={480} rx={2} fill={D.bleed} opacity={0.22} stroke={D.bleed} strokeWidth={1.5} strokeDasharray="6,4" />
        <rect x={80} y={40} width={320} height={440} rx={1} fill={D.surface} stroke={D.border} strokeWidth={1} />
        <rect x={100} y={60} width={280} height={120} rx={2} fill={D.surfaceLight} stroke={D.panel} strokeWidth={1.5} />
        <rect x={80} y={60} width={20} height={120} fill={D.surfaceLight} opacity={0.7} />
        <rect x={110} y={70} width={120} height={28} rx={3} fill={D.caption} opacity={0.4} stroke={D.caption} strokeWidth={1} />
        <text x={130} y={88} fill={D.caption} fontSize={11} fontFamily="Inter, sans-serif">CAPTION BOX</text>
        <text x={300} y={150} fill={D.sfx} fontSize={28} fontFamily="Georgia, serif" fontWeight={900} fontStyle="italic" opacity={0.75} transform="rotate(-12, 300, 150)">KRAK!</text>
        <rect x={100} y={180} width={280} height={12} fill={D.gutter} opacity={0.25} />
        <rect x={100} y={192} width={134} height={100} rx={2} fill={D.surfaceLight} stroke={D.panel} strokeWidth={1.5} />
        <rect x={246} y={192} width={134} height={100} rx={2} fill={D.surfaceLight} stroke={D.panel} strokeWidth={1.5} />
        <ellipse cx={167} cy={222} rx={48} ry={22} fill={D.balloon} opacity={0.35} stroke={D.balloon} strokeWidth={1} />
        <text x={167} y={226} fill={D.balloon} fontSize={10} fontFamily="Inter, sans-serif" textAnchor="middle">DIALOGUE</text>
        <polygon points="155,244 162,244 150,260" fill={D.balloon} opacity={0.35} stroke={D.balloon} strokeWidth={0.8} />
        <rect x={234} y={192} width={12} height={100} fill={D.gutter} opacity={0.25} />
        <rect x={100} y={304} width={86} height={80} rx={2} fill={D.surfaceLight} stroke={D.panel} strokeWidth={1.5} />
        <rect x={198} y={304} width={86} height={80} rx={2} fill={D.surfaceLight} stroke={D.panel} strokeWidth={1.5} />
        <rect x={296} y={304} width={84} height={80} rx={2} fill={D.surfaceLight} stroke={D.panel} strokeWidth={1.5} />
        <rect x={100} y={396} width={280} height={68} rx={2} fill={D.surfaceLight} stroke={D.panel} strokeWidth={1.5} />
        <defs>
          <marker id="arrowhead" markerWidth={8} markerHeight={6} refX={8} refY={3} orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill={D.textMuted} opacity={0.4} />
          </marker>
        </defs>
        <path d="M 140,120 L 340,120 L 140,240 L 340,240 L 140,340 L 340,340 L 240,430" fill="none" stroke={D.textMuted} strokeWidth={1} strokeDasharray="3,4" opacity={0.25} markerEnd="url(#arrowhead)" />
        <DiagramCallout x={70} y={120} labelX={455} labelY={40} label="BLEED AREA" color={D.bleed} />
        <DiagramCallout x={240} y={186} labelX={455} labelY={76} label="GUTTER" color={D.gutter} />
        <DiagramCallout x={240} y={140} labelX={455} labelY={112} label="PANEL" color={D.panel} />
        <DiagramCallout x={167} y={222} labelX={455} labelY={148} label="WORD BALLOON" color={D.balloon} />
        <DiagramCallout x={170} y={84} labelX={455} labelY={184} label="CAPTION BOX" color={D.caption} />
        <DiagramCallout x={320} y={140} labelX={455} labelY={220} label="SOUND EFFECT" color={D.sfx} />
        <text x={240} y={500} fill={D.textMuted} fontSize={13} fontFamily="Inter, sans-serif" textAnchor="middle" opacity={0.7}>Z-pattern reading flow →</text>
      </svg>
    </div>
  );
}

function ReadingDirectionDiagram() {
  return (
    <div className="mk-diagram-content">
      <p className="mk-diagram-desc">
        Western comics read left-to-right. Manga reads right-to-left. The panel order,
        word balloon placement, and even book binding are all mirrored. Choose your format
        before you start — it affects every page.
      </p>
      <div className="mk-diagram-compare">
        {/* Western LTR */}
        <div className="mk-diagram-col">
          <div className="mk-diagram-col-title">Western (LTR)</div>
          <svg viewBox="0 0 240 340" width={280}>
            <defs>
              <marker id="arrowLTR" markerWidth={8} markerHeight={6} refX={8} refY={3} orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill={D.gold} opacity={0.6} />
              </marker>
            </defs>
            <rect x={20} y={10} width={200} height={280} rx={2} fill={D.surface} stroke={D.border} strokeWidth={1} />
            <rect x={20} y={10} width={5} height={280} rx={1} fill={D.gold} opacity={0.5} />
            <text x={10} y={150} fill={D.gold} fontSize={11} fontFamily="Inter, sans-serif" textAnchor="middle" fontWeight={600} transform="rotate(-90, 10, 150)" opacity={0.6}>SPINE</text>
            <rect x={34} y={24} width={86} height={70} rx={2} fill={D.surfaceLight} stroke={D.panel} strokeWidth={1} />
            <rect x={128} y={24} width={78} height={70} rx={2} fill={D.surfaceLight} stroke={D.panel} strokeWidth={1} />
            <circle cx={54} cy={59} r={12} fill={D.gold} opacity={0.35} stroke={D.gold} strokeWidth={1} />
            <text x={54} y={63} fill={D.gold} fontSize={12} fontWeight={700} fontFamily="Inter, sans-serif" textAnchor="middle">1</text>
            <circle cx={167} cy={59} r={12} fill={D.gold} opacity={0.35} stroke={D.gold} strokeWidth={1} />
            <text x={167} y={63} fill={D.gold} fontSize={12} fontWeight={700} fontFamily="Inter, sans-serif" textAnchor="middle">2</text>
            <rect x={34} y={102} width={54} height={60} rx={2} fill={D.surfaceLight} stroke={D.panel} strokeWidth={1} />
            <rect x={96} y={102} width={54} height={60} rx={2} fill={D.surfaceLight} stroke={D.panel} strokeWidth={1} />
            <rect x={158} y={102} width={48} height={60} rx={2} fill={D.surfaceLight} stroke={D.panel} strokeWidth={1} />
            <circle cx={61} cy={132} r={12} fill={D.gold} opacity={0.35} stroke={D.gold} strokeWidth={1} />
            <text x={61} y={136} fill={D.gold} fontSize={12} fontWeight={700} fontFamily="Inter, sans-serif" textAnchor="middle">3</text>
            <circle cx={123} cy={132} r={12} fill={D.gold} opacity={0.35} stroke={D.gold} strokeWidth={1} />
            <text x={123} y={136} fill={D.gold} fontSize={12} fontWeight={700} fontFamily="Inter, sans-serif" textAnchor="middle">4</text>
            <circle cx={182} cy={132} r={12} fill={D.gold} opacity={0.35} stroke={D.gold} strokeWidth={1} />
            <text x={182} y={136} fill={D.gold} fontSize={12} fontWeight={700} fontFamily="Inter, sans-serif" textAnchor="middle">5</text>
            <rect x={34} y={170} width={172} height={55} rx={2} fill={D.surfaceLight} stroke={D.panel} strokeWidth={1} />
            <circle cx={120} cy={197} r={12} fill={D.gold} opacity={0.35} stroke={D.gold} strokeWidth={1} />
            <text x={120} y={201} fill={D.gold} fontSize={12} fontWeight={700} fontFamily="Inter, sans-serif" textAnchor="middle">6</text>
            <ellipse cx={58} cy={42} rx={22} ry={10} fill={D.balloon} opacity={0.3} stroke={D.balloon} strokeWidth={0.8} />
            <text x={58} y={45} fill={D.balloon} fontSize={9} fontFamily="Inter, sans-serif" textAnchor="middle">first</text>
            <ellipse cx={155} cy={42} rx={22} ry={10} fill={D.balloon} opacity={0.3} stroke={D.balloon} strokeWidth={0.8} />
            <text x={155} y={45} fill={D.balloon} fontSize={9} fontFamily="Inter, sans-serif" textAnchor="middle">second</text>
            <path d="M 54,72 L 167,72 L 167,82 L 61,98 L 61,108 L 61,142 L 123,142 L 123,148 L 182,142 L 182,166 L 120,175" fill="none" stroke={D.gold} strokeWidth={1.5} strokeDasharray="4,3" opacity={0.5} markerEnd="url(#arrowLTR)" />
            <path d="M 210,150 Q 228,150 228,170 Q 228,190 210,190" fill="none" stroke={D.textMuted} strokeWidth={1} strokeDasharray="3,3" opacity={0.4} />
            <text x={232} y={174} fill={D.textMuted} fontSize={10} fontFamily="Inter, sans-serif" opacity={0.7}>turn</text>
            <text x={54} y={18} fill={D.gold} fontSize={10} fontFamily="Inter, sans-serif" textAnchor="middle" fontWeight={700} opacity={0.9}>START ↓</text>
            <text x={120} y={255} fill={D.text} fontSize={12} fontFamily="Inter, sans-serif" textAnchor="middle" fontWeight={600}>Left → Right, Top → Bottom</text>
            <text x={120} y={270} fill={D.textSec} fontSize={11} fontFamily="Inter, sans-serif" textAnchor="middle" opacity={0.8}>Balloons: top-left read first</text>
            <text x={120} y={285} fill={D.textSec} fontSize={11} fontFamily="Inter, sans-serif" textAnchor="middle" opacity={0.8}>Book opens from the right</text>
            <text x={120} y={310} fill={D.textSec} fontSize={10} fontFamily="Inter, sans-serif" textAnchor="middle" fontStyle="italic" opacity={0.7}>Spider-Man · Saga · Invincible · Watchmen</text>
          </svg>
        </div>

        {/* Manga RTL */}
        <div className="mk-diagram-col">
          <div className="mk-diagram-col-title">Manga (RTL)</div>
          <svg viewBox="0 0 240 340" width={280}>
            <defs>
              <marker id="arrowRTL" markerWidth={8} markerHeight={6} refX={8} refY={3} orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill={D.sfx} opacity={0.6} />
              </marker>
            </defs>
            <rect x={20} y={10} width={200} height={280} rx={2} fill={D.surface} stroke={D.border} strokeWidth={1} />
            <rect x={215} y={10} width={5} height={280} rx={1} fill={D.sfx} opacity={0.5} />
            <text x={230} y={150} fill={D.sfx} fontSize={11} fontFamily="Inter, sans-serif" textAnchor="middle" fontWeight={600} transform="rotate(90, 230, 150)" opacity={0.6}>SPINE</text>
            <rect x={128} y={24} width={78} height={70} rx={2} fill={D.surfaceLight} stroke={D.panel} strokeWidth={1} />
            <rect x={34} y={24} width={86} height={70} rx={2} fill={D.surfaceLight} stroke={D.panel} strokeWidth={1} />
            <circle cx={167} cy={59} r={12} fill={D.sfx} opacity={0.35} stroke={D.sfx} strokeWidth={1} />
            <text x={167} y={63} fill={D.sfx} fontSize={12} fontWeight={700} fontFamily="Inter, sans-serif" textAnchor="middle">1</text>
            <circle cx={77} cy={59} r={12} fill={D.sfx} opacity={0.35} stroke={D.sfx} strokeWidth={1} />
            <text x={77} y={63} fill={D.sfx} fontSize={12} fontWeight={700} fontFamily="Inter, sans-serif" textAnchor="middle">2</text>
            <rect x={158} y={102} width={48} height={60} rx={2} fill={D.surfaceLight} stroke={D.panel} strokeWidth={1} />
            <rect x={96} y={102} width={54} height={60} rx={2} fill={D.surfaceLight} stroke={D.panel} strokeWidth={1} />
            <rect x={34} y={102} width={54} height={60} rx={2} fill={D.surfaceLight} stroke={D.panel} strokeWidth={1} />
            <circle cx={182} cy={132} r={12} fill={D.sfx} opacity={0.35} stroke={D.sfx} strokeWidth={1} />
            <text x={182} y={136} fill={D.sfx} fontSize={12} fontWeight={700} fontFamily="Inter, sans-serif" textAnchor="middle">3</text>
            <circle cx={123} cy={132} r={12} fill={D.sfx} opacity={0.35} stroke={D.sfx} strokeWidth={1} />
            <text x={123} y={136} fill={D.sfx} fontSize={12} fontWeight={700} fontFamily="Inter, sans-serif" textAnchor="middle">4</text>
            <circle cx={61} cy={132} r={12} fill={D.sfx} opacity={0.35} stroke={D.sfx} strokeWidth={1} />
            <text x={61} y={136} fill={D.sfx} fontSize={12} fontWeight={700} fontFamily="Inter, sans-serif" textAnchor="middle">5</text>
            <rect x={34} y={170} width={172} height={55} rx={2} fill={D.surfaceLight} stroke={D.panel} strokeWidth={1} />
            <circle cx={120} cy={197} r={12} fill={D.sfx} opacity={0.35} stroke={D.sfx} strokeWidth={1} />
            <text x={120} y={201} fill={D.sfx} fontSize={12} fontWeight={700} fontFamily="Inter, sans-serif" textAnchor="middle">6</text>
            <ellipse cx={178} cy={42} rx={22} ry={10} fill={D.balloon} opacity={0.3} stroke={D.balloon} strokeWidth={0.8} />
            <text x={178} y={45} fill={D.balloon} fontSize={9} fontFamily="Inter, sans-serif" textAnchor="middle">first</text>
            <ellipse cx={65} cy={42} rx={22} ry={10} fill={D.balloon} opacity={0.3} stroke={D.balloon} strokeWidth={0.8} />
            <text x={65} y={45} fill={D.balloon} fontSize={9} fontFamily="Inter, sans-serif" textAnchor="middle">second</text>
            <path d="M 167,72 L 77,72 L 77,82 L 182,98 L 182,108 L 182,142 L 123,142 L 123,148 L 61,142 L 61,166 L 120,175" fill="none" stroke={D.sfx} strokeWidth={1.5} strokeDasharray="4,3" opacity={0.5} markerEnd="url(#arrowRTL)" />
            <path d="M 30,150 Q 12,150 12,170 Q 12,190 30,190" fill="none" stroke={D.textMuted} strokeWidth={1} strokeDasharray="3,3" opacity={0.4} />
            <text x={5} y={174} fill={D.textMuted} fontSize={8} fontFamily="Inter, sans-serif" opacity={0.5} textAnchor="end">turn</text>
            <text x={178} y={18} fill={D.sfx} fontSize={10} fontFamily="Inter, sans-serif" textAnchor="middle" fontWeight={700} opacity={0.9}>↓ START</text>
            <text x={120} y={255} fill={D.text} fontSize={12} fontFamily="Inter, sans-serif" textAnchor="middle" fontWeight={600}>Right → Left, Top → Bottom</text>
            <text x={120} y={270} fill={D.textSec} fontSize={11} fontFamily="Inter, sans-serif" textAnchor="middle" opacity={0.8}>Balloons: top-right read first</text>
            <text x={120} y={285} fill={D.textSec} fontSize={11} fontFamily="Inter, sans-serif" textAnchor="middle" opacity={0.8}>Book opens from the left</text>
            <text x={120} y={310} fill={D.textSec} fontSize={10} fontFamily="Inter, sans-serif" textAnchor="middle" fontStyle="italic" opacity={0.7}>One Piece · Naruto · Attack on Titan · JJK</text>
          </svg>
        </div>
      </div>

      {/* Key differences summary */}
      <div className="mk-diagram-info-box">
        <div className="mk-diagram-info-title">WHY THIS MATTERS FOR YOUR COMIC</div>
        <div className="mk-diagram-bullets" style={{ maxWidth: '100%' }}>
          {[
            { color: D.gold, text: 'Choose your direction before drawing a single panel — it affects every layout decision' },
            { color: D.balloon, text: 'Word balloon placement is completely mirrored — top-left first (LTR) vs top-right first (RTL)' },
            { color: D.panel, text: 'Page turns reveal from opposite sides — right-page reveals (LTR) vs left-page reveals (RTL)' },
            { color: D.textSec, text: 'Manhwa (Korean comics) uses LTR like Western — only Japanese manga is RTL' },
            { color: D.sfx, text: 'Vertical scroll format avoids this entirely — panels just stack top to bottom' },
          ].map((item, i) => (
            <div key={i} className="mk-diagram-bullet">
              <span className="mk-diagram-bullet-icon" style={{ color: item.color }}>◆</span>
              <span className="mk-diagram-bullet-text">{item.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PrintVsScrollDiagram() {
  return (
    <div className="mk-diagram-content">
      <p className="mk-diagram-desc">
        Same story, two formats. Print composes full pages read in Z-patterns.
        Scroll stacks panels vertically, controlling pacing through spacing.
      </p>
      <div className="mk-diagram-compare">
        {/* Print format */}
        <div className="mk-diagram-col">
          <div className="mk-diagram-col-title">Traditional Page</div>
          <svg viewBox="0 0 220 310" width={280}>
            <rect x={10} y={10} width={200} height={290} rx={2} fill={D.surface} stroke={D.border} strokeWidth={1} />
            <rect x={22} y={22} width={176} height={70} rx={2} fill={D.surfaceLight} stroke={D.panel} strokeWidth={1} />
            <rect x={30} y={30} width={70} height={18} rx={2} fill={D.caption} opacity={0.4} />
            <text x={65} y={42} fill={D.caption} fontSize={9} textAnchor="middle" fontFamily="Inter, sans-serif">Caption</text>
            <rect x={22} y={100} width={84} height={60} rx={2} fill={D.surfaceLight} stroke={D.panel} strokeWidth={1} />
            <rect x={114} y={100} width={84} height={60} rx={2} fill={D.surfaceLight} stroke={D.panel} strokeWidth={1} />
            <ellipse cx={64} cy={120} rx={28} ry={12} fill={D.balloon} opacity={0.3} stroke={D.balloon} strokeWidth={0.8} />
            <ellipse cx={156} cy={125} rx={24} ry={10} fill={D.balloon} opacity={0.3} stroke={D.balloon} strokeWidth={0.8} />
            <rect x={22} y={168} width={54} height={50} rx={2} fill={D.surfaceLight} stroke={D.panel} strokeWidth={1} />
            <rect x={84} y={168} width={54} height={50} rx={2} fill={D.surfaceLight} stroke={D.panel} strokeWidth={1} />
            <rect x={146} y={168} width={52} height={50} rx={2} fill={D.surfaceLight} stroke={D.panel} strokeWidth={1} />
            <text x={172} y={200} fill={D.sfx} fontSize={14} fontWeight={900} fontStyle="italic" fontFamily="Georgia, serif" opacity={0.6} transform="rotate(-8,172,200)">BAM</text>
            <rect x={22} y={226} width={176} height={60} rx={2} fill={D.surfaceLight} stroke={D.panel} strokeWidth={1} />
            <path d="M 50,55 L 170,55 L 50,130 L 170,130 L 50,195 L 170,195 L 110,260" fill="none" stroke={D.gold} strokeWidth={1} strokeDasharray="3,3" opacity={0.3} />
          </svg>
          <div style={{ textAlign: 'center', color: D.textSec, fontSize: 13, fontFamily: 'Inter, sans-serif', marginTop: 6, opacity: 0.8 }}>5–9 panels per page</div>
          <div className="mk-diagram-bullets">
            {['Full page visible at once', 'Complex multi-panel layouts', 'Z-pattern reading flow', 'Page turns create reveals'].map((t, i) => (
              <div key={i} className="mk-diagram-bullet">
                <span className="mk-diagram-bullet-icon">◆</span>
                <span className="mk-diagram-bullet-text">{t}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll format */}
        <div className="mk-diagram-col">
          <div className="mk-diagram-col-title">Vertical Scroll</div>
          <svg viewBox="0 0 280 310" width={280}>
            <rect x={40} y={5} width={140} height={300} rx={12} fill="none" stroke={D.border} strokeWidth={1.5} />
            <rect x={42} y={20} width={136} height={270} fill={D.surface} />
            <rect x={50} y={28} width={120} height={50} rx={2} fill={D.surfaceLight} stroke={D.panel} strokeWidth={1} />
            <rect x={56} y={34} width={60} height={14} rx={2} fill={D.caption} opacity={0.4} />
            <rect x={50} y={92} width={120} height={40} rx={2} fill={D.surfaceLight} stroke={D.panel} strokeWidth={1} />
            <ellipse cx={110} cy={107} rx={30} ry={10} fill={D.balloon} opacity={0.3} stroke={D.balloon} strokeWidth={0.8} />
            <rect x={50} y={138} width={120} height={35} rx={2} fill={D.surfaceLight} stroke={D.panel} strokeWidth={1} />
            <text x={110} y={160} fill={D.sfx} fontSize={14} fontWeight={900} fontStyle="italic" fontFamily="Georgia, serif" opacity={0.6}>BAM</text>
            <rect x={50} y={178} width={120} height={35} rx={2} fill={D.surfaceLight} stroke={D.panel} strokeWidth={1} />
            <rect x={50} y={232} width={120} height={45} rx={2} fill={D.surfaceLight} stroke={D.panel} strokeWidth={1} />
            <path d="M 110,28 L 110,275" fill="none" stroke={D.gold} strokeWidth={1} strokeDasharray="3,3" opacity={0.2} />
            <text x={188} y={86} fill={D.gutter} fontSize={11} fontFamily="Inter, sans-serif" fontWeight={600}>← slow pause</text>
            <text x={188} y={136} fill={D.sfx} fontSize={11} fontFamily="Inter, sans-serif" fontWeight={600}>← quick cut</text>
            <text x={188} y={218} fill={D.gutter} fontSize={11} fontFamily="Inter, sans-serif" fontWeight={600}>← big reveal</text>
            <rect x={90} y={8} width={40} height={4} rx={2} fill={D.border} opacity={0.5} />
          </svg>
          <div style={{ textAlign: 'center', color: D.textSec, fontSize: 13, fontFamily: 'Inter, sans-serif', marginTop: 6, opacity: 0.8 }}>1–2 panels visible at a time</div>
          <div className="mk-diagram-bullets">
            {['One panel at a time', 'Full-width stacked panels', 'Spacing controls pacing', 'Scrolling replaces page turns'].map((t, i) => (
              <div key={i} className="mk-diagram-bullet">
                <span className="mk-diagram-bullet-icon">◆</span>
                <span className="mk-diagram-bullet-text">{t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ChapterStructureDiagram() {
  const sections = [
    { label: 'COVER', sub: 'Title · Chapter # · Credits · Publisher logo', color: D.gold, icon: '◉' },
    { label: 'CREDITS / INDICIA', sub: 'Full names & roles · Copyright · Publisher info · Rating', color: D.textSec, icon: '◎' },
    { label: 'RECAP (Ch. 2+)', sub: '"Previously on..." · Key moment reminder', color: D.caption, icon: '◎', optional: true },
    { label: 'SPLASH / TITLE PAGE', sub: 'Opening shot · Chapter title · Abbreviated credits', color: D.panel, icon: '◉' },
    { label: 'INTERIOR PAGES', sub: 'Panels · Dialogue · Narration · SFX · The story itself', color: D.gold, icon: '◉', main: true },
    { label: 'CLOSING PANEL', sub: 'Chapter-ending hook · Cliffhanger or resolution', color: D.panel, icon: '◉' },
    { label: 'NEXT CHAPTER TEASER', sub: 'Preview image or text · "Next: Chapter 4"', color: D.balloon, icon: '◎' },
    { label: 'CREATOR NOTES', sub: 'Behind the scenes · Process insights · Personal note', color: D.textSec, icon: '◎' },
    { label: 'BACK MATTER', sub: 'Character profiles · Glossary · Other works · Links', color: D.textSec, icon: '◎', optional: true },
  ];

  return (
    <div className="mk-diagram-content">
      <p className="mk-diagram-desc">
        The complete structure of a digital comic chapter, from the first thing
        a reader sees to the last. Items marked optional can be skipped for later chapters.
      </p>
      <div className="mk-diagram-flow">
        {sections.map((s, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div className={`mk-diagram-flow-item${s.main ? ' mk-diagram-flow-item--main' : ''}`}>
              <div className="mk-diagram-flow-icon" style={{ background: `${s.color}18`, border: `2px solid ${s.color}60`, color: s.color }}>{s.icon}</div>
              <div className="mk-diagram-flow-body">
                <div className="mk-diagram-flow-header">
                  <span className="mk-diagram-flow-label" style={{ color: s.color }}>{s.label}</span>
                  {s.optional && <span className="mk-diagram-flow-badge">OPTIONAL</span>}
                </div>
                <div className="mk-diagram-flow-sub">{s.sub}</div>
              </div>
              <div className="mk-diagram-flow-num">{String(i + 1).padStart(2, '0')}</div>
            </div>
            {i < sections.length - 1 && <div className="mk-diagram-flow-connector" />}
          </div>
        ))}
      </div>
      <div className="mk-diagram-legend">
        <span><span style={{ color: D.gold }}>◉</span> Essential</span>
        <span><span style={{ color: D.textSec }}>◎</span> Recommended</span>
      </div>
    </div>
  );
}

function CoverAnatomyDiagram() {
  return (
    <div className="mk-diagram-content">
      <p className="mk-diagram-desc">
        Every element on a comic cover serves a purpose — from selling the book to establishing
        your brand. Here's where everything goes.
      </p>
      <svg viewBox="0 0 580 480" width="100%" style={{ maxWidth: 580 }}>
        <rect x={140} y={20} width={280} height={430} rx={4} fill={D.surface} stroke={D.border} strokeWidth={1.5} />
        <rect x={158} y={36} width={56} height={20} rx={3} fill={D.gold} opacity={0.35} stroke={D.gold} strokeWidth={1} />
        <text x={186} y={50} fill={D.gold} fontSize={8} fontFamily="Inter, sans-serif" textAnchor="middle" fontWeight={700}>rB</text>
        <rect x={158} y={70} width={244} height={36} rx={2} fill="transparent" stroke={D.panel} strokeWidth={1.5} strokeDasharray="4,3" />
        <text x={280} y={94} fill={D.text} fontSize={20} fontFamily="Georgia, serif" textAnchor="middle" fontWeight={700} opacity={0.7}>COMIC TITLE</text>
        <rect x={340} y={36} width={62} height={20} rx={3} fill={D.surfaceLight} stroke={D.textMuted} strokeWidth={0.8} />
        <text x={371} y={50} fill={D.textMuted} fontSize={9} fontFamily="Inter, sans-serif" textAnchor="middle">CH. 03</text>
        <rect x={158} y={118} width={244} height={260} rx={2} fill={D.surfaceLight} stroke={D.panel} strokeWidth={1} strokeDasharray="6,4" />
        <text x={280} y={245} fill={D.textMuted} fontSize={14} fontFamily="Inter, sans-serif" textAnchor="middle">[ COVER ART ]</text>
        <text x={280} y={265} fill={D.textMuted} fontSize={10} fontFamily="Inter, sans-serif" textAnchor="middle">The illustration that</text>
        <text x={280} y={280} fill={D.textMuted} fontSize={10} fontFamily="Inter, sans-serif" textAnchor="middle">sells the chapter</text>
        <text x={280} y={400} fill={D.textSec} fontSize={10} fontFamily="Inter, sans-serif" textAnchor="middle">Written by SMITH · Art by JANE</text>
        <rect x={240} y={412} width={80} height={18} rx={9} fill={D.gold} opacity={0.15} stroke={D.gold} strokeWidth={0.8} />
        <text x={280} y={424} fill={D.gold} fontSize={8} fontFamily="Inter, sans-serif" textAnchor="middle">FANTASY</text>
        <DiagramCallout x={186} y={46} labelX={12} labelY={36} label="PUBLISHER LOGO" color={D.gold} align="left" dotSize={4} />
        <DiagramCallout x={280} y={88} labelX={455} labelY={60} label="SERIES TITLE" color={D.panel} dotSize={4} />
        <DiagramCallout x={371} y={46} labelX={455} labelY={96} label="CHAPTER NUMBER" color={D.textMuted} dotSize={4} />
        <DiagramCallout x={280} y={248} labelX={455} labelY={180} label="COVER ART" color={D.panel} dotSize={4} />
        <DiagramCallout x={280} y={400} labelX={455} labelY={300} label="CREATOR CREDITS" color={D.textSec} dotSize={4} />
        <DiagramCallout x={280} y={421} labelX={455} labelY={336} label="GENRE TAG" color={D.gold} dotSize={4} />
        <text x={455} y={410} fill={D.textMuted} fontSize={9} fontFamily="Inter, sans-serif">Digital covers also serve</text>
        <text x={455} y={424} fill={D.textMuted} fontSize={9} fontFamily="Inter, sans-serif">as the thumbnail in</text>
        <text x={455} y={438} fill={D.textMuted} fontSize={9} fontFamily="Inter, sans-serif">search results and feeds</text>
      </svg>
    </div>
  );
}

function ComicAnatomyGuide() {
  const [activeTab, setActiveTab] = useState('page');
  const tabs = [
    { id: 'page', label: 'Page Anatomy' },
    { id: 'reading', label: 'Reading Direction' },
    { id: 'compare', label: 'Print vs. Scroll' },
    { id: 'flow', label: 'Chapter Structure' },
    { id: 'cover', label: 'Cover Anatomy' },
  ];

  return (
    <>
      <p className="mk-article-lead">
        Whether you're writing your first script or drawing your first panel, understanding how comics are built helps you communicate clearly with collaborators, pace your story effectively, and present your work professionally.
      </p>
      <p>
        This interactive guide breaks down the core building blocks of comic creation — from page anatomy and reading direction to chapter structure and cover design. Select a tab below to explore each element.
      </p>

      <hr className="mk-article-divider" />

      <div className="mk-diagram-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`mk-diagram-tab${activeTab === tab.id ? ' mk-diagram-tab--active' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mk-diagram-panel">
        {activeTab === 'page' && <PageAnatomyDiagram />}
        {activeTab === 'reading' && <ReadingDirectionDiagram />}
        {activeTab === 'compare' && <PrintVsScrollDiagram />}
        {activeTab === 'flow' && <ChapterStructureDiagram />}
        {activeTab === 'cover' && <CoverAnatomyDiagram />}
      </div>

      <p className="mk-diagram-footer-note">Part of the renaissBlock Creator Education Series</p>

      <p><strong><a href="https://renaissblock.com">Start creating on renaissBlock &rarr;</a></strong></p>
    </>
  );
}

/* ---- Article content keyed by slug ---- */
const articleContent: Record<string, () => JSX.Element> = {
  'anatomy-of-a-comic-visual-guide': ComicAnatomyGuide,
  'how-to-price-webcomic-indie-comic': PricingGuide,
  'writer-artist-first-collaboration-guide': WriterArtistGuide,
};
