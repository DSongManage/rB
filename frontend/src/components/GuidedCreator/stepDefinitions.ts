export type StepId = 0 | 1 | 2 | 3 | 4 | 6 | 9 | 10 | 11 | 12 | 99;

export type ContentType = 'comic' | 'book' | 'art';

export interface StepOption {
  label: string;
  description: string;
  tag?: string;
  tagColor?: 'green' | 'blue' | 'amber';
  targetStep?: StepId;
  /** Execute a direct action instead of navigating to a step */
  action?: DirectAction;
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

export type DirectAction = 'createProject' | 'publish' | 'browseCollaborators' | 'campaign' | 'campaignSolo' | 'campaignWizard';

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
  /** Optional preview image to show instead of or before outcome items */
  previewImage?: string;
}

export const STEPS: Record<StepId, StepDefinition> = {
  // ── Step 0: Content type selection (NEW) ──
  0: {
    id: 0,
    title: "Start a new project",
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

  // ── Step 1: Journey question — content-type aware ──
  // Default shown below; use getStep1ForContentType() for book/art variants
  1: {
    id: 1,
    title: "Where are you in your journey?",
    subtitle: "We'll guide you to the right tools and next steps.",
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
        description: "Browse the Collaborators page to find artists, colorists, and letterers by role, genre, and style. Create your project after you've found the right fit.",
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
    subtitle: "Browse creators on renaissBlock. When you find someone you like, click 'Invite to Collaborate' on their profile.",
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
    title: "Launch your campaign",
    subtitle: "Set up your project, team, and campaign in one go. Add team members now or leave roles open — you can fill them later.",
    breadcrumb: ["Launch campaign", "Setup"],
    breadcrumbActive: 1,
    variant: 'outcome',
    outcomeTitle: "HOW IT WORKS:",
    outcomeItems: [
      { bold: "One wizard, everything set up", text: "create your project, add team members (or mark roles as TBD), set milestones and budgets" },
      { bold: "Backers see the breakdown", text: "your campaign page shows exactly how funds are allocated and who's on the team" },
      { bold: "Relative deadlines", text: "milestones start counting after your campaign is funded — no wasted time" },
      { bold: "Auto-escrow on success", text: "when the campaign hits its goal, escrow contracts activate automatically (3% fee on releases)" },
    ],
    afterOutcome: "Team members get invited during setup. Open roles can be filled later through the campaign page. Funds are protected by on-chain escrow.",
    directAction: { label: "Start campaign wizard", action: 'campaignWizard' },
  },

  // ── Hire path (step 9) — terminal with direct action ──

  9: {
    id: 9,
    title: "Hire your team through escrow",
    subtitle: "Browse the marketplace, find creators, and send proposals. Once a creator accepts, the project auto-creates and you fund the escrow contract.",
    breadcrumb: ["Self-funded production", "Hire team"],
    breadcrumbActive: 0,
    variant: 'outcome',
    outcomeTitle: "Your workflow:",
    outcomeItems: [
      { bold: "Browse creators", text: "filter by role, genre, style, rating, availability" },
      { bold: "Send proposals", text: "specify role, page rate, milestone structure, timeline" },
      { bold: "Creator accepts", text: "project auto-creates when they accept your proposal" },
      { bold: "Fund escrow", text: "deposit full project budget. Contractor sees locked funds before starting." },
      { bold: "Manage milestones", text: "review deliverables, approve, request revisions. Funds release per milestone." },
    ],
    previewImage: '/marketplace-preview.png',
    startOverButton: true,
    directAction: { label: "Browse creators", action: 'browseCollaborators' },
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
        description: "You have finished content ready to go. Go straight to your studio to upload pages, set a price, and start earning.",
        action: 'createProject',
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
    previewImage: '/campaign-preview.png',
    outcomeTitle: "HOW SELF-ESCROW WORKS:",
    outcomeItems: [
      { bold: "Campaign succeeds", text: "funds move to your secure project escrow" },
      { bold: "You create", text: "work at your own pace within the project deadline" },
      { bold: "You publish a chapter", text: "platform confirms publication, escrow releases proportional funds to your wallet (minus 3% fee)" },
      { bold: "If you don't publish", text: "after the project deadline, backers can reclaim 100% of remaining funds" },
    ],
    afterOutcome: "This is the strongest backer protection possible. They get a finished product or they get their money back. No middle ground.",
    directAction: { label: "Set up your campaign", action: 'campaignSolo' },
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
    afterOutcome: "You never had to think about escrow types or smart contract configuration. You just answered simple questions about your creative journey.",
    startOverButton: true,
  },
};

// ── Content-type-aware step overrides ──
// Steps that mention comic-specific roles/language get tailored per content type.

const CONTENT_LABELS: Record<ContentType, {
  roles: string;
  findRoles: string;
  deliverable: string;
  deliverablePlural: string;
  unit: string;
  unitPlural: string;
  creatorNoun: string;
}> = {
  comic: {
    roles: 'artists, colorists, or letterers',
    findRoles: 'artist, colorist, letterer, editor',
    deliverable: 'page',
    deliverablePlural: 'pages',
    unit: 'chapter or issue',
    unitPlural: 'chapters',
    creatorNoun: 'artist',
  },
  book: {
    roles: 'editors, cover designers, or illustrators',
    findRoles: 'editor, cover designer, illustrator, proofreader',
    deliverable: 'chapter',
    deliverablePlural: 'chapters',
    unit: 'chapter or full book',
    unitPlural: 'chapters',
    creatorNoun: 'editor',
  },
  art: {
    roles: 'writers, colorists, or other creative partners',
    findRoles: 'writer, colorist, animator, designer',
    deliverable: 'piece',
    deliverablePlural: 'pieces',
    unit: 'piece or collection',
    unitPlural: 'pieces',
    creatorNoun: 'collaborator',
  },
};

/**
 * Returns a content-type-aware version of any step.
 * Comic uses defaults. Book and Art get tailored language.
 */
export function getStepForContentType(stepId: StepId, contentType: ContentType): StepDefinition {
  const L = CONTENT_LABELS[contentType];

  // Step 1: Journey question
  if (stepId === 1) return getStep1ForContentType(contentType);

  // Step 2: Find collaborator
  if (stepId === 2) {
    return {
      ...STEPS[2],
      options: [
        {
          label: "Yes — I know who I want to work with",
          description: `We'll create your project and you can invite them from the Team tab. If they're on renaissBlock, they'll get a notification instantly.`,
          tag: "Fastest path",
          tagColor: 'green',
          targetStep: 3,
          icon: 'UserCheck',
          iconColor: '#10b981',
        },
        {
          label: "No — help me find one",
          description: `Browse the Collaborators page to find ${L.findRoles} by role, genre, and style. Create your project after you've found the right fit.`,
          targetStep: 4,
          icon: 'Search',
          iconColor: '#3b82f6',
        },
      ],
    };
  }

  // Step 3: Create project (known collaborator)
  if (stepId === 3) {
    return {
      ...STEPS[3],
      outcomeItems: [
        { bold: "Go to the Team tab", text: "search for your collaborator by username" },
        { bold: "Click 'Invite to Collaborate'", text: `choose their role (${L.findRoles})` },
        { bold: "Set payment terms", text: "work-for-hire, revenue share, or hybrid — you'll negotiate directly" },
        { bold: "Fund escrow when ready", text: "your collaborator sees locked funds before starting work" },
      ],
    };
  }

  // Step 4: Browse collaborators
  if (stepId === 4) {
    return {
      ...STEPS[4],
      outcomeItems: [
        { bold: "Filter by role", text: `${L.findRoles} — find exactly what you need` },
        { bold: "Check their portfolio", text: "every creator has published work you can preview" },
        { bold: "Look at ratings and availability", text: "see if they're open to offers or currently booked" },
        { bold: "Send an invite", text: "click 'Invite to Collaborate' — they'll see your project and can accept or decline" },
      ],
    };
  }

  // Step 6: Campaign wizard launch — no content-type override needed
  if (stepId === 6) {
    return { ...STEPS[6] };
  }

  // Step 9: Hire through escrow
  if (stepId === 9) {
    return {
      ...STEPS[9],
      outcomeItems: [
        { bold: "Browse creators", text: `filter by role, genre, style, rating, availability` },
        { bold: "Send proposals", text: `specify role, ${L.deliverable} rate, milestone structure, timeline` },
        { bold: "Creator accepts", text: "project auto-creates when they accept your proposal" },
        { bold: "Fund escrow", text: "deposit full project budget. Contractor sees locked funds before starting." },
        { bold: "Manage milestones", text: "review deliverables, approve, request revisions. Funds release per milestone." },
      ],
    };
  }

  // Step 10: Publish
  if (stepId === 10) {
    return {
      ...STEPS[10],
      outcomeItems: [
        { bold: `Upload finished ${L.deliverablePlural}`, text: "the platform compiles them into a readable format" },
        { bold: "Set your price", text: `you decide what readers pay per ${L.unit}` },
        { bold: "Revenue splits activate", text: "if any collaborators have revenue share agreements, the smart contract enforces the split on every sale automatically" },
        { bold: "Campaign backers get access", text: "anyone who backed the project gets their tier rewards fulfilled automatically" },
        { bold: "Sales fee: 10%", text: "platform takes 10% of each sale (1% for founding creators)" },
      ],
    };
  }

  // Step 11: Solo creator options
  if (stepId === 11) {
    return {
      ...STEPS[11],
      options: [
        {
          label: "Run a campaign to fund my project",
          description: `Raise money from backers. Funds are locked in self-escrow and release as you publish ${L.unitPlural}. Backers get full refund if you don't deliver.`,
          targetStep: 12,
        },
        {
          label: "Publish and sell my work",
          description: `You have finished content ready to go. Go straight to your studio to upload ${L.deliverablePlural}, set a price, and start earning.`,
          action: 'createProject',
        },
      ],
    };
  }

  // Step 12: Solo campaign
  if (stepId === 12) {
    return {
      ...STEPS[12],
      outcomeItems: [
        { bold: "Campaign succeeds", text: "funds move to your secure project escrow" },
        { bold: "You create", text: "work at your own pace within the project deadline" },
        { bold: `You publish a ${L.deliverable}`, text: `platform confirms publication, escrow releases proportional funds to your wallet (minus 3% fee)` },
        { bold: "If you don't publish", text: "after the project deadline, backers can reclaim 100% of remaining funds" },
      ],
    };
  }

  return STEPS[stepId];
}

/**
 * Returns a content-type-aware version of step 1.
 * Comic uses the default. Book and Art get tailored language.
 */
export function getStep1ForContentType(contentType: ContentType): StepDefinition {
  if (contentType === 'book') {
    return {
      id: 1,
      title: "Where are you in your journey?",
      subtitle: "We'll guide you to the right tools and next steps.",
      variant: 'options',
      options: [
        {
          label: "I have a manuscript and need help",
          description: "You've written a draft and need an editor, cover designer, or illustrator. We'll help you find collaborators and manage the project.",
          tag: "Most common",
          tagColor: 'green',
          targetStep: 2,
          icon: 'Users',
          iconColor: '#3b82f6',
        },
        {
          label: "I have a book and want to raise funds",
          description: "You have a completed or near-complete manuscript. You're ready to launch a campaign and let your audience fund editing, design, and publishing.",
          tag: "Ready to fund",
          tagColor: 'blue',
          targetStep: 6,
          icon: 'Rocket',
          iconColor: '#8b5cf6',
        },
        {
          label: "I write everything myself",
          description: "You're an independent author. You want to publish chapters, sell your book, or run a campaign to fund your writing.",
          tag: "Solo author",
          tagColor: 'amber',
          targetStep: 11,
          icon: 'Pen',
          iconColor: '#10b981',
        },
      ],
    };
  }

  if (contentType === 'art') {
    return {
      id: 1,
      title: "Where are you in your journey?",
      subtitle: "We'll guide you to the right tools and next steps.",
      variant: 'options',
      options: [
        {
          label: "I have artwork and need collaborators",
          description: "You're an artist looking for a writer, colorist, or other creative partner to build a project together.",
          tag: "Most common",
          tagColor: 'green',
          targetStep: 2,
          icon: 'Users',
          iconColor: '#3b82f6',
        },
        {
          label: "I have a collection and want to raise funds",
          description: "You have artwork ready to showcase. You're ready to launch a campaign and let your audience fund a full collection or series.",
          tag: "Ready to fund",
          tagColor: 'blue',
          targetStep: 6,
          icon: 'Rocket',
          iconColor: '#8b5cf6',
        },
        {
          label: "I create everything myself",
          description: "You're an independent artist. You want to publish, sell prints, or run a campaign to fund your next collection.",
          tag: "Solo artist",
          tagColor: 'amber',
          targetStep: 11,
          icon: 'Pen',
          iconColor: '#10b981',
        },
      ],
    };
  }

  // Default: comic
  return STEPS[1];
}
