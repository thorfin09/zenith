# 🚀 ZENITH — Daily Task & Goal Planner

[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)
[![React](https://img.shields.io/badge/React-19-blue.svg?logo=react)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-8.0-646CFF.svg?logo=vite)](https://vite.dev)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg?logo=nodedotjs)](https://nodejs.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-47A248.svg?logo=mongodb)](https://www.mongodb.com)

**Zenith** is a high-performance, full-stack task management application designed to help individuals reach the peak of their daily productivity. Built with the **MERN** stack (MongoDB, Express, React, Node.js), it provides a seamless, modern, and fluid experience for planning daily goals and organizing long-term tasks.

---

## 🌟 Key Features

*   **🔐 Dual-Method Authentication:** Secure registration and standard login powered by JWT (JSON Web Tokens) and bcrypt password hashing, plus seamless single-click **Google Sign-In**.
*   **📅 Dynamic Calendar Strip:** Navigate across past and future days easily with a horizontal, auto-scrolling day-by-day strip.
*   **⚡ Real-Time Task Management:** Create, toggle, edit, reschedule, or delete tasks with immediate, optimistic UI updates.
*   **🎭 Zero-Setup Demo Mode:** Test all primary features instantly directly from the login page without creating an account (powered by local component state).
*   **🌗 Dynamic Theming:** Sleek light and dark themes honoring system preferences or toggled with a single button.
*   **✨ Fluid Micro-Animations:** Beautiful list transitions and interactive elements powered by Framer Motion.
*   **📱 Fully Responsive:** Clean, mobile-first design ensuring a premium experience on desktop, tablet, and mobile screens.
*   **🛠️ Robust Backend:** Scalable Express 5 server featuring Google Auth token verification, DNS fallback retry mechanics for MongoDB connections, Helmet security headers, and CORS.

---

## 🏗️ Tech Stack

### Frontend
- **React 19:** Functional hooks architecture and modern state management.
- **Vite:** Next-generation frontend build tool for instantaneous hot reloads.
- **Framer Motion:** High-fidelity animations for checklist states and modal views.
- **Tailwind CSS:** Modern utility-first CSS framework for layout styling.
- **Lucide React:** Minimalist, clean vector icons.

### Backend
- **Node.js & Express 5:** Fast, unopinionated server framework.
- **MongoDB & Mongoose:** Flexible schema modeling for user profiles and task documents.
- **Security & Middleware:** Secure passwords with `bcryptjs`, session tokens via `jsonwebtoken`, logging via `morgan`, and API protection with `cors` and `helmet`.

---

## 📂 Project Structure

```text
zenith/
├── client/                 # React Frontend (Vite + Tailwind)
│   ├── src/
│   │   ├── assets/         # App assets & media
│   │   ├── App.jsx         # Core app components and view routing
│   │   ├── main.jsx        # App mounting and strict mode configuration
│   │   ├── index.css       # Global design variables & styling
│   │   └── App.css         # Component-specific styles & transitions
│   ├── vite.config.js      # Vite compilation settings
│   └── package.json        # Frontend scripts and dependencies
│
├── server/                 # Express Backend API
│   ├── models/
│   │   ├── User.js         # Mongoose User Schema (Credentials + Google OAuth fields)
│   │   └── Todo.js         # Mongoose Task Schema (Association, Text, Complete state, Date)
│   ├── server.js           # API Server entry point, DB connector, and routes
│   └── package.json        # Backend scripts and dependencies
│
├── docs/
│   └── API.md              # Detailed API endpoint references
├── CONTRIBUTING.md         # Developer setup & guidelines
├── LICENSE                 # ISC License
└── package.json            # Root orchestration scripts
```

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [MongoDB](https://www.mongodb.com/) (Local server or Atlas cloud cluster)

### Step 1: Clone the Repository
```bash
git clone <your-repo-url>
cd zenith
```

### Step 2: Install Dependencies
Install dependencies for all folders (root, frontend, and backend) simultaneously:
```bash
npm run install-all
```

### Step 3: Configure Environment Variables
You need to set up environment configurations for both the backend and frontend.

#### Backend Configuration
Create a `.env` file in the `server` directory:
```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/zenith
JWT_SECRET=your_jwt_signing_key_here
GOOGLE_CLIENT_ID=your_google_oauth_client_id_here
```

#### Frontend Configuration
Create a `.env` file in the `client` directory:
```env
VITE_API_URL=http://localhost:5000/api
VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id_here
```

### Step 4: Run the Application
Start both the Vite dev server and the backend API server concurrently with one command from the root directory:
```bash
npm run dev
```
- **Frontend** runs at: [http://localhost:5173](http://localhost:5173)
- **Backend API** runs at: [http://localhost:5000](http://localhost:5000)

---

## 🚦 Available Scripts

The root `package.json` contains helpful commands:
- **`npm run install-all`**: Automatically installs node dependencies for the root workspace, `/client`, and `/server`.
- **`npm run dev`**: Spawns both frontend and backend development environments concurrently.
- **`npm run build`**: Compiles the React production bundle under `client/dist`.
- **`npm run start`**: Launches the Express server in production.

---

## 📖 API & Developer Guidelines

Before making changes or starting integration work, please review:
- 🔌 **[API Documentation](docs/API.md)**: Full details on authentication routes, task structures, headers, and request/response schemas.
- 🤝 **[Contributing Guidelines](CONTRIBUTING.md)**: Standard code styles, branching strategies, and pull request checklist.

---

## 📜 License

This project is licensed under the ISC License. See the [LICENSE](LICENSE) file for details.
