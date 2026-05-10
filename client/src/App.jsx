import { useState, useEffect, useCallback } from 'react';
import { 
  Sun, Moon, LogOut, Plus, Trash2, Check, 
  User as UserIcon, Lock, Phone, UserPlus, Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import './App.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

function App() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user')) || null);
  const [token, setToken] = useState(() => localStorage.getItem('token') || null);
  const [isDemo, setIsDemo] = useState(false);
  const [demoTodos, setDemoTodos] = useState([]);
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [view, setView] = useState(user ? 'todos' : 'login');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    setTodos([]);
    setIsDemo(false);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    setView('login');
  }, []);

  const enterDemo = () => {
    setIsDemo(true);
    setView('todos');
    setDemoTodos([
      { _id: 'd1', text: 'Welcome to ZENITH Demo! 👋', completed: false },
      { _id: 'd2', text: 'Click the checkbox to complete a task', completed: true },
      { _id: 'd3', text: 'Try adding your own task above', completed: false },
    ]);
  };

  // Theme effect
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Auth fetch helper
  const authFetch = useCallback(async (url, options = {}) => {
    if (isDemo) return; // Should not be called in demo mode
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers
    };
    const response = await fetch(`${API_BASE}${url}`, { ...options, headers });
    if (response.status === 401 || response.status === 403) {
      logout();
      throw new Error('Session expired. Please login again.');
    }
    return response;
  }, [token, logout, isDemo]);

  const fetchTodos = useCallback(async () => {
    if (!token || isDemo) return;
    setLoading(true);
    try {
      const res = await authFetch('/todos');
      const data = await res.json();
      setTodos(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token, authFetch, isDemo]);

  useEffect(() => {
    const load = () => {
      if (token && !isDemo) fetchTodos();
    };
    load();
  }, [token, fetchTodos, isDemo]);

  const handleAuthSuccess = (data) => {
    setIsDemo(false);
    setUser(data.user);
    setToken(data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    localStorage.setItem('token', data.token);
    setView('todos');
  };

  if (view === 'login' || view === 'signup') {
    return (
      <AuthView 
        type={view} 
        setView={setView} 
        onSuccess={handleAuthSuccess} 
        onDemo={enterDemo}
        theme={theme} 
        setTheme={setTheme} 
      />
    );
  }

  const currentTodos = isDemo ? demoTodos : todos;

  return (
    <div className="app-container">
      <header className="header">
        <div className="logo">ZENITH {isDemo && <span style={{ fontSize: '0.75rem', verticalAlign: 'middle', background: 'var(--primary)', color: 'white', padding: '0.2rem 0.5rem', borderRadius: '1rem', marginLeft: '0.5rem' }}>DEMO</span>}</div>
        <div className="header-actions">
          <button className="icon-btn" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>
          <button className="icon-btn" onClick={logout} title={isDemo ? "Exit Demo" : "Logout"}>
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <main className="todo-main">
        {isDemo && (
          <div style={{ padding: '1rem', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', fontSize: '0.8rem', fontWeight: '600', textAlign: 'center' }}>
            Testing mode: Data will not be saved. <span className="auth-link" onClick={() => setView('signup')}>Create account</span> to save.
          </div>
        )}
        <TodoForm onAdd={async (text) => {
          if (isDemo) {
            const newTodo = { _id: Date.now().toString(), text, completed: false };
            setDemoTodos([newTodo, ...demoTodos]);
            return;
          }
          try {
            const res = await authFetch('/todos', {
              method: 'POST',
              body: JSON.stringify({ text })
            });
            const newTodo = await res.json();
            setTodos([newTodo, ...todos]);
          } catch (err) {
            setError(err.message);
          }
        }} />

        {error && <div className="error-box">{error}</div>}

        <div className="todo-list-section">
          {loading ? (
            <div className="loading-spinner"><Loader2 className="animate-spin" /></div>
          ) : (
            <AnimatePresence>
              {currentTodos.map(todo => (
                <TodoItem 
                  key={todo._id} 
                  todo={todo} 
                  onToggle={async () => {
                    if (isDemo) {
                      setDemoTodos(demoTodos.map(t => t._id === todo._id ? { ...t, completed: !t.completed } : t));
                      return;
                    }
                    try {
                      const res = await authFetch(`/todos/${todo._id}`, {
                        method: 'PATCH',
                        body: JSON.stringify({ completed: !todo.completed })
                      });
                      const updated = await res.json();
                      setTodos(todos.map(t => t._id === todo._id ? updated : t));
                    } catch (err) { setError(err.message); }
                  }}
                  onDelete={async () => {
                    if (isDemo) {
                      setDemoTodos(demoTodos.filter(t => t._id !== todo._id));
                      return;
                    }
                    try {
                      await authFetch(`/todos/${todo._id}`, { method: 'DELETE' });
                      setTodos(todos.filter(t => t._id !== todo._id));
                    } catch (err) { setError(err.message); }
                  }}
                />
              ))}
            </AnimatePresence>
          )}
        </div>
      </main>
    </div>
  );
}

function AuthView({ type, setView, onSuccess, onDemo, theme, setTheme }) {
  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    password: '',
    confirmPassword: '',
    phoneNumber: ''
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState(null);

  const checkUsername = async (val) => {
    if (val.length < 3) return;
    try {
      const res = await fetch(`${API_BASE}/auth/check-username/${val}`);
      const data = await res.json();
      setUsernameAvailable(data.available);
    } catch (e) { console.error(e); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (type === 'signup') {
      if (formData.password !== formData.confirmPassword) return setError('Passwords do not match');
      if (usernameAvailable === false) return setError('Username is taken');
    }

    setLoading(true);
    try {
      const endpoint = type === 'login' ? '/auth/login' : '/auth/register';
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.message || 'Something went wrong');

      if (type === 'login') {
        onSuccess(data);
      } else {
        setView('login');
        alert('Account created! Please login.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <header className="header">
        <div className="logo">ZENITH</div>
        <button className="icon-btn" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
          {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
        </button>
      </header>

      <motion.div 
        className="auth-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="auth-header">
          <h2 className="auth-title">{type === 'login' ? 'Welcome Back' : 'Join Zenith'}</h2>
          <p className="auth-subtitle">
            {type === 'login' ? 'Enter your details to access your tasks' : 'Create an account to stay organized'}
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {type === 'signup' && (
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <div className="input-wrapper">
                <UserIcon className="input-icon" size={18} />
                <input 
                  className="form-input" 
                  required 
                  placeholder="John Doe"
                  value={formData.fullName}
                  onChange={e => setFormData({...formData, fullName: e.target.value})}
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Username</label>
            <div className="input-wrapper">
              <UserPlus className="input-icon" size={18} />
              <input 
                className="form-input" 
                required 
                placeholder="johndoe"
                value={formData.username}
                onChange={e => {
                  setFormData({...formData, username: e.target.value});
                  if (type === 'signup') checkUsername(e.target.value);
                }}
              />
            </div>
            {type === 'signup' && formData.username.length >= 3 && (
              <span className="username-status" style={{ color: usernameAvailable ? 'var(--success)' : 'var(--danger)' }}>
                {usernameAvailable ? '✓ Username available' : '✗ Username taken'}
              </span>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="input-wrapper">
              <Lock className="input-icon" size={18} />
              <input 
                className="form-input" 
                type="password" 
                required 
                placeholder="••••••••"
                value={formData.password}
                onChange={e => setFormData({...formData, password: e.target.value})}
              />
            </div>
          </div>

          {type === 'signup' && (
            <>
              <div className="form-group">
                <label className="form-label">Confirm Password</label>
                <div className="input-wrapper">
                  <Lock className="input-icon" size={18} />
                  <input 
                    className="form-input" 
                    type="password" 
                    required 
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={e => setFormData({...formData, confirmPassword: e.target.value})}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Phone (Optional)</label>
                <div className="input-wrapper">
                  <Phone className="input-icon" size={18} />
                  <input 
                    className="form-input" 
                    placeholder="+1 (555) 000-0000"
                    value={formData.phoneNumber}
                    onChange={e => setFormData({...formData, phoneNumber: e.target.value})}
                  />
                </div>
              </div>
            </>
          )}

          {error && <div className="error-box">{error}</div>}

          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" size={20} /> : (type === 'login' ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: '0.5rem 0' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }}></div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>OR</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }}></div>
        </div>

        <button 
          className="btn-primary" 
          style={{ background: 'transparent', color: 'var(--primary)', border: '2px solid var(--primary)' }}
          onClick={onDemo}
        >
          Try Demo Mode
        </button>

        <div className="auth-footer">
          {type === 'login' ? (
            <p>Don't have an account? <span className="auth-link" onClick={() => setView('signup')}>Sign Up</span></p>
          ) : (
            <p>Already have an account? <span className="auth-link" onClick={() => setView('login')}>Sign In</span></p>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function TodoForm({ onAdd }) {
  const [text, setText] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    onAdd(text);
    setText('');
  };

  return (
    <form className="todo-input-section" onSubmit={handleSubmit}>
      <div className="input-wrapper">
        <input 
          className="form-input" 
          placeholder="Add a new task..." 
          value={text}
          onChange={e => setText(e.target.value)}
          style={{ paddingLeft: '1rem' }}
        />
        <button className="icon-btn" type="submit" style={{ position: 'absolute', right: '0.5rem', background: 'var(--primary)', color: 'white', border: 'none', width: '2rem', height: '2rem' }}>
          <Plus size={18} />
        </button>
      </div>
    </form>
  );
}

function TodoItem({ todo, onToggle, onDelete }) {
  return (
    <motion.div 
      className={`todo-item ${todo.completed ? 'completed' : ''}`}
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
    >
      <div className="todo-check" onClick={onToggle}>
        {todo.completed && <Check size={14} color="white" strokeWidth={4} />}
      </div>
      <span className="todo-text">{todo.text}</span>
      <button className="delete-btn" onClick={onDelete}>
        <Trash2 size={18} />
      </button>
    </motion.div>
  );
}

export default App;
