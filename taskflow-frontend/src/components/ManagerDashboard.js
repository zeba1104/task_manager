import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  AlertTriangle,
  Calendar,
  Check,
  ClipboardList,
  FileText,
  FolderPlus,
  Megaphone,
  UserRound,
  Users,
  X,
  XCircle,
  CalendarDays,
  ShieldAlert,
  Clock,
  History,
  Plus,
  RefreshCw,
  Sparkles,
  Download,
  Send,
  LogIn,
  LogOut,
  CheckCircle2,
  Palmtree,
  Bell,
  Activity,
  MessageSquare,
  Layers,
  Briefcase,
  CheckSquare,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import axios from '../api/axios';
import { clockIn, clockOut } from '../api/employeeApi';
import { FILE_BASE_URL } from '../api/axios';
import { createProject } from '../api/adminApi';
import { createTask, deleteTask, getTasks, updateTask } from '../api/taskApi';
import {
  getManagerOverview,
  getManagerProjects,
  getTasksForReview,
  reviewManagerLeave,
  reviewTaskSubmission,
} from '../api/managerApi';
import {
  applyLeaveRequest,
  getMyLeaveOverview,
  cancelMyLeaveRequest,
  getManagerTeamLeaves,
} from '../api/leaveApi';
import TaskForm from './TaskForm';
import TaskCard from './TaskCard';
import ManagerTeamManagement from './ManagerTeamManagement';
import ManagerProjectManagement from './ManagerProjectManagement';
import MyAttendance from './MyAttendance';
import AnnouncementsPage from './AnnouncementsPage';
import ChatPage from './ChatPage';
import HolidayCalendar from './HolidayCalendar';
import ManagerPayrollReview from './payroll/ManagerPayrollReview';
import SettingsView from './SettingsView';
import { getMyPayrolls } from '../api/payrollApi';
import Swal from '../utils/swalConfig';

const columns = [
  { status: 'pending', title: 'To Do' },
  { status: 'in-process', title: 'In Progress' },
  { status: 'in-review', title: 'In Review' },
  { status: 'completed', title: 'Completed' },
];

function formatTeamActivity(activity) {
  const actorName = activity.actor?.name || 'Team member';
  const action = (activity.action || '').toLowerCase();
  const targetType = (activity.targetType || '').toLowerCase();
  const targetName = (activity.targetName || '').trim();
  const details = activity.details || '';

  // Leave activity
  if (targetType.includes('leave') || action.includes('leave')) {
    const isApproved = action.includes('approv');
    const isRejected = action.includes('reject');
    const isApplied = action.includes('applied') || action.includes('request') || action.includes('submit');

    let title = 'Leave Request Activity';
    if (isApproved) title = 'Leave Request Approved';
    else if (isRejected) title = 'Leave Request Rejected';
    else if (isApplied) title = 'New Leave Application';

    const cleanSubject = targetName.replace(/^(leave\s*request|leaverequest)\s*/i, '').trim();
    let desc = '';
    if (isApproved) {
      desc = cleanSubject && cleanSubject.toLowerCase() !== actorName.toLowerCase()
        ? `${actorName} approved leave for ${cleanSubject}`
        : `${actorName} approved leave request`;
    } else if (isRejected) {
      desc = cleanSubject && cleanSubject.toLowerCase() !== actorName.toLowerCase()
        ? `${actorName} rejected leave for ${cleanSubject}`
        : `${actorName} rejected leave request`;
    } else {
      desc = `${actorName} submitted a leave request`;
    }

    return {
      type: 'leave',
      badgeClass: 'badge-leave',
      icon: Palmtree,
      title,
      description: desc,
      details,
      time: activity.createdAt,
    };
  }

  // Task activity
  if (targetType.includes('task') || action.includes('task')) {
    const isApproved = action.includes('approv');
    const isSubmitted = action.includes('submit');
    const isCreated = action.includes('creat');
    const isCompleted = action.includes('complet');

    let title = 'Task Update';
    if (isApproved) title = 'Task Approved & Accepted';
    else if (isSubmitted) title = 'Task Submitted for Review';
    else if (isCreated) title = 'New Task Assigned';
    else if (isCompleted) title = 'Task Marked Complete';

    const cleanTarget = targetName.replace(/^task\s*/i, '').trim();
    const cleanAction = action.replace(/\s*task\s*/gi, ' ').trim();
    const desc = `${actorName} ${cleanAction} "${cleanTarget}"`;

    return {
      type: 'task',
      badgeClass: isApproved ? 'badge-success' : 'badge-task',
      icon: isApproved ? CheckCircle2 : ClipboardList,
      title,
      description: desc,
      details,
      time: activity.createdAt,
    };
  }

  // Announcement activity
  if (targetType.includes('announcement') || action.includes('announc')) {
    return {
      type: 'announcement',
      badgeClass: 'badge-announcement',
      icon: Megaphone,
      title: 'Announcement Broadcast',
      description: `${actorName} published: "${targetName}"`,
      details,
      time: activity.createdAt,
    };
  }

  // Project activity
  if (targetType.includes('project') || action.includes('project')) {
    return {
      type: 'project',
      badgeClass: 'badge-project',
      icon: FolderPlus,
      title: 'Project Update',
      description: `${actorName} ${action} project "${targetName}"`,
      details,
      time: activity.createdAt,
    };
  }

  // Chat activity
  if (targetType.toLowerCase().includes('chat') || action.toLowerCase().includes('chat')) {
    const isApproved = action.includes('approv');
    const isDeclined = action.includes('declin') || action.includes('reject');
    return {
      type: 'chat',
      badgeClass: isApproved ? 'badge-success' : 'badge-general',
      icon: MessageSquare,
      title: isApproved ? 'Chat Request Approved' : (isDeclined ? 'Chat Request Declined' : 'Chat Permission Request'),
      description: `${actorName} ${action} "${targetName}"`,
      details,
      time: activity.createdAt,
    };
  }

  // Default activity
  return {
    type: 'general',
    badgeClass: 'badge-general',
    icon: Activity,
    title: 'Team Notification',
    description: `${actorName} ${action} ${targetType} ${targetName}`.replace(/\s+/g, ' ').trim(),
    details,
    time: activity.createdAt,
  };
}

function ManagerDashboard({ user, logout, setView, activeTab, onTabChange }) {
  const [tab, setTab] = useState(activeTab || 'overview'); // overview | team | projects | leave | profile

  useEffect(() => {
    if (activeTab && activeTab !== tab) {
      setTab(activeTab);
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const { updateUser } = useAuth();
  const [overview, setOverview] = useState(null);
  const [managerTodayAttendance, setManagerTodayAttendance] = useState(null);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [attendanceRefreshSignal, setAttendanceRefreshSignal] = useState(0);
  const [attendanceRefreshing, setAttendanceRefreshing] = useState(false);
  const [latestPaidSalary, setLatestPaidSalary] = useState(null);
  const [dismissedSalaryBannerIds, setDismissedSalaryBannerIds] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem('taskflow_dismissed_mgr_salary_banners') || '[]');
    } catch {
      return [];
    }
  });

  const dismissSalaryBanner = (id) => {
    setDismissedSalaryBannerIds((prev) => {
      const next = [...new Set([...prev, String(id)])];
      try {
        sessionStorage.setItem('taskflow_dismissed_mgr_salary_banners', JSON.stringify(next));
      } catch {
        // Ignore storage error
      }
      return next;
    });
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadManagerTodayAttendance = useCallback(async () => {
    try {
      const res = await axios.get('/attendance/mine');
      const today = new Date().toISOString().split('T')[0];
      const todayRec = (res.data || []).find((r) => r.date === today);
      setManagerTodayAttendance(todayRec || null);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadManagerTodayAttendance();
  }, [loadManagerTodayAttendance, attendanceRefreshSignal]);

  const handleManagerClockIn = async (isNextDay = false) => {
    try {
      await clockIn({ isNextDay, newSession: isNextDay });
      Swal.fire({
        title: isNextDay ? 'Clocked In for New Session' : 'Clocked In',
        text: 'Your clock-in timestamp has been recorded.',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false,
      });
      await loadManagerTodayAttendance();
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Could not clock in', 'error');
    }
  };

  const handleManagerClockOut = async () => {
    const res = await Swal.fire({
      title: 'Clock Out?',
      text: 'Are you ready to clock out and finish today\'s shift?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, Clock Out',
      confirmButtonColor: '#ef4444',
    });
    if (!res.isConfirmed) return;
    try {
      await clockOut(0);
      Swal.fire({
        title: 'Clocked Out',
        text: 'Your shift has been logged successfully.',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false,
      });
      await loadManagerTodayAttendance();
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Could not clock out', 'error');
    }
  };

  const getManagerElapsedSeconds = useCallback(() => {
    if (!managerTodayAttendance?.clockIn) return 0;
    if (managerTodayAttendance.clockOut) {
      const diff = Math.max(0, Math.round((new Date(managerTodayAttendance.clockOut).getTime() - new Date(managerTodayAttendance.clockIn).getTime()) / 1000));
      return Math.max(managerTodayAttendance.totalSeconds || 0, diff);
    }
    const elapsed = Math.max(0, Math.round((currentTime - new Date(managerTodayAttendance.clockIn).getTime()) / 1000));
    return Math.max(managerTodayAttendance.totalSeconds || 0, elapsed);
  }, [managerTodayAttendance, currentTime]);

  const formatManagerElapsedDuration = (seconds, isActive = false) => {
    if (!seconds || seconds <= 0) return '0h 0m';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (isActive) return `${h}h ${m}m ${s}s`;
    return `${h}h ${m}m`;
  };
  const [tasks, setTasks] = useState([]);
  const [taskStatusFilter, setTaskStatusFilter] = useState('all');
  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [action, setAction] = useState('');
  const [editingTask, setEditingTask] = useState(null);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [projectForm, setProjectForm] = useState({ name: '', description: '', deadline: '' });
  const [reviewTasks, setReviewTasks] = useState([]);
  const [reviewModalTask, setReviewModalTask] = useState(null);
  const [reviewFeedback, setReviewFeedback] = useState('');
  const [reviewBusy, setReviewBusy] = useState(false);

  // Leave Management State (Manager)
  const [leaveOverview, setLeaveOverview] = useState({
    leaveBalance: { annual: 12, sick: 6, casual: 4, maternity_paternity: 'As applicable' },
    leaveRequests: [],
    stats: { total: 0, pending: 0, approved: 0, rejected: 0, cancelled: 0 },
  });
  const [teamLeavesData, setTeamLeavesData] = useState({ teamLeaves: [], counts: {} });
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ leaveType: 'annual', startDate: '', endDate: '', reason: '' });
  const [leaveDocFile, setLeaveDocFile] = useState(null);
  const [calculatedDays, setCalculatedDays] = useState(1);
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);
  const [leaveHistoryModal, setLeaveHistoryModal] = useState({ open: false, leave: null });
  const [teamLeaveFilter, setTeamLeaveFilter] = useState('all');

  const formatLeaveTypeName = (type) => {
    const t = (type || '').toLowerCase();
    if (t === 'annual') return 'ANNUAL / EARNED LEAVE';
    if (t === 'sick') return 'SICK LEAVE';
    if (t === 'casual' || t === 'personal' || t === 'other') return 'CASUAL LEAVE';
    if (t === 'maternity_paternity' || t.includes('maternity')) return 'MATERNITY / PATERNITY LEAVE';
    return (type || 'LEAVE').toUpperCase() + ' LEAVE';
  };

  const [dismissedManagerLeaveBanners, setDismissedManagerLeaveBanners] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem('taskflow_dismissed_mgr_leave_banners') || '[]');
    } catch {
      return [];
    }
  });

  const dismissManagerLeaveBanner = (id) => {
    setDismissedManagerLeaveBanners((prev) => {
      const next = [...new Set([...prev, String(id)])];
      try {
        sessionStorage.setItem('taskflow_dismissed_mgr_leave_banners', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const recentManagerLeaveDecision = useMemo(() => {
    if (!leaveOverview?.leaveRequests?.length) return null;
    const decided = leaveOverview.leaveRequests.filter(
      (l) => (l.status === 'approved' || l.status === 'rejected')
    );
    if (!decided.length) return null;
    decided.sort((a, b) => new Date(b.reviewedAt || b.updatedAt || b.approvedAt || b.rejectedAt || b.createdAt) - new Date(a.reviewedAt || a.updatedAt || a.approvedAt || a.rejectedAt || a.createdAt));
    const latest = decided[0];
    if (dismissedManagerLeaveBanners.includes(String(latest._id))) return null;
    const decisionTime = new Date(latest.reviewedAt || latest.updatedAt || latest.approvedAt || latest.rejectedAt || latest.createdAt).getTime();
    if (Date.now() - decisionTime <= 14 * 24 * 60 * 60 * 1000) {
      return latest;
    }
    return null;
  }, [leaveOverview, dismissedManagerLeaveBanners]);

  const loadManagerLeaves = async () => {
    try {
      const [mineRes, teamRes] = await Promise.all([
        getMyLeaveOverview(),
        getManagerTeamLeaves(),
      ]);
      setLeaveOverview(mineRes.data);
      setTeamLeavesData(teamRes.data);
    } catch (err) {
      console.error('Failed to load manager leave overview:', err);
    }
  };

  useEffect(() => {
    loadManagerLeaves();
  }, []);

  useEffect(() => {
    if (tab === 'leave') {
      loadManagerLeaves();
    }
  }, [tab]);

  // Compute total days automatically when start or end date changes
  useEffect(() => {
    if (leaveForm.startDate && leaveForm.endDate) {
      const start = new Date(leaveForm.startDate);
      const end = new Date(leaveForm.endDate);
      if (end >= start) {
        let count = 0;
        let cur = new Date(start);
        while (cur <= end) {
          const day = cur.getDay();
          if (day !== 0 && day !== 6) count++;
          cur.setDate(cur.getDate() + 1);
        }
        setCalculatedDays(Math.max(1, count));
      } else {
        setCalculatedDays(0);
      }
    } else {
      setCalculatedDays(1);
    }
  }, [leaveForm.startDate, leaveForm.endDate]);

  const handleApplyLeaveSubmit = async (e) => {
    e.preventDefault();
    if (calculatedDays <= 0) {
      Swal.fire({ title: 'Invalid Dates', text: 'End date must be on or after start date.', icon: 'warning' });
      return;
    }
    setLeaveSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('leaveType', leaveForm.leaveType);
      formData.append('startDate', leaveForm.startDate);
      formData.append('endDate', leaveForm.endDate);
      formData.append('reason', leaveForm.reason);
      if (leaveDocFile) {
        formData.append('document', leaveDocFile);
      }

      await applyLeaveRequest(formData);
      Swal.fire({
        title: 'Leave Request Submitted',
        text: 'Your request has been routed to Admin for hierarchical approval. You will receive an email once decision is made.',
        icon: 'success'
      });
      setLeaveModalOpen(false);
      setLeaveForm({ leaveType: 'annual', startDate: '', endDate: '', reason: '' });
      setLeaveDocFile(null);
      await loadManagerLeaves();
    } catch (err) {
      Swal.fire({ title: 'Application Failed', text: err.response?.data?.message || 'Could not submit leave request.', icon: 'error' });
    } finally {
      setLeaveSubmitting(false);
    }
  };

  const handleCancelLeave = async (leaveId) => {
    const result = await Swal.fire({
      title: 'Cancel Leave Request?',
      text: 'Are you sure you want to cancel this pending leave request?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, Cancel Request',
      confirmButtonColor: '#dc2626',
    });
    if (!result.isConfirmed) return;

    try {
      await cancelMyLeaveRequest(leaveId);
      Swal.fire({ title: 'Request Cancelled', text: 'Your leave request has been cancelled.', icon: 'success' });
      await loadManagerLeaves();
    } catch (err) {
      Swal.fire({ title: 'Error', text: err.response?.data?.message || 'Could not cancel request.', icon: 'error' });
    }
  };

  const refreshOverview = async () => {
    setLoading(true);
    setError('');
    try {
      const [overviewResponse, tasksResponse, projectsResponse, reviewsResponse, payrollResponse] = await Promise.all([
        getManagerOverview(),
        getTasks().catch(() => ({ data: [] })),
        getManagerProjects().catch(() => ({ data: [] })),
        getTasksForReview().catch(() => ({ data: [] })),
        getMyPayrolls().catch(() => ({ data: { data: [] } })),
      ]);
      setOverview(overviewResponse.data);
      setTasks(tasksResponse.data || []);
      setProjects(projectsResponse.data || []);
      setEmployees(overviewResponse.data?.employees || []);
      setReviewTasks(reviewsResponse.data || []);
      const payrolls = payrollResponse.data?.data || [];
      const latestPaid = payrolls.find((p) => p.status === 'Paid') || null;
      setLatestPaidSalary(latestPaid);
    } catch (requestError) {
      const errorMsg = requestError.response?.data?.message ||
        (requestError.request
          ? 'Backend server connection error. Please ensure backend is running on port 5000 and your IP address is whitelisted in MongoDB Atlas.'
          : 'Could not load your assigned team data.');
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleReviewDecision = async (decision) => {
    if (!reviewModalTask) return;
    if (decision === 'request-changes' && !reviewFeedback.trim()) {
      Swal.fire({
        title: 'Feedback Required',
        text: 'Please enter notes explaining what changes the employee needs to make before resubmitting.',
        icon: 'warning',
      });
      return;
    }
    setReviewBusy(true);
    try {
      await reviewTaskSubmission(reviewModalTask._id, { action: decision, feedback: reviewFeedback });
      Swal.fire({
        title: decision === 'approve' ? 'Task Approved' : 'Modifications Requested',
        text: decision === 'approve' ? 'Task marked as completed.' : 'Employee notified to modify and resubmit.',
        icon: 'success',
        timer: 1600,
        showConfirmButton: false,
      });
      setReviewModalTask(null);
      setReviewFeedback('');
      await refreshOverview();
    } catch (err) {
      Swal.fire({ title: 'Error', text: err.response?.data?.message || 'Could not review task', icon: 'error' });
    } finally {
      setReviewBusy(false);
    }
  };

  const handleManagerDecideLeave = async (request, status) => {
    try {
      let reason = '';
      if (status === 'rejected') {
        const { value: promptReason } = await Swal.fire({
          title: 'Reject Employee Leave',
          input: 'textarea',
          inputLabel: 'Rejection Reason',
          inputPlaceholder: 'Explain reason for rejecting this leave request...',
          inputValidator: (val) => !val?.trim() && 'A rejection reason is required.',
          showCancelButton: true,
          confirmButtonText: 'Confirm Rejection',
          confirmButtonColor: '#dc2626',
        });
        if (!promptReason) return;
        reason = promptReason;
      }
      await reviewManagerLeave(request._id, status, reason);
      Swal.fire({
        title: status === 'approved' ? 'Leave Approved' : 'Leave Rejected',
        text: `Employee leave request has been ${status}.`,
        icon: 'success'
      });
      await loadManagerLeaves();
      await refreshOverview();
    } catch (err) {
      Swal.fire({ title: 'Error', text: err.response?.data?.message || 'Could not update leave request.', icon: 'error' });
    }
  };

  useEffect(() => {
    refreshOverview();
  }, []);

  const createOrUpdateTask = async (data) => {
    try {
      if (editingTask) await updateTask(editingTask._id, data);
      else await createTask(data);
      setTaskFormOpen(false);
      setEditingTask(null);
      await refreshOverview();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not save task.');
    }
  };

  const changeTaskStatus = async (id, status) => {
    try {
      await updateTask(id, { status });
      await refreshOverview();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not update task.');
    }
  };

  const removeTask = async (id) => {
    const result = await Swal.fire({ title: 'Delete task?', text: 'This action cannot be undone.', icon: 'warning', showCancelButton: true, confirmButtonText: 'Delete' });
    if (!result.isConfirmed) return;
    try {
      await deleteTask(id);
      await refreshOverview();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not delete task.');
    }
  };

  const submitQuickAction = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (action === 'project') await createProject({ ...projectForm, department: overview?.department?._id, manager: user.id });
      setAction('');
      await refreshOverview();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not complete this action.');
    } finally {
      setBusy(false);
    }
  };

  const decideLeave = async (request, status) => {
    try {
      await reviewManagerLeave(request._id, status);
      await refreshOverview();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not review this leave request.');
    }
  };

  const totals = overview?.stats || {};
  const taskStats = overview?.stats || {};

  return (
    <div className="dashboard-page manager-dashboard">
      {/* Clean Page Title Row (Announcements & Chat have their own dedicated rich headers) */}
      {tab !== 'announcements' && tab !== 'chat' && tab !== 'holidays' && tab !== 'profile' && (
        <div className="page-header-row">
          <div className="page-header-info">
            <div className="page-title-icon-box">
              {tab === 'profile' ? <UserRound size={22} /> :
               tab === 'team' ? <Users size={22} /> :
               tab === 'projects' ? <Briefcase size={22} /> :
               tab === 'leave' ? <CalendarDays size={22} /> :
               tab === 'attendance' ? <Clock size={22} /> :
               <Layers size={22} />}
            </div>
            <div>
              <h2 className="page-main-title">
                {tab === 'profile' ? 'My Profile & Department' :
                 tab === 'team' ? 'Team Management' :
                 tab === 'projects' ? 'Project Management' :
                 tab === 'leave' ? 'My Leave & Team Leaves' :
                 tab === 'attendance' ? 'My Everyday Attendance & Working Hours' : 'Team Overview'}
              </h2>
              <p className="page-subtitle">
                {tab === 'profile' ? 'Personal profile, department assignment, and manager credentials.' :
                 tab === 'team' ? 'Monitor team members, assign tasks, and supervise daily performance.' :
                 tab === 'projects' ? 'Supervise ongoing team deliverables, milestones, and project documents.' :
                 tab === 'leave' ? 'Review and manage team leave requests, sick leaves, and personal quotas.' :
                 tab === 'attendance' ? 'Daily check-in logs, break tracking, and recorded work duration.' :
                 'Operational snapshot of team capacity, task completion, and active workflows.'}
              </p>
            </div>
          </div>
          <div className="page-header-actions">
            {tab === 'attendance' && (
              <button
                type="button"
                className="btn-secondary btn-small attendance-refresh-btn"
                onClick={() => {
                  setAttendanceRefreshing(true);
                  setAttendanceRefreshSignal((s) => s + 1);
                  setTimeout(() => setAttendanceRefreshing(false), 800);
                }}
                disabled={attendanceRefreshing}
                title="Refresh attendance records"
              >
                <RefreshCw size={13} className={attendanceRefreshing ? 'spinning' : ''} />
                <span>{attendanceRefreshing ? 'Updating...' : 'Refresh Records'}</span>
              </button>
            )}
            <span className="header-date-badge">
              <Calendar size={13} /> {new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        </div>
      )}

      {error && (
        <div className="error-text" role="alert" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <span>{error}</span>
          <button type="button" className="btn-ghost btn-small" onClick={refreshOverview} style={{ padding: '4px 12px' }}>
            Retry Connection
          </button>
        </div>
      )}
      {loading && !overview && tab === 'overview' && (
        <p className="manager-loading">Loading assigned team data...</p>
      )}

      {/* VIEW: OVERVIEW */}
      {tab === 'overview' && (
        <>
          {/* Celebratory Manager Salary Credited via Razorpay Banner */}
          {latestPaidSalary && !dismissedSalaryBannerIds.includes(String(latestPaidSalary._id)) && (
            <div className="payroll-credited-dashboard-card">
              <div className="credited-card-icon-wrap">
                <CheckCircle2 size={24} className="text-emerald" />
              </div>
              <div className="credited-card-body">
                <div className="credited-card-pill-row">
                  <span className="credited-status-tag">💰 MANAGER SALARY CREDITED VIA RAZORPAY</span>
                  <span className="credited-period-tag">{latestPaidSalary.periodLabel}</span>
                </div>
                <h3 className="credited-card-title">
                  ₹{Number(latestPaidSalary.netSalary).toLocaleString('en-IN')} Credited Successfully
                </h3>
                <p className="credited-card-subtitle">
                  Your {latestPaidSalary.periodLabel} executive manager compensation has been disbursed to your bank account via Razorpay.
                  {latestPaidSalary.payout?.utr && (
                    <span> Ref / UTR: <strong>{latestPaidSalary.payout.utr}</strong></span>
                  )}
                </p>
              </div>
              <div className="credited-card-actions">
                <button
                  type="button"
                  onClick={() => {
                    setTab('payroll');
                    if (onTabChange) onTabChange('payroll');
                  }}
                  className="btn-view-payslip-primary"
                >
                  View Payroll Details →
                </button>
                <button
                  type="button"
                  onClick={() => dismissSalaryBanner(latestPaidSalary._id)}
                  className="btn-dismiss-credited"
                  title="Dismiss alert"
                  aria-label="Dismiss alert"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Prominent Manager Personal Leave Decision Alert Banner */}
          {recentManagerLeaveDecision && (
            <div className={`emp-leave-decision-alert alert-${recentManagerLeaveDecision.status}`}>
              <div className="alert-icon-side">
                {recentManagerLeaveDecision.status === 'approved' ? (
                  <CheckCircle2 size={22} className="text-emerald" />
                ) : (
                  <XCircle size={22} className="text-rose" />
                )}
              </div>
              <div className="alert-body-content">
                <div className="alert-header-row">
                  <span className="alert-title-text">
                    Personal Leave Request {recentManagerLeaveDecision.status === 'approved' ? 'Approved' : 'Rejected'}
                  </span>
                  <span className={`alert-status-pill pill-${recentManagerLeaveDecision.status}`}>
                    {recentManagerLeaveDecision.status.toUpperCase()}
                  </span>
                  <span className="alert-date-time">
                    {new Date(recentManagerLeaveDecision.reviewedAt || recentManagerLeaveDecision.updatedAt || recentManagerLeaveDecision.approvedAt || recentManagerLeaveDecision.rejectedAt || recentManagerLeaveDecision.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                <p className="alert-desc-text">
                  Your request for <strong>{formatLeaveTypeName(recentManagerLeaveDecision.leaveType)}</strong> ({new Date(recentManagerLeaveDecision.startDate).toLocaleDateString()} &mdash; {new Date(recentManagerLeaveDecision.endDate).toLocaleDateString()}, {recentManagerLeaveDecision.totalDays || 1} {recentManagerLeaveDecision.totalDays === 1 ? 'day' : 'days'}) was <strong>{recentManagerLeaveDecision.status}</strong> by Executive Administration.
                  {recentManagerLeaveDecision.status === 'rejected' && recentManagerLeaveDecision.rejectionReason && (
                    <span className="alert-reason-block">
                      <strong>Reason:</strong> {recentManagerLeaveDecision.rejectionReason}
                    </span>
                  )}
                </p>
              </div>
              <div className="alert-action-side">
                <button
                  type="button"
                  className="btn-alert-redirect"
                  onClick={() => {
                    setTab('leave');
                    if (onTabChange) onTabChange('leave');
                  }}
                >
                  View in Leave &amp; Quotas &rarr;
                </button>
                <button
                  type="button"
                  className="btn-alert-dismiss"
                  onClick={() => dismissManagerLeaveBanner(recentManagerLeaveDecision._id)}
                  title="Dismiss alert"
                  aria-label="Dismiss alert"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Manager's Personal Clock In / Clock Out Hero Section */}
          {(() => {
            const isManagerOnLeave = Boolean(
              managerTodayAttendance?.isOnLeave ||
              managerTodayAttendance?.status === 'on-leave' ||
              managerTodayAttendance?.status === 'On Leave' ||
              managerTodayAttendance?.leaveDetails
            );
            const isWorkingNow = Boolean(managerTodayAttendance?.clockIn && !managerTodayAttendance?.clockOut);
            const isCompleted = Boolean(managerTodayAttendance?.clockIn && managerTodayAttendance?.clockOut);
            const elapsedSecs = getManagerElapsedSeconds();
            const durationStr = formatManagerElapsedDuration(elapsedSecs, isWorkingNow);
            const leaveInfo = managerTodayAttendance?.leaveDetails || {};

            const cardClass = isManagerOnLeave
              ? 'hero-leave'
              : isWorkingNow
              ? 'hero-active'
              : isCompleted
              ? 'hero-completed'
              : 'hero-pending';

            return (
              <div className={`my-attendance-hero-card dashboard-clock-card ${cardClass}`}>
                <div className="hero-status-content">
                  <div className="hero-status-badge-wrap">
                    {isManagerOnLeave ? (
                      <span className="leave-status-pill">
                        <Palmtree size={13} /> On Approved Leave
                      </span>
                    ) : isWorkingNow ? (
                      <span className="live-status-pill">
                        <span className="live-pulse-dot" /> Shift Active
                      </span>
                    ) : isCompleted ? (
                      <span className="completed-status-pill">
                        <CheckCircle2 size={13} /> Shift Completed
                      </span>
                    ) : (
                      <span className="pending-status-pill">
                        <Clock size={13} /> Ready to Clock In
                      </span>
                    )}
                    <span className="hero-date-text">
                      Today: {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </div>

                  {isManagerOnLeave ? (
                    <div className="hero-times-row hero-leave-details-row">
                      <div className="hero-time-col">
                        <span className="hero-time-label">Leave Category</span>
                        <strong className="hero-time-val text-purple">
                          {leaveInfo.leaveType ? `${leaveInfo.leaveType.toUpperCase()} LEAVE` : 'Approved Leave'}
                        </strong>
                      </div>
                      <div className="hero-time-divider" />
                      <div className="hero-time-col">
                        <span className="hero-time-label">Attendance Record</span>
                        <strong className="hero-time-val text-emerald">
                          <CheckCircle2 size={14} /> Excused (On Leave)
                        </strong>
                      </div>
                      <div className="hero-time-divider" />
                      <div className="hero-time-col">
                        <span className="hero-time-label">Approved Duration</span>
                        <strong className="hero-time-val">
                          {leaveInfo.totalDays ? `${leaveInfo.totalDays} Day${leaveInfo.totalDays > 1 ? 's' : ''}` : '1 Day (Today)'}
                        </strong>
                      </div>
                    </div>
                  ) : (
                    <div className="hero-times-row">
                      <div className="hero-time-col">
                        <span className="hero-time-label">Clock In</span>
                        <strong className="hero-time-val">
                          {managerTodayAttendance?.clockIn ? new Date(managerTodayAttendance.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--'}
                        </strong>
                      </div>
                      <div className="hero-time-divider" />
                      <div className="hero-time-col">
                        <span className="hero-time-label">Clock Out</span>
                        <strong className="hero-time-val">
                          {managerTodayAttendance?.clockOut ? new Date(managerTodayAttendance.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--'}
                        </strong>
                      </div>
                      <div className="hero-time-divider" />
                      <div className="hero-time-col">
                        <span className="hero-time-label">Today's Duration</span>
                        <strong className={`hero-time-val ${isWorkingNow ? 'text-emerald' : ''}`}>
                          {durationStr}
                        </strong>
                      </div>
                    </div>
                  )}
                </div>

                <div className="hero-action-buttons">
                  {isManagerOnLeave ? (
                    <div className="leave-action-group">
                      <div className="leave-excused-chip">
                        <CheckCircle2 size={16} className="text-emerald" />
                        <span>Excused from Clock-in</span>
                      </div>
                      {!managerTodayAttendance?.clockIn && (
                        <button
                          type="button"
                          className="btn-secondary btn-small btn-clock-override"
                          onClick={() => handleManagerClockIn(false)}
                          title="Click if you need to clock in and work during your leave"
                        >
                          <LogIn size={13} />
                          <span>Clock In Anyway</span>
                        </button>
                      )}
                    </div>
                  ) : !managerTodayAttendance?.clockIn ? (
                    <button
                      type="button"
                      className="btn-clock-action btn-clock-in"
                      onClick={() => handleManagerClockIn(false)}
                      title="Clock in for today's work"
                    >
                      <LogIn size={16} />
                      <span>Clock In Now</span>
                    </button>
                  ) : isWorkingNow ? (
                    <button
                      type="button"
                      className="btn-clock-action btn-clock-out"
                      onClick={handleManagerClockOut}
                      title="Clock out and complete today's shift"
                    >
                      <LogOut size={16} />
                      <span>Clock Out Now</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-clock-action btn-clock-reopen"
                      onClick={() => handleManagerClockIn(true)}
                      title="Clock in for next day or new session"
                    >
                      <RefreshCw size={14} />
                      <span>Clock In for Next Day</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Top Stat Cards - Grid */}
          <div className="manager-stat-grid">
            <div className="dashboard-stat-card">
              <div className="stat-card-header">
                <div className="stat-icon-bubble bubble-indigo">
                  <Users size={20} strokeWidth={2.2} />
                </div>
              </div>
              <div className="stat-card-content">
                <span className="stat-card-value">{totals.employees || 0}</span>
                <span className="stat-card-label">Assigned employees</span>
                <span className="stat-card-subtitle">Team members</span>
              </div>
            </div>

            <div className="dashboard-stat-card">
              <div className="stat-card-header">
                <div className="stat-icon-bubble bubble-cyan">
                  <Layers size={20} strokeWidth={2.2} />
                </div>
              </div>
              <div className="stat-card-content">
                <span className="stat-card-value">{totals.teams || 0}</span>
                <span className="stat-card-label">Teams</span>
                <span className="stat-card-subtitle">Managed squads</span>
              </div>
            </div>

            <div className="dashboard-stat-card is-clickable" onClick={() => setView('tasks')} role="button" tabIndex={0} title="View Projects">
              <div className="stat-card-header">
                <div className="stat-icon-bubble bubble-orange">
                  <Briefcase size={20} strokeWidth={2.2} />
                </div>
                <span className="stat-card-arrow" title="View details">→</span>
              </div>
              <div className="stat-card-content">
                <span className="stat-card-value">{totals.projects || 0}</span>
                <span className="stat-card-label">Assigned projects</span>
                <span className="stat-card-subtitle">Active projects</span>
              </div>
            </div>

            <div className="dashboard-stat-card is-clickable" onClick={() => setView('tasks')} role="button" tabIndex={0} title="View Task Management Board">
              <div className="stat-card-header">
                <div className="stat-icon-bubble bubble-blue">
                  <CheckSquare size={20} strokeWidth={2.2} />
                </div>
                <span className="stat-card-arrow" title="View tasks">→</span>
              </div>
              <div className="stat-card-content">
                <span className="stat-card-value">{totals.tasks || 0}</span>
                <span className="stat-card-label">Assigned tasks</span>
                <span className="stat-card-subtitle">Across all teams</span>
              </div>
            </div>

            <div className="dashboard-stat-card is-clickable" onClick={() => setView('tasks')} role="button" tabIndex={0} title="View Task Management Board">
              <div className="stat-card-header">
                <div className="stat-icon-bubble bubble-amber">
                  <Clock size={20} strokeWidth={2.2} />
                </div>
                <span className="stat-card-arrow" title="View tasks">→</span>
              </div>
              <div className="stat-card-content">
                <span className="stat-card-value">{taskStats.pendingTasks || 0}</span>
                <span className="stat-card-label">Pending</span>
                <span className="stat-card-subtitle">To do backlog</span>
              </div>
            </div>

            <div className="dashboard-stat-card is-clickable" onClick={() => setView('tasks')} role="button" tabIndex={0} title="View Task Management Board">
              <div className="stat-card-header">
                <div className="stat-icon-bubble bubble-sky">
                  <TrendingUp size={20} strokeWidth={2.2} />
                </div>
                <span className="stat-card-arrow" title="View tasks">→</span>
              </div>
              <div className="stat-card-content">
                <span className="stat-card-value">{taskStats.inProgressTasks || 0}</span>
                <span className="stat-card-label">In progress</span>
                <span className="stat-card-subtitle">Being worked on</span>
              </div>
            </div>

            <div className="dashboard-stat-card is-clickable" onClick={() => setView('tasks')} role="button" tabIndex={0} title="View Task Management Board">
              <div className="stat-card-header">
                <div className="stat-icon-bubble bubble-emerald">
                  <CheckCircle2 size={20} strokeWidth={2.2} />
                </div>
                <span className="stat-card-arrow" title="View tasks">→</span>
              </div>
              <div className="stat-card-content">
                <span className="stat-card-value">{taskStats.completedTasks || 0}</span>
                <span className="stat-card-label">Completed</span>
                <span className="stat-card-subtitle">Successfully done</span>
              </div>
            </div>

            <div className="dashboard-stat-card is-clickable" onClick={() => setView('tasks')} role="button" tabIndex={0} title="View Task Management Board">
              <div className="stat-card-header">
                <div className="stat-icon-bubble bubble-rose">
                  <AlertTriangle size={20} strokeWidth={2.2} />
                </div>
                <span className="stat-card-arrow" title="View tasks">→</span>
              </div>
              <div className="stat-card-content">
                <span className="stat-card-value">{taskStats.overdueTasks || 0}</span>
                <span className="stat-card-label">Overdue</span>
                <span className="stat-card-subtitle">Needs attention</span>
              </div>
            </div>
          </div>

          <section className="manager-attendance-summary">
            <header>
              <h3>Today's team attendance</h3>
              <span>{overview?.isDepartmentHead ? 'Department scope' : 'Direct reports'}</span>
            </header>
            <div className="attendance-summary-grid">
              <div><span className="attendance-summary-dot present" /><strong>{overview?.attendanceSummary?.present || 0}</strong><span>Present</span></div>
              <div><span className="attendance-summary-dot absent" /><strong>{overview?.attendanceSummary?.absent || 0}</strong><span>Absent</span></div>
              <div><span className="attendance-summary-dot late" /><strong>{overview?.attendanceSummary?.late || 0}</strong><span>Late</span></div>
              <div><span className="attendance-summary-dot leave" /><strong>{overview?.attendanceSummary?.onLeave || 0}</strong><span>On leave</span></div>
            </div>
          </section>

          <section className="dashboard-quick-actions-bar" aria-label="Manager quick actions">
            <div className="quick-actions-info">
              <h3>Quick actions</h3>
              <p>Team management and workflow shortcuts.</p>
            </div>
            <div className="quick-actions-list">
              <button
                type="button"
                className="action-pill-btn action-pill-primary"
                onClick={() => { setEditingTask(null); setAction(''); setTaskFormOpen(true); }}
              >
                <ClipboardList size={15} />
                <span>Assign task</span>
              </button>
              <button
                type="button"
                className="action-pill-btn action-pill-default"
                onClick={() => setAction('project')}
              >
                <FolderPlus size={15} />
                <span>Create project</span>
              </button>
              <button
                type="button"
                className="action-pill-btn action-pill-default"
                onClick={() => setView('tasks')}
              >
                <CheckSquare size={15} />
                <span>Task Board</span>
              </button>
              <button
                type="button"
                className="action-pill-btn action-pill-default"
                onClick={() => setView('attendance')}
              >
                <Clock size={15} />
                <span>Team Attendance</span>
              </button>
              <button
                type="button"
                className="action-pill-btn action-pill-default"
                onClick={() => setView('announcements')}
              >
                <Megaphone size={15} />
                <span>Announcements</span>
              </button>
            </div>
          </section>

          {taskFormOpen && (
            <section className="manager-task-form">
              <header>
                <h3>{editingTask ? 'Edit task' : 'Assign task'}</h3>
                <button className="icon-btn" onClick={() => { setTaskFormOpen(false); setEditingTask(null); }} aria-label="Close task form">
                  <X size={18} />
                </button>
              </header>
              <TaskForm
                initialData={editingTask}
                onSubmit={createOrUpdateTask}
                onCancel={() => { setTaskFormOpen(false); setEditingTask(null); }}
                employees={employees}
                projects={projects}
                userRole="Manager"
              />
            </section>
          )}

          {action === 'project' && (
            <div
              className="admin-modal-backdrop"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) setAction('');
              }}
            >
              <section className="admin-action-modal modern-action-modal" role="dialog" aria-modal="true">
                <header className="admin-modal-header">
                  <div className="admin-modal-title-wrap">
                    <div className="admin-modal-icon-badge badge-project">
                      <FolderPlus size={22} />
                    </div>
                    <div>
                      <h2 className="admin-modal-title">Create Project</h2>
                      <p className="admin-modal-subtitle">
                        Initialize a project workspace and assign deliverable milestones.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="admin-modal-close-btn"
                    onClick={() => setAction('')}
                    aria-label="Close dialog"
                  >
                    <X size={18} />
                  </button>
                </header>

                <form onSubmit={submitQuickAction} className="admin-modal-form">
                  <div className="admin-form-field">
                    <label htmlFor="mgr-action-proj-name" className="admin-field-label">
                      Project Name <span className="req">*</span>
                    </label>
                    <input
                      id="mgr-action-proj-name"
                      className="admin-field-control"
                      autoFocus
                      placeholder="e.g. Website Redesign & Optimization"
                      value={projectForm.name}
                      onChange={(event) => setProjectForm({ ...projectForm, name: event.target.value })}
                      required
                    />
                  </div>

                  <div className="admin-form-field">
                    <label htmlFor="mgr-action-proj-desc" className="admin-field-label">
                      Description
                    </label>
                    <textarea
                      id="mgr-action-proj-desc"
                      className="admin-field-control admin-textarea-control"
                      rows={3}
                      placeholder="Scope, key deliverables, and requirements..."
                      value={projectForm.description}
                      onChange={(event) => setProjectForm({ ...projectForm, description: event.target.value })}
                    />
                  </div>

                  <div className="admin-form-field">
                    <label htmlFor="mgr-action-proj-deadline" className="admin-field-label">
                      Target Deadline
                    </label>
                    <input
                      id="mgr-action-proj-deadline"
                      type="date"
                      className="admin-field-control"
                      value={projectForm.deadline}
                      onChange={(event) => setProjectForm({ ...projectForm, deadline: event.target.value })}
                    />
                  </div>

                  <footer className="admin-modal-footer">
                    <button type="button" className="btn-modal-cancel" onClick={() => setAction('')}>
                      Cancel
                    </button>
                    <button type="submit" className="btn-modal-primary" disabled={busy}>
                      {busy ? (
                        <>
                          <RefreshCw size={15} className="spin-icon" style={{ marginRight: '6px' }} />
                          Saving...
                        </>
                      ) : (
                        <>
                          <FolderPlus size={15} style={{ marginRight: '6px' }} />
                          Create Project
                        </>
                      )}
                    </button>
                  </footer>
                </form>
              </section>
            </div>
          )}

          <div className="manager-overview-grid">
            <section className="admin-overview-panel">
              <header><h3>Project progress</h3><span>{overview?.projects?.length || 0} assigned</span></header>
              {overview?.projects?.length ? overview.projects.map((project) => (
                <div className="project-progress-row" key={project._id}>
                  <div className="project-progress-heading"><strong>{project.name}</strong><span>{project.progress}%</span></div>
                  <div className="project-progress-track"><span style={{ width: `${project.progress}%` }} /></div>
                  <small>{project.completedTasks}/{project.taskCount} tasks · deadline {project.deadline ? new Date(project.deadline).toLocaleDateString() : 'not set'}</small>
                </div>
              )) : <p className="admin-empty-state">No assigned projects.</p>}
            </section>

            <section className="admin-overview-panel">
              <header><h3>Employee task completion</h3><span>{overview?.employeeTaskStats?.length || 0} team members</span></header>
              {overview?.employeeTaskStats?.length ? overview.employeeTaskStats.map((employee) => (
                <div className="project-progress-row" key={employee.id}>
                  <div className="project-progress-heading"><strong>{employee.name}</strong><span>{employee.completionRate}% · {employee.completedTasks}/{employee.taskCount}</span></div>
                  <div className="project-progress-track"><span style={{ width: `${employee.completionRate}%` }} /></div>
                </div>
              )) : <p className="admin-empty-state">No team task data.</p>}
            </section>

            <section className="admin-overview-panel">
              <header><h3>Pending leave requests</h3><span>{overview?.pendingLeaveRequests?.length || 0}</span></header>
              {overview?.pendingLeaveRequests?.length ? overview.pendingLeaveRequests.map((request) => (
                <article className="leave-request-row" key={request._id}>
                  <div>
                    <strong>{request.user?.name}</strong>
                    <span>{request.leaveType} · {new Date(request.startDate).toLocaleDateString()} – {new Date(request.endDate).toLocaleDateString()}</span>
                  </div>
                  <div className="leave-request-actions">
                    <button className="leave-approve" onClick={() => decideLeave(request, 'approved')} aria-label="Approve leave"><Check size={15} /></button>
                    <button className="leave-reject" onClick={() => decideLeave(request, 'rejected')} aria-label="Reject leave"><X size={15} /></button>
                  </div>
                </article>
              )) : <p className="admin-empty-state">No requests awaiting review.</p>}
            </section>

            <section className="admin-overview-panel">
              <header>
                <h3 style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <ClipboardList size={16} color="#6366f1" /> Task Submissions for Review
                </h3>
                <span>{reviewTasks.length} submitted</span>
              </header>
              {reviewTasks.length ? reviewTasks.map((t) => (
                <article className="leave-request-row" key={t._id} style={{ alignItems: 'flex-start' }}>
                  <div>
                    <strong>{t.title}</strong>
                    <span>Employee: <b>{t.user?.name}</b> {t.project ? `· Project: ${t.project}` : ''}</span>
                    {t.submissionNotes && (
                      <p style={{ margin: '4px 0', fontSize: '12px', color: 'var(--text-muted, #64748b)' }}>
                        Notes: {t.submissionNotes}
                      </p>
                    )}
                    <small style={{ color: t.reviewStatus === 'changes-requested' ? '#d97706' : '#10b981' }}>
                      Status: {t.reviewStatus === 'changes-requested' ? 'Modifications Requested' : 'Submitted for Review'}
                    </small>
                  </div>
                  <div className="leave-request-actions">
                    <button
                      type="button"
                      className="btn-primary btn-small"
                      onClick={() => { setReviewModalTask(t); setReviewFeedback(''); }}
                      style={{ padding: '4px 10px', fontSize: '12px' }}
                    >
                      Review
                    </button>
                  </div>
                </article>
              )) : <p className="admin-empty-state">No task submissions awaiting manager review.</p>}
            </section>

            <section className="admin-overview-panel">
              <header><h3>Upcoming deadlines</h3><span>Projects and tasks</span></header>
              {overview?.upcomingDeadlines?.length ? (
                <ul className="manager-deadline-list">
                  {overview.upcomingDeadlines.map((deadline, index) => (
                    <li key={`${deadline.type}-${deadline.name}-${index}`}>
                      <span className="deadline-type">{deadline.type}</span>
                      <strong>{deadline.name}</strong>
                      <time>{new Date(deadline.date).toLocaleDateString()}</time>
                    </li>
                  ))}
                </ul>
              ) : <p className="admin-empty-state">No upcoming deadlines.</p>}
            </section>

            <section className="admin-overview-panel manager-activity-panel">
              <header>
                <div className="panel-title-wrap" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Bell size={16} className="text-blue" />
                  <h3 style={{ margin: 0 }}>Recent Notifications &amp; Team Activity</h3>
                </div>
                <span className="overview-count-pill">{overview?.activities?.length || 0} updates</span>
              </header>
              {overview?.activities?.length ? (
                <div className="manager-activity-cards-list">
                  {overview.activities.map((activity) => {
                    const item = formatTeamActivity(activity);
                    const ActivityIcon = item.icon;
                    return (
                      <div key={activity._id} className={`manager-activity-card ${item.badgeClass}`}>
                        <div className={`activity-icon-wrap type-${item.type}`}>
                          <ActivityIcon size={16} />
                        </div>
                        <div className="activity-card-body">
                          <div className="activity-card-head">
                            <strong className="activity-title">{item.title}</strong>
                            <span className="activity-time">
                              <Clock size={11} /> {new Date(item.time).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}, {new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="activity-desc">{item.description}</p>
                          {item.details && (
                            <div className="activity-details-chip">
                              <span>{item.details}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="admin-empty-state">
                  <Bell size={28} className="text-muted" />
                  <p>No recent team notifications or activity recorded.</p>
                </div>
              )}
            </section>

            <section className="admin-overview-panel">
              <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h3 style={{ margin: 0 }}>Assigned task board</h3>
                  <span>{tasks.length} tasks total</span>
                </div>
                <div className="status-filter-pills">
                  <button
                    type="button"
                    className={`status-pill ${taskStatusFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setTaskStatusFilter('all')}
                  >
                    <span>All</span>
                    <span className="pill-badge">{tasks.length}</span>
                  </button>
                  <button
                    type="button"
                    className={`status-pill pill-pending ${taskStatusFilter === 'pending' ? 'active' : ''}`}
                    onClick={() => setTaskStatusFilter(taskStatusFilter === 'pending' ? 'all' : 'pending')}
                  >
                    <span className="pill-dot dot-pending" />
                    <span>To Do</span>
                    <span className="pill-badge">{tasks.filter(t => t.status === 'pending').length}</span>
                  </button>
                  <button
                    type="button"
                    className={`status-pill pill-in-process ${taskStatusFilter === 'in-process' ? 'active' : ''}`}
                    onClick={() => setTaskStatusFilter(taskStatusFilter === 'in-process' ? 'all' : 'in-process')}
                  >
                    <span className="pill-dot dot-in-process" />
                    <span>In Progress</span>
                    <span className="pill-badge">{tasks.filter(t => t.status === 'in-process').length}</span>
                  </button>
                  <button
                    type="button"
                    className={`status-pill pill-in-review ${taskStatusFilter === 'in-review' ? 'active' : ''}`}
                    onClick={() => setTaskStatusFilter(taskStatusFilter === 'in-review' ? 'all' : 'in-review')}
                  >
                    <span className="pill-dot dot-in-review" />
                    <span>In Review</span>
                    <span className="pill-badge">{tasks.filter(t => t.status === 'in-review').length}</span>
                  </button>
                  <button
                    type="button"
                    className={`status-pill pill-completed ${taskStatusFilter === 'completed' ? 'active' : ''}`}
                    onClick={() => setTaskStatusFilter(taskStatusFilter === 'completed' ? 'all' : 'completed')}
                  >
                    <span className="pill-dot dot-completed" />
                    <span>Completed</span>
                    <span className="pill-badge">{tasks.filter(t => t.status === 'completed').length}</span>
                  </button>
                </div>
              </header>
              <div className={`manager-task-list ${taskStatusFilter !== 'all' ? 'single-column' : ''}`}>
                {(taskStatusFilter === 'all' ? columns : columns.filter(c => c.status === taskStatusFilter)).map((column) => {
                  const colTasks = tasks.filter((task) => task.status === column.status);
                  return (
                    <div key={column.status} className="manager-task-column">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <h4 style={{ margin: 0 }}>{column.title} ({colTasks.length})</h4>
                        {taskStatusFilter !== 'all' && (
                          <button
                            type="button"
                            className="view-all-cols-btn"
                            onClick={() => setTaskStatusFilter('all')}
                          >
                            View All Columns
                          </button>
                        )}
                      </div>
                      <div className={taskStatusFilter !== 'all' ? 'manager-cards-grid' : ''}>
                        {colTasks.map((task) => (
                          <TaskCard
                            key={task._id}
                            task={task}
                            onEdit={(item) => { setEditingTask(item); setTaskFormOpen(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                            onDelete={removeTask}
                            onStatusChange={changeTaskStatus}
                            canDelete={false}
                            onDetails={() => {}}
                          />
                        ))}
                      </div>
                      {colTasks.length === 0 && (
                        <p className="kanban-empty" style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
                          No tasks in {column.title}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </>
      )}

      {/* VIEW: 1.3 TEAM MANAGEMENT */}
      {tab === 'team' && (
        <ManagerTeamManagement manager={user} />
      )}

      {/* VIEW: 1.4 PROJECT MANAGEMENT */}
      {tab === 'projects' && (
        <ManagerProjectManagement
          manager={user}
          authorizedEmployees={employees}
          department={overview?.department}
        />
      )}

      {/* VIEW: 1.5 MY LEAVE & TEAM LEAVE OVERSIGHT */}
      {tab === 'leave' && (
        <div className="manager-leave-view-container">
          {/* Header Action Row */}
          <div className="manager-leave-hero">
            <div className="hero-text-col">
              <div className="hero-badge-pill">
                <ShieldAlert size={14} />
                <span>Hierarchical Admin Approval Required</span>
              </div>
              <h3>Manager Leave &amp; Team Leave Oversight</h3>
              <p>Apply for personal leave routed strictly to Admin, track your remaining quotas, and monitor team member leave coverage.</p>
            </div>
            <div className="hero-actions-col">
              <button
                type="button"
                className="btn-primary"
                onClick={() => setLeaveModalOpen(true)}
              >
                <Plus size={16} /> Apply for Leave
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={loadManagerLeaves}
                title="Refresh leave balances and requests"
              >
                <RefreshCw size={15} /> Refresh
              </button>
            </div>
          </div>

          {/* 4 Quota Balance Cards */}
          <div className="manager-leave-quota-grid">
            <div className="quota-metric-card quota-card-blue">
              <div className="quota-card-top">
                <span className="quota-label">Annual / Earned Leave</span>
                <span className="quota-tag">Paid</span>
              </div>
              <div className="quota-val-row">
                <strong>{leaveOverview.leaveBalance?.annual ?? 12}</strong>
                <span>days left</span>
              </div>
              <p className="quota-hint">Annual paid allocation (12 days/yr)</p>
            </div>

            <div className="quota-metric-card quota-card-emerald">
              <div className="quota-card-top">
                <span className="quota-label">Sick Leave</span>
                <span className="quota-tag">Paid</span>
              </div>
              <div className="quota-val-row">
                <strong>{leaveOverview.leaveBalance?.sick ?? 6}</strong>
                <span>days left</span>
              </div>
              <p className="quota-hint">Medical appointments &amp; recovery (6 days/yr)</p>
            </div>

            <div className="quota-metric-card quota-card-amber">
              <div className="quota-card-top">
                <span className="quota-label">Casual Leave</span>
                <span className="quota-tag">Paid</span>
              </div>
              <div className="quota-val-row">
                <strong>{leaveOverview.leaveBalance?.casual ?? leaveOverview.leaveBalance?.personal ?? 4}</strong>
                <span>days left</span>
              </div>
              <p className="quota-hint">Urgent personal &amp; casual matters (4 days/yr)</p>
            </div>

            <div className="quota-metric-card quota-card-purple">
              <div className="quota-card-top">
                <span className="quota-label">Maternity / Paternity Leave</span>
                <span className="quota-tag">Policy / Legal</span>
              </div>
              <div className="quota-val-row">
                <strong style={{ fontSize: '20px' }}>{leaveOverview.leaveBalance?.maternity_paternity ?? 'As applicable'}</strong>
              </div>
              <p className="quota-hint">Statutory parental &amp; legal policy</p>
            </div>
          </div>

          {/* Manager Approval Authority Banner - Matching Employee Style */}
          <div className="reporting-manager-banner">
            <div className="manager-rep-info">
              <ShieldAlert size={22} className="text-blue" />
              <div>
                <strong>Approval Authority: Organization Admin</strong>
                <p>Manager leave requests are strictly submitted to the Organization Admin for hierarchical governance.</p>
              </div>
            </div>
            <div className="manager-routing-hint">
              <Sparkles size={16} />
              <span>Self-approval is disabled. Direct hierarchical Admin decision authority enforced.</span>
            </div>
          </div>

          {/* Subtabs for Manager: My Leaves vs Team Leaves */}
          <div className="emp-leave-history-section">
            <div className="leave-subtabs-bar" role="tablist" aria-label="Leave categories">
              <button
                type="button"
                role="tab"
                aria-selected={teamLeaveFilter !== 'team'}
                className={`leave-subtab-pill ${teamLeaveFilter !== 'team' ? 'active' : ''}`}
                onClick={() => setTeamLeaveFilter('all')}
              >
                <UserRound size={16} className="subtab-icon" />
                <span className="subtab-label">My Leave Requests</span>
                <span className="subtab-count">{leaveOverview.leaveRequests?.length || 0}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={teamLeaveFilter === 'team'}
                className={`leave-subtab-pill ${teamLeaveFilter === 'team' ? 'active' : ''}`}
                onClick={() => setTeamLeaveFilter('team')}
              >
                <Users size={16} className="subtab-icon" />
                <span className="subtab-label">Team Member Requests</span>
                <span className="subtab-count">{teamLeavesData.teamLeaves?.length || 0}</span>
                {teamLeavesData.teamLeaves?.some((t) => t.status === 'pending' && !t.routingReason?.toLowerCase().includes('approved leave')) && (
                  <span className="subtab-action-indicator" title="Pending team requests awaiting your decision" />
                )}
              </button>
            </div>

            {/* TAB CONTENT 1: MY LEAVE REQUESTS */}
            {teamLeaveFilter !== 'team' && (
              <div className="manager-leaves-list-wrap">
                {(!leaveOverview.leaveRequests || leaveOverview.leaveRequests.length === 0) ? (
                  <div className="admin-empty-state leave-empty-state">
                    <CalendarDays size={36} className="text-muted" />
                    <h5>No leave requests submitted yet</h5>
                    <p>You haven&apos;t submitted any leave requests yet. Click &quot;Apply for Leave&quot; above to submit one to Admin.</p>
                  </div>
                ) : (
                  <div className="emp-leaves-grid">
                    {leaveOverview.leaveRequests.map((l) => {
                      const days = typeof l.totalDays === 'number' && l.totalDays > 0
                        ? l.totalDays
                        : (l.startDate && l.endDate ? Math.max(1, Math.round((new Date(l.endDate) - new Date(l.startDate)) / (1000 * 60 * 60 * 24)) + 1) : 1);

                      return (
                        <article key={l._id} className={`admin-leave-card status-${l.status}`}>
                          <div className="leave-card-top">
                            <div className="leave-type-info">
                              <span className={`leave-type-chip chip-${l.leaveType}`}>
                                {formatLeaveTypeName(l.leaveType)}
                              </span>
                              <span className="dates-range-text">
                                {new Date(l.startDate).toLocaleDateString()} — {new Date(l.endDate).toLocaleDateString()}
                              </span>
                            </div>
                            <span className={`leave-status-pill pill-${l.status}`}>
                              {l.status?.toUpperCase()}
                            </span>
                          </div>

                          <div className="leave-details-grid">
                            <div className="leave-detail-col">
                              <span className="detail-label">Total Days</span>
                              <span className="detail-val">
                                <strong>{days} {days === 1 ? 'day' : 'days'}</strong>
                              </span>
                            </div>

                            <div className="leave-detail-col">
                              <span className="detail-label">Approver Authority</span>
                              <span className="detail-val">
                                <b>{l.approver?.name || 'Organization Admin'}</b>
                                <small className="approver-role-sub">({l.approverRole || 'Admin'})</small>
                              </span>
                            </div>

                            <div className="leave-detail-col">
                              <span className="detail-label">Submitted On</span>
                              <span className="detail-val">
                                {new Date(l.submittedAt || l.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>

                          {l.reason && (
                            <div className="leave-reason-box">
                              <span className="reason-label">Reason:</span>
                              <p className="reason-text">{l.reason}</p>
                            </div>
                          )}

                          {l.rejectionReason && (
                            <div className="leave-rejection-box">
                              <span className="rejection-label">Rejection Remark:</span>
                              <p className="rejection-text">{l.rejectionReason}</p>
                            </div>
                          )}

                          {l.supportingDocument?.filename && (
                            <div className="leave-document-row">
                              <FileText size={14} className="text-blue" />
                              <span className="doc-name">{l.supportingDocument.originalName || 'Supporting Document'}</span>
                              <a
                                href={`${FILE_BASE_URL}/uploads/leaveDocs/${l.supportingDocument.filename}`}
                                target="_blank"
                                rel="noreferrer"
                                className="doc-link-btn"
                              >
                                <Download size={13} /> View
                              </a>
                            </div>
                          )}

                          <div className="leave-card-actions">
                            <button
                              type="button"
                              className="btn-history-pill"
                              onClick={() => setLeaveHistoryModal({ open: true, leave: l })}
                            >
                              <History size={13} /> View Audit History ({l.approvalHistory?.length || 0})
                            </button>

                            {l.status === 'pending' && (
                              <button
                                type="button"
                                className="btn-cancel-req"
                                onClick={() => handleCancelLeave(l._id)}
                                title="Cancel this pending leave request"
                              >
                                Cancel Request
                              </button>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT 2: TEAM MEMBER REQUESTS */}
            {teamLeaveFilter === 'team' && (
              <div className="team-leaves-list-wrap">
                {(!teamLeavesData.teamLeaves || teamLeavesData.teamLeaves.length === 0) ? (
                  <div className="admin-empty-state leave-empty-state">
                    <Users size={36} className="text-muted" />
                    <h5>No team member leave requests</h5>
                    <p>Leave requests submitted by your assigned team members will appear here.</p>
                  </div>
                ) : (
                  <div className="emp-leaves-grid">
                    {teamLeavesData.teamLeaves.map((tLeave) => {
                      const wasForwarded = tLeave.routingReason?.toLowerCase().includes('approved leave') || tLeave.routingReason?.toLowerCase().includes('unavailable');
                      const days = typeof tLeave.totalDays === 'number' && tLeave.totalDays > 0
                        ? tLeave.totalDays
                        : (tLeave.startDate && tLeave.endDate ? Math.max(1, Math.round((new Date(tLeave.endDate) - new Date(tLeave.startDate)) / (1000 * 60 * 60 * 24)) + 1) : 1);

                      return (
                        <article key={tLeave._id} className={`admin-leave-card status-${tLeave.status}`}>
                          <div className="leave-card-top">
                            <div className="requester-profile-cell">
                              <div className="user-avatar-badge avatar-employee">
                                {tLeave.user?.name?.[0]?.toUpperCase() || 'E'}
                              </div>
                              <div className="requester-info">
                                <div className="requester-name-line">
                                  <strong>{tLeave.user?.name || 'Employee'}</strong>
                                  <span className="role-tag-pill pill-employee">
                                    {tLeave.user?.designation || 'Team Member'}
                                  </span>
                                </div>
                                <div className="requester-sub-line">
                                  {tLeave.user?.employeeId && <span>ID: <b>{tLeave.user.employeeId}</b></span>}
                                  {tLeave.user?.department && <span>Dept: <b>{tLeave.user.department}</b></span>}
                                </div>
                              </div>
                            </div>

                            <div className="leave-status-group">
                              <span className={`leave-type-chip chip-${tLeave.leaveType}`}>
                                {formatLeaveTypeName(tLeave.leaveType)}
                              </span>
                              <span className={`leave-status-pill pill-${tLeave.status}`}>
                                {tLeave.status?.toUpperCase()}
                              </span>
                            </div>
                          </div>

                          {wasForwarded && (
                            <div className="leave-forwarded-notice">
                              <AlertTriangle size={15} />
                              <div>
                                <strong>Forwarded to Admin:</strong>
                                <span>You were on approved leave during these requested dates; request was automatically forwarded to Organization Admin.</span>
                              </div>
                            </div>
                          )}

                          <div className="leave-details-grid">
                            <div className="leave-detail-col">
                              <span className="detail-label">Requested Period</span>
                              <span className="detail-val">
                                <strong>{new Date(tLeave.startDate).toLocaleDateString()} — {new Date(tLeave.endDate).toLocaleDateString()}</strong>
                              </span>
                            </div>

                            <div className="leave-detail-col">
                              <span className="detail-label">Total Days</span>
                              <span className="detail-val">
                                <strong>{days} {days === 1 ? 'day' : 'days'}</strong>
                              </span>
                            </div>

                            <div className="leave-detail-col">
                              <span className="detail-label">Approver Authority</span>
                              <span className="detail-val">
                                <b>{tLeave.approver?.name || (tLeave.approverRole === 'Admin' ? 'Admin Authority' : 'You (Manager)')}</b>
                                <small className="approver-role-sub">({tLeave.approverRole || 'Manager'})</small>
                              </span>
                            </div>

                            <div className="leave-detail-col">
                              <span className="detail-label">Submitted On</span>
                              <span className="detail-val">
                                {new Date(tLeave.submittedAt || tLeave.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>

                          {tLeave.reason && (
                            <div className="leave-reason-box">
                              <span className="reason-label">Reason:</span>
                              <p className="reason-text">{tLeave.reason}</p>
                            </div>
                          )}

                          {tLeave.rejectionReason && (
                            <div className="leave-rejection-box">
                              <span className="rejection-label">Rejection Remark:</span>
                              <p className="rejection-text">{tLeave.rejectionReason}</p>
                            </div>
                          )}

                          {tLeave.supportingDocument?.filename && (
                            <div className="leave-document-row">
                              <FileText size={14} className="text-blue" />
                              <span className="doc-name">{tLeave.supportingDocument.originalName || 'Supporting Document'}</span>
                              <a
                                href={`${FILE_BASE_URL}/uploads/leaveDocs/${tLeave.supportingDocument.filename}`}
                                target="_blank"
                                rel="noreferrer"
                                className="doc-link-btn"
                              >
                                <Download size={13} /> View Document
                              </a>
                            </div>
                          )}

                          <div className="leave-card-actions">
                            <div className="actions-left">
                              <button
                                type="button"
                                className="btn-history-pill"
                                onClick={() => setLeaveHistoryModal({ open: true, leave: tLeave })}
                              >
                                <History size={13} /> View Audit History ({tLeave.approvalHistory?.length || 0})
                              </button>
                            </div>

                            <div className="actions-right">
                              {tLeave.status === 'pending' && !wasForwarded && (
                                <>
                                  <button
                                    type="button"
                                    className="btn-leave-approve"
                                    onClick={() => handleManagerDecideLeave(tLeave, 'approved')}
                                    title="Approve this employee leave request"
                                  >
                                    <Check size={14} /> Approve
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-leave-reject"
                                    onClick={() => handleManagerDecideLeave(tLeave, 'rejected')}
                                    title="Reject this employee leave request"
                                  >
                                    <X size={14} /> Reject
                                  </button>
                                </>
                              )}
                              {tLeave.status === 'pending' && wasForwarded && (
                                <span className="pending-notice-pill">
                                  Awaiting Admin Decision
                                </span>
                              )}
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW: MY PROFILE & DEPARTMENT (SETTINGS) */}
      {tab === 'profile' && (
        <SettingsView user={user} onUserUpdated={updateUser} />
      )}

      {/* VIEW: MY ATTENDANCE */}
      {tab === 'attendance' && (
        <MyAttendance user={user} isManager={true} refreshSignal={attendanceRefreshSignal} />
      )}

      {/* VIEW: ANNOUNCEMENTS */}
      {tab === 'announcements' && (
        <AnnouncementsPage user={user} />
      )}

      {/* VIEW: DIRECT MESSAGES (CHAT) */}
      {tab === 'chat' && (
        <ChatPage user={user} />
      )}

      {/* VIEW: GOVERNMENT HOLIDAYS */}
      {tab === 'holidays' && (
        <HolidayCalendar user={user} setView={setView} />
      )}

      {/* VIEW: TEAM PAYROLL & SALARY REVIEW */}
      {tab === 'payroll' && (
        <ManagerPayrollReview user={user} setView={setView} />
      )}
      {/* Task Review Modal */}
      {reviewModalTask && (
        <div className="admin-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setReviewModalTask(null); }}>
          <section className="admin-action-modal" style={{ maxWidth: '600px', width: '90%' }} role="dialog" aria-modal="true">
            <header>
              <div>
                <h2>Review Task Submission</h2>
                <p className="muted-text">{reviewModalTask.title}</p>
              </div>
              <button className="icon-btn" onClick={() => setReviewModalTask(null)} aria-label="Close modal"><X size={18} /></button>
            </header>
            <div style={{ padding: '16px 0', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ background: 'var(--bg-secondary, #f8fafc)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color, #e2e8f0)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px', marginBottom: '8px' }}>
                  <div><strong>Employee:</strong> {reviewModalTask.user?.name} ({reviewModalTask.user?.employeeId || 'ID'})</div>
                  <div><strong>Project:</strong> {reviewModalTask.project || 'General'}</div>
                  <div><strong>Priority:</strong> <span className={`task-badge priority-${(reviewModalTask.priority || 'medium').toLowerCase()}`}>{reviewModalTask.priority}</span></div>
                  <div><strong>Submitted:</strong> {reviewModalTask.submittedAt ? new Date(reviewModalTask.submittedAt).toLocaleString() : 'Recently'}</div>
                </div>
                {reviewModalTask.submissionNotes && (
                  <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-color, #e2e8f0)' }}>
                    <strong style={{ fontSize: '13px', display: 'block', marginBottom: '4px' }}>Employee Submission Notes:</strong>
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-primary, #334155)', whiteSpace: 'pre-wrap' }}>{reviewModalTask.submissionNotes}</p>
                  </div>
                )}
                {reviewModalTask.attachments?.length > 0 && (
                  <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-color, #e2e8f0)' }}>
                    <strong style={{ fontSize: '13px', display: 'block', marginBottom: '6px' }}>Uploaded Work Files ({reviewModalTask.attachments.length}):</strong>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {reviewModalTask.attachments.map((att) => (
                        <a
                          key={att._id}
                          href={`/api/tasks/${reviewModalTask._id}/attachments/${att._id}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', background: 'var(--bg-card, #fff)', border: '1px solid var(--border-color, #cbd5e1)', borderRadius: '6px', fontSize: '12px', textDecoration: 'none', color: '#6366f1' }}
                        >
                          <FileText size={13} /> {att.originalName}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>
                  Manager Remarks / Modification Instructions:
                </label>
                <textarea
                  rows={4}
                  value={reviewFeedback}
                  onChange={(e) => setReviewFeedback(e.target.value)}
                  placeholder="Provide feedback, approval comments, or specific changes required for the employee..."
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>
            </div>
            <footer>
              <button type="button" className="btn-ghost" onClick={() => setReviewModalTask(null)} disabled={reviewBusy}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-ghost"
                style={{ color: '#d97706', borderColor: '#d97706', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                onClick={() => handleReviewDecision('request-changes')}
                disabled={reviewBusy}
              >
                <AlertTriangle size={15} /> Request Changes
              </button>
              <button
                type="button"
                className="btn-primary"
                style={{ background: '#10b981', borderColor: '#10b981', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                onClick={() => handleReviewDecision('approve')}
                disabled={reviewBusy}
              >
                <Check size={15} /> Approve Task
              </button>
            </footer>
          </section>
        </div>
      )}

      {/* =========================================================================
          MANAGER APPLY FOR LEAVE MODAL (ADMIN APPROVAL)
         ========================================================================= */}
      {leaveModalOpen && (
        <div className="manager-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setLeaveModalOpen(false); }}>
          <div className="manager-modal-box apply-leave-modal" role="dialog" aria-modal="true">
            <header className="manager-modal-header">
              <div className="modal-title-with-badge">
                <CalendarDays size={18} className="text-blue" />
                <h3>Apply for Leave (Manager)</h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  className="btn-primary btn-small"
                  onClick={handleApplyLeaveSubmit}
                  disabled={leaveSubmitting}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600, padding: '6px 14px', fontSize: '12px' }}
                >
                  <Send size={13} /> {leaveSubmitting ? 'Sending...' : 'Send for Approval'}
                </button>
                <button type="button" className="icon-btn" onClick={() => setLeaveModalOpen(false)} aria-label="Close">
                  <X size={18} />
                </button>
              </div>
            </header>

            <form onSubmit={handleApplyLeaveSubmit}>
              <div className="modal-body-scroll">
                <div className="manager-apply-notice">
                  <ShieldAlert size={16} />
                  <div>
                    <strong>Admin Routing Notice:</strong>
                    <p>As a manager, your leave request is strictly submitted to the Organization Admin for hierarchical review. Self-approval is disabled.</p>
                  </div>
                </div>

                <div className="form-group-field">
                  <label>Leave Type <span className="req">*</span></label>
                  <select
                    value={leaveForm.leaveType}
                    onChange={(e) => setLeaveForm({ ...leaveForm, leaveType: e.target.value })}
                    required
                  >
                    <option value="annual">Annual / Earned Leave ({leaveOverview.leaveBalance?.annual ?? 12} days left)</option>
                    <option value="sick">Sick Leave ({leaveOverview.leaveBalance?.sick ?? 6} days left)</option>
                    <option value="casual">Casual Leave ({leaveOverview.leaveBalance?.casual ?? leaveOverview.leaveBalance?.personal ?? 4} days left)</option>
                    <option value="maternity_paternity">Maternity / Paternity Leave (Policy / Legal - As applicable)</option>
                  </select>
                </div>

                <div className="form-row-dates">
                  <div className="form-group-field">
                    <label>Start Date <span className="req">*</span></label>
                    <input
                      type="date"
                      value={leaveForm.startDate}
                      min={new Date().toISOString().slice(0, 10)}
                      onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group-field">
                    <label>End Date <span className="req">*</span></label>
                    <input
                      type="date"
                      value={leaveForm.endDate}
                      min={leaveForm.startDate || new Date().toISOString().slice(0, 10)}
                      onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="calculated-days-strip">
                  <Clock size={15} />
                  <span>Calculated Working Days: <strong>{calculatedDays} {calculatedDays === 1 ? 'day' : 'days'}</strong></span>
                </div>

                <div className="form-group-field">
                  <label>Leave Reason <span className="req">*</span></label>
                  <textarea
                    rows={3}
                    placeholder="Describe the reason for your leave request..."
                    value={leaveForm.reason}
                    onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group-field">
                  <label>Supporting Document <span className="optional-tag">(Optional)</span></label>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                    onChange={(e) => setLeaveDocFile(e.target.files?.[0] || null)}
                  />
                  <small className="field-hint">Accepted formats: PDF, DOC, DOCX, PNG, JPG (Max 10MB)</small>
                </div>
              </div>

              <footer className="manager-modal-footer">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setLeaveModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={leaveSubmitting}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '9px 18px', fontWeight: 600 }}
                >
                  <Send size={15} />
                  {leaveSubmitting ? 'Sending to Admin...' : 'Send Leave for Approval'}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          LEAVE AUDIT HISTORY MODAL (MANAGER)
         ========================================================================= */}
      {leaveHistoryModal.open && leaveHistoryModal.leave && (
        <div className="manager-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setLeaveHistoryModal({ open: false, leave: null }); }}>
          <div className="manager-modal-box leave-history-modal" role="dialog" aria-modal="true">
            <header className="manager-modal-header">
              <div className="modal-title-with-badge">
                <History size={18} className="text-blue" />
                <h3>Leave Request Audit History</h3>
              </div>
              <button type="button" className="icon-btn" onClick={() => setLeaveHistoryModal({ open: false, leave: null })}>
                <X size={18} />
              </button>
            </header>

            <div className="modal-body-scroll">
              <div className="history-target-summary">
                <h4>{leaveHistoryModal.leave.user?.name || 'Leave Request'} · {formatLeaveTypeName(leaveHistoryModal.leave.leaveType)}</h4>
                <p>
                  Dates: <b>{new Date(leaveHistoryModal.leave.startDate).toLocaleDateString()}</b> to <b>{new Date(leaveHistoryModal.leave.endDate).toLocaleDateString()}</b> ({leaveHistoryModal.leave.totalDays} days) · Status: <b>{leaveHistoryModal.leave.status?.toUpperCase()}</b>
                </p>
                {leaveHistoryModal.leave.routingReason && (
                  <p className="routing-note">
                    <b>Routing:</b> {leaveHistoryModal.leave.routingReason}
                  </p>
                )}
              </div>

              <div className="audit-timeline-stream">
                {(!leaveHistoryModal.leave.approvalHistory || leaveHistoryModal.leave.approvalHistory.length === 0) ? (
                  <p className="admin-empty-state">No recorded history events.</p>
                ) : (
                  leaveHistoryModal.leave.approvalHistory.map((item, idx) => (
                    <div key={idx} className="timeline-node">
                      <div className="node-marker" />
                      <div className="node-content">
                        <div className="node-header">
                          <strong className="node-action">{item.action}</strong>
                          <time className="node-time">{new Date(item.timestamp).toLocaleString()}</time>
                        </div>
                        <div className="node-performer">
                          <span>By: <b>{item.performer?.name || item.performerRole || 'System'}</b></span>
                          {item.performerRole && <span className="performer-role-tag">({item.performerRole})</span>}
                        </div>
                        {item.details && <p className="node-details">{item.details}</p>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <footer className="manager-modal-footer">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setLeaveHistoryModal({ open: false, leave: null })}
              >
                Close History
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

export default ManagerDashboard;
