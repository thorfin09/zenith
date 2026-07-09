/* eslint-disable react-hooks/set-state-in-effect, no-unused-vars, react-hooks/exhaustive-deps */
import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Sun, Moon, LogOut, Plus, Trash2, Check, 
  User as UserIcon, Lock, Phone, UserPlus, Loader2,
  Calendar, Home, Edit2, X, ChevronLeft, ChevronRight,
  RefreshCw, Settings, Heart, Trophy, ShieldAlert, Laptop, Smartphone, Apple
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
  const [view, setView] = useState(user ? 'todos' : 'landing');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

  // Custom Daily / Calendar / Dropdown State
  const [selectedDate, setSelectedDate] = useState(() => toLocalDateString(new Date()));
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [dates, setDates] = useState([]);
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  
  // Custom swipe & pull-to-refresh states
  const [slideDirection, setSlideDirection] = useState(1);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Update checking states
  const [checkingForUpdates, setCheckingForUpdates] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [latestReleaseInfo, setLatestReleaseInfo] = useState(null);

  // Leaderboard states
  const [leaderboard, setLeaderboard] = useState([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  // Admin portal states
  const [adminUsers, setAdminUsers] = useState([]);
  const [loadingAdminUsers, setLoadingAdminUsers] = useState(false);
  const [systemConfig, setSystemConfig] = useState(null);
  const [savingConfig, setSavingConfig] = useState(false);

  const touchStartY = useRef(0);
  const isPullStart = useRef(false);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    setTodos([]);
    setIsDemo(false);
    setShowProfileMenu(false);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    setView('landing');
  }, []);

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

  const syncUserStats = useCallback(async () => {
    if (!token || isDemo) return;
    try {
      const res = await fetch(`${API_BASE}/users/active`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          platform: window.navigator.userAgent.includes('Electron') ? 'windows' : 'web',
          version: '2.2.3'
        })
      });
      if (res.ok) {
        const data = await res.json();
        setUser(prev => {
          if (!prev) return prev;
          const updated = { ...prev, streak: data.streak, isAdmin: data.isAdmin };
          localStorage.setItem('user', JSON.stringify(updated));
          return updated;
        });
      }
    } catch (e) {
      console.error(e);
    }
  }, [token, isDemo]);

  const fetchLeaderboard = useCallback(async () => {
    setLoadingLeaderboard(true);
    try {
      const response = await fetch(`${API_BASE}/leaderboard`);
      if (response.ok) {
        const data = await response.json();
        setLeaderboard(data);
      }
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
    } finally {
      setLoadingLeaderboard(false);
    }
  }, []);

  const isNewerVersion = (current, latest) => {
    try {
      const cleanCurrent = current.startsWith('v') ? current.substring(1) : current;
      const cleanLatest = latest.startsWith('v') ? latest.substring(1) : latest;

      const currentParts = cleanCurrent.split('+')[0].split('.').map(Number);
      const latestParts = cleanLatest.split('+')[0].split('.').map(Number);

      for (let i = 0; i < 3; i++) {
        const c = currentParts[i] || 0;
        const l = latestParts[i] || 0;
        if (l > c) return true;
        if (l < c) return false;
      }
    } catch (e) {
      console.error('Error parsing version:', e);
    }
    return false;
  };

  const checkForUpdates = useCallback(async (silent = false) => {
    if (checkingForUpdates) return;
    setCheckingForUpdates(true);
    try {
      const response = await fetch('https://api.github.com/repos/thorfin09/zenith/releases/latest', {
        headers: { 'Accept': 'application/vnd.github.v3+json' }
      });
      if (response.status === 200) {
        const data = await response.json();
        const latestTag = data.tag_name;
        const releaseName = data.name || latestTag;
        const htmlUrl = data.html_url;
        const notes = data.body || 'No release notes provided.';

        if (isNewerVersion('2.2.3', latestTag)) {
          setLatestReleaseInfo({
            tag: latestTag,
            name: releaseName,
            url: htmlUrl,
            notes: notes
          });
          setShowUpdateModal(true);
        } else {
          if (!silent) {
            alert('You are on the latest version!');
          }
        }
      } else {
        if (!silent) {
          alert(`Failed to check for updates. Status code: ${response.status}`);
        }
      }
    } catch (err) {
      console.error(err);
      if (!silent) {
        alert(`Network error checking for updates: ${err.message}`);
      }
    } finally {
      setCheckingForUpdates(false);
    }
  }, [checkingForUpdates]);

  // Silent update check on mount
  useEffect(() => {
    checkForUpdates(true);
  }, []);

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
    setSlideDirection(direction);
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
      const dir = new Date(todayStr) > new Date(selectedDate) ? 1 : -1;
      setSlideDirection(dir);
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

  const fetchTodos = useCallback(async (silent = false) => {
    if (!token || isDemo) return;
    if (!silent) setLoading(true);
    try {
      const res = await authFetch('/todos');
      const data = await res.json();
      setTodos(data);
    } catch (err) {
      setError(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [token, authFetch, isDemo]);

  const handleRefresh = async () => {
    if (loading || isRefreshing) return;
    setIsRefreshing(true);
    try {
      await fetchTodos(true);
    } catch (err) {
      console.error(err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleTouchStart = (e) => {
    const scrollTop = e.currentTarget.scrollTop;
    if (scrollTop === 0 && !loading && !isRefreshing && !isDemo) {
      touchStartY.current = e.touches[0].clientY;
      isPullStart.current = true;
      setIsPulling(true);
    }
  };

  const handleTouchMove = (e) => {
    if (!isPullStart.current) return;
    const currentY = e.touches[0].clientY;
    const diffY = currentY - touchStartY.current;

    if (diffY > 0) {
      if (e.cancelable) e.preventDefault();
      const distance = Math.min(80, diffY * 0.45);
      setPullDistance(distance);
    } else {
      setPullDistance(0);
      setIsPulling(false);
      isPullStart.current = false;
    }
  };

  const handleTouchEnd = async (e) => {
    if (!isPullStart.current) return;
    isPullStart.current = false;
    setIsPulling(false);

    if (pullDistance >= 60) {
      setIsRefreshing(true);
      setPullDistance(50);
      try {
        await fetchTodos(true);
      } catch (err) {
        console.error(err);
      } finally {
        setPullDistance(0);
        setIsRefreshing(false);
      }
    } else {
      setPullDistance(0);
    }
  };

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
      syncUserStats();
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
      syncUserStats();
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
      syncUserStats();
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
      syncUserStats();
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
      syncUserStats();
    } catch (err) {
      setError(err.message);
      setTodos(previousTodos);
    }
  };

  if (view === 'landing') {
    return (
      <LandingPageView 
        onGetStarted={() => setView(token ? 'todos' : 'login')}
        onDemo={enterDemo}
        onSignIn={() => setView('login')}
      />
    );
  }

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

  if (view === 'leaderboard') {
    return (
      <LeaderboardView 
        onBack={() => setView('todos')}
        leaderboard={leaderboard}
        loading={loadingLeaderboard}
        fetchLeaderboard={fetchLeaderboard}
        currentUser={user}
      />
    );
  }

  if (view === 'admin') {
    return (
      <AdminPortalView 
        onBack={() => setView('todos')}
        adminUsers={adminUsers}
        loadingUsers={loadingAdminUsers}
        fetchUsers={async () => {
          setLoadingAdminUsers(true);
          try {
            const res = await authFetch('/admin/users');
            const data = await res.json();
            if (res.ok) setAdminUsers(data);
          } catch (e) {
            console.error(e);
          } finally {
            setLoadingAdminUsers(false);
          }
        }}
        systemConfig={systemConfig}
        fetchConfig={async () => {
          try {
            const res = await fetch(`${API_BASE}/config`);
            const data = await res.json();
            if (res.ok) setSystemConfig(data);
          } catch (e) {
            console.error(e);
          }
        }}
        saveConfig={async (newConfig) => {
          setSavingConfig(true);
          try {
            const res = await authFetch('/config', {
              method: 'PUT',
              body: JSON.stringify(newConfig)
            });
            const data = await res.json();
            if (res.ok) {
              setSystemConfig(data);
              alert('Settings saved successfully!');
            }
          } catch (e) {
            console.error(e);
          } finally {
            setSavingConfig(false);
          }
        }}
        savingConfig={savingConfig}
      />
    );
  }

  if (view === 'settings') {
    return (
      <>
        <SettingsView 
          themeKey={theme}
          onChangeTheme={setTheme}
          onBack={() => setView('todos')}
          checkingForUpdates={checkingForUpdates}
          checkForUpdates={() => checkForUpdates(false)}
        />
        <AnimatePresence>
          {showUpdateModal && latestReleaseInfo && (
            <div className="modal-overlay" onClick={() => setShowUpdateModal(false)}>
              <motion.div 
                className="modal-card"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="modal-header">
                  <RefreshCw size={24} className="animate-spin" />
                  <span className="modal-title">Update Available!</span>
                </div>
                <div className="modal-body">
                  <strong>A new version ({latestReleaseInfo.tag}) is ready.</strong>
                  <span>Release: {latestReleaseInfo.name}</span>
                  <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '0.5rem 0' }} />
                  <span className="modal-notes-title">What's New:</span>
                  <pre className="modal-notes">{latestReleaseInfo.notes}</pre>
                </div>
                <div className="modal-actions">
                  <button className="modal-btn-text" onClick={() => setShowUpdateModal(false)}>Later</button>
                  <button className="modal-btn-primary" onClick={() => {
                    window.open(latestReleaseInfo.url, '_blank');
                    setShowUpdateModal(false);
                  }}>Update Now</button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </>
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
        <div className="logo" onClick={() => setView(user ? 'todos' : 'landing')} style={{ cursor: 'pointer' }}>ZENITH {isDemo && <span style={{ fontSize: '0.75rem', verticalAlign: 'middle', background: 'var(--primary)', color: 'white', padding: '0.2rem 0.5rem', borderRadius: '1rem', marginLeft: '0.5rem' }}>DEMO</span>}</div>
        <div className="header-actions" style={{ alignItems: 'center' }}>
          {user && (
            <div className="streak-indicator" title="Active Daily Streak" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: '800', background: 'rgba(249, 115, 22, 0.1)', padding: '0.35rem 0.65rem', borderRadius: '2rem', color: '#f97316', fontSize: '0.85rem' }}>
              🔥 <span>{user.streak || 0}</span>
            </div>
          )}

          <button 
            className={`icon-btn ${loading || isRefreshing ? 'loading' : ''}`} 
            onClick={handleRefresh} 
            title="Refresh Tasks" 
            disabled={loading || isRefreshing || isDemo}
          >
            <RefreshCw size={20} className={loading || isRefreshing ? 'animate-spin' : ''} />
          </button>
          
          <button className="icon-btn" onClick={() => { setView('leaderboard'); fetchLeaderboard(); }} title="Leaderboard">
            <Trophy size={20} />
          </button>

          <button className="icon-btn" onClick={() => setView('settings')} title="Settings">
            <Settings size={20} />
          </button>
          
          <button className="icon-btn" onClick={() => setTheme(theme === 'light' || theme === 'light_indigo' ? 'dark_blue' : 'light')}>
            {theme === 'light' || theme === 'light_indigo' ? <Moon size={20} /> : <Sun size={20} />}
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
                  
                  <button className="dropdown-item" onClick={() => { setView('settings'); setShowProfileMenu(false); }}>
                    <Settings size={16} />
                    <span>Settings</span>
                  </button>

                  {user && user.isAdmin && (
                    <button className="dropdown-item" onClick={() => { setView('admin'); setShowProfileMenu(false); }}>
                      <ShieldAlert size={16} style={{ color: 'var(--danger)' }} />
                      <span>Admin Portal</span>
                    </button>
                  )}
                  
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
                      onClick={() => {
                        if (!isActive) {
                          const dir = new Date(dateStr) > new Date(selectedDate) ? 1 : -1;
                          setSlideDirection(dir);
                          setSelectedDate(dateStr);
                        }
                      }}
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

        <div 
          className="todo-list-section"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{ overscrollBehaviorY: 'contain', position: 'relative' }}
        >
          {/* Pull to Refresh Indicator */}
          <div 
            className="pull-to-refresh-indicator"
            style={{
              height: `${pullDistance}px`,
              opacity: pullDistance > 0 ? Math.min(1, pullDistance / 45) : 0,
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: isPulling ? 'none' : 'height 0.2s ease, opacity 0.2s ease',
              background: 'var(--input-bg)',
              borderRadius: '0.75rem',
              marginBottom: pullDistance > 0 ? '0.5rem' : '0px',
            }}
          >
            <Loader2 
              size={20} 
              className={isRefreshing ? 'animate-spin' : ''}
              style={{
                transform: isRefreshing ? 'none' : `rotate(${pullDistance * 5}deg) scale(${Math.min(1, pullDistance / 50)})`,
                color: 'var(--primary)',
                transition: isRefreshing ? 'none' : 'transform 0.1s ease',
              }}
            />
          </div>

          {loading ? (
            <div className="loading-spinner"><Loader2 className="animate-spin" /></div>
          ) : (
            <AnimatePresence mode="popLayout" custom={slideDirection}>
              <motion.div
                key={selectedDate}
                custom={slideDirection}
                variants={{
                  enter: (dir) => ({
                    x: dir > 0 ? 100 : -100,
                    opacity: 0
                  }),
                  center: {
                    x: 0,
                    opacity: 1
                  },
                  exit: (dir) => ({
                    x: dir > 0 ? -100 : 100,
                    opacity: 0
                  })
                }}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: "spring", stiffness: 350, damping: 32 }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.5}
                onDragEnd={(e, info) => {
                  const swipeThreshold = 70;
                  if (info.offset.x < -swipeThreshold) {
                    navigateDate(1);
                  } else if (info.offset.x > swipeThreshold) {
                    navigateDate(-1);
                  }
                }}
                style={{ touchAction: 'pan-y', width: '100%', cursor: 'grab' }}
                whileTap={{ cursor: 'grabbing' }}
              >
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
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </main>

      {/* Update Modal */}
      <AnimatePresence>
        {showUpdateModal && latestReleaseInfo && (
          <div className="modal-overlay" onClick={() => setShowUpdateModal(false)}>
            <motion.div 
              className="modal-card"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <RefreshCw size={24} className="animate-spin" />
                <span className="modal-title">Update Available!</span>
              </div>
              <div className="modal-body">
                <strong>A new version ({latestReleaseInfo.tag}) is ready.</strong>
                <span>Release: {latestReleaseInfo.name}</span>
                <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '0.5rem 0' }} />
                <span className="modal-notes-title">What's New:</span>
                <pre className="modal-notes">{latestReleaseInfo.notes}</pre>
              </div>
              <div className="modal-actions">
                <button className="modal-btn-text" onClick={() => setShowUpdateModal(false)}>Later</button>
                <button className="modal-btn-primary" onClick={() => {
                  window.open(latestReleaseInfo.url, '_blank');
                  setShowUpdateModal(false);
                }}>Update Now</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
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

function SettingsView({ themeKey, onChangeTheme, onBack, checkingForUpdates, checkForUpdates }) {
  const themes = [
    {
      key: 'light',
      title: 'Light Indigo',
      primary: '#6366F1',
      background: '#F9FAFB',
      surface: '#ffffff',
      isDark: false
    },
    {
      key: 'dark_blue',
      title: 'Dark Slate (Original)',
      primary: '#6366F1',
      background: '#0F172A',
      surface: '#1E293B',
      isDark: true
    },
    {
      key: 'midnight',
      title: 'Midnight Black (AMOLED)',
      primary: '#EF4444',
      background: '#000000',
      surface: '#000000',
      isDark: true
    },
    {
      key: 'amoled_grey',
      title: 'Grey Black (AMOLED)',
      primary: '#9CA3AF',
      background: '#000000',
      surface: '#000000',
      isDark: true
    },
    {
      key: 'amoled_blue',
      title: 'Blue Black (AMOLED)',
      primary: '#2979FF',
      background: '#000000',
      surface: '#000000',
      isDark: true
    },
    {
      key: 'forest',
      title: 'Forest Emerald',
      primary: '#10B981',
      background: '#022C22',
      surface: '#064E3B',
      isDark: true
    },
    {
      key: 'sunset',
      title: 'Sunset Amber',
      primary: '#F59E0B',
      background: '#171717',
      surface: '#262626',
      isDark: true
    }
  ];

  return (
    <div className="app-container">
      <header className="header" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="settings-back-btn" onClick={onBack} title="Back">
            <ChevronLeft size={24} />
          </button>
          <div className="logo" style={{ fontSize: '1.25rem' }}>Settings</div>
        </div>
      </header>

      <main className="settings-main">
        <div className="settings-section">
          <div className="settings-section-header">
            <span>Personalize Theme</span>
          </div>
          <div className="theme-list">
            {themes.map(t => {
              const isSelected = themeKey === t.key || (t.key === 'dark_blue' && themeKey === 'dark');
              return (
                <div 
                  key={t.key} 
                  className={`theme-card ${isSelected ? 'active' : ''}`}
                  onClick={() => onChangeTheme(t.key)}
                >
                  <div className="theme-preview" style={{ background: t.background }}>
                    <div className="theme-circle-outer" style={{ background: t.surface }}>
                      <div className="theme-circle-inner" style={{ background: t.primary }}></div>
                    </div>
                  </div>
                  <div className="theme-info">
                    <span className="theme-name">{t.title}</span>
                    <span className="theme-mode">{t.isDark ? 'Dark Mode' : 'Light Mode'}</span>
                  </div>
                  <div className="theme-check">
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      border: '2px solid var(--primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: isSelected ? 'var(--primary)' : 'transparent',
                      color: 'white'
                    }}>
                      {isSelected && <Check size={14} strokeWidth={4} />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ height: '1px', background: 'var(--border)', margin: '0.5rem 0' }}></div>

        <div className="settings-section">
          <div className="settings-section-header">
            <span>Updates & Info</span>
          </div>
          
          <div className="info-card">
            <div className="info-row">
              <div className="info-col">
                <span className="info-label">App Version</span>
                <span className="info-desc">v2.2.3</span>
              </div>
              <button 
                className="check-update-btn" 
                onClick={checkForUpdates}
                disabled={checkingForUpdates}
              >
                {checkingForUpdates ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <RefreshCw size={16} />
                )}
                <span>Check Now</span>
              </button>
            </div>

            <div style={{ height: '1px', background: 'var(--border)', margin: '0.25rem 0' }}></div>

            <div 
              className="kofi-row"
              onClick={() => window.open('https://ko-fi.com/thorfin09', '_blank')}
            >
              <div className="kofi-icon-wrapper">
                <Heart size={20} fill="#ef4444" />
              </div>
              <div className="theme-info">
                <span className="theme-name">Support on Ko-fi</span>
                <span className="theme-mode">Support the developer</span>
              </div>
              <div style={{ color: 'var(--text-muted)' }}>
                <ChevronRight size={18} />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function LandingPageView({ onGetStarted, onDemo, onSignIn }) {
  const [latestVersion, setLatestVersion] = useState('2.2.3');
  const [downloadUrls, setDownloadUrls] = useState({
    windows: 'https://github.com/thorfin09/zenith/releases/latest',
    android: 'https://github.com/thorfin09/zenith/releases/latest',
    ios: 'https://github.com/thorfin09/zenith/releases/latest'
  });

  useEffect(() => {
    const fetchLatestRelease = async () => {
      try {
        const response = await fetch('https://api.github.com/repos/thorfin09/zenith/releases/latest');
        if (response.ok) {
          const data = await response.json();
          setLatestVersion(data.tag_name);
          
          let winUrl = data.html_url;
          let apkUrl = data.html_url;
          
          if (data.assets) {
            for (let asset of data.assets) {
              if (asset.name.endsWith('.exe')) {
                winUrl = asset.browser_download_url;
              } else if (asset.name.endsWith('.apk')) {
                apkUrl = asset.browser_download_url;
              }
            }
          }
          setDownloadUrls({
            windows: winUrl,
            android: apkUrl,
            ios: 'https://github.com/thorfin09/zenith/releases/latest'
          });
        }
      } catch (e) {
        console.error('Failed to fetch github release:', e);
      }
    };
    fetchLatestRelease();
  }, []);

  return (
    <div className="landing-container">
      <header className="landing-header">
        <div className="logo" style={{ fontSize: '1.5rem', fontWeight: '800' }}>ZENITH</div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="landing-nav-btn" onClick={onSignIn}>Sign In</button>
          <button className="landing-nav-btn primary" onClick={onGetStarted}>Get Started</button>
        </div>
      </header>

      <main className="landing-hero">
        <h1 className="hero-title">Keep Your Focus. Build Your Streak.</h1>
        <p className="hero-subtitle">
          Zenith is a premium daily task and goal planner. Maintain consistency, track streaks, and compete on the global leaderboard.
        </p>
        <div className="hero-actions">
          <button className="hero-btn-primary" onClick={onGetStarted}>Get Started (Web App)</button>
          <button className="hero-btn-secondary" onClick={onDemo}>Try Demo Mode</button>
        </div>
      </main>

      <section className="landing-features">
        <h2 className="section-title">Features Made for Consistency</h2>
        <div className="feature-grid">
          <div className="feature-card">
            <span className="feature-icon">📅</span>
            <h3>Daily Task Planning</h3>
            <p>Plan your day with precision. Drag and drop dates, view overdue tasks, and complete goals on time.</p>
          </div>
          <div className="feature-card">
            <span className="feature-icon">🔥</span>
            <h3>Streak Tracking</h3>
            <p>Making a goal each day keeps your streak active. Don't break the chain and stay motivated.</p>
          </div>
          <div className="feature-card">
            <span className="feature-icon">🏆</span>
            <h3>Global Leaderboard</h3>
            <p>Compete with users worldwide based on active streaks. Climb the ranks and build a name.</p>
          </div>
        </div>
      </section>

      <section className="landing-downloads">
        <h2 className="section-title">Download Zenith App</h2>
        <p className="downloads-subtitle">Take your daily planner everywhere you go. Available on all platforms.</p>
        <div className="downloads-grid">
          <div className="download-card">
            <Laptop size={40} className="download-icon" />
            <h3>Windows</h3>
            <span className="version-tag">{latestVersion}</span>
            <button className="download-btn" onClick={() => window.open(downloadUrls.windows, '_blank')}>
              Download Setup
            </button>
          </div>
          <div className="download-card">
            <Smartphone size={40} className="download-icon" />
            <h3>Android</h3>
            <span className="version-tag">{latestVersion}</span>
            <button className="download-btn" onClick={() => window.open(downloadUrls.android, '_blank')}>
              Download APK
            </button>
          </div>
          <div className="download-card">
            <Apple size={40} className="download-icon" />
            <h3>iOS</h3>
            <span className="version-tag">{latestVersion}</span>
            <button className="download-btn" onClick={() => window.open(downloadUrls.ios, '_blank')}>
              TestFlight / App Store
            </button>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <p>© 2026 Zenith Planner. Built for productivity.</p>
      </footer>
    </div>
  );
}

function LeaderboardView({ onBack, leaderboard, loading, fetchLeaderboard, currentUser }) {
  useEffect(() => {
    fetchLeaderboard();
  }, []);

  return (
    <div className="app-container">
      <header className="header" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="settings-back-btn" onClick={onBack} title="Back">
            <ChevronLeft size={24} />
          </button>
          <div className="logo" style={{ fontSize: '1.25rem' }}>Global Leaderboard</div>
        </div>
        <button className="icon-btn" onClick={fetchLeaderboard} disabled={loading} title="Refresh">
          <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
        </button>
      </header>

      <main className="leaderboard-main" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
        {loading ? (
          <div className="loading-spinner" style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
            <Loader2 className="animate-spin" size={32} style={{ color: 'var(--primary)' }} />
          </div>
        ) : leaderboard.length === 0 ? (
          <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No active streaks on the leaderboard yet. Start planning to be the first! 🔥
          </div>
        ) : (
          <div className="leaderboard-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {leaderboard.map((u, index) => {
              const isCurrentUser = currentUser && currentUser.username === u.username;
              const isTopThree = index < 3;
              const medals = ['🥇', '🥈', '🥉'];
              return (
                <div 
                  key={u.username}
                  className={`leaderboard-item ${isCurrentUser ? 'current-user-row' : ''}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.85rem 1.25rem',
                    background: isCurrentUser ? 'rgba(99, 102, 241, 0.12)' : 'var(--card-bg)',
                    border: isCurrentUser ? '2px solid var(--primary)' : '1px solid var(--border)',
                    borderRadius: '1rem',
                    boxShadow: 'var(--shadow)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ fontSize: '1.2rem', fontWeight: 'bold', minWidth: '2rem', display: 'inline-block' }}>
                      {isTopThree ? medals[index] : `#${index + 1}`}
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: '700', color: 'var(--text-main)' }}>{u.fullName}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>@{u.username}</span>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: '800', color: '#f97316', fontSize: '1.1rem' }}>
                    🔥 {u.streak}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function AdminPortalView({ onBack, adminUsers, loadingUsers, fetchUsers, systemConfig, fetchConfig, saveConfig, savingConfig }) {
  const [activeTab, setActiveTab] = useState('users'); // 'users' or 'config'
  
  // Config form state
  const [formConfig, setFormConfig] = useState({
    androidDownloadUrl: '',
    androidVersion: '',
    iosDownloadUrl: '',
    iosVersion: '',
    windowsDownloadUrl: '',
    windowsVersion: ''
  });

  useEffect(() => {
    fetchUsers();
    fetchConfig();
  }, []);

  useEffect(() => {
    if (systemConfig) {
      setFormConfig({
        androidDownloadUrl: systemConfig.androidDownloadUrl || '',
        androidVersion: systemConfig.androidVersion || '',
        iosDownloadUrl: systemConfig.iosDownloadUrl || '',
        iosVersion: systemConfig.iosVersion || '',
        windowsDownloadUrl: systemConfig.windowsDownloadUrl || '',
        windowsVersion: systemConfig.windowsVersion || ''
      });
    }
  }, [systemConfig]);

  const handleSave = (e) => {
    e.preventDefault();
    saveConfig(formConfig);
  };

  return (
    <div className="app-container" style={{ maxWidth: '600px' }}>
      <header className="header" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="settings-back-btn" onClick={onBack} title="Back">
            <ChevronLeft size={24} />
          </button>
          <div className="logo" style={{ fontSize: '1.25rem' }}>Admin Portal</div>
        </div>
      </header>

      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', margin: '1rem 0' }}>
        <button 
          style={{
            flex: 1,
            padding: '0.75rem',
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'users' ? '3px solid var(--primary)' : 'none',
            fontWeight: activeTab === 'users' ? '700' : '500',
            color: activeTab === 'users' ? 'var(--primary)' : 'var(--text-muted)',
            cursor: 'pointer'
          }}
          onClick={() => setActiveTab('users')}
        >
          Users List
        </button>
        <button 
          style={{
            flex: 1,
            padding: '0.75rem',
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'config' ? '3px solid var(--primary)' : 'none',
            fontWeight: activeTab === 'config' ? '700' : '500',
            color: activeTab === 'config' ? 'var(--primary)' : 'var(--text-muted)',
            cursor: 'pointer'
          }}
          onClick={() => setActiveTab('config')}
        >
          App Configs
        </button>
      </div>

      <main>
        {activeTab === 'users' ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1rem', color: 'var(--text-main)' }}>Total Registered Users ({adminUsers.length})</h3>
              <button 
                onClick={fetchUsers} 
                disabled={loadingUsers}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--primary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  fontSize: '0.85rem',
                  fontWeight: '600'
                }}
              >
                <RefreshCw size={16} className={loadingUsers ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>

            {loadingUsers ? (
              <div className="loading-spinner" style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                <Loader2 className="animate-spin" size={32} style={{ color: 'var(--primary)' }} />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {adminUsers.map(u => (
                  <div 
                    key={u.username}
                    style={{
                      background: 'var(--card-bg)',
                      border: '1px solid var(--border)',
                      borderRadius: '0.75rem',
                      padding: '1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                      boxShadow: 'var(--shadow)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: '700', fontSize: '1rem' }}>{u.fullName} {u.isAdmin && <span style={{ fontSize: '0.7rem', background: 'var(--danger)', color: 'white', padding: '0.1rem 0.4rem', borderRadius: '0.5rem', verticalAlign: 'middle', marginLeft: '0.35rem' }}>Admin</span>}</span>
                      <span style={{ fontSize: '0.95rem', color: '#f97316', fontWeight: 'bold' }}>🔥 {u.streak} days</span>
                    </div>

                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      <span><strong>Username:</strong> @{u.username}</span>
                      <span><strong>Phone:</strong> {u.phoneNumber || 'N/A'}</span>
                      <span><strong>Platform:</strong> {u.platform || 'unknown'}</span>
                      <span><strong>App Version:</strong> {u.appVersion ? `v${u.appVersion}` : 'unknown'}</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '0.5rem', marginTop: '0.25rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <span>Joined: {new Date(u.createdAt).toLocaleDateString()}</span>
                      <span>Active: {new Date(u.lastActiveAt).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingBottom: '2rem' }}>
            <h3 style={{ fontSize: '1rem', color: 'var(--text-main)' }}>Platform Download URL & Version Configurations</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <h4 style={{ fontSize: '0.875rem', fontWeight: '700', color: 'var(--primary)', textTransform: 'uppercase' }}>Windows App</h4>
              <div className="form-group">
                <label className="form-label">Download URL</label>
                <input 
                  className="form-input" 
                  value={formConfig.windowsDownloadUrl} 
                  onChange={e => setFormConfig({...formConfig, windowsDownloadUrl: e.target.value})} 
                  placeholder="https://github.com/..."
                />
              </div>
              <div className="form-group">
                <label className="form-label">Version Match</label>
                <input 
                  className="form-input" 
                  value={formConfig.windowsVersion} 
                  onChange={e => setFormConfig({...formConfig, windowsVersion: e.target.value})} 
                  placeholder="2.2.3"
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
              <h4 style={{ fontSize: '0.875rem', fontWeight: '700', color: 'var(--primary)', textTransform: 'uppercase' }}>Android App</h4>
              <div className="form-group">
                <label className="form-label">Download URL</label>
                <input 
                  className="form-input" 
                  value={formConfig.androidDownloadUrl} 
                  onChange={e => setFormConfig({...formConfig, androidDownloadUrl: e.target.value})} 
                  placeholder="https://..."
                />
              </div>
              <div className="form-group">
                <label className="form-label">Version Match</label>
                <input 
                  className="form-input" 
                  value={formConfig.androidVersion} 
                  onChange={e => setFormConfig({...formConfig, androidVersion: e.target.value})} 
                  placeholder="2.2.3"
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
              <h4 style={{ fontSize: '0.875rem', fontWeight: '700', color: 'var(--primary)', textTransform: 'uppercase' }}>iOS App</h4>
              <div className="form-group">
                <label className="form-label">Download URL</label>
                <input 
                  className="form-input" 
                  value={formConfig.iosDownloadUrl} 
                  onChange={e => setFormConfig({...formConfig, iosDownloadUrl: e.target.value})} 
                  placeholder="https://..."
                />
              </div>
              <div className="form-group">
                <label className="form-label">Version Match</label>
                <input 
                  className="form-input" 
                  value={formConfig.iosVersion} 
                  onChange={e => setFormConfig({...formConfig, iosVersion: e.target.value})} 
                  placeholder="2.2.3"
                />
              </div>
            </div>

            <button 
              className="btn-primary" 
              type="submit" 
              disabled={savingConfig}
              style={{ marginTop: '1rem' }}
            >
              {savingConfig ? <Loader2 className="animate-spin" size={20} /> : 'Save Configurations'}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}

export default App;
