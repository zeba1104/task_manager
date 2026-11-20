import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  CheckSquare,
  Briefcase,
  Users,
  Layers,
  Palmtree,
  X,
  Landmark,
  CheckCircle2,
  CreditCard,
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
    } else if (notif.type === 'payment_debited' || notif.type === 'payment_credited' || notif.type === 'payroll_approval' || notif.type === 'payroll_ready') {
      if (user?.role === 'Admin') onNavigate({ view: 'payroll' });
      else if (user?.role === 'Manager') {
        if (notif._id && String(notif._id).startsWith('mgr_own_')) {
          onNavigate({ view: 'manager', tab: 'payroll' });
        } else {
          onNavigate({ view: 'payroll' });
        }
      } else {
        onNavigate({ view: 'employee', tab: 'payroll' });
      }
    } else if (user?.role === 'Admin') {
      onNavigate({ view: 'admin' });
    }
  };

  const toggleCollapse = () => {
    setCollapsed((prev) => !prev);
  };

  const handleSettingsClick = () => {
    setDropdownOpen(false);
    onNavigate({ view: 'settings', tab: 'profile' });
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedSearchIndex, setSelectedSearchIndex] = useState(0);
  const searchInputRef = useRef(null);
  const searchWrapRef = useRef(null);

  // Close search popover on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const searchItems = useMemo(() => {
    const role = user?.role || 'Employee';
    return [
      {
        id: 'dashboard',
        title: 'Operations Dashboard',
        desc: 'Workspace overview, performance metrics & activity',
        category: 'Pages',
        icon: <Layers size={16} />,
        action: () => {
          if (role === 'Admin') onNavigate({ view: 'admin' });
          else if (role === 'Manager') onNavigate({ view: 'manager', tab: 'dashboard' });
          else onNavigate({ view: 'employee', tab: 'dashboard' });
        },
        keywords: 'dashboard overview home kpi stats summary operations'
      },
      {
        id: 'tasks',
        title: 'Tasks & Kanban Board',
        desc: 'Interactive task boards, backlog, sprints & status',
        category: 'Pages',
        icon: <CheckSquare size={16} />,
        action: () => {
          if (role === 'Employee') onNavigate({ view: 'employee', tab: 'tasks' });
          else onNavigate({ view: 'tasks' });
        },
        keywords: 'tasks kanban board todo in progress completed workflow sprint'
      },
      {
        id: 'projects',
        title: 'Projects & Milestones',
        desc: 'Project tracking, progress indicators & deliverables',
        category: 'Pages',
        icon: <Briefcase size={16} />,
        action: () => {
          if (role === 'Admin') onNavigate({ view: 'admin' });
          else if (role === 'Manager') onNavigate({ view: 'manager', tab: 'projects' });
          else onNavigate({ view: 'employee', tab: 'projects' });
        },
        keywords: 'projects portfolios milestones deliverables active'
      },
      {
        id: 'attendance',
        title: 'Attendance & Shifts',
        desc: 'Shift check-in/out, logs, monthly duration & history',
        category: 'Pages',
        icon: <Clock size={16} />,
        action: () => {
          if (role === 'Admin') onNavigate({ view: 'attendance' });
          else if (role === 'Manager') onNavigate({ view: 'manager', tab: 'attendance' });
          else onNavigate({ view: 'employee', tab: 'attendance' });
        },
        keywords: 'attendance shifts check-in clock-in clock-out time work hours'
      },
      {
        id: 'leaves',
        title: 'Leave & Quota Balances',
        desc: 'Annual, sick, casual leave quotas & approval tracking',
        category: 'Pages',
        icon: <CalendarDays size={16} />,
        action: () => {
          if (role === 'Admin') onNavigate({ view: 'admin-leaves' });
          else if (role === 'Manager') onNavigate({ view: 'manager', tab: 'leave' });
          else onNavigate({ view: 'employee', tab: 'leave' });
        },
        keywords: 'leave quota balances apply vacation sick casual maternity approval'
      },
      {
        id: 'announcements',
        title: 'Broadcast Announcements',
        desc: 'Company-wide updates, notices, memos & guidelines',
        category: 'Pages',
        icon: <Megaphone size={16} />,
        action: () => {
          if (role === 'Admin') onNavigate({ view: 'announcements' });
          else if (role === 'Manager') onNavigate({ view: 'manager', tab: 'announcements' });
          else onNavigate({ view: 'employee', tab: 'announcements' });
        },
        keywords: 'announcements news updates broadcast notices memo company'
      },
      {
        id: 'holidays',
        title: 'Government & National Holidays',
        desc: 'Statutory holiday calendar and observed festivals',
        category: 'Pages',
        icon: <Palmtree size={16} />,
        action: () => {
          if (role === 'Admin') onNavigate({ view: 'holidays' });
          else if (role === 'Manager') onNavigate({ view: 'manager', tab: 'holidays' });
          else onNavigate({ view: 'employee', tab: 'holidays' });
        },
        keywords: 'holidays calendar festival national public diwali eid republic'
      },
      {
        id: 'chat',
        title: 'Direct Messages & Chat',
        desc: 'Direct communication with managers and team members',
        category: 'Pages',
        icon: <MessageSquare size={16} />,
        action: () => {
          if (role === 'Admin') onNavigate({ view: 'chat' });
          else if (role === 'Manager') onNavigate({ view: 'manager', tab: 'chat' });
          else onNavigate({ view: 'employee', tab: 'chat' });
        },
        keywords: 'chat direct messages messaging communication team discussion dm'
      },
      {
        id: 'payroll',
        title: role === 'Admin' ? 'Salary & Payroll Management' : (role === 'Manager' ? 'Team Payroll & Attendance Review' : 'My Salary & Payslips'),
        desc: 'Compensation, monthly attendance calculations, RazorpayX payouts & official payslips',
        category: 'Pages',
        icon: <Landmark size={16} />,
        action: () => {
          onNavigate({ view: 'payroll' });
        },
        keywords: 'salary payroll payslip payouts razorpay test mode bank account earnings deductions compensation take-home'
      },
      ...(role === 'Admin' || role === 'Manager' ? [{
        id: 'directory',
        title: role === 'Admin' ? 'Members & Governance Directory' : 'Team Members Directory',
        desc: 'Manage staff, employee profiles, roles & credentials',
        category: 'Pages',
        icon: <Users size={16} />,
        action: () => {
          if (role === 'Admin') onNavigate({ view: 'employees' });
          else onNavigate({ view: 'manager', tab: 'team' });
        },
        keywords: 'employees members directory staff managers profiles roster users'
      }] : []),
      {
        id: 'profile',
        title: 'Account Settings & Security',
        desc: 'Profile information, password management & preferences',
        category: 'Settings',
        icon: <Settings size={16} />,
        action: () => {
          onNavigate({ view: 'settings', tab: 'profile' });
        },
        keywords: 'settings profile account password security email personal'
      },
      {
        id: 'toggle-theme',
        title: isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode',
        desc: isDarkMode ? 'Activate clean daylight theme' : 'Activate eye-friendly dark workspace theme',
        category: 'Actions',
        icon: isDarkMode ? <Sun size={16} /> : <Moon size={16} />,
        action: () => toggleTheme(),
        keywords: 'theme dark light mode appearance color toggle night sun moon'
      }
    ];
  }, [user, isDarkMode, onNavigate]);

  const filteredSearchItems = useMemo(() => {
    if (!searchQuery.trim()) {
      return searchItems.slice(0, 6);
    }
    const q = searchQuery.toLowerCase().trim();
    return searchItems.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.desc.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.keywords.toLowerCase().includes(q)
    );
  }, [searchItems, searchQuery]);

  const handleSelectSearchItem = (item) => {
    item.action();
    setSearchQuery('');
    setSearchOpen(false);
    searchInputRef.current?.blur();
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const getBreadcrumb = () => {
    if (activeView === 'settings') {
      return { section: 'Settings', current: 'Account Settings & Security' };
    }
    if (user?.role === 'Admin') {
      if (activeView === 'admin') return { section: 'Admin', current: 'Operations Center' };
      if (activeView === 'employees') return { section: 'Governance', current: 'Members Directory' };
      if (activeView === 'tasks') return { section: 'Operations', current: 'Task Board' };
      if (activeView === 'attendance') return { section: 'Governance', current: 'Attendance Records' };
      if (activeView === 'admin-leaves') return { section: 'Governance', current: 'Leave Approvals' };
      if (activeView === 'holidays') return { section: 'Company', current: 'Government Holidays' };
      if (activeView === 'announcements') return { section: 'Broadcasts', current: 'Announcements' };
      if (activeView === 'chat') return { section: 'Messaging', current: 'Executive Chat' };
      return { section: 'Admin', current: 'Control Center' };
    }
    if (user?.role === 'Manager') {
      if (activeView === 'tasks') return { section: 'Tasks', current: 'Team Task Board' };
      if (activeView === 'holidays') return { section: 'Company', current: 'Holiday Calendar' };
      if (activeView === 'chat') return { section: 'Communication', current: 'Team Chat' };
      if (activeView === 'announcements') return { section: 'Broadcasts', current: 'Announcements' };
      if (activeTab === 'team') return { section: 'Workspace', current: 'Team Members' };
      if (activeTab === 'projects') return { section: 'Workspace', current: 'Project Portfolios' };
      if (activeTab === 'leave') return { section: 'Workspace', current: 'Leave Approvals' };
      if (activeTab === 'attendance') return { section: 'Workspace', current: 'Attendance Tracking' };
      if (activeTab === 'profile') return { section: 'Settings', current: 'Manager Profile' };
      return { section: 'Team', current: 'Team Overview' };
    }
    // Employee
    if (activeView === 'tasks') return { section: 'Tasks', current: 'My Task Board' };
    if (activeView === 'holidays') return { section: 'Company', current: 'Holiday Calendar' };
    if (activeView === 'chat') return { section: 'Communication', current: 'Manager Chat' };
    if (activeView === 'announcements') return { section: 'Broadcasts', current: 'Announcements' };
    if (activeTab === 'tasks') return { section: 'Workspace', current: 'Assigned Tasks' };
    if (activeTab === 'projects') return { section: 'Workspace', current: 'My Projects' };
    if (activeTab === 'leave') return { section: 'Workspace', current: 'Leave & Quotas' };
    if (activeTab === 'attendance') return { section: 'Workspace', current: 'My Attendance' };
    if (activeTab === 'profile') return { section: 'Settings', current: 'My Profile' };
    return { section: 'Workspace', current: 'Team Dashboard' };
  };

  const breadcrumb = getBreadcrumb();

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

            {/* Breadcrumb Navigation */}
            <nav className="topbar-breadcrumb" aria-label="Breadcrumb">
              <span className="breadcrumb-root">Taskflow</span>
              <span className="breadcrumb-sep">/</span>
              <span className="breadcrumb-section">{breadcrumb.section}</span>
              <span className="breadcrumb-sep">/</span>
              <span className="breadcrumb-current">{breadcrumb.current}</span>
            </nav>

            {/* Global Search Bar with ⌘K badge & interactive Command Palette */}
            <div className="topbar-search-wrap" ref={searchWrapRef}>
              <Search size={15} className="search-icon" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSearchOpen(true);
                  setSelectedSearchIndex(0);
                }}
                onFocus={() => setSearchOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setSelectedSearchIndex((prev) => (prev + 1) % (filteredSearchItems.length || 1));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setSelectedSearchIndex((prev) => (prev - 1 + (filteredSearchItems.length || 1)) % (filteredSearchItems.length || 1));
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (filteredSearchItems[selectedSearchIndex]) {
                      handleSelectSearchItem(filteredSearchItems[selectedSearchIndex]);
                    }
                  } else if (e.key === 'Escape') {
                    setSearchOpen(false);
                    searchInputRef.current?.blur();
                  }
                }}
                placeholder="Search pages, actions, modules..."
                className="topbar-search-input"
                aria-label="Search"
              />
              {searchQuery ? (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => {
                    setSearchQuery('');
                    searchInputRef.current?.focus();
                  }}
                  title="Clear search"
                >
                  <X size={13} />
                </button>
              ) : (
                <span
                  className="search-kbd-shortcut"
                  onClick={() => {
                    setSearchOpen(true);
                    searchInputRef.current?.focus();
                  }}
                  title="Press Ctrl+K or ⌘K to search"
                >
                  ⌘K
                </span>
              )}

              {/* Command Palette Dropdown */}
              {searchOpen && (
                <div className="topbar-search-popover">
                  <div className="popover-header-row">
                    <span>{searchQuery ? `Matching Results (${filteredSearchItems.length})` : 'Quick Navigation & Shortcuts'}</span>
                    <span>Taskflow Search</span>
                  </div>
                  <div className="popover-results-list">
                    {filteredSearchItems.length === 0 ? (
                      <div className="popover-empty">
                        No matches found for "{searchQuery}". Try searching for tasks, projects, attendance, or settings.
                      </div>
                    ) : (
                      filteredSearchItems.map((item, idx) => (
                        <div
                          key={item.id}
                          className={`popover-item ${idx === selectedSearchIndex ? 'is-selected' : ''}`}
                          onClick={() => handleSelectSearchItem(item)}
                          onMouseEnter={() => setSelectedSearchIndex(idx)}
                        >
                          <div className="popover-item-icon">{item.icon}</div>
                          <div className="popover-item-text">
                            <div className="popover-item-title">{item.title}</div>
                            <div className="popover-item-desc">{item.desc}</div>
                          </div>
                          <span className="popover-item-badge">{item.category}</span>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="popover-footer">
                    <span>↑↓ to navigate · ↵ to select · ESC to exit</span>
                  </div>
                </div>
              )}
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
                            {n.type === 'payment_debited' ? <CreditCard size={14} className="text-amber" /> :
                             n.type === 'payment_credited' ? <CheckCircle2 size={14} className="text-emerald" /> :
                             n.type === 'payroll_approval' || n.type === 'payroll_ready' ? <Landmark size={14} className="text-blue" /> :
                             n.type === 'revision' ? <AlertTriangle size={14} className="text-red" /> :
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
