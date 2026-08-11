# AGENTS.md

This file provides practical instructions for coding agents working in this repository.

## Objective

Make focused, minimal changes that solve the requested task while preserving existing behavior.

## Repository Overview

- Frontend: `client/` (React 18 + TypeScript + Vite + Tailwind + shadcn/ui)
- Backend: `server/` (Express 5 + TypeScript)
- Data: `data/` (SQLite database file)
- Ops and deployment: `scripts/`, `k8s/`, Docker files, CI files in `.github/workflows/`

## Setup

1. Install dependencies:
   - `npm install`
2. Run local development:
   - `npm start`
3. Build production artifacts:
   - `npm run build`

## Required Validation

Run these existing project checks after changes:

1. Type/lint check:
   - `npm run lint`
2. Build:
   - `npm run build`
3. Tests:
   - `npm test`

Note: `npm test` currently reports no configured tests and exits successfully. Still run it unless explicitly told not to.

## Coding Conventions

Follow repository conventions from `.github/CONTRIBUTING.md`:

- Use TypeScript for new code.
- Prefer double quotes.
- Use relative imports (no path aliases like `@/`).
- Reuse `client/src/components/ui/` (shadcn/ui) components where applicable.
- Keep changes small and directly related to the request.

## Backend and Data Rules

- Use Kysely for database operations.
- Resolve runtime data paths from `DATA_DIRECTORY` rather than `process.cwd()`.

## Change Scope Rules

- Do not refactor unrelated areas.
- Do not remove or rewrite unrelated tests.
- Update documentation when behavior or developer workflow changes.
- Do not commit secrets or credentials; verify any changed config/env files carefully.

## Suggested Change Workflow

1. Read relevant files first (`README.md`, `.github/CONTRIBUTING.md`, nearby source files).
2. Implement the smallest complete fix.
3. Run `npm run lint`, `npm run build`, and `npm test`.
4. Summarize what changed, how it was validated, and any remaining risks.

## Useful Commands

- `npm start` - run frontend and backend in development
- `npm run lint` - TypeScript type checks (client + server)
- `npm run build` - Vite build + server TypeScript compile
- `npm test` - current test placeholder
- `make help` - list common project automation commands
