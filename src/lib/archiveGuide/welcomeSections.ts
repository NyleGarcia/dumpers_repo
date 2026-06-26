export const ARCHIVE_GUIDE_META = {
  title: "Dumper's Repo",
  subtitle:
    'A community-driven platform for Star Citizen crafting, resource tracking, and fair-value pricing.',
  documentTitle: "Dumper's Repo - Complete Archive Guide",
}

export const ABOUT_SECTION = {
  id: 'about',
  title: "What is Dumper's Repo?",
  paragraphs: [
    "**Dumper's Repo** is a comprehensive toolkit for Star Citizen players who want to engage with the game's crafting and economy systems without getting ripped off.",
    "Whether you're tracking which blueprints you've unlocked, managing your mined resources, coordinating crafting orders with your org, or just trying to figure out what a fair price is for that pile of Quantanium you just refined — Dumper's Repo has you covered.",
    'The site is designed to be a one-stop shop for crafters, miners, and traders who want transparency and fairness in their in-game economic activities.',
  ],
}

export const OFFLINE_MODE_SECTION = {
  id: 'offline-mode',
  title: 'Offline Mode',
  intro:
    'Want to try out the tools before signing up? **Offline Mode** lets you explore most features without creating an account.',
  worksOffline: [
    'Browse all blueprints and archive data',
    'Mark blueprints as acquired (local only)',
    'Build your Mission Tracker list (local only)',
    'Track resources in Resource Tracker (local only)',
    'Use the Mining Tracker for RS references',
    'Preview Fulfillment — see how many WTB/WTS orders are waiting (sign in to accept)',
  ],
  membersOnly: [
    'Custom Orders — post WTB buy requests and WTS sell listings (partial OK by default)',
    'Fulfillment — browse, accept full or partial WTS buys, and complete trades',
    'Mining Ledger — crew payout tracking (requires verified RSI Handle on your account)',
    'View member directory / browse collections',
    'Cross-device data sync',
  ],
  migration:
    'Offline progress is stored in your browser using the same IDs as member accounts. Old offline data from before a recent update is cleared automatically when you visit. On your **first sign-in** (when the welcome onboarding appears), valid offline data migrates to your account — unmatched or outdated items are skipped, not forced in. If you already have an account, your offline stash stays separate in the browser.',
  footnote:
    "Offline data is stored in your browser. It persists across sessions but won't sync between devices or browsers until you create an account.",
}

export const DFP_SECTION = {
  id: 'dfp',
  title: "Why Dumper's Fair-Value Price (DFP)?",
  problem: {
    title: 'The Problem',
    body: '"Grey market" trading sites are plagued with price gouging. People asking 5 billion aUEC for items that take maybe an hour to acquire yourself. It\'s predatory, it\'s frustrating, and CIG/RSI rightfully despises these practices.',
  },
  solution: {
    title: 'The Solution',
    intro:
      "**Dumper's Fair-Value Price (DFP)** is an algorithmic pricing system that calculates what resources and crafted items are actually worth based on:",
    bullets: [
      'Time investment required to acquire/craft',
      'Resource rarity and availability',
      'Quality tier (500-1000 scale, with exponential value curves)',
      'Blueprint acquisition difficulty and reputation requirements',
    ],
  },
  goal: {
    title: 'The Goal',
    body: 'Create a pricing standard the community can rally behind. When everyone uses DFP, buyers know they\'re getting fair deals, sellers know they\'re being compensated fairly, and the exploitative grey market loses its power.',
  },
}

export const RATINGS_SECTION = {
  id: 'ratings',
  title: 'Buyer & Fulfiller Ratings',
  intro:
    'Custom Orders and Fulfillment use one **reputation rating system** for both **WTB** (want to buy) and **WTS** (want to sell) listings. There is no separate sell rating — the same 1–5 star archive flow and buyer/fulfiller scores apply to both tags.',
  wtbWts: {
    title: 'WTB vs WTS — who is the buyer?',
    items: [
      '**WTB** — you post a buy request; someone fulfills it for you. You are the **buyer**; they are the seller/fulfiller.',
      '**WTS** — you post a sell listing; someone buys it on Fulfillment (full listing or partial lines). You are the **seller**; they are the buyer.',
      'Partial WTS purchases are separate child orders — same rating flow as any other deal.',
      'Ratings always land in the same two buckets: **buyer rep** and **fulfiller rep** (seller side), regardless of tag.',
    ],
  },
  asBuyer: {
    title: 'As a Buyer',
    items: [
      '**WTB:** post on Custom Orders; rate your fulfiller after pickup',
      '**WTS:** buy full or partial on Fulfillment; rate the seller after pickup',
      'Rate the other party 1–5 stars when archiving a completed order',
      'Your buyer rep helps sellers/fulfillers decide whether to trade with you',
    ],
  },
  asSeller: {
    title: 'As a Seller / Fulfiller',
    items: [
      '**WTB:** accept on Fulfillment and craft/deliver; rate the buyer after completion',
      '**WTS:** post on Custom Orders; mark ready when a buyer accepts (each partial sale counts separately); rate the buyer after completion',
      'Your fulfiller rep (seller side) is visible on listings and buy requests',
      'Higher ratings build trust for both craft fulfillment and direct sales',
    ],
  },
  note: 'Both buyers and fulfillers must have a verified RSI Handle to participate in the order system. This ensures accountability and helps prevent scams.',
}

export const PENDING_REP_SECTION = {
  id: 'pending-rep',
  title: 'Building Your Reputation',
  intro:
    'New members start with **"Pending" reputation** until they complete 5 successful marketplace transactions (as buyer or seller/fulfiller, on either WTB or WTS). During this time, limits apply by **role**, not by tag:',
  buyerLimits: {
    title: 'Pending Buyer Limits',
    items: [
      'Applies when you are the **buyer** — WTB posts and WTS purchases (including partial buys)',
      'Maximum of 2 active buyer-side orders at a time',
      'Total buyer-side value capped at 1,000,000 aUEC',
      'Minimum 10,000 aUEC per **WTB** post while pending',
      'Posting **WTS** listings is not capped by the 2-order / 1M buyer limits',
      'Limits lift after 5 completed transactions as a buyer',
    ],
  },
  sellerLimits: {
    title: 'Pending Seller / Fulfiller Limits',
    items: [
      'Applies when you are the **seller** — WTB fulfillments and active WTS sales (each partial child order counts)',
      'Can only have 1 active seller-side job at a time',
      'Complete or release it before accepting another WTB or WTS handoff',
      'Limits lift after 5 completed transactions as a seller/fulfiller',
    ],
  },
  important:
    'Everyone must rate completed WTB and WTS transactions before posting new orders or accepting new ones on Fulfillment. Until you do, those actions are paused — you can still browse listings and manage any orders already in progress. Archive unrated deals from the **Completed** tab on Custom Orders.',
}

export const ORDER_RULES_SECTION = {
  id: 'order-rules',
  title: 'Order System Rules & Expectations',
  intro:
    'The order system is built on **trust and fairness**. To protect all members, we enforce the following rules — especially for users still building their reputation.',
  expected: {
    title: "What's Expected",
    items: [
      'Post **WTB** only for items you genuinely want crafted or supplied',
      'Post **WTS** only for stock you actually have on hand',
      'WTS listings default to partial purchase — check “full listing” only when the bundle must sell together',
      'Complete transactions in good faith on both Custom Orders and Fulfillment',
      'Rate promptly after completion (same archive + stars flow for both tags)',
      'Communicate clearly with your buyer or seller',
      'Use your verified RSI Handle for all in-game trades',
    ],
  },
  notAllowed: {
    title: "What's Not Allowed",
    items: [
      'Duplicate **WTB** posts for the same blueprint while one is active',
      'Making artificially small **WTB** orders to farm reputation quickly',
      'Repeatedly trading with the same person to inflate ratings (WTB or WTS)',
      'Using multiple accounts to manipulate the marketplace',
      'Abandoning accepted jobs without good reason',
      'Refusing to rate completed WTB or WTS transactions',
    ],
  },
  pendingRep: {
    title: 'Pending Rep Requirements',
    items: [
      '**Minimum WTB value:** 10,000 aUEC per buy post while reputation is pending',
      '**No duplicate WTB:** Cannot post another buy request for the same blueprint if one is pending or in progress',
      '**Buyer limits:** Max 2 active buyer-side orders / 1M aUEC (WTB posts + WTS purchases, including partial buys)',
      '**Seller limits:** Max 1 active seller-side job (WTB fulfillment or WTS sale in progress; each partial sale counts)',
    ],
  },
  timeLimits: {
    title: 'Time Limits',
    items: [
      '**Seller deadline:** 72 hours to mark ready after accept (WTB craft or WTS handoff), or the deal releases back to the pool',
      '**Partial WTS cancel:** Cancelling a partial purchase restores quantities to the seller\'s listing',
      '**Buyer pickup:** 72 hours to confirm after ready, or auto-complete (buyer may receive a strike)',
      '**Rating deadline:** 24 hours after the other party rates, or a 5-star rating is auto-applied on your behalf',
      '**3 strikes in 30 days** may lead to account restrictions',
    ],
  },
  consequences: {
    title: 'Consequences for Violations',
    items: [
      '**Reputation reset:** All ratings cleared, returning you to "Pending" status with limits',
      '**Order history cleared:** Archived orders may be removed along with your reputation',
      '**Account ban:** Severe or repeated violations may result in permanent removal from the platform',
    ],
    note: 'Repeated or serious violations may result in account review and disciplinary action by site staff.',
  },
}

export const ORDERING_TIPS_SECTION = {
  id: 'ordering-tips',
  title: 'Best Ordering Practices',
  intros: [
    'These tips focus on **WTB** buy requests (Submit Buy Order). See the Custom Orders page guide for WTS partial listings and the order builder.',
    'For **WTS** sell listings: post only stock you have on hand; partial purchase is the default so buyers can cherry-pick lines. Check “Buyers must purchase the full listing” only when you need an all-or-nothing sale. Mark ready promptly once a buyer accepts (full or partial).',
    'For WTB posts, follow these tips to get fulfilled faster and make it easier for sellers to help you.',
  ],
  tips: [
    {
      title: 'Use Live Stat Preview',
      body: 'Expand cart lines in the order builder to set per-slot material qualities. The live DFP total and effective stat preview update as you go — match what you actually have or expect to craft with.',
      variant: 'emerald' as const,
    },
    {
      title: 'Separate Easy from Hard',
      body: 'Create **separate orders** for easy items (Q500–Q700) and harder items (Q800–Q1000). Mixing them forces fulfillers to either source rare high-quality materials for everything or skip your order entirely. Split them up and get your easy items faster.',
      variant: 'emerald' as const,
    },
    {
      title: 'Check Blueprint Ownership',
      body: 'Each blueprint card shows how many members own it. If **no one owns a blueprint**, your order may sit unfulfilled until someone acquires it. Consider ordering common blueprints separately from rare ones so your easier items don\'t get blocked.',
      variant: 'emerald' as const,
    },
    {
      title: 'One Hard Item Per Order',
      body: 'For Q800+ or rare blueprints, consider **one item per order**. This lets specialized fulfillers pick up what they can craft well, rather than needing someone who happens to have all your specific blueprints and high-quality materials.',
      variant: 'emerald' as const,
    },
    {
      title: 'Avoid Mixed-Ownership Orders',
      body: 'If your order includes blueprints that some members own and others that **no one owns yet**, the entire order is unfulfillable. A fulfiller must own *every* blueprint in an order to accept it. You\'ll see a warning when creating such orders.',
      variant: 'amber' as const,
    },
  ],
  closingTip:
    'Smaller, focused orders tend to get picked up faster than large mixed orders. Fulfillers can quickly see if they can help and jump in immediately.',
}

export const TRADE_PROTECTION_SECTION = {
  id: 'trade-protection',
  title: 'Protecting Yourself in Trades',
  intro:
    'In-game trades happen outside the site. Keep your own records so disputes can be resolved fairly.',
  items: [
    'Screenshot aUEC transfers before and after handoff',
    'Record video of the exchange when possible',
    "Note the other party's RSI Handle, location, and time",
    'Keep Spectrum or in-game chat logs',
    'If a fulfiller marked ready but you didn\'t receive goods, use **Report Problem** on the order — do not wait for the 72-hour auto-complete',
  ],
  evidenceNote:
    'Evidence is **not uploaded on the site**. If support needs proof during a dispute, they may ask you to email screenshots or share a cloud storage link (Google Drive, Imgur, etc.).',
}

export const EXTERNAL_RESOURCES = [
  { title: 'Star Citizen Wiki', description: 'Community wiki with comprehensive game information' },
  { title: 'Erkul Games', description: 'DPS calculator and ship loadout planner' },
  { title: 'Universal Item Finder', description: 'Search for in-game items and their locations' },
  { title: 'Cornerstone', description: 'Trading and economy tracker' },
  { title: 'Star Citizen Trade Tools', description: 'Mining and trading calculators' },
  { title: 'RSI Website', description: 'Official Star Citizen website' },
]

export const ARCHIVE_TIPS = [
  {
    title: 'Blueprint Rewards',
    content:
      "Blueprints are awarded from contracts at specific reputation levels. Check Mission Tracker to track which blueprints you're working towards and the missions that can award them.",
  },
  {
    title: 'Resource Tracking',
    content:
      "Use the Resource Tracker to keep inventory of your mined and refined materials. Dumper's Fair-Value Price (DFP) calculates fair market values based on quality tiers.",
  },
  {
    title: 'Quality Tiers',
    content:
      'Resource quality ranges from 500 (base) to 1000 (perfect). Higher quality resources have exponentially higher DFP values, especially at Q850 and above.',
  },
  {
    title: 'Standing Progression',
    content:
      'All factions use the same standing ladder from Neutral to Elite Contractor. Higher standings unlock better-paying contracts and exclusive blueprint rewards.',
  },
]

export const DATA_SOURCES = [
  {
    title: 'Game catalog data',
    content:
      'Blueprints, components, ordnance, mining spawns, factions, Archive lore, and RS signature references are extracted directly from Star Citizen game files, then parsed into bundled JSON shipped with the site.',
  },
  {
    title: 'DFP pricing',
    content:
      "Dumper's Fair-Value Price (DFP) is a proprietary pricing engine loaded from the official franchise bundle. The site does not pull live prices from third-party market APIs.",
  },
  {
    title: 'Not included here',
    content:
      "Live in-game shop inventories are not part of Dumper's Repo. For item locations and market lookup, use the external tools listed in the General Archive section.",
  },
]

export const ORGANIZATIONS = [
  {
    title: 'RSI Organization Hub',
    description: 'Browse all Star Citizen organizations on the official RSI site',
  },
  {
    title: 'Black Star [BSTR]',
    badge: 'Site Sponsor',
    description: 'Industrial and defense enterprise focused on extraction, production, and trade',
  },
]

export const ARCHIVE_DISCLAIMER =
  'This site is not affiliated with Cloud Imperium Games or Roberts Space Industries. All game content and materials are trademarks and copyrights of their respective owners.'

/** Table of contents for the printable guide (anchor ids + labels). */
export const PRINTABLE_TOC = [
  { id: 'about', label: "What is Dumper's Repo?" },
  { id: 'offline-mode', label: 'Offline Mode' },
  { id: 'dfp', label: "Why Dumper's Fair-Value Price (DFP)?" },
  { id: 'ratings', label: 'Buyer & Fulfiller Ratings' },
  { id: 'pending-rep', label: 'Building Your Reputation' },
  { id: 'order-rules', label: 'Order System Rules' },
  { id: 'ordering-tips', label: 'Best Ordering Practices' },
  { id: 'trade-protection', label: 'Protecting Yourself in Trades' },
  { id: 'page-guides', label: 'Page-by-Page Guide' },
  { id: 'archive-tips', label: 'Quick Tips' },
  { id: 'data-sources', label: 'Data Sources' },
  { id: 'external-resources', label: 'External Resources' },
]
