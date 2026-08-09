import { withCasperPersona } from './casper';

export type ContextMode = 'none' | 'file' | 'project';

export interface Workflow {
  id: string;
  label: string;
  description: string;
  contextMode: ContextMode;
  systemPrompt: string;
  emptyHint: string;
  inputPlaceholder: string;
}

export const WORKFLOWS: Workflow[] = [
  {
    id: 'general',
    label: 'General',
    description: 'Everyday coding with Casper',
    contextMode: 'file',
    systemPrompt: withCasperPersona(
      'Everyday coding help. When the user asks for changes, return complete updated file content they can Apply. Keep answers tight.'
    ),
    emptyHint: "Hey — I'm Casper. Open a file or just tell me what we're building.",
    inputPlaceholder: 'Talk to Casper…',
  },
  {
    id: 'ui-builder',
    label: 'UI Builder',
    description: 'Casper builds pages for live Preview',
    contextMode: 'project',
    systemPrompt: withCasperPersona(
      'UI builder mode. Prefer index.html / style.css / app.js (or similar). Each file in its own fenced block with a path comment on line 1. Design for Local Code Preview reload. No fake backends unless asked.'
    ),
    emptyHint: 'Describe a UI — Casper will ship HTML/CSS/JS for Preview.',
    inputPlaceholder: 'What should Casper build?',
  },
  {
    id: 'debug',
    label: 'Debug',
    description: 'Casper hunts bugs',
    contextMode: 'file',
    systemPrompt: withCasperPersona(
      'Debug mode. (1) Name the likely bug, (2) explain why, (3) minimal fix in a fenced block. No cosmetics-first answers.'
    ),
    emptyHint: 'Paste an error or open the buggy file — Casper will dig in.',
    inputPlaceholder: 'What broke?',
  },
  {
    id: 'review',
    label: 'Review',
    description: 'Casper code review',
    contextMode: 'file',
    systemPrompt: withCasperPersona(
      'Review mode. Bullets by severity (critical first). Patches only when the fix is clear.'
    ),
    emptyHint: 'Open a file and ask Casper for a review.',
    inputPlaceholder: 'Review this…',
  },
  {
    id: 'explain',
    label: 'Explain',
    description: 'Casper teaches the code',
    contextMode: 'file',
    systemPrompt: withCasperPersona(
      'Explain mode. Short sections, plain language, small examples. Do not rewrite whole files unless asked.'
    ),
    emptyHint: 'Ask Casper what this code is doing.',
    inputPlaceholder: 'Explain…',
  },
  {
    id: 'project',
    label: 'Project',
    description: 'Casper sees the whole tree',
    contextMode: 'project',
    systemPrompt: withCasperPersona(
      'Project mode. You get a file listing (+ optional open file). Reason about structure. New files: path comments on code blocks.'
    ),
    emptyHint: 'Ask Casper about architecture or a feature across the repo.',
    inputPlaceholder: 'About the project…',
  },
  {
    id: 'agent',
    label: 'Agent',
    description: 'Casper multi-file edits (Apply All)',
    contextMode: 'project',
    systemPrompt: withCasperPersona(
      'Agent mode. Implement the request with one or more complete files. Every code block MUST start with a path comment. Smallest file set that works. Short bullet summary after. User will review diffs then Apply All.'
    ),
    emptyHint: 'Describe a multi-file job — Casper will propose files for Apply All.',
    inputPlaceholder: 'Give Casper a mission…',
  },
];

export const DEFAULT_WORKFLOW_ID = 'general';

export function getWorkflow(id: string | undefined | null): Workflow {
  return WORKFLOWS.find((w) => w.id === id) ?? WORKFLOWS[0];
}
