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

### Linux Desktop Install (Ubuntu, etc.)

Install Local Code as a desktop app with an application-menu launcher and a
systemd user service that starts it automatically when you log in:

```bash
./scripts/install-linux-desktop.sh
```

This builds the production bundle (if needed), then installs — all per-user,
no sudo required:

- `~/.config/systemd/user/local-coder.service` — starts the server at login on port 4000
- `~/.local/share/applications/local-coder.desktop` — "Local Code" in your app menu
- the app icon

Click **Local Code** in your application menu (or run `npm run app:linux`) to
open the editor at http://localhost:4000. Useful commands:

```bash
systemctl --user status local-coder        # check the service
systemctl --user restart local-coder       # restart after a rebuild
./scripts/install-linux-desktop.sh --uninstall   # remove launcher + service
```

Set `LOCAL_CODER_PORT` before installing to use a different port.

### Production Build

1. Build the application:
```bash
npm run build
```

2. Start production server (the working directory must be `dist/` so the
server can find its static files in `dist/public`; the extra `server/` level
in the entry path is produced by the TypeScript build):
```bash
cd dist && NODE_ENV=production PORT=4000 node server/server/index.js
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

## Deployment

This project includes comprehensive CI/CD pipelines and deployment configurations for multiple platforms:

### Supported CI/CD Platforms

- **GitHub Actions** - Complete pipelines for CI, Docker builds, deployments, releases, and code quality
- **GitLab CI** - Full pipeline with staging and production deployments
- **CircleCI** - Build, test, and deployment workflows
- **Azure Pipelines** - Multi-stage pipeline with Docker support
- **Drone CI** - Lightweight CI/CD configuration

### Kubernetes Deployment

Deploy to Kubernetes clusters with:

```bash
# Apply basic deployment
kubectl apply -f k8s/deployment.yml
kubectl apply -f k8s/ingress.yml
kubectl apply -f k8s/hpa.yml

# Deploy with Kustomize (recommended)
kubectl apply -k k8s/environments/staging
kubectl apply -k k8s/environments/production

# Use deployment script
./scripts/deploy.sh production v1.0.0
```

### Docker Deployment

```bash
# Production
docker-compose -f docker-compose.prod.yml up -d

# Development
docker-compose --profile dev up
```

### Deployment Features

- ✅ Multi-environment support (staging, production)
- ✅ Horizontal pod autoscaling
- ✅ Health checks and readiness probes
- ✅ ConfigMaps and Secrets management
- ✅ Network policies for security
- ✅ Prometheus monitoring integration
- ✅ Automated dependency updates (Dependabot)
- ✅ Security scanning (Trivy)
- ✅ Rollback scripts

For detailed deployment instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md).

## Scripts

- `npm start` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run type checking
- `npm test` - Run tests
- `./scripts/deploy.sh [env] [version]` - Deploy to environment
- `./scripts/rollback.sh [env] [revision]` - Rollback deployment
- `./scripts/health-check.sh [url]` - Check application health

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

MIT
