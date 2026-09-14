---
name: testing-local-coder
description: Run and end-to-end test Local Coder's Express/Vite UI, LM Studio token features, and the local-only NEO//OPS server control deck.
---

# Testing local-coder

## Startup
- Select a Node version supported by the installed dependency engines, rather than assuming the system Node path exists. The effective minimum is Node 22.12 because `better-sqlite3@13.0.3` requires Node >=22 and Vite requires Node >=22.12; Node 24.19.0 worked in this inspection. A NODE_MODULE_VERSION error means native dependencies need rebuilding under the selected supported runtime.
- Repository CI, release builds, Docker images, and installers target Node 22.12 or newer.
- Verify SQLite loads with the selected runtime before startup: `node -e "const db=new (require('better-sqlite3'))(':memory:'); console.log(db.prepare('select 1 as ready').get())"`.
- Run `npm start` using the selected runtime in PATH. Express API is on :3001, Vite UI on :3000; Vite proxies `/api` to :3001.
- If Vite crashes on a missing rolldown native binding: `npm install --no-save @rolldown/binding-linux-x64-gnu@$(node -p "require('rolldown/package.json').version")`.
- Data dir falls back to `./data` locally; sqlite DB is `data/database.sqlite`. `sqlite3` CLI may not be installed; query with a better-sqlite3 one-liner using the same Node runtime.

## UI map
- Editor (http://localhost:3000): three resizable panels — Files | editor | Casper chat.
- Chat Settings: gear at top-right of Casper panel. Fields: Provider (LM Studio/Ollama), Model, LM Studio Base URL, LM Studio API Token (password, `lmstudio-api-key`), Ollama Base URL, Save.
- Saving PUTs each key to `/api/settings/<key>`. `lmstudio_api_key` is secret: GET returns `********`; PUT of literal `********` is a no-op; empty PUT clears it.
- Clear chat history on an isolated unauthenticated local instance: `curl -X DELETE http://localhost:3001/api/chat/messages`.

## Simulating LM Studio
- Fake servers may exist at `/tmp/fake-lmstudio-auth.mjs` (requires `Authorization: Bearer test-token-123`) and `/tmp/fake-lmstudio.mjs` (no auth). Recreate if missing. Serve :1234 with `GET /api/v0/models` (model with `state:"loaded"`, `type:"llm"`), `GET /v1/models`, and `POST /v1/chat/completions` streaming SSE `data: {"choices":[{"delta":{"content":...}}]}` ending with `data: [DONE]`.
- With Model blank or Auto, a wrong/missing token should yield 401 during model discovery and the UI error "No model loaded in LM Studio — load one, or set a model name in settings. If LM Studio requires an API token, set it in settings." With an explicit model, discovery is skipped and the expected error is "LM Studio API error: Unauthorized".
- Stub request logs provide evidence that the Authorization header is sent.

## NEO//OPS local-only inspection
- Route: http://localhost:3000/ops, also reachable via Editor's SERVER OPS control.
- Use a fresh temporary `DATA_DIRECTORY` and `HOST=127.0.0.1`. An existing data directory may contain remote nodes in `nodes.json` and a paired Casper access token in SQLite; startup can reconnect configured tunnels or auto-start the paired daemon.
- Example: `DATA_DIRECTORY="$(mktemp -d)" HOST=127.0.0.1 OPS_NODES= npm start`, with a supported Node in PATH.
- Modules: Overwatch, Filesystem, Console, Processes, Daemons, Network, Logs. Alt+1 through Alt+7 also navigate.
- NODE-01 is the local registry entry. The Add Node form's Establish Uplink action persists SSH configuration and starts tunneling. Open the form and verify Establish Uplink is disabled while Host is empty; do not enter a host or submit without permission to persist a node and attempt SSH.
- Console is a real PTY with full process-user host access, starting at `/`. Prefer harmless commands such as `printf 'QA_READ_ONLY\n'; id -un; pwd; uname -s`; `exit` tests disconnect. Check new/close session controls, session preservation and xterm exceptions during tab lifecycle and viewport resizing.
- Safe module checks: read `/etc/os-release`; filter processes to a nonexistent sentinel; filter Daemons to `ssh`; filter Network to `3001`. Do not execute file mutations, process signals or daemon lifecycle actions without explicit scope/approval.
- On filesystem/log failures, assert that previous data is cleared or explicitly marked stale rather than relabeled as the failed target. Current Logs behavior may retain old content under the new source title; report that as a failed assertion instead of treating the stale content as a successful load.
- Test desktop plus 1000x800 and 390x844 viewports. Check card bodies, header/rack dropdown clipping, scrolling and console width, not only whether sidebar buttons remain visible.
- Stop only the owned development process to test outage handling. Check both global link and rack-node badges, and distinguish unavailable telemetry from true zero/no volumes. Restart to check recovery; stop owned services after inspection.

## Devin Secrets Needed
- None for isolated local NEO//OPS inspection or simulated LM Studio.
- Real LM Studio credentials, remote SSH access or Casper pairing credentials require separate authorized scope; do not provision or connect merely to inspect the UI.
