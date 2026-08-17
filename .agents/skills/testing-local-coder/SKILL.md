---
name: testing-local-coder
description: How to run and end-to-end test the local-coder app (Express API + Vite UI), including simulating an authenticated LM Studio server for API-token features.
---

# Testing local-coder

## Startup
- Requires Node 20. Run: `PATH=/usr/bin:/bin:/usr/local/bin /usr/bin/npm start` (Node 22 breaks the better-sqlite3 prebuild with a NODE_MODULE_VERSION mismatch).
- Express API on :3001, Vite dev UI on :3000. Vite proxies `/api` to :3001.
- If Vite crashes on a missing rolldown native binding: `npm install --no-save @rolldown/binding-linux-x64-gnu@$(node -p "require('rolldown/package.json').version")`.
- Data dir falls back to `./data` locally; sqlite DB at `data/database.sqlite`. `sqlite3` CLI is not installed — query with a better-sqlite3 one-liner, e.g. `node -e "const db=require('better-sqlite3')('data/database.sqlite');console.log(JSON.stringify(db.prepare(\"SELECT * FROM settings\").all()))"` (run with Node 20 PATH as above).

## UI map
- Editor page (http://localhost:3000): three resizable panels — Files | editor | Casper chat.
- Chat Settings dialog: gear icon at the top-right of the Casper chat panel header. Fields: Provider select (LM Studio/Ollama), Model, LM Studio Base URL, "LM Studio API Token" (password input, id `lmstudio-api-key`), Ollama Base URL, Save button.
- Saving PUTs each key to `/api/settings/<key>`. `lmstudio_api_key` is a secret: GET returns `********`; PUT of the literal `********` is a no-op; empty PUT clears it.
- Clear chat history: `curl -X DELETE http://localhost:3001/api/chat/messages`.

## Simulating LM Studio
- Fake LM Studio servers may exist at `/tmp/fake-lmstudio-auth.mjs` (requires `Authorization: Bearer test-token-123`) and `/tmp/fake-lmstudio.mjs` (no auth) — /tmp is wiped between sessions, so recreate them if missing. They must serve on :1234: `GET /api/v0/models` (return a model with `state:"loaded"`, `type:"llm"`), `GET /v1/models`, and `POST /v1/chat/completions` streaming SSE `data: {"choices":[{"delta":{"content":...}}]}` chunks ending with `data: [DONE]`.
- With a wrong/missing token the auth stub should 401 everything; the app then shows the chat error "No model loaded in LM Studio — load one, or set a model name in settings. If LM Studio requires an API token, set it in settings."
- The stub's request log is the easiest proof that the `Authorization: Bearer <token>` header is actually sent.
