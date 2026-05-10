# 🚀 ZENITH

**Zenith** is a high-performance, full-stack task management application designed to help individuals reach the peak of their productivity. Built with the **MERN** stack (MongoDB, Express, React, Node.js), it offers a seamless, modern, and intuitive experience for tracking goals and daily tasks.

---

## 🌟 Features

- **🔐 Secure Authentication:** User registration and login powered by JWT (JSON Web Tokens) and bcrypt password hashing.
- **⚡ Real-time Task Management:** Create, complete, and delete tasks with instant UI updates.
- **🎭 Demo Mode:** Try out the application's core features immediately without needing to create an account.
- **🌗 Dynamic Theming:** Beautiful Light and Dark mode support that respects user preferences.
- **✨ Fluid Animations:** Smooth UI transitions and list interactions powered by Framer Motion.
- **📱 Responsive Design:** A mobile-first approach ensuring productivity on any device.
- **🛠️ Robust Backend:** Built with Express 5, featuring security middleware like Helmet and CORS.

---

## 🏗️ Tech Stack

### Frontend
- **React 19:** Utilizing the latest features and hooks.
- **Vite:** Next-generation frontend tooling for lightning-fast development.
- **Framer Motion:** High-quality production-ready animations.
- **Lucide React:** Beautifully simple pixel-perfect icons.
- **Tailwind CSS:** Modern utility-first CSS framework for rapid styling.

### Backend
- **Node.js & Express:** Scalable and performant server-side environment.
- **MongoDB & Mongoose:** Flexible NoSQL database with elegant schema modeling.
- **Authentication:** Secure session management with JWT and bcryptjs.
- **Middleware:** Morgan for logging, Helmet for security, and CORS for cross-origin resource sharing.

---

## 🌎 Real-life Applications

Zenith is more than just a "to-do" list; it's a foundation for organized living:

1.  **Professional Task Tracking:** Stay on top of work deliverables, meeting action items, and project milestones.
2.  **Personal Goal Setting:** Track long-term aspirations, daily habits, and household chores in one centralized place.
3.  **Academic Planning:** Students can manage assignment deadlines, study schedules, and extracurricular activities.
4.  **Agile Development Baseline:** This project serves as a robust boilerplate for building more complex collaborative project management tools.

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [MongoDB](https://www.mongodb.com/) (Local or Atlas)

### Installation

1.  **Clone the repository:**
    ```bash
    git clone <your-repo-url>
    cd zenith
    ```

2.  **Install dependencies for all components:**
    ```bash
    npm run install-all
    ```

3.  **Environment Setup:**
    Create a `.env` file in the `server` directory based on the `.env.example`:
    ```env
    PORT=5000
    MONGODB_URI=your_mongodb_connection_string
    JWT_SECRET=your_super_secret_key
    ```

4.  **Run the application:**
    ```bash
    npm run dev
    ```
    This will start both the frontend (Vite) and the backend (Nodemon) concurrently.

---

## 📂 Project Structure

```text
zenith/
├── client/           # React frontend (Vite)
│   ├── src/          # Components, App logic, Assets
│   └── public/       # Static assets
├── server/           # Express backend
│   ├── models/       # Mongoose schemas (User, Todo)
│   └── server.js     # API entry point and routes
└── package.json      # Root scripts for orchestration
```

---

## 📜 License

This project is licensed under the ISC License.
