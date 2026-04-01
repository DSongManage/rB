export type StepId = 0 | 1 | 2 | 3 | 4 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 99;

export type ContentType = 'comic' | 'book' | 'art';

export interface StepOption {
  label: string;
  description: string;
  tag?: string;
  tagColor?: 'green' | 'blue' | 'amber';
  targetStep: StepId;
  /** For step 0: which content type this option selects */
  contentType?: ContentType;
  /** Lucide icon name for this option */
  icon?: string;
  /** Icon color (CSS color value) */
  iconColor?: string;
}

export interface OutcomeItem {
  bold: string;
  text: string;
}

export type DirectAction = 'createProject' | 'publish' | 'browseCollaborators';

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
  /** Direct action button on this step (not via step 99) */
  directAction?: { label: string; action: DirectAction };
}

export const STEPS: Record<StepId, StepDefinition> = {
  // ── Step 0: Content type selection (NEW) ──
  0: {
    id: 0,
    title: "What would you like to create?",
    subtitle: "Pick your content type. You can always change this later.",
    variant: 'options',
    options: [
      {
        label: "Comic",
        description: "Create visual stories with panel layouts and artwork. Page-by-page upload, panel arrangement, and reader-friendly display.",
        tag: "Most popular",
        tagColor: 'green',
        targetStep: 1,
        contentType: 'comic',
        icon: 'Layers',
        iconColor: '#f59e0b',
      },
      {
        label: "Book",
        description: "Write chapters, novels, or short stories with rich text editing. Chapter-based structure with preview before publish.",
        targetStep: 1,
        contentType: 'book',
        icon: 'BookOpen',
        iconColor: '#3b82f6',
      },
      {
        label: "Art",
        description: "Publish standalone artwork, illustrations, or collections. High-res uploads with gallery display.",
        targetStep: 1,
        contentType: 'art',
        icon: 'Image',
        iconColor: '#10b981',
      },
    ],
  },

  // ── Step 1: Journey question (was step 0) ──
  1: {
    id: 1,
    title: "What brings you to renaissBlock?",
    subtitle: "We'll set up everything you need based on where you are in your creative journey.",
    variant: 'options',
    options: [
      {
        label: "I have a story and need a team",
        description: "You're a writer with a script or concept. You need artists, colorists, or letterers to bring it to life. We'll help you build a pitch, find collaborators, and manage production.",
        tag: "Most common",
        tagColor: 'green',
        targetStep: 2,
        icon: 'Users',
        iconColor: '#3b82f6',
      },
      {
        label: "I have a pitch and want to raise funds",
        description: "You already have sample pages and a team (or plan to hire one). You're ready to launch a campaign and let your audience fund the full project.",
        tag: "Ready to fund",
        tagColor: 'blue',
        targetStep: 6,
        icon: 'Rocket',
        iconColor: '#8b5cf6',
      },
      {
        label: "I have funding and need to hire",
        description: "You have a budget (self-funded or from elsewhere) and need to find and pay your creative team through secure escrow.",
        targetStep: 9,
        icon: 'Briefcase',
        iconColor: '#f59e0b',
      },
      {
        label: "I create everything myself",
        description: "You write and draw your own work. You want to publish, sell, or run a campaign for your work.",
        tag: "Solo creator",
        tagColor: 'amber',
        targetStep: 11,
        icon: 'Pen',
        iconColor: '#10b981',
      },
    ],
  },

  // ── Story + need team path (steps 2-3) ──

  2: {
    id: 2,
    title: "Do you have a collaborator in mind?",
    subtitle: "We'll create your project first, then help you connect with the right people.",
    breadcrumb: ["Story + need team", "Find collaborator"],
    breadcrumbActive: 0,
    variant: 'options',
    options: [
      {
        label: "Yes — I know who I want to work with",
        description: "We'll create your project and you can invite them from the Team tab. If they're on renaissBlock, they'll get a notification instantly.",
        tag: "Fastest path",
        tagColor: 'green',
        targetStep: 3,
        icon: 'UserCheck',
        iconColor: '#10b981',
      },
      {
        label: "No — help me find one",
        description: "We'll create your project, then take you to the Collaborators page where you can browse artists, colorists, and letterers by role, genre, and style.",
        targetStep: 4,
        icon: 'Search',
        iconColor: '#3b82f6',
      },
    ],
  },

  3: {
    id: 3,
    title: "Let's create your project",
    subtitle: "Your project is the home base for everything — collaborators, milestones, content, and payments all live here.",
    breadcrumb: ["Story + need team", "Create project"],
    breadcrumbActive: 1,
    variant: 'outcome',
    outcomeTitle: "AFTER CREATING YOUR PROJECT:",
    outcomeItems: [
      { bold: "Go to the Team tab", text: "search for your collaborator by username" },
      { bold: "Click 'Invite to Collaborate'", text: "choose their role (artist, colorist, letterer)" },
      { bold: "Set payment terms", text: "work-for-hire, revenue share, or hybrid — you'll negotiate directly" },
      { bold: "Fund escrow when ready", text: "your collaborator sees locked funds before starting work" },
    ],
    afterOutcome: "Payment terms and escrow details are configured after your collaborator accepts — no need to decide everything upfront.",
    directAction: { label: "Create project", action: 'createProject' },
  },

  4: {
    id: 4,
    title: "Find your collaborator",
    subtitle: "We'll create your project, then take you to browse creators. When you find someone you like, click 'Invite to Collaborate' on their profile.",
    breadcrumb: ["Story + need team", "Find collaborator"],
    breadcrumbActive: 1,
    variant: 'outcome',
    outcomeTitle: "HOW TO FIND THE RIGHT FIT:",
    outcomeItems: [
      { bold: "Filter by role", text: "artist, colorist, letterer, editor — find exactly what you need" },
      { bold: "Check their portfolio", text: "every creator has published work you can preview" },
      { bold: "Look at ratings and availability", text: "see if they're open to offers or currently booked" },
      { bold: "Send an invite", text: "click 'Invite to Collaborate' — they'll see your project and can accept or decline" },
    ],
    afterOutcome: "Once they accept, you'll set up payment terms and escrow together from your project's Team tab.",
    directAction: { label: "Browse collaborators", action: 'browseCollaborators' },
  },

  // Step 5 intentionally skipped (removed old pitch-complete branching step)

  // ── Campaign path (steps 6-8) ──

  6: {
    id: 6,
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
        targetStep: 7,
      },
      {
        label: "No — I'm raising funds to hire",
        description: "Campaign funds will go into a project escrow. You'll hire and set up contracts after the campaign succeeds. Funds are locked until work delivers.",
        targetStep: 8,
      },
    ],
  },

  7: {
    id: 7,
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

  8: {
    id: 8,
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

  // ── Hire path (step 9) — terminal with direct action ──

  9: {
    id: 9,
    title: "Hire your team through escrow",
    subtitle: "You have a budget and you're ready to build. Create your project, then browse the marketplace, send proposals, and fund escrow contracts.",
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
    directAction: { label: "Create project", action: 'createProject' },
  },

  // ── Publish path (step 10) — terminal with direct action ──

  10: {
    id: 10,
    title: "Publish your work",
    subtitle: "Your work is ready for readers. Publishing mints it as an NFT on Solana (invisible to readers — they just see content in their library).",
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
    directAction: { label: "Start publishing", action: 'publish' },
  },

  // ── Solo creator path (steps 11-12) ──

  11: {
    id: 11,
    title: "What would you like to do?",
    subtitle: "You create your own work. Here's how renaissBlock can help.",
    breadcrumb: ["Solo creator", "What do you want to do?"],
    breadcrumbActive: 0,
    variant: 'options',
    options: [
      {
        label: "Run a campaign to fund my project",
        description: "Raise money from backers. Funds are locked in self-escrow and release as you publish chapters. Backers get full refund if you don't deliver.",
        targetStep: 12,
      },
      {
        label: "Publish and sell my work",
        description: "You have finished content ready to go. Upload it, set a price, and start earning from reader purchases.",
        targetStep: 10,
      },
      {
        label: "Actually, I need to hire some help",
        description: "Maybe a colorist or letterer? You can hire specific roles through escrow while keeping creative control.",
        targetStep: 9,
      },
    ],
  },

  12: {
    id: 12,
    title: "Solo campaign — self-escrow",
    subtitle: "Your campaign funds are locked in escrow and release as you publish completed chapters or the finished issue.",
    breadcrumb: ["Solo creator", "Solo campaign"],
    breadcrumbActive: 1,
    variant: 'outcome',
    outcomeTitle: "How self-escrow works:",
    outcomeItems: [
      { bold: "Campaign succeeds", text: "funds move to your project escrow (PDA2)" },
      { bold: "You create", text: "work at your own pace within the project deadline" },
      { bold: "You publish a chapter", text: "platform confirms publication, escrow releases proportional funds to your wallet (minus 3% fee)" },
      { bold: "If you don't publish", text: "after the project deadline, backers can reclaim 100% of remaining funds" },
    ],
    afterOutcome: "This is the strongest backer protection possible. They get a finished product or they get their money back. No middle ground.",
    navNext: { label: "Next: Set up campaign", stepId: 99 },
  },

  // ── Terminal step 99 — campaign action only ──

  99: {
    id: 99,
    title: "You're ready to go!",
    subtitle: "From here you'll enter the campaign setup flow. The guided journey has determined your project structure, escrow type, and next steps.",
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
