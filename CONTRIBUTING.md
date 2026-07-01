# 🤝 Contributing to Zenith

First off, thank you for considering contributing to Zenith! It's people like you who make Zenith an excellent tool for productivity.

To maintain code quality and ensure a smooth review process, please review and follow these guidelines.

---

## 🧭 How Can I Contribute?

### 1. Reporting Bugs
- Search the existing issues list first to see if the bug has already been reported.
- If it hasn't, open a new issue. Include:
  - A clear and descriptive title.
  - Steps to reproduce the bug.
  - Expected vs. actual behavior.
  - Relevant screenshots or logs (if applicable).
  - Your environment details (OS, Browser, Node.js version).

### 2. Suggesting Enhancements
- Check if your idea is already proposed in the issues.
- Open a new issue with the label `enhancement`.
- Explain the utility of the feature and how it should work.

### 3. Submitting Pull Requests
- Ensure you have discussed the changes via an issue before starting work on a major feature.
- Follow the branch naming conventions and standard development workflow outlined below.

---

## 🛠️ Development Setup & Workflow

### 1. Prerequisites
- **Node.js**: version 18 or higher.
- **MongoDB**: A running local MongoDB instance or a MongoDB Atlas URI.

### 2. Forking and Cloning
1. Fork this repository on GitHub.
2. Clone your fork locally:
   ```bash
   git clone https://github.com/your-username/zenith.git
   cd zenith
   ```
3. Add the upstream remote:
   ```bash
   git remote add upstream https://github.com/original-owner/zenith.git
   ```

### 3. Installing Dependencies
Install all packages for the root, frontend, and backend folders:
```bash
npm run install-all
```

### 4. Running the Development Server
Start the frontend and backend concurrently:
```bash
npm run dev
```
- Frontend: `http://localhost:5173` (Vite)
- Backend: `http://localhost:5000` (Express)

---

## 📐 Coding Standards

### Git Branching Strategy
Create a branch with a descriptive name prefixed by the type of change:
- **`feature/`** for new features (e.g., `feature/analytics-dashboard`)
- **`bugfix/`** for bug fixes (e.g., `bugfix/login-dns-retry`)
- **`docs/`** for documentation changes (e.g., `docs/api-specs`)
- **`refactor/`** for code refactoring (e.g., `refactor/auth-middleware`)

Example:
```bash
git checkout -b feature/calendar-views
```

### Code Style & Guidelines
- **Frontend (React)**:
  - Write modern functional components using React 19.
  - Use Tailwind CSS for utility styling. Keep layout properties responsive and theme-aware (using CSS variables where appropriate).
  - Use Lucide React icons.
  - Ensure Framer Motion animations are smooth and lightweight.
  - Run the ESLint linter in the `client` directory before submitting changes:
    ```bash
    cd client
    npm run lint
    ```
- **Backend (Node.js & Express)**:
  - Use Express 5 routing and async/await for asynchronous database queries.
  - Check user ownership of models (e.g., matching `req.user.id` against `todo.userId`) in all Todo endpoints.
  - Always clean up logs and console outputs that are not required for production.

---

## 🚀 Pull Request Guidelines

1. **Keep it focused**: A single Pull Request should only address one issue or feature.
2. **Sync with upstream**: Before sending your PR, ensure your branch is up to date with the latest main branch:
   ```bash
   git checkout main
   git pull upstream main
   git checkout your-branch
   git merge main
   ```
3. **Commit Messages**: Use clean, descriptive commit messages (e.g., `feat: add Google OAuth integration` or `fix: handle local date parsing error`).
4. **Submit the PR**: Open a pull request against the `main` branch of the upstream repository.
5. **Describe your changes**: Provide a comprehensive description of the problem solved, testing performed, and any visual UI changes (screenshots are appreciated).
