/**
 * seed-campaigns-api.ts
 *
 * Creates realistic demo campaigns by calling the REAL backend HTTP endpoints,
 * so the actual creation path is exercised: wallet auth (nonce + signature),
 * DTO validation, JwtAuthGuard, and the campaigns.createCampaign service.
 *
 * Unlike seed-demo.ts (which writes the DB directly via Prisma and calls the
 * contract directly), this script touches NO database and NO contract. Each
 * campaign is created in PENDING status. You approve them manually as an admin
 * in the admin UI, which is what deploys them on-chain.
 *
 * The generated data is on-chain-valid so manual approval succeeds later:
 *   - non-empty ipfsHash
 *   - milestone amounts sum exactly to the goal
 *   - every milestone deadline <= the campaign deadline
 *   - campaign deadline is in the (near) future
 *
 * Run (from apps/server):
 *   npx ts-node scripts/seed-campaigns-api.ts
 *
 * Requirements:
 *   - Backend running and reachable at API_URL (default http://localhost:3000/api)
 *   - DB migrated (npx prisma migrate deploy) so images/documents columns exist
 *   - SEED_CREATOR_KEYS set in apps/server/.env: comma-separated private keys.
 *     A random key is chosen per campaign as the creator. These wallets only
 *     sign auth messages, so they need no gas / no funds.
 */

import 'dotenv/config';
import { ethers } from 'ethers';

// ---- Config -----------------------------------------------------------------

const API_URL = (process.env.API_URL || 'http://localhost:3000/api').replace(/\/$/, '');

// Accept keys with or without the 0x prefix.
function normalizeKey(k: string): string {
  const t = k.trim();
  if (!t) return t;
  return /^0x/i.test(t) ? t : `0x${t}`;
}

let CREATOR_KEYS = (process.env.SEED_CREATOR_KEYS || '')
  .split(',')
  .map((k) => k.trim())
  .filter(Boolean)
  .map(normalizeKey);

let CREATOR_KEY_SOURCE = 'SEED_CREATOR_KEYS';

// Fallback: if no dedicated creator keys are provided, reuse OPERATOR_PRIVATE_KEY
// as the single creator (all campaigns will share that author).
if (CREATOR_KEYS.length === 0 && process.env.OPERATOR_PRIVATE_KEY?.trim()) {
  CREATOR_KEYS = [normalizeKey(process.env.OPERATOR_PRIVATE_KEY)];
  CREATOR_KEY_SOURCE = 'OPERATOR_PRIVATE_KEY (fallback)';
}

if (CREATOR_KEYS.length === 0) {
  console.error(
    'No creator keys found. Add a comma-separated list of creator private keys to apps/server/.env, e.g.\n' +
      '  SEED_CREATOR_KEYS=0xkey1,0xkey2,0xkey3\n' +
      '(or set OPERATOR_PRIVATE_KEY, which is used as a fallback).',
  );
  process.exit(1);
}

const DAY_MS = 24 * 60 * 60 * 1000;

// ---- Campaign templates -----------------------------------------------------
// Tokens alternate ETH / USDC. Amounts are tiny (~0.01 ETH or ~10 USDC) and the
// milestone amounts always sum to the goal. Descriptions are intentionally long.

type MilestoneTemplate = { title: string; description: string; amount: number };
type CampaignTemplate = {
  title: string;
  description: string;
  category: string;
  paymentToken: 'ETH' | 'USDC';
  repositoryUrl: string;
  website?: string;
  license: string;
  milestones: MilestoneTemplate[];
};

const CAMPAIGNS: CampaignTemplate[] = [
  {
    title: 'Privacy First Browser Extension',
    description:
      'A fully open source browser extension that defends everyday users against silent tracking. It blocks canvas and font fingerprinting, injects believable decoy signals into the WebGL and AudioContext APIs, and routes DNS requests over HTTPS so that your browsing history cannot be reconstructed by your network provider. The project ships with zero telemetry, no analytics, and no subscription tiers. Every release is reproducible from source and independently auditable, and the threat model is documented in plain language so that non technical users can understand exactly what is protected and what is not.',
    category: 'Security and Privacy',
    paymentToken: 'ETH',
    repositoryUrl: 'https://github.com/defund-demo/privacy-shield',
    website: 'https://privacyshield.example.org',
    license: 'MIT',
    milestones: [
      {
        title: 'Fingerprinting Shield Core',
        description:
          'Build the spoofing engine for canvas, WebGL, and AudioContext readouts, including a test harness that scores how unique the resulting browser fingerprint is across common detection sites.',
        amount: 0.02,
      },
      {
        title: 'DNS over HTTPS Integration',
        description:
          'Add an encrypted DNS resolver with a one click UI toggle, a configurable upstream list, and a fallback path so connectivity never breaks when a resolver is unreachable.',
        amount: 0.01,
      },
      {
        title: 'Audit and Store Submission',
        description:
          'Commission a third party security review, fix the findings, and submit signed builds to the Chrome Web Store and Firefox Add ons portal.',
        amount: 0.01,
      },
    ],
  },
  {
    title: 'Zero Knowledge Proof SDK',
    description:
      'A TypeScript and Rust software development kit that lets ordinary application developers build zero knowledge powered features without needing a doctorate in cryptography. It ships with audited circuit templates for the most common use cases, including anonymous voting, private token balances, and age or membership proofs. The SDK abstracts away trusted setup ceremonies, proof serialization, and on chain verification so a product team can integrate a privacy preserving feature in an afternoon. Extensive documentation, runnable examples, and a command line tool round out the experience.',
    category: 'Developer Tools',
    paymentToken: 'USDC',
    repositoryUrl: 'https://github.com/defund-demo/zk-proof-sdk',
    website: 'https://zksdk.example.dev',
    license: 'Apache-2.0',
    milestones: [
      {
        title: 'Circuit Template Library',
        description:
          'Author and test Groth16 and PLONK circuits for voting, confidential transfers, and identity attestations, with property based tests for soundness.',
        amount: 4,
      },
      {
        title: 'TypeScript SDK and CLI',
        description:
          'Implement proof generation, verification, and contract bindings, plus a command line tool for scaffolding new circuits and exporting verifier contracts.',
        amount: 3,
      },
      {
        title: 'Docs and Example Apps',
        description:
          'Write a full documentation site and ship three runnable example applications that demonstrate end to end integration.',
        amount: 3,
      },
    ],
  },
  {
    title: 'Decentralised Git Protocol',
    description:
      'A protocol that stores git repositories on IPFS while anchoring commit signatures on chain. Pull requests are represented as transferable tokens, issues live in a decentralised forum, and the whole system works with the existing git command line through a custom remote helper, so contributors do not need to learn new tooling. The goal is to make source code hosting resistant to deplatforming and single points of failure, while preserving the everyday developer workflow that millions of engineers already rely on.',
    category: 'Infrastructure',
    paymentToken: 'ETH',
    repositoryUrl: 'https://github.com/defund-demo/decentralised-git',
    license: 'GPL-3.0',
    milestones: [
      {
        title: 'IPFS Remote Helper',
        description:
          'Implement a custom git remote protocol that pushes and pulls objects to and from IPFS with content addressed packfiles.',
        amount: 0.01,
      },
      {
        title: 'On Chain Commit Signing',
        description:
          'Add a signed commit graph using EIP 712 typed data so every commit can be cryptographically attributed to its author.',
        amount: 0.01,
      },
      {
        title: 'Pull Request and Issue Layer',
        description:
          'Build token based pull requests and a decentralised issue tracker with notifications.',
        amount: 0.01,
      },
      {
        title: 'CLI Polish and Docs',
        description:
          'Stabilise the command line experience, add shell completions, and publish a migration guide for existing repositories.',
        amount: 0.01,
      },
    ],
  },
  {
    title: 'Open Source Climate Data Commons',
    description:
      'A free and open repository of high resolution climate and air quality data aggregated from public sensor networks, satellites, and citizen science projects. Researchers, journalists, and local governments can query historical and near real time readings through a simple API without paying licensing fees. The platform normalises wildly different data formats into a single schema, documents the provenance of every record, and publishes reproducible pipelines so that anyone can verify how a number was produced.',
    category: 'Climate',
    paymentToken: 'USDC',
    repositoryUrl: 'https://github.com/defund-demo/climate-commons',
    website: 'https://climatecommons.example.earth',
    license: 'MPL-2.0',
    milestones: [
      {
        title: 'Ingestion Pipelines',
        description:
          'Build connectors for three major public sensor networks and one satellite source, with automatic retries and schema validation.',
        amount: 3,
      },
      {
        title: 'Unified Query API',
        description:
          'Expose a documented REST and GraphQL API with rate limiting, pagination, and provenance metadata on every record.',
        amount: 3,
      },
      {
        title: 'Reproducible Pipelines',
        description:
          'Containerise every transformation step and publish the pipelines so results can be independently reproduced.',
        amount: 2,
      },
      {
        title: 'Public Dashboard',
        description:
          'Ship a lightweight public dashboard for exploring trends without writing code.',
        amount: 2,
      },
    ],
  },
  {
    title: 'Self Hosted Encrypted Notes',
    description:
      'A self hostable note taking application with end to end encryption, offline first sync, and a clean editor that supports markdown, code blocks, and attachments. Notes are encrypted on the device before they ever leave it, so the server operator can never read your content. The project targets people who want the convenience of a modern notes app without surrendering their private thoughts to a third party cloud. It runs comfortably on a small home server or a cheap virtual machine.',
    category: 'Productivity',
    paymentToken: 'ETH',
    repositoryUrl: 'https://github.com/defund-demo/encrypted-notes',
    license: 'AGPL-3.0',
    milestones: [
      {
        title: 'End to End Encryption Core',
        description:
          'Implement client side encryption with key derivation, secure key backup, and a recovery flow that never exposes plaintext to the server.',
        amount: 0.01,
      },
      {
        title: 'Offline First Sync',
        description:
          'Add conflict free replicated data type based sync so edits made offline merge cleanly when the device reconnects.',
        amount: 0.01,
      },
      {
        title: 'Rich Editor',
        description:
          'Build a markdown editor with code highlighting, attachments, and a fast full text search index.',
        amount: 0.01,
      },
      {
        title: 'One Command Deploy',
        description:
          'Provide a single command Docker deployment with sensible defaults and automated backups.',
        amount: 0.01,
      },
      {
        title: 'Mobile Companion',
        description:
          'Ship a progressive web app that works well on phones and supports biometric unlock.',
        amount: 0.01,
      },
    ],
  },
  {
    title: 'Accessible Maps Toolkit',
    description:
      'An open toolkit that makes interactive maps usable for people who rely on screen readers, keyboard navigation, or high contrast modes. Most web mapping libraries are effectively invisible to assistive technology, which excludes millions of users from everyday tasks like finding a clinic or planning a route. This project provides drop in components and patterns that bring maps up to modern accessibility standards while remaining fast and easy to embed.',
    category: 'Accessibility',
    paymentToken: 'USDC',
    repositoryUrl: 'https://github.com/defund-demo/accessible-maps',
    website: 'https://a11ymaps.example.app',
    license: 'BSD-3-Clause',
    milestones: [
      {
        title: 'Keyboard Navigation Layer',
        description:
          'Implement full keyboard control for panning, zooming, and focusing markers, with a logical and predictable tab order.',
        amount: 4,
      },
      {
        title: 'Screen Reader Semantics',
        description:
          'Add accessible descriptions, live region announcements, and a textual alternative view of the map contents.',
        amount: 3,
      },
      {
        title: 'High Contrast and Audit',
        description:
          'Provide high contrast themes and complete a formal accessibility audit against recognised guidelines.',
        amount: 3,
      },
    ],
  },
  {
    title: 'Lightweight Container Runtime',
    description:
      'A minimal and auditable container runtime aimed at edge devices and small servers where the mainstream stack is too heavy. It focuses on a tiny trusted computing base, fast cold starts, and predictable resource usage. The runtime is written in a memory safe language, ships with a clear specification, and is designed so that a single engineer can read and understand the entire codebase in a weekend.',
    category: 'Infrastructure',
    paymentToken: 'ETH',
    repositoryUrl: 'https://github.com/defund-demo/tiny-runtime',
    license: 'Apache-2.0',
    milestones: [
      {
        title: 'Process Isolation Core',
        description:
          'Implement namespaces, cgroups, and a minimal root filesystem setup with strong defaults.',
        amount: 0.02,
      },
      {
        title: 'Image Format and Pull',
        description:
          'Support a compact image format with content addressed layers and a verifying pull client.',
        amount: 0.01,
      },
      {
        title: 'Spec and Conformance Tests',
        description:
          'Publish a written specification and a conformance test suite so alternative implementations can be validated.',
        amount: 0.01,
      },
    ],
  },
  {
    title: 'Community Mesh Networking Kit',
    description:
      'A hardware and software kit that lets neighbourhoods build their own resilient wireless networks, useful during outages or in areas underserved by commercial providers. The kit includes flashable firmware, a friendly setup wizard, and a routing layer that heals automatically as nodes join and leave. Documentation is written for community organisers rather than network engineers, with step by step guides and printable diagrams.',
    category: 'Networking',
    paymentToken: 'USDC',
    repositoryUrl: 'https://github.com/defund-demo/mesh-kit',
    website: 'https://meshkit.example.net',
    license: 'GPL-2.0',
    milestones: [
      {
        title: 'Self Healing Firmware',
        description:
          'Build flashable firmware with an automatic routing protocol that recovers when nodes appear or disappear.',
        amount: 2,
      },
      {
        title: 'Setup Wizard',
        description:
          'Create a guided setup wizard that configures a new node in under five minutes with no command line.',
        amount: 2,
      },
      {
        title: 'Captive Portal and Sharing',
        description:
          'Add an optional captive portal and fair bandwidth sharing between participating households.',
        amount: 2,
      },
      {
        title: 'Organiser Documentation',
        description:
          'Write community focused documentation with diagrams, a parts list, and troubleshooting guides.',
        amount: 2,
      },
      {
        title: 'Pilot Deployment',
        description:
          'Run a small pilot with a real community and incorporate the feedback into a stable release.',
        amount: 2,
      },
    ],
  },
  {
    title: 'Open Hardware Insulin Pump Monitor',
    description:
      'An open hardware companion device that monitors commercial insulin pumps and continuous glucose monitors, surfacing alerts and trends on a low cost screen by the bedside. It is explicitly a monitoring and visualisation aid rather than a dosing device, with prominent safety messaging and a conservative design philosophy. All schematics, firmware, and assembly instructions are published openly so that the community can review, improve, and locally manufacture the device.',
    category: 'Health',
    paymentToken: 'ETH',
    repositoryUrl: 'https://github.com/defund-demo/glucose-monitor',
    license: 'BSD-2-Clause',
    milestones: [
      {
        title: 'Sensor Bridge Firmware',
        description:
          'Read data from supported glucose monitors over Bluetooth and normalise it into a single stream with clear error handling.',
        amount: 0.01,
      },
      {
        title: 'Bedside Display',
        description:
          'Build a low power display showing current readings, trend arrows, and configurable threshold alerts.',
        amount: 0.02,
      },
      {
        title: 'Safety Review and Docs',
        description:
          'Complete a safety focused design review and publish full schematics and assembly instructions.',
        amount: 0.01,
      },
    ],
  },
  {
    title: 'Civic Budget Transparency Portal',
    description:
      'A reusable open source portal that helps local governments publish their budgets and spending in a way ordinary residents can actually understand. It transforms dense financial spreadsheets into clear visual breakdowns, supports multiple languages, and lets residents drill from a high level summary down to individual line items. The project includes an importer for common accounting export formats so a small municipality can stand up a transparency site without a dedicated technical team.',
    category: 'Civic Tech',
    paymentToken: 'USDC',
    repositoryUrl: 'https://github.com/defund-demo/budget-portal',
    website: 'https://budgets.example.city',
    license: 'MIT',
    milestones: [
      {
        title: 'Accounting Importer',
        description:
          'Build importers for two common accounting export formats with validation and a clear mapping interface.',
        amount: 3,
      },
      {
        title: 'Visual Breakdowns',
        description:
          'Create interactive visualisations that let residents explore spending from summary to line item.',
        amount: 4,
      },
      {
        title: 'Localisation and Launch',
        description:
          'Add multi language support and ship a launch ready deployment template for municipalities.',
        amount: 3,
      },
    ],
  },
  {
    title: 'Federated Learning for Small Clinics',
    description:
      'A privacy preserving machine learning framework that lets small clinics collaboratively train diagnostic models without ever sharing raw patient data. Each clinic trains locally and only encrypted model updates are aggregated, so sensitive records never leave the building. The framework targets resource constrained settings with intermittent connectivity, and it includes tooling to measure and limit how much any single participant can influence the shared model.',
    category: 'Health',
    paymentToken: 'ETH',
    repositoryUrl: 'https://github.com/defund-demo/federated-clinics',
    license: 'Apache-2.0',
    milestones: [
      {
        title: 'Local Training Runtime',
        description:
          'Build a lightweight runtime that trains models locally and produces encrypted updates suitable for aggregation.',
        amount: 0.01,
      },
      {
        title: 'Secure Aggregation',
        description:
          'Implement secure aggregation so the server learns the combined update without seeing individual contributions.',
        amount: 0.01,
      },
      {
        title: 'Robustness Controls',
        description:
          'Add tooling to detect and limit the influence of any single participant on the shared model.',
        amount: 0.01,
      },
      {
        title: 'Offline Friendly Sync',
        description:
          'Support intermittent connectivity with resumable rounds and clear progress reporting.',
        amount: 0.01,
      },
    ],
  },
  {
    title: 'Open Translation Memory for Minority Languages',
    description:
      'A community owned translation memory and glossary platform focused on minority and indigenous languages that are poorly served by commercial machine translation. Contributors can build and curate parallel corpora, agree on terminology, and export datasets for use in their own tools. The platform emphasises community governance, clear data licensing, and respectful handling of cultural knowledge, so that the people who speak a language remain in control of the resources built around it.',
    category: 'Open Source',
    paymentToken: 'USDC',
    repositoryUrl: 'https://github.com/defund-demo/translation-memory',
    website: 'https://tm.example.community',
    license: 'BSD-3-Clause',
    milestones: [
      {
        title: 'Corpus Editor',
        description:
          'Build a collaborative editor for aligning parallel sentences with review and approval workflows.',
        amount: 3,
      },
      {
        title: 'Terminology and Governance',
        description:
          'Add a shared glossary with community voting and clear data licensing on every contribution.',
        amount: 3,
      },
      {
        title: 'Dataset Export',
        description:
          'Provide clean dataset exports in standard formats with provenance and licence metadata attached.',
        amount: 4,
      },
    ],
  },
];

// ---- Helpers ----------------------------------------------------------------

function round(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

function goalFor(c: CampaignTemplate): number {
  // The DB stores amounts as Decimal(18, 2), so goals round to 2 decimals.
  return round(
    c.milestones.reduce((sum, m) => sum + m.amount, 0),
    2,
  );
}

// Guard against the Decimal(18, 2) truncation trap: every milestone amount must
// be >= 0.01 and have at most 2 decimals, or it silently stores as a smaller /
// zero value and the campaign cannot be approved on-chain later.
function assertValidAmounts() {
  for (const c of CAMPAIGNS) {
    for (const m of c.milestones) {
      const r = round(m.amount, 2);
      if (r !== m.amount || r < 0.01) {
        throw new Error(
          `Invalid amount ${m.amount} in "${c.title}" / "${m.title}". ` +
            'DB stores Decimal(18,2): each amount must be >= 0.01 with at most 2 decimals.',
        );
      }
    }
  }
}

function ipfsHashFor(title: string, description: string): string {
  // Mirrors the frontend fallback so campaign.ipfsHash is non-empty.
  return ethers.keccak256(ethers.toUtf8Bytes(title + description));
}

function pickCreator(): ethers.Wallet {
  const key = CREATOR_KEYS[Math.floor(Math.random() * CREATOR_KEYS.length)];
  return new ethers.Wallet(key);
}

/**
 * Near future, randomized campaign deadline (3 to 7 days out) plus milestone
 * deadlines spread evenly across the window, each at or before the campaign
 * deadline. Returns ISO strings.
 */
function buildDeadlines(milestoneCount: number): { campaign: string; milestones: string[] } {
  const now = Date.now();
  const windowDays = 3 + Math.floor(Math.random() * 5); // 3..7
  const campaignMs = now + windowDays * DAY_MS;
  const milestones: string[] = [];
  for (let i = 0; i < milestoneCount; i++) {
    const fraction = (i + 1) / milestoneCount;
    const ms = Math.min(now + Math.round(fraction * (campaignMs - now)), campaignMs);
    milestones.push(new Date(ms).toISOString());
  }
  return { campaign: new Date(campaignMs).toISOString(), milestones };
}

function getSetCookies(res: Response): string[] {
  const anyHeaders = res.headers as any;
  if (typeof anyHeaders.getSetCookie === 'function') {
    return anyHeaders.getSetCookie();
  }
  const raw = res.headers.get('set-cookie');
  return raw ? [raw] : [];
}

function extractJwtCookie(res: Response): string {
  for (const c of getSetCookies(res)) {
    const m = c.match(/(?:^|;\s*)jwt=([^;]+)/);
    if (m) return `jwt=${m[1]}`;
  }
  throw new Error('No jwt cookie found in /auth/verify response');
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function postJson(path: string, body: unknown, cookie?: string): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

// Per wallet JWT cache. /auth/nonce is rate limited to 5/min/IP, so we only hit
// it once per unique wallet and reuse the cookie across that wallet's campaigns.
const cookieCache = new Map<string, string>();

async function authenticate(wallet: ethers.Wallet): Promise<string> {
  const key = wallet.address.toLowerCase();
  const cached = cookieCache.get(key);
  if (cached) return cached;

  // Request a nonce, retrying once on a rate limit response.
  let nonceRes = await postJson('/auth/nonce', { walletAddress: wallet.address });
  if (nonceRes.status === 429) {
    console.log('    rate limited on /auth/nonce, waiting 60s...');
    await sleep(60_000);
    nonceRes = await postJson('/auth/nonce', { walletAddress: wallet.address });
  }
  if (!nonceRes.ok) {
    throw new Error(`/auth/nonce failed (${nonceRes.status}): ${await nonceRes.text()}`);
  }
  const { nonce } = (await nonceRes.json()) as { nonce: string };

  const signature = await wallet.signMessage(nonce);

  const verifyRes = await postJson('/auth/verify', {
    walletAddress: wallet.address,
    signature,
  });
  if (!verifyRes.ok) {
    throw new Error(`/auth/verify failed (${verifyRes.status}): ${await verifyRes.text()}`);
  }
  const cookie = extractJwtCookie(verifyRes);
  cookieCache.set(key, cookie);
  return cookie;
}

function buildPayload(c: CampaignTemplate) {
  const goalAmount = goalFor(c);
  const { campaign: deadline, milestones: msDeadlines } = buildDeadlines(c.milestones.length);
  return {
    title: c.title,
    description: c.description,
    category: c.category,
    goalAmount,
    deadline,
    website: c.website,
    repositoryUrl: c.repositoryUrl,
    license: c.license,
    paymentToken: c.paymentToken,
    ipfsHash: ipfsHashFor(c.title, c.description),
    images: [] as string[],
    milestones: c.milestones.map((m, i) => ({
      title: m.title,
      description: m.description,
      amount: m.amount,
      deadline: msDeadlines[i],
    })),
  };
}

// ---- Main -------------------------------------------------------------------

async function main() {
  assertValidAmounts();

  console.log('DeFund campaign seeder (via real backend API)');
  console.log('-'.repeat(60));
  console.log(`API        : ${API_URL}`);
  console.log(`Creators   : ${CREATOR_KEYS.length} key(s) from ${CREATOR_KEY_SOURCE}`);
  console.log(`Campaigns  : ${CAMPAIGNS.length}`);
  console.log('-'.repeat(60));

  let created = 0;
  let failed = 0;

  for (const [i, template] of CAMPAIGNS.entries()) {
    const label = `[${i + 1}/${CAMPAIGNS.length}] ${template.title}`;
    const wallet = pickCreator();
    console.log(`\n${label}`);
    console.log(`  creator : ${wallet.address}`);
    console.log(`  token   : ${template.paymentToken}  goal: ${goalFor(template)}  milestones: ${template.milestones.length}`);

    try {
      const cookie = await authenticate(wallet);
      const payload = buildPayload(template);
      const res = await postJson('/projects', payload, cookie);

      if (!res.ok) {
        failed++;
        console.log(`  FAILED  : ${res.status} ${await res.text()}`);
        continue;
      }

      const campaign = (await res.json()) as { id: string; status: string };
      created++;
      console.log(`  created : id=${campaign.id} status=${campaign.status}`);
    } catch (err) {
      failed++;
      console.log(`  ERROR   : ${(err as Error).message}`);
    }
  }

  console.log('\n' + '-'.repeat(60));
  console.log(`Done. Created ${created}, failed ${failed}.`);
  console.log('Campaigns are PENDING. Approve them as admin to deploy them on-chain.');
}

main().catch((e) => {
  console.error('\nFatal:', e);
  process.exit(1);
});
