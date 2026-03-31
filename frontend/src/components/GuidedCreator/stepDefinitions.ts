export type StepId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 99;

export interface StepOption {
  label: string;
  description: string;
  tag?: string;
  tagColor?: 'green' | 'blue' | 'amber';
  targetStep: StepId;
}

export interface OutcomeItem {
  bold: string;
  text: string;
}

export interface StepDefinition {
  id: StepId;
  title: string;
  subtitle: string;
  breadcrumb?: string[];
  breadcrumbActive?: number;
  variant: 'options' | 'outcome';
  options?: StepOption[];
  outcomeTitle?: string;
  outcomeItems?: OutcomeItem[];
  afterOutcome?: string;
  note?: string;
  navNext?: { label: string; stepId: StepId };
  startOverButton?: boolean;
}

export const STEPS: Record<StepId, StepDefinition> = {
  0: {
    id: 0,
    title: "What brings you to renaissBlock?",
    subtitle: "We'll set up everything you need based on where you are in your creative journey.",
    variant: 'options',
    options: [
      {
        label: "I have a story and need a team",
        description: "You're a writer with a script or concept. You need artists, colorists, or letterers to bring it to life. We'll help you build a pitch, find collaborators, and manage production.",
        tag: "Most common",
        tagColor: 'green',
        targetStep: 1,
      },
      {
        label: "I have a pitch and want to raise funds",
        description: "You already have sample pages and a team (or plan to hire one). You're ready to launch a campaign and let your audience fund the full project.",
        tag: "Ready to fund",
        tagColor: 'blue',
        targetStep: 5,
      },
      {
        label: "I have funding and need to hire",
        description: "You have a budget (self-funded or from elsewhere) and need to find and pay your creative team through secure escrow.",
        targetStep: 8,
      },
      {
        label: "I create everything myself",
        description: "You write and draw your own comics. You want to publish, sell, or run a campaign for your work.",
        tag: "Solo creator",
        tagColor: 'amber',
        targetStep: 10,
      },
    ],
  },

  1: {
    id: 1,
    title: "Let's start with your story",
    subtitle: "Creating a project is your home base. Everything — collaborators, milestones, campaigns, published work — lives under this project.",
    breadcrumb: ["Story + need team", "Build pitch", "Find artist"],
    breadcrumbActive: 0,
    variant: 'outcome',
    outcomeTitle: "You'll set up:",
    outcomeItems: [
      { bold: "Project name", text: "the title of your comic or series" },
      { bold: "Genre and synopsis", text: "helps collaborators evaluate fit" },
      { bold: "Script or outline", text: "upload what you have so far" },
      { bold: "Visual references", text: "mood boards, style inspiration" },
    ],
    afterOutcome: "This creates your project workspace. Next, we'll help you find an artist for your first 5 pages.",
    navNext: { label: "Next: Find an artist", stepId: 2 },
  },

  2: {
    id: 2,
    title: "How do you want to pay your artist?",
    subtitle: "This determines how the escrow contract works. You can always negotiate different terms for future collaborators.",
    breadcrumb: ["Story + need team", "Find artist", "Payment terms"],
    breadcrumbActive: 1,
    variant: 'options',
    options: [
      {
        label: "Work-for-hire — pay per page",
        description: "You pay a fixed rate per page through escrow. The artist is paid as milestones are approved. You own the finished work. Clean and simple.",
        tag: "Recommended for first collaboration",
        tagColor: 'green',
        targetStep: 3,
      },
      {
        label: "Hybrid — reduced rate + revenue share",
        description: "Lower upfront payment per page, plus a percentage of future sales when the finished work publishes. Good when you have some budget but want to share the upside.",
        targetStep: 3,
      },
      {
        label: "Revenue share only — no upfront payment",
        description: "No upfront cost. Your collaborator earns a percentage of all future sales on renaissBlock. Best for equal creative partnerships where both sides invest their time.",
        targetStep: 3,
      },
    ],
    note: "Note: Revenue share applies to published content sales on renaissBlock only, not to campaign contributions or other funding. If this project is a pitch that won't be sold directly, revenue share won't generate income unless the pitch itself is published for sale.",
  },

  3: {
    id: 3,
    title: "Produce your first 5 pages",
    subtitle: "Most successful comics start with a 5-page sample. This proves the concept and gives you something to show backers or publishers.",
    breadcrumb: ["Story + need team", "Find artist", "Build your pitch"],
    breadcrumbActive: 2,
    variant: 'outcome',
    outcomeTitle: "How it works:",
    outcomeItems: [
      { bold: "Fund escrow", text: "deposit the full 5-page budget. Your artist sees the money is real before they start." },
      { bold: "Page-by-page delivery", text: "artist uploads each page. You review and approve. Escrow releases per page (3% platform fee)." },
      { bold: "Revision rounds", text: "request changes with specific feedback. Built-in limits keep things fair for both sides." },
      { bold: "Auto-approve", text: "if you don't review within 72 hours, the milestone auto-approves. No stalling payments." },
    ],
    afterOutcome: "Once all 5 pages are approved, your pitch is ready. Time to decide what's next.",
    navNext: { label: "Next: Pitch is done", stepId: 4 },
  },

  4: {
    id: 4,
    title: "Your 5-page pitch is complete!",
    subtitle: "You have a finished sample. Here's what you can do with it:",
    breadcrumb: ["Story + need team", "Build pitch", "What's next?"],
    breadcrumbActive: 2,
    variant: 'options',
    options: [
      {
        label: "Launch a campaign to fund the full issue",
        description: "Your pitch pages become the showcase. Backers see real art, real story, real team. Campaign funds go into production escrow — protected until work delivers.",
        tag: "Most popular",
        tagColor: 'green',
        targetStep: 5,
      },
      {
        label: "Self-fund the full issue",
        description: "You have the budget to continue. Set up escrow contracts for the remaining 20 pages, plus colorist and letterer when the time comes.",
        targetStep: 8,
      },
      {
        label: "Publish the pitch as a preview",
        description: "Put your 5 pages on renaissBlock for readers to discover. Build an audience first, then decide about the full issue later.",
        targetStep: 9,
      },
    ],
  },

  5: {
    id: 5,
    title: "Do you already have a team?",
    subtitle: "This determines how campaign funds are structured when your campaign succeeds.",
    breadcrumb: ["Launch campaign", "Team status", "Campaign setup"],
    breadcrumbActive: 0,
    variant: 'options',
    options: [
      {
        label: "Yes — team is assembled with agreed rates",
        description: "You know who's doing the art, coloring, and lettering, and you've agreed on rates. Campaign funds will auto-split into pre-configured escrow contracts when funded. Backers see exactly where every dollar goes.",
        tag: "Strongest backer trust",
        tagColor: 'green',
        targetStep: 6,
      },
      {
        label: "No — I'm raising funds to hire",
        description: "Campaign funds will go into a project escrow. You'll hire and set up contracts after the campaign succeeds. Funds are locked until work delivers.",
        targetStep: 7,
      },
    ],
  },

  6: {
    id: 6,
    title: "Set up your team budget",
    subtitle: "Your campaign goal will be calculated from the team costs you define here. When the campaign funds, escrow contracts are created automatically.",
    breadcrumb: ["Launch campaign", "Team assembled", "Auto-split setup"],
    breadcrumbActive: 2,
    variant: 'outcome',
    outcomeTitle: "Your campaign will show backers:",
    outcomeItems: [
      { bold: "Artist", text: "@artisto — $3,000 (25 pages at $120/pg) — locked in escrow" },
      { bold: "Colorist", text: "@colorqueen — $1,250 (25 pages at $50/pg) — locked in escrow" },
      { bold: "Letterer", text: "@letterhead — $500 (25 pages at $20/pg) — locked in escrow" },
      { bold: "Production costs", text: "$1,250 — released to creator for printing, shipping, tools" },
      { bold: "Campaign goal: $6,000", text: "" },
    ],
    afterOutcome: "Team members confirm their participation during setup. When funded, their escrow contracts activate instantly — no delay, no manual setup.",
    note: "$4,750 locked in escrow (79%) + $1,250 to creator (21%)",
    navNext: { label: "Next: Set tiers and launch", stepId: 99 },
  },

  7: {
    id: 7,
    title: "Campaign funds go to project escrow",
    subtitle: "Since you haven't assembled your team yet, all funds will be locked in a single project escrow (PDA2). You'll create contractor escrow contracts as you hire.",
    breadcrumb: ["Launch campaign", "Raising to hire", "Campaign escrow"],
    breadcrumbActive: 2,
    variant: 'outcome',
    outcomeTitle: "How this works for backers:",
    outcomeItems: [
      { bold: "All funds locked", text: "nothing is released until you hire team members and they deliver work" },
      { bold: "Transparent progress", text: "backers see when you create contracts and milestones start completing" },
      { bold: "60-day activity requirement", text: "if no escrow contracts are created within 60 days, backers can reclaim" },
      { bold: "Full protection", text: "funds only leave escrow as approved work is delivered" },
    ],
    navNext: { label: "Next: Set tiers and launch", stepId: 99 },
  },

  8: {
    id: 8,
    title: "Hire your team through escrow",
    subtitle: "You have a budget and you're ready to build. Browse the marketplace, send proposals, and fund escrow contracts.",
    breadcrumb: ["Self-funded production", "Hire team"],
    breadcrumbActive: 0,
    variant: 'outcome',
    outcomeTitle: "Your workflow:",
    outcomeItems: [
      { bold: "Browse creators", text: "filter by role, genre, style, rating, availability" },
      { bold: "Send proposals", text: "specify role, page rate, milestone structure, timeline" },
      { bold: "Fund escrow", text: "deposit full project budget. Contractor sees locked funds before starting." },
      { bold: "Manage milestones", text: "review deliverables, approve, request revisions. Funds release per milestone." },
      { bold: "Sequential pipeline", text: "art finishes, then hire colorist, then letterer. Each role gets its own contract." },
    ],
    startOverButton: true,
    navNext: { label: "When done: Publish", stepId: 9 },
  },

  9: {
    id: 9,
    title: "Publish your work",
    subtitle: "Your comic is ready for readers. Publishing mints it as an NFT on Solana (invisible to readers — they just see a comic in their library).",
    breadcrumb: ["Publish"],
    breadcrumbActive: 0,
    variant: 'outcome',
    outcomeTitle: "What happens:",
    outcomeItems: [
      { bold: "Upload finished pages", text: "the platform compiles them into a readable format" },
      { bold: "Set your price", text: "you decide what readers pay per chapter or per issue" },
      { bold: "Revenue splits activate", text: "if any collaborators have revenue share agreements, the smart contract enforces the split on every sale automatically" },
      { bold: "Campaign backers get access", text: "anyone who backed the project gets their tier rewards fulfilled automatically" },
      { bold: "Sales fee: 10%", text: "platform takes 10% of each sale (1% for founding creators)" },
    ],
    startOverButton: true,
  },

  10: {
    id: 10,
    title: "What would you like to do?",
    subtitle: "You create your own work. Here's how renaissBlock can help.",
    breadcrumb: ["Solo creator", "What do you want to do?"],
    breadcrumbActive: 0,
    variant: 'options',
    options: [
      {
        label: "Run a campaign to fund my project",
        description: "Raise money from backers. Funds are locked in self-escrow and release as you publish chapters. Backers get full refund if you don't deliver.",
        targetStep: 11,
      },
      {
        label: "Publish and sell my work",
        description: "You have finished content ready to go. Upload it, set a price, and start earning from reader purchases.",
        targetStep: 9,
      },
      {
        label: "Actually, I need to hire some help",
        description: "Maybe a colorist or letterer? You can hire specific roles through escrow while keeping creative control.",
        targetStep: 8,
      },
    ],
  },

  11: {
    id: 11,
    title: "Solo campaign — self-escrow",
    subtitle: "Your campaign funds are locked in escrow and release as you publish completed chapters or the finished issue.",
    breadcrumb: ["Solo creator", "Solo campaign"],
    breadcrumbActive: 1,
    variant: 'outcome',
    outcomeTitle: "How self-escrow works:",
    outcomeItems: [
      { bold: "Campaign succeeds", text: "funds move to your project escrow (PDA2)" },
      { bold: "You create", text: "work on your comic at your own pace within the project deadline" },
      { bold: "You publish a chapter", text: "platform confirms publication, escrow releases proportional funds to your wallet (minus 3% fee)" },
      { bold: "If you don't publish", text: "after the project deadline, backers can reclaim 100% of remaining funds" },
    ],
    afterOutcome: "This is the strongest backer protection possible. They get a finished product or they get their money back. No middle ground.",
    navNext: { label: "Next: Set up campaign", stepId: 99 },
  },

  99: {
    id: 99,
    title: "You're ready to go!",
    subtitle: "From here you'll enter the actual setup flow. The guided journey has determined your project structure, escrow type, and next steps.",
    variant: 'outcome',
    outcomeTitle: "Behind the scenes, the platform will set up:",
    outcomeItems: [
      { bold: "Project container", text: "with the right type (collaborative or solo)" },
      { bold: "Escrow configuration", text: "with the correct release logic" },
      { bold: "Team contracts", text: "pre-configured if team was assembled (auto-split ready)" },
      { bold: "Campaign draft", text: "with budget breakdown and tier templates" },
    ],
    afterOutcome: "You never had to think about PDAs, escrow types, or smart contract configuration. You just answered simple questions about your creative journey.",
    startOverButton: true,
  },
};
