import React, { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Clock,
  CheckSquare,
  CalendarDays,
  Briefcase,
  FolderKanban,
  UserCheck,
  TrendingUp,
  Building2,
  Megaphone,
  MessageSquare,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  Sparkles,
} from 'lucide-react';
import { getNavigationForRole } from '../config/navigationConfig';
import UserAvatar from './UserAvatar';

const ICON_MAP = {
  LayoutDashboard,
  Users,
  Clock,
  CheckSquare,
  CalendarDays,
  Briefcase,
  FolderKanban,
  UserCheck,
  TrendingUp,
  Building2,
  Megaphone,
  MessageSquare,
};

function Sidebar({
  user,
  activeView,
  activeTab,
  onNavigate,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
  logout,
}) {
  const [openSubmenus, setOpenSubmenus] = useState({ 'manager-leave': true });

  const role = user?.role || 'Employee';
  const navSections = getNavigationForRole(role);
  const mainItems = navSections.main || [];
  const quickItems = navSections.quick || [];

  const toggleSubmenu = (itemId, e) => {
    e.stopPropagation();
    setOpenSubmenus((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const isItemActive = (item) => {
    if (item.view === 'tasks' && activeView === 'tasks') return true;
    if (role === 'Admin') {
      return activeView === item.view;
    }
    // Manager and Employee
    if (activeView === item.view) {
      if (item.tab) {
        return activeTab === item.tab;
      }
      return true;
    }
    return false;
  };

  const renderNavNode = (item) => {
    const IconComponent = ICON_MAP[item.icon] || LayoutDashboard;
    const active = isItemActive(item);
    const hasSubmenu = item.submenu && item.submenu.length > 0;
    const isSubmenuOpen = openSubmenus[item.id];

    return (
      <div key={item.id} className="sidebar-nav-node">
        <button
          type="button"
          className={`sidebar-nav-link ${active ? 'active' : ''}`}
          onClick={() => {
            onNavigate(item);
            if (mobileOpen) onCloseMobile();
          }}
          title={collapsed ? item.label : undefined}
          aria-current={active ? 'page' : undefined}
        >
          <span className="nav-icon-wrap">
            <IconComponent size={18} />
          </span>

          {!collapsed && (
            <>
              <span className="nav-label">{item.label}</span>

              {item.badge && (
                <span className="nav-badge-pill">{item.badge}</span>
              )}

              {hasSubmenu && (
                <span
                  className={`nav-arrow ${isSubmenuOpen ? 'open' : ''}`}
                  onClick={(e) => toggleSubmenu(item.id, e)}
                  aria-label="Toggle submenu"
                >
                  <ChevronDown size={14} />
                </span>
              )}
            </>
          )}
        </button>

        {/* Expandable Submenu */}
        {!collapsed && hasSubmenu && isSubmenuOpen && (
          <div className="sidebar-submenu-list">
            {item.submenu.map((sub) => (
              <button
                key={sub.id}
                type="button"
                className="sidebar-subnav-link"
                onClick={() => {
                  onNavigate({ ...item, subfilter: sub.subfilter });
                  if (mobileOpen) onCloseMobile();
                }}
              >
                <span className="subnav-dot" />
                <span className="subnav-label">{sub.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="sidebar-mobile-backdrop"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`app-sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}
        aria-label="Main sidebar navigation"
      >
        {/* Sidebar Brand Header (matching Taskify in Image 2) */}
        <div
          className="sidebar-header"
          onClick={() => {
            if (collapsed) onToggleCollapse();
          }}
          title={collapsed ? 'Click to open sidebar' : undefined}
          style={{ cursor: collapsed ? 'pointer' : 'default' }}
        >
          <div className="sidebar-brand-lockup">
            <button
              type="button"
              className="sidebar-brand-logo-btn"
              onClick={(e) => {
                e.stopPropagation();
                onToggleCollapse();
              }}
              title={collapsed ? 'Open sidebar' : 'Collapse sidebar'}
              aria-label={collapsed ? 'Open sidebar' : 'Collapse sidebar'}
            >
              <div className="sidebar-brand-logo-box">
                <CheckSquare size={20} className="brand-logo-svg" />
              </div>
            </button>
            {!collapsed && (
              <span
                className="sidebar-brand-name"
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigate(mainItems[0] || { view: role === 'Admin' ? 'admin' : role === 'Manager' ? 'manager' : 'employee' });
                }}
                style={{ cursor: 'pointer' }}
                title="Go to Dashboard"
              >
                Taskflow
              </span>
            )}
          </div>

          {/* Desktop Collapse Toggle */}
          <button
            type="button"
            className="sidebar-collapse-btn desktop-only"
            onClick={onToggleCollapse}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>

          {/* Mobile Close Button */}
          <button
            type="button"
            className="sidebar-close-btn mobile-only"
            onClick={onCloseMobile}
            title="Close navigation"
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        {/* Sidebar Navigation Links List */}
        <div className="sidebar-nav-scroll">
          {/* Section 1: MAIN NAVIGATION */}
          {!collapsed && (
            <div className="sidebar-section-heading">MAIN NAVIGATION</div>
          )}
          <nav className="sidebar-menu-list">
            {mainItems.map(renderNavNode)}
          </nav>

          {/* Section 2: QUICK ACTIONS */}
          {quickItems.length > 0 && (
            <>
              {!collapsed && (
                <div className="sidebar-section-heading" style={{ marginTop: '18px' }}>
                  QUICK ACTIONS
                </div>
              )}
              <nav className="sidebar-menu-list">
                {quickItems.map(renderNavNode)}
              </nav>
            </>
          )}

          {/* Role Status Card (matching Image 2) */}
          {!collapsed && (
            <div className="sidebar-promo-card">
              <div className="promo-card-top">
                <Sparkles size={16} className="promo-icon" />
                <span className="promo-title">Taskflow {role}</span>
              </div>
              <p className="promo-desc">
                {user?.department ? `${user.department} Department` : 'Organization Workspace'}
              </p>
              <div className="promo-progress-track">
                <div className="promo-progress-bar" style={{ width: '85%' }} />
              </div>
            </div>
          )}
        </div>

        {/* Bottom User Profile Row (matching Image 2!) */}
        <div className="sidebar-footer">
          <div className="sidebar-user-card">
            <div className="sidebar-user-avatar">
              <UserAvatar user={user} className="sidebar-avatar-img" fallbackClass="sidebar-avatar-initial" />
            </div>

            {!collapsed && (
              <div className="sidebar-user-details">
                <span className="sidebar-user-name" title={user?.name}>
                  {user?.name || 'User'}
                </span>
                <span className="sidebar-user-meta" title={user?.email}>
                  {user?.email || 'user@example.com'}
                </span>
              </div>
            )}

            <button
              type="button"
              className="sidebar-logout-btn"
              onClick={logout}
              title="Logout from account"
              aria-label="Logout"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
