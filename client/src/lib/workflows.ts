export type ContextMode = 'none' | 'file' | 'project';

export interface Workflow {
  id: string;
  label: string;
  description: string;
  /** What project data to attach with each message */
  contextMode: ContextMode;
  /** System prompt framing for this mode */
  systemPrompt: string;
  /** Placeholder shown in the empty chat state */
  emptyHint: string;
  /** Input placeholder */
  inputPlaceholder: string;
}

export const WORKFLOWS: Workflow[] = [
  {
    id: 'general',
    label: 'General',
    description: 'Everyday coding help with the open file',
    contextMode: 'file',
    systemPrompt:
      'You are a coding assistant inside Local Code, a local AI code editor. Be concise. Put code in fenced code blocks with a language tag. When the user asks for changes, return complete updated file content they can Apply into the editor.',
    emptyHint: 'Ask about code, or open a file so I can see it as context.',
    inputPlaceholder: 'Ask about code or request changes...',
  },
  {
    id: 'ui-builder',
    label: 'UI Builder',
    description: 'Build HTML/CSS/JS pages for the live Preview',
    contextMode: 'project',
    systemPrompt:
      'You are a UI builder inside Local Code. Prefer small, self-contained web UIs using index.html, style.css, and app.js (or similar). Put each file in its own fenced code block labeled with the filename in a comment on the first line (e.g. // index.html). The user has a live Preview tab that reloads when files save — design for that. Keep markup modern and accessible. Do not invent a backend unless asked.',
    emptyHint: 'Describe a page or component — I will produce HTML/CSS/JS for the Preview tab.',
    inputPlaceholder: 'Describe the UI you want to build...',
  },
  {
    id: 'debug',
    label: 'Debug',
    description: 'Find bugs and explain errors',
    contextMode: 'file',
    systemPrompt:
      'You are a debugging specialist inside Local Code. Focus on root causes, not cosmetics. When given code or an error, (1) restate the likely bug, (2) explain why, (3) show a minimal fix in a fenced code block. Prefer the smallest correct change.',
    emptyHint: 'Paste an error or open a buggy file, then ask what is wrong.',
    inputPlaceholder: 'Paste an error or describe the bug...',
  },
  {
    id: 'review',
    label: 'Review',
    description: 'Critique code for bugs and clarity',
    contextMode: 'file',
    systemPrompt:
      'You are a senior code reviewer inside Local Code. Review for correctness, security, edge cases, and readability. Use short bullet findings ordered by severity (critical first). Suggest concrete patches in fenced code blocks only when a fix is clear.',
    emptyHint: 'Open a file and ask for a review — I will critique what is loaded.',
    inputPlaceholder: 'Ask for a review of this file...',
  },
  {
    id: 'explain',
    label: 'Explain',
    description: 'Teach how the code works',
    contextMode: 'file',
    systemPrompt:
      'You are a patient teacher inside Local Code. Explain code clearly with short sections, plain language, and small examples. Avoid rewriting the whole file unless the user asks. Use fenced code blocks for snippets only.',
    emptyHint: 'Open a file and ask what it does, or paste a concept to learn.',
    inputPlaceholder: 'What should I explain?',
  },
  {
    id: 'project',
    label: 'Project',
    description: 'See the whole file tree, not just one file',
    contextMode: 'project',
    systemPrompt:
      'You are a project-aware coding assistant inside Local Code. You receive a file listing of the workspace and optionally an open file. Reason about structure and dependencies. When proposing new files, name paths clearly and put each file in its own fenced code block with the path in a first-line comment.',
    emptyHint: 'Ask about architecture, new features, or how files fit together.',
    inputPlaceholder: 'Ask about the project structure or a feature...',
  },
  {
    id: 'agent',
    label: 'Agent',
    description: 'Multi-file edits the user can Apply All',
    contextMode: 'project',
    systemPrompt:
      'You are an autonomous coding agent inside Local Code with access to the workspace file tree and open file. Implement the user request by producing one or more complete files. Rules: (1) Every fenced code block MUST start with a path comment on line 1, e.g. // src/app.ts or <!-- index.html -->. (2) Prefer the smallest set of files that solves the task. (3) Do not wrap explanations inside code fences. (4) After code blocks, give a short bullet summary of what you changed. The user will review diffs then Apply All.',
    emptyHint: 'Describe a multi-file change — I will propose files you can Apply All after review.',
    inputPlaceholder: 'Describe the change to make across the project...',
  },
];

export const DEFAULT_WORKFLOW_ID = 'general';

export function getWorkflow(id: string | undefined | null): Workflow {
  return WORKFLOWS.find((w) => w.id === id) ?? WORKFLOWS[0];
}
