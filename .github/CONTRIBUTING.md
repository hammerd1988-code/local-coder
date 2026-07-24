# Contributing to Local Coder

Thank you for your interest in contributing to Local Coder! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and collaborative environment.

## Getting Started

1. **Fork the repository**
   ```bash
   git clone https://github.com/your-username/local-coder.git
   cd local-coder
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm start
   ```

4. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Workflow

### Code Style

- Use TypeScript for all new code
- Follow existing code patterns and conventions
- Use double quotes for strings
- Use relative imports (no path aliases like `@/`)
- Keep components small and focused (< 50 lines)
- Create separate files for each component

### Component Guidelines

- Use shadcn/ui components from `client/src/components/ui/`
- Make className explicit as props instead of spreading props
- Always use functions for event handlers, never inline functions
- Prefer splitting JSX into smaller React components

### Database Guidelines

- Use Kysely query builder for all database operations
- Never use `process.cwd()` for data paths
- Always resolve paths from `DATA_DIRECTORY` environment variable
- Enable query and error logging in Kysely instances

### Testing

Before submitting a PR:

1. **Type checking**
   ```bash
   npm run lint
   ```

2. **Build the application**
   ```bash
   npm run build
   ```

3. **Test locally**
   ```bash
   npm start
   # or with Docker
   docker-compose --profile dev up
   ```

## Commit Messages

Write clear, concise commit messages:

- Use present tense ("Add feature" not "Added feature")
- Use imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit first line to 72 characters
- Reference issues and PRs when applicable

Examples:
```
Add terminal resize functionality

Fix database connection timeout issue
Fixes #123

Update deployment documentation
```

## Pull Request Process

1. **Update documentation** if you're changing functionality
2. **Add tests** for new features when applicable
3. **Ensure all checks pass** (CI, type checking, builds)
4. **Fill out the PR template** completely
5. **Request review** from maintainers

### PR Title Format

Use a clear, descriptive title:
- `feat: Add dark mode toggle`
- `fix: Resolve terminal resize bug`
- `docs: Update deployment guide`
- `refactor: Simplify file explorer logic`
- `perf: Optimize database queries`

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
├── k8s/                 # Kubernetes manifests
├── scripts/             # Deployment scripts
└── data/                # Persistent data
```

## Areas for Contribution

### High Priority

- Test coverage improvements
- Performance optimizations
- Accessibility improvements
- Documentation updates
- Bug fixes

### Feature Ideas

- Additional editor themes
- More git operations
- Plugin system enhancements
- Collaborative editing
- File search functionality

### Infrastructure

- CI/CD pipeline improvements
- Docker optimizations
- Kubernetes configurations
- Monitoring and observability

## Reporting Bugs

Use the bug report template when creating issues:

1. Describe the bug clearly
2. Provide steps to reproduce
3. Include expected vs actual behavior
4. Add environment details
5. Attach logs or screenshots if applicable

## Suggesting Features

Use the feature request template:

1. Explain the problem or use case
2. Describe your proposed solution
3. Consider alternatives
4. Indicate priority level

## Questions?

- Check existing issues and PRs
- Review the documentation
- Ask in discussions or create an issue

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to Local Coder! 🎉
