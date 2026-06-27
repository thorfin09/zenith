import { useState, useEffect, useCallback } from 'react';
import { 
  Sun, Moon, LogOut, Plus, Trash2, Check, 
  User as UserIcon, Lock, Phone, UserPlus, Loader2,
  Calendar, Home, Edit2, X, ChevronLeft, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import './App.css';

const API_BASE = import.meta.env.VITE_API_URL || 'https://zenith-1-wrur.onrender.com/api';

const toLocalDateString = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const date = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${date}`;
};

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

  // Custom Daily / Calendar / Dropdown State
  const [selectedDate, setSelectedDate] = useState(() => toLocalDateString(new Date()));
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [dates, setDates] = useState([]);
  const [isFirstLoad, setIsFirstLoad] = useState(true);

  useEffect(() => {
    const datesList = [];
    const today = new Date();
    // Generate last 30 days + today + next 100 days (131 days total)
    for (let i = -30; i <= 100; i++) {
      const d = new Date();
      d.setDate(today.getDate() + i);
      datesList.push(d);
    }
    setDates(datesList);
  }, []);

  // Smooth scroll active date card into view
  useEffect(() => {
    const activeCard = document.querySelector('.date-card.active');
    if (activeCard) {
      if (isFirstLoad) {
        // Use 'auto' (instant) scroll on mount so "Today" is immediately positioned on the far-left
        activeCard.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'start' });
        setIsFirstLoad(false);
      } else {
        activeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [selectedDate, isFirstLoad, dates]);

  const navigateDate = (direction) => {
    const current = new Date(selectedDate + 'T00:00:00');
    current.setDate(current.getDate() + direction);
    setSelectedDate(toLocalDateString(current));
  };

  const resetToToday = () => {
    const todayStr = toLocalDateString(new Date());
    if (selectedDate === todayStr) {
      // If already on today, manually smooth scroll back to Today on the far-left
      const activeCard = document.querySelector('.date-card.active');
      if (activeCard) {
        activeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
      }
    } else {
      setIsFirstLoad(true);
      setSelectedDate(todayStr);
    }
    setShowProfileMenu(false);
  };

  useEffect(() => {
    if (!showProfileMenu) return;
    const handleClose = () => setShowProfileMenu(false);
    document.addEventListener('click', handleClose);
    return () => document.removeEventListener('click', handleClose);
  }, [showProfileMenu]);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    setTodos([]);
    setIsDemo(false);
    setShowProfileMenu(false);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    setView('login');
  }, []);

  const enterDemo = () => {
    setIsDemo(true);
    setView('todos');
    const todayStr = toLocalDateString(new Date());
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = toLocalDateString(yesterday);
    setDemoTodos([
      { _id: 'd1', text: 'Welcome to ZENITH Daily! 📅', completed: false, date: todayStr },
      { _id: 'd2', text: 'Click the checkbox to complete a task', completed: true, date: todayStr },
      { _id: 'd3', text: 'An overdue task from yesterday!', completed: false, date: yesterdayStr },
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

  // --- Optimistic Operations ---
  
  const handleAddTodo = async (text) => {
    const tempId = `temp-${Date.now()}`;
    const newTodo = {
      _id: tempId,
      text,
      completed: false,
      date: selectedDate,
      createdAt: new Date().toISOString()
    };

    if (isDemo) {
      setDemoTodos([newTodo, ...demoTodos]);
      return;
    }

    const previousTodos = [...todos];
    setTodos([newTodo, ...todos]);

    try {
      const res = await authFetch('/todos', {
        method: 'POST',
        body: JSON.stringify({ text, date: selectedDate })
      });
      const savedTodo = await res.json();
      setTodos(prev => prev.map(t => t._id === tempId ? savedTodo : t));
    } catch (err) {
      setError(err.message);
      setTodos(previousTodos);
    }
  };

  const handleToggleTodo = async (todoId, currentCompleted) => {
    if (isDemo) {
      setDemoTodos(demoTodos.map(t => t._id === todoId ? { ...t, completed: !currentCompleted } : t));
      return;
    }

    const previousTodos = [...todos];
    setTodos(todos.map(t => t._id === todoId ? { ...t, completed: !currentCompleted } : t));

    try {
      const res = await authFetch(`/todos/${todoId}`, {
        method: 'PATCH',
        body: JSON.stringify({ completed: !currentCompleted })
      });
      const updated = await res.json();
      setTodos(prev => prev.map(t => t._id === todoId ? updated : t));
    } catch (err) {
      setError(err.message);
      setTodos(previousTodos);
    }
  };

  const handleDeleteTodo = async (todoId) => {
    if (isDemo) {
      setDemoTodos(demoTodos.filter(t => t._id !== todoId));
      return;
    }

    const previousTodos = [...todos];
    setTodos(todos.filter(t => t._id !== todoId));

    try {
      await authFetch(`/todos/${todoId}`, { method: 'DELETE' });
    } catch (err) {
      setError(err.message);
      setTodos(previousTodos);
    }
  };

  const handleRescheduleTodo = async (todoId) => {
    const todayStr = toLocalDateString(new Date());
    if (isDemo) {
      setDemoTodos(demoTodos.map(t => t._id === todoId ? { ...t, date: todayStr } : t));
      return;
    }

    const previousTodos = [...todos];
    setTodos(todos.map(t => t._id === todoId ? { ...t, date: todayStr } : t));

    try {
      const res = await authFetch(`/todos/${todoId}`, {
        method: 'PATCH',
        body: JSON.stringify({ date: todayStr })
      });
      const updated = await res.json();
      setTodos(prev => prev.map(t => t._id === todoId ? updated : t));
    } catch (err) {
      setError(err.message);
      setTodos(previousTodos);
    }
  };

  const handleEditTodo = async (todoId, newText) => {
    if (!newText.trim()) return;

    if (isDemo) {
      setDemoTodos(demoTodos.map(t => t._id === todoId ? { ...t, text: newText } : t));
      return;
    }

    const previousTodos = [...todos];
    setTodos(todos.map(t => t._id === todoId ? { ...t, text: newText } : t));

    try {
      const res = await authFetch(`/todos/${todoId}`, {
        method: 'PATCH',
        body: JSON.stringify({ text: newText })
      });
      const updated = await res.json();
      setTodos(prev => prev.map(t => t._id === todoId ? updated : t));
    } catch (err) {
      setError(err.message);
      setTodos(previousTodos);
    }
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
  const todayString = toLocalDateString(new Date());
  const isSelectedToday = selectedDate === todayString;
  
  // Filter todos for selected date
  const dateTodos = currentTodos.filter(t => t.date === selectedDate);
  
  // Filter uncompleted todos from previous days (only display on today's view)
  const overdueTodos = isSelectedToday 
    ? currentTodos.filter(t => !t.completed && t.date < todayString)
    : [];

  return (
    <div className="app-container">
      <header className="header">
        <div className="logo">ZENITH {isDemo && <span style={{ fontSize: '0.75rem', verticalAlign: 'middle', background: 'var(--primary)', color: 'white', padding: '0.2rem 0.5rem', borderRadius: '1rem', marginLeft: '0.5rem' }}>DEMO</span>}</div>
        <div className="header-actions" style={{ alignItems: 'center' }}>
          <button className="icon-btn" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>
          
          <div className="profile-container">
            <div className="profile-trigger" onClick={(e) => { e.stopPropagation(); setShowProfileMenu(!showProfileMenu); }}>
              <div className="profile-avatar">
                {user ? user.fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'U'}
              </div>
              <span className="profile-name">{user ? user.fullName : 'Guest'}</span>
            </div>
            
            <AnimatePresence>
              {showProfileMenu && (
                <motion.div 
                  className="profile-dropdown"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                >
                  <div className="dropdown-header">
                    <span className="dropdown-header-name">{user ? user.fullName : 'Guest User'}</span>
                    <span className="dropdown-header-email">@{user ? user.username : 'guest'}</span>
                  </div>
                  
                  <button className="dropdown-item" onClick={resetToToday}>
                    <Home size={16} />
                    <span>Home (Today)</span>
                  </button>
                  
                  <button className="dropdown-item logout" onClick={logout}>
                    <LogOut size={16} />
                    <span>{isDemo ? 'Exit Demo' : 'Sign Out'}</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      <main className="todo-main">
        {isDemo && (
          <div style={{ padding: '1rem', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', fontSize: '0.8rem', fontWeight: '600', textAlign: 'center' }}>
            Testing mode: Data will not be saved. <span className="auth-link" onClick={() => setView('signup')}>Create account</span> to save.
          </div>
        )}
        
        <div className="calendar-section">
          <div className="calendar-header">
            <span className="calendar-title">
              {new Date(selectedDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </span>
            <button className="today-btn" onClick={resetToToday}>
              Today
            </button>
          </div>
          
          <div className="calendar-nav-wrapper">
            <button 
              className="nav-arrow-btn" 
              onClick={() => navigateDate(-1)} 
              title="Previous Day"
            >
              <ChevronLeft size={16} />
            </button>
            
            <div className="dates-strip-container">
              <div className="dates-strip">
                {dates.map((d, index) => {
                  const dateStr = toLocalDateString(d);
                  const isActive = selectedDate === dateStr;
                  const isToday = toLocalDateString(new Date()) === dateStr;
                  
                  return (
                    <div 
                      key={index} 
                      className={`date-card ${isActive ? 'active' : ''}`}
                      onClick={() => setSelectedDate(dateStr)}
                      style={isToday && !isActive ? { borderColor: 'var(--primary)', borderWidth: '1.5px' } : {}}
                    >
                      <span className="date-day">{d.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                      <span className="date-num">{d.getDate()}</span>
                      <span className="date-month">{d.toLocaleDateString('en-US', { month: 'short' })}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <button className="nav-arrow-btn" onClick={() => navigateDate(1)} title="Next Day">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {selectedDate >= todayString ? (
          <TodoForm onAdd={handleAddTodo} />
        ) : (
          <div style={{ padding: '1.25rem', background: 'rgba(239, 68, 68, 0.04)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', fontWeight: '600', letterSpacing: '0.2px' }}>
            🔒 Past dates are locked. You cannot add new tasks.
          </div>
        )}

        {error && <div className="error-box">{error}</div>}

        <div className="todo-list-section">
          {loading ? (
            <div className="loading-spinner"><Loader2 className="animate-spin" /></div>
          ) : (
            <div>
              {/* Overdue Section */}
              <AnimatePresence>
                {overdueTodos.length > 0 && (
                  <div style={{ marginBottom: '1rem' }}>
                    <div className="overdue-section-header">
                      <span>⚠️ Pending from Past</span>
                    </div>
                    {overdueTodos.map(todo => (
                      <TodoItem 
                        key={todo._id} 
                        todo={todo} 
                        onToggle={() => handleToggleTodo(todo._id, todo.completed)}
                        onDelete={() => handleDeleteTodo(todo._id)}
                        onReschedule={() => handleRescheduleTodo(todo._id)}
                        onEdit={(newText) => handleEditTodo(todo._id, newText)}
                      />
                    ))}
                  </div>
                )}
              </AnimatePresence>

              {/* Selected Date Todos Section */}
              <div className="todo-list-section-title">
                <span>{isSelectedToday ? "Today's Tasks" : `Tasks for ${new Date(selectedDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}`}</span>
              </div>

              {dateTodos.length === 0 ? (
                <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No tasks for this day. Enjoy your day! ✨
                </div>
              ) : (
                <AnimatePresence>
                  {dateTodos.map(todo => (
                    <TodoItem 
                      key={todo._id} 
                      todo={todo} 
                      onToggle={() => handleToggleTodo(todo._id, todo.completed)}
                      onDelete={() => handleDeleteTodo(todo._id)}
                      onEdit={(newText) => handleEditTodo(todo._id, newText)}
                    />
                  ))}
                </AnimatePresence>
              )}
            </div>
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

  const handleGoogleSuccess = useCallback(async (response) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Google Sign-In failed');
      onSuccess(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [onSuccess]);

  useEffect(() => {
    if (window.google) {
      window.google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '294705223499-bon46rd275f0ihgsq9clr0ets0pvh1uc.apps.googleusercontent.com',
        callback: handleGoogleSuccess
      });

      const buttonDiv = document.getElementById('google-signin-btn');
      if (buttonDiv) {
        window.google.accounts.id.renderButton(
          buttonDiv,
          { 
            theme: theme === 'dark' ? 'filled_black' : 'outline', 
            size: 'large', 
            width: 380, 
            shape: 'rectangular',
            text: 'signin_with',
            logo_alignment: 'left'
          }
        );
      }
    }
  }, [theme, type, handleGoogleSuccess]);

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

        <div id="google-signin-btn" style={{ width: '100%', display: 'flex', justifyContent: 'center' }}></div>

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

function TodoItem({ todo, onToggle, onDelete, onReschedule, onEdit }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(todo.text);

  const handleSave = () => {
    if (editText.trim() && editText !== todo.text) {
      onEdit(editText);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      setEditText(todo.text);
      setIsEditing(false);
    }
  };

  return (
    <motion.div 
      className={`todo-item ${todo.completed ? 'completed' : ''} ${isEditing ? 'editing' : ''}`}
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
    >
      <div className="todo-check" onClick={isEditing ? null : onToggle}>
        {todo.completed && <Check size={14} color="white" strokeWidth={4} />}
      </div>
      
      {isEditing ? (
        <input
          className="todo-edit-input"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />
      ) : (
        <span className="todo-text">{todo.text}</span>
      )}
      
      <div className="todo-item-actions">
        {isEditing ? (
          <>
            <button className="edit-action-btn save" onClick={handleSave} title="Save Edit">
              <Check size={16} />
            </button>
            <button className="edit-action-btn cancel" onClick={() => { setEditText(todo.text); setIsEditing(false); }} title="Cancel">
              <X size={16} />
            </button>
          </>
        ) : (
          <>
            {onReschedule && (
              <button className="todo-reschedule-btn" onClick={onReschedule} title="Reschedule to Today">
                <Calendar size={16} />
              </button>
            )}
            <button className="edit-btn" onClick={() => setIsEditing(true)} title="Edit Task">
              <Edit2 size={16} />
            </button>
            <button className="delete-btn" onClick={onDelete} title="Delete Task">
              <Trash2 size={18} />
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
}

export default App;
