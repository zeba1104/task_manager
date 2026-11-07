import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Menu,
  Search,
  Settings,
  Bell,
  LogOut,
  Moon,
  Sun,
  Megaphone,
  AlertTriangle,
  CalendarDays,
  Clock,
  CheckCheck,
  MessageSquare,
} from 'lucide-react';
import axios from '../api/axios';
import Sidebar from './Sidebar';
import UserAvatar from './UserAvatar';

function AppLayout({
  user,
  activeView,
  activeTab,
  onNavigate,
  logout,
  children,
}) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('taskflow_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Notification Popover State
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const notifRef = useRef(null);

  const loadNotifications = useCallback(async () => {
    try {
      const res = await axios.get('/users/notifications');
      const data = res.data || [];
      try {
        const readIds = new Set(JSON.parse(localStorage.getItem('taskflow_read_notifs') || '[]'));
        setNotifications(
          data.map((n) => ({
            ...n,
            isRead: n.isRead || readIds.has(String(n._id)),
          }))
        );
      } catch {
        setNotifications(data);
      }
    } catch {
      // fallback
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 15000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  useEffect(() => {
    if (notifOpen) {
      loadNotifications();
    }
  }, [notifOpen, loadNotifications]);

  // Theme handling
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      return (
        localStorage.getItem('taskflow_theme') === 'dark' ||
        localStorage.getItem('taskflow-theme') === 'dark' ||
        document.documentElement.getAttribute('data-theme') === 'dark' ||
        document.body.classList.contains('dark-theme')
      );
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const themeVal = isDarkMode ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', themeVal);
    document.body.setAttribute('data-theme', themeVal);
    document.body.classList.toggle('dark-theme', isDarkMode);
    try {
      localStorage.setItem('taskflow_theme', themeVal);
      localStorage.setItem('taskflow-theme', themeVal);
    } catch {
      // Ignore
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode((prev) => !prev);
  };

  useEffect(() => {
    try {
      localStorage.setItem('taskflow_sidebar_collapsed', String(collapsed));
    } catch {
      // Ignore
    }
  }, [collapsed]);

  // Click outside to close profile dropdown & notification dropdown
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };
    if (dropdownOpen || notifOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [dropdownOpen, notifOpen]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleMarkAllRead = () => {
    try {
      const readIds = notifications.map((n) => String(n._id));
      const stored = JSON.parse(localStorage.getItem('taskflow_read_notifs') || '[]');
      localStorage.setItem('taskflow_read_notifs', JSON.stringify([...new Set([...stored, ...readIds])]));
    } catch {
      // Ignore
    }
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const handleNotificationItemClick = (notif) => {
    setNotifOpen(false);
    try {
      const stored = JSON.parse(localStorage.getItem('taskflow_read_notifs') || '[]');
      localStorage.setItem('taskflow_read_notifs', JSON.stringify([...new Set([...stored, String(notif._id)])]));
    } catch {
      // Ignore
    }
    // Mark as read locally
    setNotifications((prev) =>
      prev.map((n) => (n._id === notif._id ? { ...n, isRead: true } : n))
    );

    if (notif.type === 'announcement') {
      if (user?.role === 'Admin') onNavigate({ view: 'announcements' });
      else if (user?.role === 'Manager') onNavigate({ view: 'manager', tab: 'announcements' });
      else onNavigate({ view: 'employee', tab: 'announcements' });
    } else if (notif.type === 'leave') {
      if (user?.role === 'Admin') onNavigate({ view: 'admin-leaves' });
      else if (user?.role === 'Manager') onNavigate({ view: 'manager', tab: 'leave' });
      else onNavigate({ view: 'employee', tab: 'leave' });
    } else if (notif.type === 'chat') {
      if (user?.role === 'Admin') onNavigate({ view: 'chat' });
      else if (user?.role === 'Manager') onNavigate({ view: 'manager', tab: 'chat' });
      else onNavigate({ view: 'employee', tab: 'chat' });
    } else if (notif.type === 'revision' || notif.type === 'task') {
      if (user?.role === 'Employee') onNavigate({ view: 'employee', tab: 'tasks' });
      else if (user?.role === 'Manager') onNavigate({ view: 'tasks' });
      else onNavigate({ view: 'tasks' });
    } else if (user?.role === 'Admin') {
      onNavigate({ view: 'admin' });
    }
  };

  const toggleCollapse = () => {
    setCollapsed((prev) => !prev);
  };

  const handleSettingsClick = () => {
    setDropdownOpen(false);
    if (user?.role === 'Admin') {
      onNavigate({ view: 'admin' });
    } else if (user?.role === 'Manager') {
      onNavigate({ view: 'manager', tab: 'profile' });
    } else {
      onNavigate({ view: 'employee', tab: 'profile' });
    }
  };

  return (
    <div className={`app-shell ${collapsed ? 'sidebar-is-collapsed' : 'sidebar-is-expanded'}`}>
      {/* Unified Role-Based Sidebar */}
      <Sidebar
        user={user}
        activeView={activeView}
        activeTab={activeTab}
        onNavigate={onNavigate}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapse}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        logout={logout}
      />

      {/* Main Canvas Area */}
      <div className="app-main-canvas">
        {/* TopBar Header (matching Image 2) */}
        <header className="app-topbar">
          <div className="topbar-left">
            {/* Hamburger Button */}
            <button
              type="button"
              className="topbar-hamburger-btn"
              onClick={() => {
                if (window.innerWidth <= 768) {
                  setMobileOpen(true);
                } else {
                  toggleCollapse();
                }
              }}
              title="Toggle Navigation"
              aria-label="Toggle Navigation"
            >
              <Menu size={19} />
            </button>

            {/* Global Search Bar with ⌘K badge */}
            <div className="topbar-search-wrap">
              <Search size={15} className="search-icon" />
              <input
                type="text"
                placeholder="Search..."
                className="topbar-search-input"
                aria-label="Search"
              />
              <span className="search-kbd-shortcut">⌘K</span>
            </div>
          </div>

          <div className="topbar-right">
            {/* Dark Mode Moon/Sun Toggle */}
            <button
              type="button"
              className="topbar-icon-action"
              onClick={toggleTheme}
              title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label="Toggle theme"
            >
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* Settings Gear Icon */}
            <button
              type="button"
              className="topbar-icon-action"
              onClick={handleSettingsClick}
              title="Settings & Profile"
              aria-label="Settings"
            >
              <Settings size={18} />
            </button>

            {/* Notification Bell with interactive Dropdown Popover */}
            <div className="topbar-notification-container" ref={notifRef}>
              <button
                type="button"
                className={`topbar-icon-action notification-action ${notifOpen ? 'active' : ''}`}
                onClick={() => setNotifOpen((prev) => !prev)}
                title="Recent Notifications & Alerts"
                aria-label="Notifications"
                aria-haspopup="true"
                aria-expanded={notifOpen}
              >
                <Bell size={18} />
                {unreadCount > 0 && <span className="notification-unread-dot" />}
              </button>

              {notifOpen && (
                <div className="topbar-notifications-popover" role="dialog" aria-label="Notifications list">
                  <div className="notif-popover-header">
                    <div className="notif-header-title">
                      <Bell size={15} className="text-blue" />
                      <strong>Notifications</strong>
                      {unreadCount > 0 && (
                        <span className="notif-unread-count-tag">{unreadCount} New</span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        className="notif-mark-read-btn"
                        onClick={handleMarkAllRead}
                        title="Mark all as read"
                      >
                        <CheckCheck size={13} />
                        <span>Mark all read</span>
                      </button>
                    )}
                  </div>

                  <div className="notif-popover-list">
                    {notifications.length === 0 ? (
                      <div className="notif-popover-empty">
                        <Bell size={24} className="text-muted" />
                        <p>No recent notifications</p>
                      </div>
                    ) : (
                      notifications.slice(0, 8).map((n, idx) => (
                        <div
                          key={n._id || idx}
                          className={`notif-popover-item ${!n.isRead ? 'is-unread' : ''}`}
                          onClick={() => handleNotificationItemClick(n)}
                          role="button"
                          tabIndex={0}
                        >
                          <div className="notif-item-icon-box">
                            {n.type === 'revision' ? <AlertTriangle size={14} className="text-red" /> :
                             n.type === 'leave' ? <CalendarDays size={14} className="text-purple" /> :
                             n.type === 'announcement' ? <Megaphone size={14} className="text-blue" /> :
                             n.type === 'chat' ? <MessageSquare size={14} className="text-emerald" /> :
                             <Bell size={14} className="text-blue" />}
                          </div>
                          <div className="notif-item-body">
                            <strong className="notif-item-title">{n.title}</strong>
                            <p className="notif-item-desc">{n.message}</p>
                            <span className="notif-item-time">
                              <Clock size={11} /> {new Date(n.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          {!n.isRead && <span className="notif-item-unread-dot" />}
                        </div>
                      ))
                    )}
                  </div>

                  <div className="notif-popover-footer">
                    <button
                      type="button"
                      className="btn-ghost btn-xs"
                      onClick={() => {
                        setNotifOpen(false);
                        if (user?.role === 'Admin') onNavigate({ view: 'announcements' });
                        else if (user?.role === 'Manager') onNavigate({ view: 'manager', tab: 'announcements' });
                        else onNavigate({ view: 'employee', tab: 'announcements' });
                      }}
                    >
                      View Announcements
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* User Avatar with Dropdown Popover (matching Image 2!) */}
            <div className="topbar-user-dropdown-container" ref={dropdownRef}>
              <button
                type="button"
                className="topbar-avatar-btn"
                onClick={() => setDropdownOpen((prev) => !prev)}
                title="User menu"
                aria-haspopup="true"
                aria-expanded={dropdownOpen}
              >
                <div className="topbar-avatar-circle">
                  <UserAvatar user={user} className="topbar-avatar-img" fallbackClass="topbar-avatar-initial" />
                </div>
              </button>

              {/* Dropdown Menu (matching Image 2) */}
              {dropdownOpen && (
                <div className="topbar-dropdown-popover" role="menu">
                  <div className="popover-user-block">
                    <span className="popover-user-name">{user?.name || 'User'}</span>
                    <span className="popover-user-email">{user?.email || 'user@example.com'}</span>
                  </div>

                  <div className="popover-divider" />

                  <button
                    type="button"
                    className="popover-menu-item"
                    role="menuitem"
                    onClick={handleSettingsClick}
                  >
                    <Settings size={15} />
                    <span>Settings</span>
                  </button>

                  <div className="popover-divider" />

                  <button
                    type="button"
                    className="popover-menu-item logout-menu-item"
                    role="menuitem"
                    onClick={() => {
                      setDropdownOpen(false);
                      logout();
                    }}
                  >
                    <LogOut size={15} />
                    <span>Log out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Viewport Content Area */}
        <main className="app-content-viewport" id="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}

export default AppLayout;
