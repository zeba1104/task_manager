import React, { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Clock,
  CheckSquare,
  CalendarDays,
  Calendar,
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
  Banknote,
  CreditCard,
} from 'lucide-react';
import { getNavigationForRole } from '../config/navigationConfig';
import UserAvatar from './UserAvatar';

const ICON_MAP = {
  LayoutDashboard,
  Users,
  Clock,
  CheckSquare,
  CalendarDays,
  Calendar,
  Briefcase,
  FolderKanban,
  UserCheck,
  TrendingUp,
  Building2,
  Megaphone,
  MessageSquare,
  Banknote,
  CreditCard,
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
  const isEffectiveCollapsed = collapsed && !mobileOpen;
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
          title={isEffectiveCollapsed ? item.label : undefined}
          aria-current={active ? 'page' : undefined}
        >
          <span className="nav-icon-wrap">
            <IconComponent size={18} />
          </span>

          {!isEffectiveCollapsed && (
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
        {!isEffectiveCollapsed && hasSubmenu && isSubmenuOpen && (
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
        className={`app-sidebar ${isEffectiveCollapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}
        aria-label="Main sidebar navigation"
      >
        {/* Sidebar Brand Header (matching Taskify in Image 2) */}
        <div
          className="sidebar-header"
          onClick={() => {
            if (isEffectiveCollapsed) onToggleCollapse();
          }}
          title={isEffectiveCollapsed ? 'Click to open sidebar' : undefined}
          style={{ cursor: isEffectiveCollapsed ? 'pointer' : 'default' }}
        >
          <div className="sidebar-brand-lockup">
            <button
              type="button"
              className="sidebar-brand-logo-btn"
              onClick={(e) => {
                e.stopPropagation();
                onToggleCollapse();
              }}
              title={isEffectiveCollapsed ? 'Open sidebar' : 'Collapse sidebar'}
              aria-label={isEffectiveCollapsed ? 'Open sidebar' : 'Collapse sidebar'}
            >
              <div className="sidebar-brand-logo-box">
                <CheckSquare size={20} className="brand-logo-svg" />
              </div>
            </button>
            {!isEffectiveCollapsed && (
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
            title={isEffectiveCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={isEffectiveCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isEffectiveCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
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
          {!isEffectiveCollapsed && (
            <div className="sidebar-section-heading">MAIN NAVIGATION</div>
          )}
          <nav className="sidebar-menu-list">
            {mainItems.map(renderNavNode)}
          </nav>

          {/* Section 2: QUICK ACTIONS */}
          {quickItems.length > 0 && (
            <>
              {!isEffectiveCollapsed && (
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
          {!isEffectiveCollapsed && (
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

            {!isEffectiveCollapsed && (
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
