# Local Coder - Code Editor Environment

A full-featured web-based code editor with terminal, file explorer, git integration, and more.

## Features

- 🎨 Monaco Editor integration
- 📁 File explorer with tree view
- 💻 Integrated terminal
- 🔄 Git version control
- 💬 Chat panel
- 🔌 Plugin system
- 🎨 Theme switcher

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend**: Node.js, Express 5, TypeScript
- **Database**: SQLite with Kysely query builder
- **Terminal**: xterm.js with node-pty

## Getting Started

### Local Development

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm start
```

This runs both the Vite dev server (port 3000) and Express API (port 3001).

3. Open http://localhost:3000 in your browser.

### Docker Development

Run with Docker Compose (development mode):
```bash
docker-compose --profile dev up
```

Run production mode:
```bash
docker-compose up
```

Build Docker image manually:
```bash
docker build -t local-coder .
docker run -p 4000:4000 -v $(pwd)/data:/app/data local-coder
```

### Production Build

1. Build the application:
```bash
npm run build
```

2. Start production server:
```bash
NODE_ENV=production PORT=4000 node dist/index.js
```

## Environment Variables

- `NODE_ENV`: Environment mode (`development` or `production`)
- `PORT`: Server port (default: 3001 dev, 4000 prod)
- `DATA_DIRECTORY`: Path to persistent data directory (default: `/home/app/data`)

Copy `.env.example` to `.env` and adjust as needed.

## Project Structure

```
/home/app/
├── client/              # React frontend
│   ├── src/
│   │   ├── components/  # UI components
│   │   ├── pages/       # Page components
│   │   └── lib/         # Utilities
│   └── public/          # Static assets
├── server/              # Express backend
│   ├── routes/          # API routes
│   └── db.ts            # Database setup
├── data/                # Persistent data
│   └── database.sqlite  # SQLite database
└── scripts/             # Build & dev scripts
```

## API Endpoints

- `POST /api/files/read` - Read file contents
- `POST /api/files/write` - Write file contents
- `GET /api/files/tree` - Get file tree
- `POST /api/git/*` - Git operations
- `GET /api/chat` - Chat messages
- `POST /api/chat` - Send chat message
- `GET /api/settings` - Get settings
- `POST /api/settings` - Update settings
- `WS /api/terminal` - Terminal WebSocket

## Database

SQLite database stored in `data/database.sqlite` with schema managed by Kysely migrations.

## License

MIT
