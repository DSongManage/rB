import SEOHead from './SEOHead';
import MarketingLayout from './MarketingLayout';

const faqPageSchema = {
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Do I need to know anything about crypto or blockchain?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "No. renaissBlock handles all the technical complexity behind the scenes. You sign up, create, publish, and earn — just like any other platform. Your wallet is created automatically and you cash out to your regular bank account."
      }
    },
    {
      "@type": "Question",
      "name": "How are revenue splits enforced?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Revenue splits are enforced by smart contracts on the Solana blockchain. When a reader purchases your work, the payment is automatically divided according to your agreed split and deposited into each collaborator's wallet instantly. No one can change the split after it's set."
      }
    },
    {
      "@type": "Question",
      "name": "What does renaissBlock charge?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "The platform takes a 10% fee on sales. Founding creators — the first 50 to complete a project earning $100+ in sales — receive a permanent 1% fee instead. That means 99 cents of every dollar goes to you and your collaborators."
      }
    },
    {
      "@type": "Question",
      "name": "What if my collaborator stops working on the project?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Chapter-by-chapter publishing means you're never overcommitted. Each chapter is a discrete unit. If a collaboration isn't working, you've only invested in the chapters you've completed together, and those chapters continue earning for both of you."
      }
    },
    {
      "@type": "Question",
      "name": "Can I publish solo work without a collaborator?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Absolutely. You can publish written content, comics, or illustrated works entirely on your own. The collaboration features are there when you want them, but they're not required."
      }
    }
  ]
};

const howToSchema = {
  "@type": "HowTo",
  "name": "How to Collaborate on a Comic with Automatic Revenue Sharing",
  "description": "A step-by-step guide to creating and publishing collaborative comics on renaissBlock with automatic revenue splits.",
  "step": [
    { "@type": "HowToStep", "name": "Create Your Account", "text": "Sign up for free. You'll get a secure digital wallet automatically — no crypto knowledge needed." },
    { "@type": "HowToStep", "name": "Find Your Creative Partner", "text": "Browse creator profiles and send a project proposal directly to someone whose style matches your vision." },
    { "@type": "HowToStep", "name": "Collaborate & Publish", "text": "Work together chapter by chapter. Upload pages, review drafts, and publish when ready." },
    { "@type": "HowToStep", "name": "Readers Purchase Your Work", "text": "Readers buy chapters using credit card, Apple Pay, or Google Pay. No crypto knowledge needed." },
    { "@type": "HowToStep", "name": "Revenue Splits Automatically", "text": "Every sale splits revenue according to your agreement and deposits earnings into each collaborator's wallet instantly." },
    { "@type": "HowToStep", "name": "Cash Out to Your Bank", "text": "Link your bank account and convert digital earnings to real dollars in 1-3 business days." }
  ]
};

const steps = [
  {
    title: 'Create Your Account',
    desc: "Sign up for free. You'll get a secure digital wallet automatically — no crypto knowledge needed. Your wallet holds your earnings and is fully controlled by you.",
  },
  {
    title: 'Find Your Creative Partner',
    desc: "Browse creator profiles to find someone whose style matches your vision. Writers and artists can signal they're open to collaboration on their profile. When you find the right person, send them a project proposal directly — including your pitch, role breakdown, and proposed revenue split. If they accept, you're partners.",
  },
  {
    title: 'Collaborate & Publish',
    desc: 'Work together chapter by chapter. Upload pages, review drafts, and publish when ready. Chapter-by-chapter publishing lets you build an audience incrementally and de-risks the project for both partners.',
  },
  {
    title: 'Readers Purchase Your Work',
    desc: "Readers buy your chapters using a credit card, Apple Pay, or Google Pay. They don't need to know anything about crypto — the payment experience feels like any online store. Funds are converted to USDC (a digital dollar) behind the scenes.",
  },
  {
    title: 'Revenue Splits Automatically',
    desc: 'The moment a sale happens, revenue is split according to your agreement and deposited into each collaborator\'s wallet instantly. A 60/40 split means 60% goes to one partner and 40% to the other, every single time, enforced by code — not trust.',
  },
  {
    title: 'Cash Out to Your Bank',
    desc: 'When you\'re ready to withdraw, link your bank account through our secure payout partner. Your digital earnings convert to real dollars and arrive in your bank in 1-3 business days.',
  },
];

const faqs = [
  {
    q: 'Do I need to know anything about crypto or blockchain?',
    a: 'No. renaissBlock handles all the technical complexity behind the scenes. You sign up, create, publish, and earn — just like any other platform. Your wallet is created automatically and you cash out to your regular bank account.',
  },
  {
    q: 'How are revenue splits enforced?',
    a: "Revenue splits are enforced by smart contracts on the Solana blockchain. When a reader purchases your work, the payment is automatically divided according to your agreed split and deposited into each collaborator's wallet instantly. No one can change the split after it's set.",
  },
  {
    q: 'What does renaissBlock charge?',
    a: 'The platform takes a 10% fee on sales. Founding creators — the first 50 to complete a project earning $100+ in sales — receive a permanent 1% fee instead. That means 99 cents of every dollar goes to you and your collaborators.',
  },
  {
    q: 'What if my collaborator stops working on the project?',
    a: "Chapter-by-chapter publishing means you're never overcommitted. Each chapter is a discrete unit. If a collaboration isn't working, you've only invested in the chapters you've completed together, and those chapters continue earning for both of you.",
  },
  {
    q: 'Can I publish solo work without a collaborator?',
    a: 'Absolutely. You can publish written content, comics, or illustrated works entirely on your own. The collaboration features are there when you want them, but they\'re not required.',
  },
];

export default function HowItWorks() {
  return (
    <MarketingLayout>
      <SEOHead
        title="How It Works | renaissBlock"
        description="Learn how renaissBlock connects writers and artists for comic collaborations with automatic revenue sharing. Create, publish, and earn — step by step."
        canonicalPath="/how-it-works"
        schemas={[faqPageSchema, howToSchema]}
      />

      <div className="mk-page-hero">
        <h1>How It Works</h1>
        <p>From signing up to cashing out — here's everything you need to know.</p>
      </div>

      <section className="mk-section">
        <div className="mk-container">
          <div className="mk-section-header">
            <div className="mk-section-label">Step by Step</div>
            <h2 className="mk-section-title">Six Steps to Your First Collaboration</h2>
          </div>
          <div className="mk-hiw-steps">
            {steps.map((step, i) => (
              <div className="mk-hiw-step" key={i}>
                <div className="mk-hiw-step-num">{i + 1}</div>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mk-section mk-section--alt">
        <div className="mk-container">
          <div className="mk-section-header">
            <h2 className="mk-section-title">Frequently Asked Questions</h2>
          </div>
          <div className="mk-faq">
            {faqs.map((faq, i) => (
              <div className="mk-faq-item" key={i}>
                <h3 className="mk-faq-q">{faq.q}</h3>
                <p className="mk-faq-a">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
