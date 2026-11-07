/**
 * Role-Based Navigation Configuration
 * Defines structured menu items for Admin, Manager, and Employee panels.
 * Organized into MAIN NAVIGATION and QUICK ACTIONS matching the modern dashboard standard.
 */
export const ROLE_NAVIGATION = {
  Admin: {
    main: [
      {
        id: 'admin-overview',
        label: 'Dashboard',
        icon: 'LayoutDashboard',
        view: 'admin',
      },
      {
        id: 'admin-employees',
        label: 'Members',
        icon: 'Users',
        view: 'employees',
      },
      {
        id: 'admin-tasks',
        label: 'Tasks',
        icon: 'CheckSquare',
        view: 'tasks',
      },
    ],
    quick: [
      {
        id: 'admin-attendance',
        label: 'Attendance',
        icon: 'Clock',
        view: 'attendance',
      },
      {
        id: 'admin-leaves',
        label: 'Leave Governance',
        icon: 'CalendarDays',
        view: 'admin-leaves',
        section: 'leave-management',
        badge: 'Admin',
      },
      {
        id: 'admin-departments',
        label: 'Departments',
        icon: 'Building2',
        view: 'admin-departments',
        section: 'departments-section',
      },
      {
        id: 'admin-announcements',
        label: 'Announcements',
        icon: 'Megaphone',
        view: 'announcements',
      },
      {
        id: 'admin-chat',
        label: 'Direct Messages',
        icon: 'MessageSquare',
        view: 'chat',
      },
    ],
  },

  Manager: {
    main: [
      {
        id: 'manager-overview',
        label: 'Team Dashboard',
        icon: 'LayoutDashboard',
        view: 'manager',
        tab: 'overview',
      },
      {
        id: 'manager-team',
        label: 'Members',
        icon: 'Users',
        view: 'manager',
        tab: 'team',
      },
      {
        id: 'manager-tasks',
        label: 'Tasks',
        icon: 'CheckSquare',
        view: 'tasks',
      },
    ],
    quick: [
      {
        id: 'manager-projects',
        label: 'Projects',
        icon: 'Briefcase',
        view: 'manager',
        tab: 'projects',
      },
      {
        id: 'manager-attendance',
        label: 'My Attendance',
        icon: 'Clock',
        view: 'manager',
        tab: 'attendance',
      },
      {
        id: 'manager-announcements',
        label: 'Announcements',
        icon: 'Megaphone',
        view: 'manager',
        tab: 'announcements',
      },
      {
        id: 'manager-chat',
        label: 'Direct Messages',
        icon: 'MessageSquare',
        view: 'manager',
        tab: 'chat',
      },
      {
        id: 'manager-leave',
        label: 'Leave & Approvals',
        icon: 'CalendarDays',
        view: 'manager',
        tab: 'leave',
        submenu: [
          { id: 'manager-leave-mine', label: 'My Leave Requests', subfilter: 'mine' },
          { id: 'manager-leave-team', label: 'Team Member Requests', subfilter: 'team' },
        ],
      },
      {
        id: 'manager-profile',
        label: 'Settings',
        icon: 'UserCheck',
        view: 'manager',
        tab: 'profile',
      },
    ],
  },

  Employee: {
    main: [
      {
        id: 'employee-dashboard',
        label: 'Dashboard',
        icon: 'LayoutDashboard',
        view: 'employee',
        tab: 'dashboard',
      },
      {
        id: 'employee-tasks',
        label: 'My Tasks',
        icon: 'CheckSquare',
        view: 'employee',
        tab: 'tasks',
      },
      {
        id: 'employee-projects',
        label: 'Projects',
        icon: 'FolderKanban',
        view: 'employee',
        tab: 'projects',
      },
    ],
    quick: [
      {
        id: 'employee-attendance',
        label: 'My Attendance',
        icon: 'Clock',
        view: 'employee',
        tab: 'attendance',
      },
      {
        id: 'employee-announcements',
        label: 'Announcements',
        icon: 'Megaphone',
        view: 'employee',
        tab: 'announcements',
      },
      {
        id: 'employee-chat',
        label: 'Direct Messages',
        icon: 'MessageSquare',
        view: 'employee',
        tab: 'chat',
      },
      {
        id: 'employee-leave',
        label: 'Leave & Quotas',
        icon: 'CalendarDays',
        view: 'employee',
        tab: 'leave',
      },
      {
        id: 'employee-taskboard',
        label: 'Task Board',
        icon: 'TrendingUp',
        view: 'tasks',
      },
      {
        id: 'employee-profile',
        label: 'Settings',
        icon: 'UserCheck',
        view: 'employee',
        tab: 'profile',
      },
    ],
  },
};

export const getNavigationForRole = (role) => {
  return ROLE_NAVIGATION[role] || ROLE_NAVIGATION.Employee;
};
