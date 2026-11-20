import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios, { FILE_BASE_URL } from '../api/axios';
import {
  getEmployeeDashboard,
  getMyProjects,
  getProjectDetails,
  uploadProjectDocument,
  toggleProjectMilestone,
  addProjectComment,
  getMyTasks,
  getTaskDetails,
  updateTaskStatus,
  submitTaskForReview,
  resubmitTask,
  addTaskProgressUpdate,
  clockIn,
  clockOut,
} from '../api/employeeApi';
import {
  applyLeaveRequest,
  getMyLeaveOverview,
  cancelMyLeaveRequest,
} from '../api/leaveApi';
import Swal from '../utils/swalConfig';
import MyAttendance from './MyAttendance';
import AnnouncementsPage from './AnnouncementsPage';
import ChatPage from './ChatPage';
import HolidayCalendar from './HolidayCalendar';
import EmployeeSalaryPortal from './payroll/EmployeeSalaryPortal';
import SettingsView from './SettingsView';
import { getMyPayrolls } from '../api/payrollApi';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  FolderOpen,
  Briefcase,
  Users,
  UserRound,
  X,
  XCircle,
  Search,
  Star,
  Upload,
  Download,
  MessageSquare,
  Paperclip,
  FileText,
  Megaphone,
  Send,
  RotateCcw,
  Flag,
  CalendarDays,
  Activity,
  Timer,
  Sparkles,
  Check,
  History,
  RefreshCw,
  LogIn,
  LogOut,
  Palmtree,
  Building2,
  Hash,
  ShieldCheck,
  Target,
  Layers,
  UserCheck,
  FileUp,
  CheckSquare,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

function getDeadlineStatus(item) {
  let days = item.daysRemaining;
  let isOverdue = Boolean(item.isOverdue);
  let isToday = Boolean(item.isToday);

  if (item.deadline) {
    const deadlineDate = new Date(item.deadline);
    if (!isNaN(deadlineDate.getTime())) {
      const todayStr = new Date().toISOString().slice(0, 10);
      const deadlineStr = deadlineDate.toISOString().slice(0, 10);
      const tStart = new Date(todayStr + 'T00:00:00.000Z');
      const dStart = new Date(deadlineStr + 'T00:00:00.000Z');
      const diff = Math.round((dStart - tStart) / (1000 * 60 * 60 * 24));
      days = diff;
      isToday = diff === 0;
      isOverdue = diff < 0;
    }
  }

  if (isOverdue || days < 0) {
    const absDays = Math.abs(days ?? 1) || 1;
    return {
      text: `Overdue by ${absDays}d`,
      className: 'badge-overdue',
      type: 'overdue',
      label: 'Overdue',
    };
  }

  if (isToday || days === 0) {
    return {
      text: 'Due Today',
      className: 'badge-today',
      type: 'today',
      label: 'Due Today',
    };
  }

  if (days === 1) {
    return {
      text: 'Due Tomorrow',
      className: 'badge-soon',
      type: 'tomorrow',
      label: 'Due Tomorrow',
    };
  }

  return {
    text: `${days}d left`,
    className: days <= 3 ? 'badge-soon' : 'badge-ok',
    type: days <= 3 ? 'soon' : 'upcoming',
    label: `${days} days left`,
  };
}


function UserAvatar({ user, className = 'emp-avatar-medium' }) {
  const [imageUrl, setImageUrl] = useState('');

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    if (!user?._id || !user?.profilePicture) {
      setImageUrl('');
      return () => { active = false; };
    }
    axios.get(`/users/${user._id}/profile-picture?t=${encodeURIComponent(user.profilePicture)}`, { responseType: 'blob' })
      .then((res) => {
        objectUrl = URL.createObjectURL(res.data);
        if (active) setImageUrl(objectUrl);
      })
      .catch(() => { if (active) setImageUrl(''); });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [user?._id, user?.profilePicture]);

  return imageUrl ? (
    <img className={className} src={imageUrl} alt="" />
  ) : (
    <span className={`${className}-fallback`}>{user?.name?.[0]?.toUpperCase() || 'E'}</span>
  );
}

export default function EmployeeDashboard({ user, logout, setView, activeTab, onTabChange }) {
  const [tab, setTab] = useState(activeTab || 'dashboard'); // dashboard | profile | projects | tasks | leave

  useEffect(() => {
    if (activeTab === 'tasks' && setView) {
      setView('tasks');
    } else if (activeTab && activeTab !== tab) {
      setTab(activeTab);
    }
  }, [activeTab, setView]); // eslint-disable-line react-hooks/exhaustive-deps

  const { updateUser } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Leave Management State (Employee)
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ leaveType: 'annual', startDate: '', endDate: '', reason: '' });
  const [leaveDocFile, setLeaveDocFile] = useState(null);
  const [calculatedLeaveDays, setCalculatedLeaveDays] = useState(1);
  const [leaveBusy, setLeaveBusy] = useState(false);
  const [leaveOverview, setLeaveOverview] = useState({
    leaveBalance: { annual: 12, sick: 6, casual: 4, maternity_paternity: 'As applicable' },
    assignedManager: null,
    leaveRequests: [],
    stats: { total: 0, pending: 0, approved: 0, rejected: 0, cancelled: 0 },
  });
  const [leaveHistoryModal, setLeaveHistoryModal] = useState({ open: false, leave: null });
  const [attendanceRefreshSignal, setAttendanceRefreshSignal] = useState(0);
  const [attendanceRefreshing, setAttendanceRefreshing] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Dynamic seconds ticker for main dashboard clock in/out
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getTodayElapsedSeconds = useCallback(() => {
    const todayAtt = dashboardData?.todayAttendance;
    if (!todayAtt?.clockIn) return 0;
    if (todayAtt.clockOut) {
      const diff = Math.max(0, Math.round((new Date(todayAtt.clockOut).getTime() - new Date(todayAtt.clockIn).getTime()) / 1000));
      return Math.max(todayAtt.totalSeconds || 0, diff);
    }
    const elapsed = Math.max(0, Math.round((currentTime - new Date(todayAtt.clockIn).getTime()) / 1000));
    return Math.max(todayAtt.totalSeconds || 0, elapsed);
  }, [dashboardData?.todayAttendance, currentTime]);

  const formatElapsedDuration = (seconds, isActive = false) => {
    if (!seconds || seconds <= 0) return '0h 0m';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (isActive) return `${h}h ${m}m ${s}s`;
    return `${h}h ${m}m`;
  };

  const formatLeaveTypeName = (type) => {
    const t = (type || '').toLowerCase();
    if (t === 'annual') return 'ANNUAL / EARNED LEAVE';
    if (t === 'sick') return 'SICK LEAVE';
    if (t === 'casual' || t === 'personal' || t === 'other') return 'CASUAL LEAVE';
    if (t === 'maternity_paternity' || t.includes('maternity')) return 'MATERNITY / PATERNITY LEAVE';
    return (type || 'LEAVE').toUpperCase() + ' LEAVE';
  };

  const [dismissedLeaveBannerIds, setDismissedLeaveBannerIds] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem('taskflow_dismissed_leave_banners') || '[]');
    } catch {
      return [];
    }
  });

  const dismissLeaveBanner = (id) => {
    setDismissedLeaveBannerIds((prev) => {
      const next = [...new Set([...prev, String(id)])];
      try {
        sessionStorage.setItem('taskflow_dismissed_leave_banners', JSON.stringify(next));
      } catch {
        // Ignore storage error
      }
      return next;
    });
  };

  const [latestPaidSalary, setLatestPaidSalary] = useState(null);
  const [dismissedSalaryBannerIds, setDismissedSalaryBannerIds] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem('taskflow_dismissed_salary_banners') || '[]');
    } catch {
      return [];
    }
  });

  const dismissSalaryBanner = (id) => {
    setDismissedSalaryBannerIds((prev) => {
      const next = [...new Set([...prev, String(id)])];
      try {
        sessionStorage.setItem('taskflow_dismissed_salary_banners', JSON.stringify(next));
      } catch {
        // Ignore storage error
      }
      return next;
    });
  };

  const recentLeaveDecision = useMemo(() => {
    if (!leaveOverview?.leaveRequests?.length) return null;
    const decided = leaveOverview.leaveRequests.filter(
      (l) => (l.status === 'approved' || l.status === 'rejected')
    );
    if (!decided.length) return null;
    decided.sort((a, b) => new Date(b.reviewedAt || b.updatedAt || b.approvedAt || b.rejectedAt || b.createdAt) - new Date(a.reviewedAt || a.updatedAt || a.approvedAt || a.rejectedAt || a.createdAt));
    const latest = decided[0];
    if (dismissedLeaveBannerIds.includes(String(latest._id))) return null;
    // Show if decided recently (within last 14 days)
    const decisionTime = new Date(latest.reviewedAt || latest.updatedAt || latest.approvedAt || latest.rejectedAt || latest.createdAt).getTime();
    if (Date.now() - decisionTime <= 14 * 24 * 60 * 60 * 1000) {
      return latest;
    }
    return null;
  }, [leaveOverview, dismissedLeaveBannerIds]);

  const handleViewLeaveTab = () => {
    setTab('leave');
    if (onTabChange) onTabChange('leave');
  };

  // Profile Form State
  // Projects State
  const [projectsList, setProjectsList] = useState([]);
  const [projectSearch, setProjectSearch] = useState('');
  const [projectStatusFilter, setProjectStatusFilter] = useState('');
  const [projectPriorityFilter, setProjectPriorityFilter] = useState('');
  const [selectedProject, setSelectedProject] = useState(null);
  const [projectDetailTab, setProjectDetailTab] = useState('overview'); // overview | milestones | tasks | documents | comments
  const [projectDocFile, setProjectDocFile] = useState(null);
  const [projectCommentText, setProjectCommentText] = useState('');
  const [projectBusy, setProjectBusy] = useState(false);

  // Tasks State
  const [tasksList, setTasksList] = useState([]);
  const [taskSearch, setTaskSearch] = useState('');
  const [taskStatusFilter, setTaskStatusFilter] = useState('');
  const [taskPriorityFilter, setTaskPriorityFilter] = useState('');
  const [taskQuickFilter, setTaskQuickFilter] = useState('all'); // all | modification | overdue | inProgress
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskModalTab, setTaskModalTab] = useState('details'); // details | submit | progress | history
  const [submissionNotes, setSubmissionNotes] = useState('');
  const [progressUpdateInput, setProgressUpdateInput] = useState({ text: '', progress: 50 });
  const [taskBusy, setTaskBusy] = useState(false);

  // Load Dashboard Data
  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [res, payrollRes] = await Promise.all([
        getEmployeeDashboard(),
        getMyPayrolls().catch(() => ({ data: { data: [] } })),
      ]);
      setDashboardData(res.data);
      const payrolls = payrollRes.data?.data || [];
      const latestPaid = payrolls.find((p) => p.status === 'Paid') || null;
      setLatestPaidSalary(latestPaid);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load your dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // Load data when tab changes
  useEffect(() => {
    if (tab === 'projects') {
      getMyProjects().then((res) => setProjectsList(res.data)).catch(() => {});
    } else if (tab === 'tasks') {
      getMyTasks().then((res) => setTasksList(res.data)).catch(() => {});
    }
  }, [tab]);

  // Quick Action: Clock In
  const handleClockIn = async (isNextDay = false) => {
    try {
      const res = await clockIn({ isNextDay, newSession: isNextDay });
      const record = res?.data;
      const newClockIn = record?.clockIn || new Date().toISOString();
      setDashboardData(prev => ({
        ...prev,
        todayAttendance: {
          ...prev?.todayAttendance,
          clockIn: newClockIn,
          clockOut: null,
          status: 'Present'
        }
      }));
      Swal.fire({
        title: isNextDay ? 'Clocked In for Next Day' : 'Clocked In',
        text: `Your clock-in time (${new Date(newClockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}) has been logged.`,
        icon: 'success',
        timer: 1600,
        showConfirmButton: false
      });
      loadDashboard();
    } catch (err) {
      Swal.fire({ title: 'Error', text: err.response?.data?.message || 'Could not clock in', icon: 'error' });
    }
  };

  // Quick Action: Clock Out
  const handleClockOut = async () => {
    try {
      const res = await clockOut(0);
      const record = res?.data;
      const newClockOut = record?.clockOut || new Date().toISOString();
      // Instantly update state so button immediately transitions to "Clock In for Next Day"
      setDashboardData(prev => ({
        ...prev,
        todayAttendance: {
          ...prev?.todayAttendance,
          clockOut: newClockOut
        }
      }));
      Swal.fire({
        title: 'Clocked Out',
        text: `Your clock-out time (${new Date(newClockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}) has been recorded.`,
        icon: 'success',
        timer: 1600,
        showConfirmButton: false
      });
      loadDashboard();
    } catch (err) {
      Swal.fire({ title: 'Error', text: err.response?.data?.message || 'Could not clock out', icon: 'error' });
    }
  };

  // Load Employee Leave Overview
  const loadEmployeeLeaves = useCallback(async () => {
    try {
      const res = await getMyLeaveOverview();
      setLeaveOverview(res.data);
    } catch (err) {
      console.error('Failed to load employee leave overview:', err);
    }
  }, []);

  useEffect(() => {
    loadEmployeeLeaves();
  }, [loadEmployeeLeaves]);

  useEffect(() => {
    if (tab === 'leave') {
      loadEmployeeLeaves();
    }
  }, [tab, loadEmployeeLeaves]);

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
        setCalculatedLeaveDays(Math.max(1, count));
      } else {
        setCalculatedLeaveDays(0);
      }
    } else {
      setCalculatedLeaveDays(1);
    }
  }, [leaveForm.startDate, leaveForm.endDate]);

  // Quick Action: Apply Leave Modal
  const openApplyLeaveModal = async () => {
    setLeaveModalOpen(true);
    await loadEmployeeLeaves();
  };

  const handleLeaveSubmit = async (e) => {
    e.preventDefault();
    if (calculatedLeaveDays <= 0) {
      Swal.fire({ title: 'Invalid Dates', text: 'End date must be on or after start date.', icon: 'warning' });
      return;
    }
    setLeaveBusy(true);
    try {
      const formData = new FormData();
      formData.append('leaveType', leaveForm.leaveType);
      formData.append('startDate', leaveForm.startDate);
      formData.append('endDate', leaveForm.endDate);
      formData.append('reason', leaveForm.reason);
      if (leaveDocFile) {
        formData.append('document', leaveDocFile);
      }

      const res = await applyLeaveRequest(formData);
      const routeInfo = res.data.approvalRoute === 'ADMIN'
        ? 'Your assigned manager is currently on approved leave. This request has been automatically forwarded to Admin for approval.'
        : `Your leave request has been submitted to your assigned manager (${res.data.designatedApprover?.name || 'Manager'}).`;

      Swal.fire({
        title: 'Leave Request Submitted',
        text: routeInfo,
        icon: 'success'
      });
      setLeaveModalOpen(false);
      setLeaveForm({ leaveType: 'annual', startDate: '', endDate: '', reason: '' });
      setLeaveDocFile(null);
      await loadEmployeeLeaves();
      await loadDashboard();
    } catch (err) {
      Swal.fire({ title: 'Error', text: err.response?.data?.message || 'Could not apply leave', icon: 'error' });
    } finally {
      setLeaveBusy(false);
    }
  };

  const handleCancelLeave = async (id) => {
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
      await cancelMyLeaveRequest(id);
      Swal.fire({ title: 'Request Cancelled', text: 'Your leave request has been cancelled.', icon: 'success' });
      await loadEmployeeLeaves();
      await loadDashboard();
    } catch (err) {
      Swal.fire({ title: 'Error', text: err.response?.data?.message || 'Could not cancel leave request.', icon: 'error' });
    }
  };

  // Projects: Open Details
  const openProject = async (projectId) => {
    setProjectBusy(true);
    try {
      const res = await getProjectDetails(projectId);
      setSelectedProject(res.data);
      setProjectDetailTab('overview');
    } catch (err) {
      Swal.fire({ title: 'Error', text: 'Could not load project details', icon: 'error' });
    } finally {
      setProjectBusy(false);
    }
  };

  // Projects: Upload Doc
  const handleProjectDocUpload = async (e) => {
    e.preventDefault();
    if (!projectDocFile || !selectedProject) return;
    setProjectBusy(true);
    const form = new FormData();
    form.append('document', projectDocFile);
    try {
      const res = await uploadProjectDocument(selectedProject.project._id, form);
      setSelectedProject({
        ...selectedProject,
        project: { ...selectedProject.project, documents: res.data },
      });
      setProjectDocFile(null);
      Swal.fire({ title: 'Document Uploaded', icon: 'success', timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ title: 'Upload Failed', text: err.response?.data?.message || 'Could not upload document', icon: 'error' });
    } finally {
      setProjectBusy(false);
    }
  };

  // Projects: Add Comment
  const handleProjectComment = async (e) => {
    e.preventDefault();
    if (!projectCommentText.trim() || !selectedProject) return;
    setProjectBusy(true);
    try {
      const res = await addProjectComment(selectedProject.project._id, { text: projectCommentText });
      setSelectedProject({
        ...selectedProject,
        project: { ...selectedProject.project, comments: res.data },
      });
      setProjectCommentText('');
    } catch (err) {
      Swal.fire({ title: 'Error', text: err.response?.data?.message || 'Could not add comment', icon: 'error' });
    } finally {
      setProjectBusy(false);
    }
  };

  // Projects: Toggle Milestone Complete
  const handleToggleMilestone = async (milestoneId, newCompleted) => {
    if (!selectedProject) return;
    setProjectBusy(true);
    try {
      const res = await toggleProjectMilestone(selectedProject.project._id, milestoneId, {
        completed: newCompleted,
      });
      const updatedMilestones = res.data.milestones || res.data;
      const updatedProgress = res.data.progress !== undefined ? res.data.progress : selectedProject.project.progress;
      const updatedStatus = res.data.status || selectedProject.project.status;

      setSelectedProject((prev) => ({
        ...prev,
        project: {
          ...prev.project,
          milestones: updatedMilestones,
          progress: updatedProgress,
          status: updatedStatus,
        },
      }));

      // Update in projectsList as well
      setProjectsList((prev) =>
        prev.map((p) =>
          p.project?._id === selectedProject.project._id
            ? {
                ...p,
                project: { ...p.project, progress: updatedProgress, status: updatedStatus },
                completedMilestones: updatedMilestones.filter((m) => m.completed).length,
              }
            : p
        )
      );

      Swal.fire({
        title: newCompleted ? 'Milestone Completed!' : 'Marked as Pending',
        text: newCompleted
          ? 'Great job! Project progress has been updated.'
          : 'Milestone status set to pending.',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire({
        title: 'Error',
        text: err.response?.data?.message || 'Could not update milestone status',
        icon: 'error',
      });
    } finally {
      setProjectBusy(false);
    }
  };

  // Tasks: Open Details & Work Submission
  const openTask = async (taskId, initialTab = 'details') => {
    setTaskBusy(true);
    try {
      const res = await getTaskDetails(taskId);
      const isNeedsMod = res.data.status !== 'completed' && res.data.reviewStatus === 'changes-requested';
      setSelectedTask({ ...res.data, needsModification: isNeedsMod });
      setTaskModalTab(initialTab);
      setSubmissionNotes(res.data.submissionNotes || '');
    } catch (err) {
      Swal.fire({ title: 'Error', text: 'Could not load task details', icon: 'error' });
    } finally {
      setTaskBusy(false);
    }
  };

  // Tasks: Update Status
  const handleTaskStatusChange = async (taskId, status) => {
    try {
      await updateTaskStatus(taskId, status);
      if (tab === 'tasks') {
        const res = await getMyTasks();
        setTasksList(res.data);
      }
      if (selectedTask && selectedTask._id === taskId) {
        setSelectedTask({ ...selectedTask, status });
      }
      loadDashboard();
    } catch (err) {
      Swal.fire({ title: 'Error', text: 'Could not update task status', icon: 'error' });
    }
  };

  // Tasks: Submit / Resubmit Work
  const handleSubmitTaskWork = async (e) => {
    e.preventDefault();
    if (!selectedTask) return;
    setTaskBusy(true);
    try {
      const isMod = selectedTask.status !== 'completed' && (selectedTask.needsModification || selectedTask.reviewStatus === 'changes-requested');
      if (isMod) {
        await resubmitTask(selectedTask._id, { submissionNotes });
        Swal.fire({ title: 'Task Resubmitted', text: 'Your modified work was submitted for manager review.', icon: 'success' });
      } else {
        await submitTaskForReview(selectedTask._id, { submissionNotes });
        Swal.fire({ title: 'Submitted for Review', text: 'Your task has been submitted for manager verification.', icon: 'success' });
      }
      setSelectedTask(null);
      await loadDashboard();
      if (tab === 'tasks') {
        const res = await getMyTasks();
        setTasksList(res.data);
      }
    } catch (err) {
      Swal.fire({ title: 'Submission Failed', text: err.response?.data?.message || 'Could not submit task', icon: 'error' });
    } finally {
      setTaskBusy(false);
    }
  };

  // Tasks: Add Progress Update
  const handleTaskProgressUpdate = async (e) => {
    e.preventDefault();
    if (!selectedTask || !progressUpdateInput.text.trim()) return;
    setTaskBusy(true);
    try {
      const res = await addTaskProgressUpdate(selectedTask._id, progressUpdateInput);
      setSelectedTask({ ...selectedTask, progressUpdates: res.data });
      setProgressUpdateInput({ text: '', progress: 50 });
      Swal.fire({ title: 'Progress Update Posted', icon: 'success', timer: 1400, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ title: 'Error', text: 'Could not post progress update', icon: 'error' });
    } finally {
      setTaskBusy(false);
    }
  };

  // Filtered Projects
  const filteredProjects = useMemo(() => {
    let list = projectsList;
    if (projectSearch.trim()) {
      const q = projectSearch.toLowerCase();
      list = list.filter(p =>
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.description && p.description.toLowerCase().includes(q)) ||
        (p.objectives && p.objectives.toLowerCase().includes(q))
      );
    }
    if (projectStatusFilter) {
      list = list.filter(p => p.status === projectStatusFilter);
    }
    if (projectPriorityFilter) {
      list = list.filter(p => p.priority === projectPriorityFilter);
    }
    return list;
  }, [projectsList, projectSearch, projectStatusFilter, projectPriorityFilter]);

  // Filtered Tasks
  const filteredTasks = useMemo(() => {
    let list = tasksList;
    if (taskSearch.trim()) {
      const q = taskSearch.toLowerCase();
      list = list.filter(t =>
        (t.title && t.title.toLowerCase().includes(q)) ||
        (t.description && t.description.toLowerCase().includes(q)) ||
        (t.project && t.project.toLowerCase().includes(q))
      );
    }
    if (taskStatusFilter) {
      list = list.filter(t => t.status === taskStatusFilter);
    }
    if (taskPriorityFilter) {
      list = list.filter(t => t.priority === taskPriorityFilter);
    }
    if (taskQuickFilter === 'modification') {
      list = list.filter(t => t.status !== 'completed' && (t.needsModification || t.reviewStatus === 'changes-requested'));
    } else if (taskQuickFilter === 'overdue') {
      list = list.filter(t => t.isOverdue);
    } else if (taskQuickFilter === 'inProgress') {
      list = list.filter(t => t.status === 'in-process');
    } else if (taskQuickFilter === 'pending') {
      list = list.filter(t => t.status === 'pending');
    } else if (taskQuickFilter === 'inReview') {
      list = list.filter(t => t.status === 'in-review');
    } else if (taskQuickFilter === 'completed') {
      list = list.filter(t => t.status === 'completed');
    }
    return list;
  }, [tasksList, taskSearch, taskStatusFilter, taskPriorityFilter, taskQuickFilter]);

  const stats = dashboardData?.stats || {};
  const todayAtt = dashboardData?.todayAttendance || {};
  const isOnLeaveToday = Boolean(
    todayAtt.isOnLeave ||
    todayAtt.status === 'On Leave' ||
    todayAtt.status === 'on-leave' ||
    todayAtt.leaveDetails
  );
  const leaveInfo = todayAtt.leaveDetails || {};
  const leaveTitle = formatLeaveTypeName(leaveInfo.leaveType || todayAtt.leaveReason || 'Approved Leave');

  return (
    <div className="dashboard-page employee-dashboard">
      {/* Clean Page Title Row (Announcements & Chat have their own dedicated rich headers) */}
      {tab !== 'announcements' && tab !== 'chat' && tab !== 'holidays' && tab !== 'profile' && (
        <div className="page-header-row">
          <div className="page-header-info">
            <div className="page-title-icon-box">
              {tab === 'dashboard' ? <Layers size={22} /> :
               tab === 'tasks' ? <CheckSquare size={22} /> :
               tab === 'projects' ? <Briefcase size={22} /> :
               tab === 'leave' ? <CalendarDays size={22} /> :
               tab === 'attendance' ? <Clock size={22} /> :
               tab === 'profile' ? <UserRound size={22} /> :
               <Users size={22} />}
            </div>
            <div>
              <h2 className="page-main-title">
                {tab === 'dashboard' ? 'Team Dashboard' :
                 tab === 'tasks' ? 'My Assigned Tasks' :
                 tab === 'projects' ? 'My Projects' :
                 tab === 'leave' ? 'Leave & Quotas' :
                 tab === 'attendance' ? 'My Everyday Attendance & Working Hours' :
                 tab === 'profile' ? 'My Profile & Settings' : 'Employee Workspace'}
              </h2>
              <p className="page-subtitle">
                {tab === 'dashboard' ? 'Overview of your workspace, upcoming deadlines, and team activity.' :
                 tab === 'tasks' ? 'Track your active deliverables, pending reviews, and completed work.' :
                 tab === 'projects' ? 'Collaborate on department projects, documents, and key milestones.' :
                 tab === 'leave' ? 'Submit leave requests and monitor your remaining paid & casual quotas.' :
                 tab === 'attendance' ? 'Daily clock-in records, shift hours, and working duration logs.' :
                 tab === 'profile' ? 'Manage your personal details, emergency contacts, and account security.' :
                 'Your dedicated personal workspace and operational portal.'}
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

      {error && <p className="error-text" role="alert">{error}</p>}
      {loading && !dashboardData && tab === 'dashboard' && (
        <p className="manager-loading">Loading your personalized dashboard...</p>
      )}

      {/* =========================================================================
          TAB 1: 1.1 EMPLOYEE DASHBOARD
         ========================================================================= */}
      {tab === 'dashboard' && dashboardData && (
        <div className="employee-dashboard-content">
            {/* Celebratory Approved Leave Top Banner when employee is on leave */}
            {isOnLeaveToday && (
              <div className="employee-leave-banner-card">
                <div className="leave-banner-icon-wrap">
                  <Palmtree size={24} />
                </div>
                <div className="leave-banner-content">
                  <div className="leave-banner-headline">
                    <span className="leave-badge-chip">Approved Leave</span>
                    <h4>You are on Approved Leave Today ({leaveTitle})</h4>
                  </div>
                  <p>
                    {leaveInfo.reason
                      ? `Approved request: "${leaveInfo.reason}"`
                      : 'Your leave has been approved by your reporting manager. Your attendance is marked as excused paid leave. Regular clock-in is not required today.'}
                  </p>
                  <div className="leave-banner-meta">
                    <span className="leave-meta-item">
                      <CalendarDays size={13} />
                      {leaveInfo.startDate && leaveInfo.endDate
                        ? `${new Date(leaveInfo.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} – ${new Date(leaveInfo.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`
                        : 'Today'}
                    </span>
                    <span className="leave-meta-dot">·</span>
                    <span className="leave-meta-item">
                      <CheckCircle2 size={13} className="text-emerald" />
                      {leaveInfo.totalDays ? `${leaveInfo.totalDays} Day${leaveInfo.totalDays > 1 ? 's' : ''} Excused` : 'Excused Day'}
                    </span>
                  </div>
                </div>
                <div className="leave-banner-aside">
                  <span className="leave-rest-tag">🌴 Enjoy your time off!</span>
                </div>
              </div>
            )}

            {/* Celebratory Salary Credited via Razorpay Banner */}
            {latestPaidSalary && !dismissedSalaryBannerIds.includes(String(latestPaidSalary._id)) && (
              <div className="payroll-credited-dashboard-card">
                <div className="credited-card-icon-wrap">
                  <CheckCircle2 size={24} className="text-emerald" />
                </div>
                <div className="credited-card-body">
                  <div className="credited-card-pill-row">
                    <span className="credited-status-tag">💰 SALARY CREDITED VIA RAZORPAY</span>
                    <span className="credited-period-tag">{latestPaidSalary.periodLabel}</span>
                  </div>
                  <h3 className="credited-card-title">
                    ₹{Number(latestPaidSalary.netSalary).toLocaleString('en-IN')} Credited Successfully
                  </h3>
                  <p className="credited-card-subtitle">
                    Your {latestPaidSalary.periodLabel} compensation has been disbursed to your bank account via Razorpay.
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
                    View Official Payslip →
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

            {/* Elevated Identity & Manager Banner */}
            <div className="employee-info-card elevated-info-card">
              <div className="info-main">
                <div className="emp-avatar-wrapper">
                  <UserAvatar user={dashboardData.user} className="emp-avatar-medium" />
                  <span className={`emp-online-indicator ${isOnLeaveToday ? 'status-leave' : 'status-online'}`} />
                </div>
                <div className="info-main-details">
                  <div className="info-name-row">
                    <h3>{dashboardData.user?.name}</h3>
                    {isOnLeaveToday ? (
                      <span className="status-pill status-on-leave">
                        <Palmtree size={12} /> On Leave Today
                      </span>
                    ) : dashboardData.user?.isSuspended ? (
                      <span className="status-pill status-suspended">
                        <span className="pulse-dot" /> Suspended
                      </span>
                    ) : (
                      <span className="status-pill status-active">
                        <span className="pulse-dot" /> Active Employee
                      </span>
                    )}
                  </div>

                  <div className="emp-tags-row">
                    <span className="emp-meta-badge badge-role">
                      <Briefcase size={12} /> {dashboardData.user?.designation || 'Specialist'}
                    </span>
                    <span className="emp-meta-badge badge-dept">
                      <Building2 size={12} /> {dashboardData.user?.departmentInfo?.name || dashboardData.user?.department || 'General'}
                    </span>
                    <span className="emp-meta-badge badge-team">
                      <Users size={12} /> {dashboardData.user?.team || 'Operations'}
                    </span>
                    {dashboardData.user?.employeeId && (
                      <span className="emp-meta-badge badge-id">
                        <Hash size={12} /> {dashboardData.user.employeeId}
                      </span>
                    )}
                    {dashboardData.user?.joiningDate && (
                      <span className="emp-meta-badge badge-date">
                        <Calendar size={12} /> Joined: {new Date(dashboardData.user.joiningDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Reporting Manager block */}
              <div className="reporting-manager-box">
                <span className="manager-label">
                  <ShieldCheck size={13} className="text-blue" /> Reporting Manager
                </span>
                <div className="manager-details">
                  {dashboardData.user?.manager ? (
                    <>
                      <UserAvatar user={dashboardData.user.manager} className="emp-avatar-small" />
                      <div className="manager-text-col">
                        <strong>{dashboardData.user.manager.name}</strong>
                        <small>{dashboardData.user.manager.designation || 'Manager'} · {dashboardData.user.manager.email}</small>
                      </div>
                    </>
                  ) : (
                    <span className="text-muted">Directly reporting to Department Head</span>
                  )}
                </div>
              </div>
            </div>

            {/* Prominent Leave Decision Alert Banner (Approved / Rejected) */}
            {recentLeaveDecision && (
              <div className={`emp-leave-decision-alert alert-${recentLeaveDecision.status}`}>
                <div className="alert-icon-side">
                  {recentLeaveDecision.status === 'approved' ? (
                    <CheckCircle2 size={22} className="text-emerald" />
                  ) : (
                    <XCircle size={22} className="text-rose" />
                  )}
                </div>
                <div className="alert-body-content">
                  <div className="alert-header-row">
                    <span className="alert-title-text">
                      Leave Request {recentLeaveDecision.status === 'approved' ? 'Approved' : 'Rejected'}
                    </span>
                    <span className={`alert-status-pill pill-${recentLeaveDecision.status}`}>
                      {recentLeaveDecision.status.toUpperCase()}
                    </span>
                    <span className="alert-date-time">
                      {new Date(recentLeaveDecision.reviewedAt || recentLeaveDecision.updatedAt || recentLeaveDecision.approvedAt || recentLeaveDecision.rejectedAt || recentLeaveDecision.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  <p className="alert-desc-text">
                    Your request for <strong>{formatLeaveTypeName(recentLeaveDecision.leaveType)}</strong> ({new Date(recentLeaveDecision.startDate).toLocaleDateString()} &mdash; {new Date(recentLeaveDecision.endDate).toLocaleDateString()}, {recentLeaveDecision.totalDays || 1} {recentLeaveDecision.totalDays === 1 ? 'day' : 'days'}) was <strong>{recentLeaveDecision.status}</strong> by {recentLeaveDecision.approver?.name || (recentLeaveDecision.approverRole === 'Admin' ? 'Executive Admin' : 'Reporting Manager')} ({recentLeaveDecision.approverRole || 'Approver'}).
                    {recentLeaveDecision.status === 'rejected' && recentLeaveDecision.rejectionReason && (
                      <span className="alert-reason-block">
                        <strong>Reason:</strong> {recentLeaveDecision.rejectionReason}
                      </span>
                    )}
                  </p>
                </div>
                <div className="alert-action-side">
                  <button
                    type="button"
                    className="btn-alert-redirect"
                    onClick={handleViewLeaveTab}
                  >
                    View in Leave &amp; Quotas &rarr;
                  </button>
                  <button
                    type="button"
                    className="btn-alert-dismiss"
                    onClick={() => dismissLeaveBanner(recentLeaveDecision._id)}
                    title="Dismiss alert"
                    aria-label="Dismiss alert"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* Today's Shift Clock In / Clock Out Hero Section (Main Dashboard) */}
            {(() => {
              const isWorkingNow = Boolean(todayAtt.clockIn && !todayAtt.clockOut);
              const isCompleted = Boolean(todayAtt.clockIn && todayAtt.clockOut);
              const elapsedSecs = getTodayElapsedSeconds();
              const durationStr = formatElapsedDuration(elapsedSecs, isWorkingNow);

              const cardStatusClass = isOnLeaveToday
                ? 'hero-leave'
                : isWorkingNow
                ? 'hero-active'
                : isCompleted
                ? 'hero-completed'
                : 'hero-pending';

              return (
                <div className={`my-attendance-hero-card dashboard-clock-card ${cardStatusClass}`}>
                  <div className="hero-status-content">
                    <div className="hero-status-badge-wrap">
                      {isOnLeaveToday ? (
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

                    {isOnLeaveToday ? (
                      <div className="hero-times-row hero-leave-details-row">
                        <div className="hero-time-col">
                          <span className="hero-time-label">Leave Category</span>
                          <strong className="hero-time-val text-purple">
                            {leaveTitle}
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
                            {todayAtt.clockIn ? new Date(todayAtt.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--'}
                          </strong>
                        </div>
                        <div className="hero-time-divider" />
                        <div className="hero-time-col">
                          <span className="hero-time-label">Clock Out</span>
                          <strong className="hero-time-val">
                            {todayAtt.clockOut ? new Date(todayAtt.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--'}
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
                    {isOnLeaveToday ? (
                      <div className="leave-action-group">
                        <div className="leave-excused-chip">
                          <CheckCircle2 size={16} className="text-emerald" />
                          <span>Excused from Clock-in</span>
                        </div>
                        {!todayAtt.clockIn && (
                          <button
                            type="button"
                            className="btn-secondary btn-small btn-clock-override"
                            onClick={() => handleClockIn(false)}
                            title="Click if you need to clock in and work during your leave"
                          >
                            <LogIn size={13} />
                            <span>Clock In Anyway</span>
                          </button>
                        )}
                      </div>
                    ) : !todayAtt.clockIn ? (
                      <button
                        type="button"
                        className="btn-clock-action btn-clock-in"
                        onClick={() => handleClockIn(false)}
                        title="Clock in for today's work"
                      >
                        <LogIn size={16} />
                        <span>Clock In Now</span>
                      </button>
                    ) : isWorkingNow ? (
                      <button
                        type="button"
                        className="btn-clock-action btn-clock-out"
                        onClick={handleClockOut}
                        title="Clock out and complete today's shift"
                      >
                        <LogOut size={16} />
                        <span>Clock Out Now</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn-clock-action btn-clock-reopen"
                        onClick={() => handleClockIn(true)}
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

          {/* Submissions Requiring Modifications Alert Banner */}
          {(() => {
            const activeModTasks = (dashboardData.tasksRequiringModifications || []).filter(
              t => t.status !== 'completed' && t.status !== 'in-review' && t.reviewStatus === 'changes-requested'
            );
            if (activeModTasks.length === 0) return null;
            return (
              <div className="modifications-alert-banner">
                <div className="mod-heading">
                  <AlertTriangle size={20} className="text-red" />
                  <div>
                    <h4>Action Required: Modifications Requested by Manager ({activeModTasks.length})</h4>
                    <p>Your manager has reviewed and requested revisions on the following tasks:</p>
                  </div>
                </div>
                <div className="mod-tasks-list">
                  {activeModTasks.map((task) => (
                    <div key={task._id} className="mod-task-item">
                      <div>
                        <strong>{task.title}</strong>
                        <span> · Project: {task.project || 'General'}</span>
                        {task.managerFeedback?.[task.managerFeedback.length - 1] && (
                          <p className="mod-feedback-text">
                            <b>Manager Remark:</b> &quot;{task.managerFeedback[task.managerFeedback.length - 1].text}&quot;
                          </p>
                        )}
                      </div>
                      <button className="btn-primary btn-small" onClick={() => openTask(task._id, 'submit')}>
                        <RotateCcw size={14} /> Review &amp; Resubmit
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Workload KPIs Grid */}
          <div className="manager-stat-grid employee-stat-grid">
            <div className="dashboard-stat-card is-clickable" onClick={() => setView && setView('tasks')} role="button" tabIndex={0} title="View Projects">
              <div className="stat-card-header">
                <div className="stat-icon-bubble bubble-orange">
                  <Briefcase size={20} strokeWidth={2.2} />
                </div>
                <span className="stat-card-arrow" title="View details">→</span>
              </div>
              <div className="stat-card-content">
                <span className="stat-card-value">{stats.totalProjects || 0}</span>
                <span className="stat-card-label">Assigned Projects</span>
                <span className="stat-card-subtitle">Active assignments</span>
              </div>
            </div>

            <div className="dashboard-stat-card is-clickable" onClick={() => setView && setView('tasks')} role="button" tabIndex={0} title="View Task Management Board">
              <div className="stat-card-header">
                <div className="stat-icon-bubble bubble-blue">
                  <CheckSquare size={20} strokeWidth={2.2} />
                </div>
                <span className="stat-card-arrow" title="View tasks">→</span>
              </div>
              <div className="stat-card-content">
                <span className="stat-card-value">{stats.totalTasks || 0}</span>
                <span className="stat-card-label">Total Tasks</span>
                <span className="stat-card-subtitle">Assigned to you</span>
              </div>
            </div>

            <div className="dashboard-stat-card is-clickable" onClick={() => setView && setView('tasks')} role="button" tabIndex={0} title="View Task Management Board">
              <div className="stat-card-header">
                <div className="stat-icon-bubble bubble-amber">
                  <Clock size={20} strokeWidth={2.2} />
                </div>
                <span className="stat-card-arrow" title="View tasks">→</span>
              </div>
              <div className="stat-card-content">
                <span className="stat-card-value">{stats.pendingTasks || 0}</span>
                <span className="stat-card-label">To Do (Pending)</span>
                <span className="stat-card-subtitle">Awaiting start</span>
              </div>
            </div>

            <div className="dashboard-stat-card is-clickable" onClick={() => setView && setView('tasks')} role="button" tabIndex={0} title="View Task Management Board">
              <div className="stat-card-header">
                <div className="stat-icon-bubble bubble-sky">
                  <TrendingUp size={20} strokeWidth={2.2} />
                </div>
                <span className="stat-card-arrow" title="View tasks">→</span>
              </div>
              <div className="stat-card-content">
                <span className="stat-card-value">{stats.inProgressTasks || 0}</span>
                <span className="stat-card-label">In Progress</span>
                <span className="stat-card-subtitle">Currently working</span>
              </div>
            </div>

            <div className="dashboard-stat-card is-clickable" onClick={() => setView && setView('tasks')} role="button" tabIndex={0} title="View Task Management Board">
              <div className="stat-card-header">
                <div className="stat-icon-bubble bubble-purple">
                  <UserCheck size={20} strokeWidth={2.2} />
                </div>
                <span className="stat-card-arrow" title="View tasks">→</span>
              </div>
              <div className="stat-card-content">
                <span className="stat-card-value">{stats.inReviewTasks || 0}</span>
                <span className="stat-card-label">Under Review</span>
                <span className="stat-card-subtitle">Pending approval</span>
              </div>
            </div>

            <div className="dashboard-stat-card is-clickable" onClick={() => setView && setView('tasks')} role="button" tabIndex={0} title="View Task Management Board">
              <div className="stat-card-header">
                <div className="stat-icon-bubble bubble-emerald">
                  <CheckCircle2 size={20} strokeWidth={2.2} />
                </div>
                <span className="stat-card-arrow" title="View tasks">→</span>
              </div>
              <div className="stat-card-content">
                <span className="stat-card-value">{stats.completedTasks || 0}</span>
                <span className="stat-card-label">Completed</span>
                <span className="stat-card-subtitle">Verified done</span>
              </div>
            </div>

            <div className="dashboard-stat-card is-clickable" onClick={() => setView && setView('tasks')} role="button" tabIndex={0} title="View Task Management Board">
              <div className="stat-card-header">
                <div className="stat-icon-bubble bubble-rose">
                  <AlertTriangle size={20} strokeWidth={2.2} />
                </div>
                <span className="stat-card-arrow" title="View tasks">→</span>
              </div>
              <div className="stat-card-content">
                <span className="stat-card-value">{stats.overdueTasks || 0}</span>
                <span className="stat-card-label">Overdue Tasks</span>
                <span className="stat-card-subtitle">Requires attention</span>
              </div>
            </div>

            <div className="dashboard-stat-card">
              <div className="stat-card-header">
                <div className="stat-icon-bubble bubble-teal">
                  <Target size={20} strokeWidth={2.2} />
                </div>
              </div>
              <div className="stat-card-content">
                <span className="stat-card-value">{stats.completionRate || 0}%</span>
                <span className="stat-card-label">Completion Rate</span>
                <span className="stat-card-subtitle">Overall efficiency</span>
              </div>
            </div>
          </div>

          {/* Quick Actions Bar */}
          <section className="dashboard-quick-actions-bar" aria-label="Employee quick actions">
            <div className="quick-actions-info">
              <h3>Quick actions</h3>
              <p>Your daily workflow shortcuts.</p>
            </div>
            <div className="quick-actions-list">
              <button
                type="button"
                className="action-pill-btn action-pill-primary"
                onClick={() => setView && setView('tasks')}
              >
                <CheckSquare size={15} />
                <span>Task Board</span>
              </button>
              <button
                type="button"
                className="action-pill-btn action-pill-default"
                onClick={() => setView && setView('attendance')}
              >
                <Clock size={15} />
                <span>My Attendance</span>
              </button>
              <button
                type="button"
                className="action-pill-btn action-pill-default"
                onClick={openApplyLeaveModal}
              >
                <CalendarDays size={15} />
                <span>Apply Leave</span>
              </button>
              <button
                type="button"
                className="action-pill-btn action-pill-default"
                onClick={() => setView && setView('holidays')}
              >
                <Palmtree size={15} />
                <span>Holidays</span>
              </button>
              <button
                type="button"
                className="action-pill-btn action-pill-default"
                onClick={() => setView && setView('announcements')}
              >
                <Megaphone size={15} />
                <span>Announcements</span>
              </button>
            </div>
          </section>

          {/* 2-Column Dashboard Grid */}
          <div className="employee-columns-grid">
            {/* Left Column: Deadlines, Project Progress, Task Stats */}
            <div className="employee-column-left">
              {/* Upcoming Deadlines */}
              <section className="emp-panel">
                <header>
                  <div className="panel-title-wrap">
                    <Calendar size={16} />
                    <h3>Upcoming Deadlines</h3>
                  </div>
                  <span>Projects &amp; Tasks ({dashboardData.upcomingDeadlines?.length || 0})</span>
                </header>

                {!dashboardData.upcomingDeadlines || dashboardData.upcomingDeadlines.length === 0 ? (
                  <div className="emp-deadline-empty-state">
                    <CheckCircle2 size={24} className="empty-icon" />
                    <p className="empty-title">All caught up!</p>
                    <span className="empty-desc">No upcoming deadlines at this moment.</span>
                  </div>
                ) : (
                  <div className="emp-deadlines-stream">
                    {dashboardData.upcomingDeadlines.map((item) => {
                      const status = getDeadlineStatus(item);
                      const isProject = item.type === 'project';
                      const formattedDeadline = item.deadline
                        ? new Date(item.deadline).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                        : 'No deadline';

                      return (
                        <div
                          key={`${item.type}-${item.id}`}
                          className={`emp-deadline-card status-${status.type}`}
                          onClick={() => (isProject ? openProject(item.id) : openTask(item.id, 'details'))}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              if (isProject) {
                                openProject(item.id);
                              } else {
                                openTask(item.id, 'details');
                              }
                            }
                          }}
                          title={`Click to view ${item.type} details`}
                        >
                          <div className="emp-deadline-card-header">
                            <div className="emp-deadline-tags">
                              <span className={`emp-deadline-type type-${item.type}`}>
                                {isProject ? <Briefcase size={11} /> : <CheckSquare size={11} />}
                                {item.type}
                              </span>
                              {item.priority && (
                                <span className={`emp-deadline-priority priority-${String(item.priority).toLowerCase()}`}>
                                  {item.priority}
                                </span>
                              )}
                            </div>
                            <span className={`emp-deadline-badge ${status.className}`}>
                              {status.type === 'today' && <Clock size={11} />}
                              {status.type === 'overdue' && <AlertTriangle size={11} />}
                              {status.text}
                            </span>
                          </div>

                          <div className="emp-deadline-card-main">
                            <h4 className="emp-deadline-name">{item.title}</h4>
                            {item.project && !isProject && (
                              <div className="emp-deadline-subtext">
                                <FolderOpen size={12} />
                                <span>Project: <b>{item.project}</b></span>
                              </div>
                            )}
                          </div>

                          <div className="emp-deadline-card-footer">
                            <div className="emp-deadline-due">
                              <Calendar size={12} />
                              <span>Deadline: <b>{formattedDeadline}</b></span>
                            </div>
                            <div className="emp-deadline-cta">
                              <span>View {isProject ? 'Project' : 'Task'}</span>
                              <ArrowRight size={12} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Project-Wise Progress & Contributions */}
              <section className="emp-panel">
                <header>
                  <div className="panel-title-wrap">
                    <FolderOpen size={16} />
                    <h3>My Projects &amp; Contributions</h3>
                  </div>
                  <span>{dashboardData.projectContributions?.length || 0} Projects</span>
                </header>

                {dashboardData.projectContributions?.length === 0 ? (
                  <p className="admin-empty-state">No assigned projects.</p>
                ) : (
                  <div className="emp-projects-progress-list">
                    {dashboardData.projectContributions.map((proj) => (
                      <div key={proj.id} className="emp-project-progress-card">
                        <div className="proj-head">
                          <strong>{proj.name}</strong>
                          <span className={`status-pill status-${proj.status?.toLowerCase().replace(/\s+/g, '-')}`}>{proj.status}</span>
                        </div>
                        <div className="progress-dual-bars">
                          <div>
                            <div className="bar-label">
                              <span>Overall Project Progress</span>
                              <b>{proj.progress}%</b>
                            </div>
                            <div className="workload-bar-track">
                              <div className="workload-bar-fill" style={{ width: `${proj.progress}%` }} />
                            </div>
                          </div>
                          <div>
                            <div className="bar-label">
                              <span>My Tasks Completed</span>
                              <b>{proj.completedTasksCount}/{proj.assignedTasksCount} ({proj.myContributionRate}%)</b>
                            </div>
                            <div className="workload-bar-track">
                              <div className="workload-bar-fill attendance-fill" style={{ width: `${proj.myContributionRate}%` }} />
                            </div>
                          </div>
                        </div>
                        {proj.overdueTasksCount > 0 && (
                          <small className="text-red">⚠ {proj.overdueTasksCount} overdue tasks in this project</small>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* Right Column: Meetings, Announcements, Feedback, Activities */}
            <div className="employee-column-right">
              {/* Upcoming Team Meetings & Events */}
              <section className="emp-panel">
                <header>
                  <div className="panel-title-wrap">
                    <Users size={16} />
                    <h3>Upcoming Team Meetings &amp; Events</h3>
                  </div>
                  <span>Meetings &amp; Syncs</span>
                </header>

                {dashboardData.upcomingMeetings?.length === 0 ? (
                  <p className="admin-empty-state">No upcoming meetings scheduled.</p>
                ) : (
                  <div className="emp-meetings-list">
                    {dashboardData.upcomingMeetings.map((meeting) => (
                      <div key={meeting._id} className="emp-meeting-item">
                        <div className="meeting-date-box">
                          <span className="m-month">{new Date(meeting.startTime).toLocaleString('default', { month: 'short' })}</span>
                          <span className="m-day">{new Date(meeting.startTime).getDate()}</span>
                        </div>
                        <div className="meeting-info">
                          <strong>{meeting.title}</strong>
                          <p>{meeting.description || 'Team sync'}</p>
                          <small>
                            <Clock size={11} /> {new Date(meeting.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · Organizer: {meeting.organizer?.name || 'Manager'}
                          </small>
                        </div>
                        {meeting.meetingLink && (
                          <a href={meeting.meetingLink} target="_blank" rel="noreferrer" className="btn-ghost btn-small">
                            Join
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Manager Feedback */}
              <section className="emp-panel">
                <header>
                  <div className="panel-title-wrap">
                    <Star size={16} />
                    <h3>Manager Feedback &amp; Reviews</h3>
                  </div>
                  <span>Performance</span>
                </header>

                {dashboardData.recentFeedback?.length === 0 ? (
                  <p className="admin-empty-state">No feedback recorded yet.</p>
                ) : (
                  <div className="emp-feedback-list">
                    {dashboardData.recentFeedback.map((fb) => (
                      <div key={fb._id} className="emp-feedback-item">
                        <div className="fb-top">
                          <strong>{fb.manager?.name || 'Manager'}</strong>
                          <div className="fb-stars">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                size={12}
                                fill={star <= fb.rating ? '#f59e0b' : 'none'}
                                color={star <= fb.rating ? '#f59e0b' : '#d1d5db'}
                              />
                            ))}
                          </div>
                        </div>
                        <p>{fb.comments}</p>
                        <small>{new Date(fb.createdAt).toLocaleDateString()} · {fb.feedbackType}</small>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: 1.2 MY PROFILE & DEPARTMENT INFORMATION (SETTINGS)
         ========================================================================= */}
      {tab === 'profile' && (
        <SettingsView user={user} onUserUpdated={updateUser} />
      )}

      {/* =========================================================================
          TAB 3: 1.3 MY PROJECTS
         ========================================================================= */}
      {tab === 'projects' && (
        <div className="employee-projects-view">
          {/* Toolbar */}
          <div className="manager-toolbar">
            <div className="manager-search-box">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                placeholder="Search projects by name, objectives..."
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
              />
              {projectSearch && (
                <button className="clear-btn" onClick={() => setProjectSearch('')}>
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="manager-filters-group">
              <select value={projectStatusFilter} onChange={(e) => setProjectStatusFilter(e.target.value)}>
                <option value="">All Statuses</option>
                <option value="Planning">Planning</option>
                <option value="In Progress">In Progress</option>
                <option value="On Hold">On Hold</option>
                <option value="Completed">Completed</option>
              </select>

              <select value={projectPriorityFilter} onChange={(e) => setProjectPriorityFilter(e.target.value)}>
                <option value="">All Priorities</option>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>

              {(projectSearch || projectStatusFilter || projectPriorityFilter) && (
                <button
                  className="btn-ghost btn-small"
                  onClick={() => {
                    setProjectSearch('');
                    setProjectStatusFilter('');
                    setProjectPriorityFilter('');
                  }}
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {filteredProjects.length === 0 ? (
            <div className="manager-empty-box">
              <FolderOpen size={36} className="text-muted" />
              <h4>No projects assigned matching your filters.</h4>
              <p>Projects assigned to you by your Manager will appear here.</p>
            </div>
          ) : (
            <div className="manager-project-grid">
              {filteredProjects.map((project) => (
                <div key={project._id} className="manager-project-card">
                  <div className="project-card-header">
                    <div>
                      <div className="card-badge-row">
                        <span className={`priority-tag priority-${project.priority?.toLowerCase()}`}>
                          <Flag size={11} /> {project.priority}
                        </span>
                        <span className="dept-tag">{project.department?.name || 'Department'}</span>
                      </div>
                      <h4 className="project-card-title">{project.name}</h4>
                    </div>
                    <span className={`status-badge status-${project.status?.toLowerCase().replace(/\s+/g, '-')}`}>
                      {project.status}
                    </span>
                  </div>

                  {project.description && (
                    <p className="project-card-desc">{project.description}</p>
                  )}

                  {/* Progress & Contributions */}
                  <div className="project-progress-wrap">
                    <div className="progress-text-row">
                      <span>Overall Project Progress</span>
                      <strong>{project.progress || 0}%</strong>
                    </div>
                    <div className="workload-bar-track">
                      <div className="workload-bar-fill" style={{ width: `${project.progress || 0}%` }} />
                    </div>
                  </div>

                  <div className="project-deadline-row">
                    <div className="deadline-item">
                      <Calendar size={13} className="text-muted" />
                      <span>Deadline: <b>{project.deadline ? new Date(project.deadline).toLocaleDateString() : 'N/A'}</b></span>
                    </div>
                    {project.deadline && (
                      <span className={`days-countdown ${project.isOverdue ? 'overdue' : project.daysRemaining <= 3 ? 'soon' : 'ok'}`}>
                        {project.isOverdue ? `Overdue by ${Math.abs(project.daysRemaining)}d` : `${project.daysRemaining}d left`}
                      </span>
                    )}
                  </div>

                  <div className="project-team-row">
                    <div className="lead-col">
                      <span className="sub-label">Team Lead:</span>
                      <div className="lead-badge">
                        <UserAvatar user={project.teamLead} className="emp-avatar-small" />
                        <span>{project.teamLead?.name || 'Unassigned'}</span>
                      </div>
                    </div>
                    <div className="members-col">
                      <span className="sub-label">My Contribution:</span>
                      <strong>{project.myCompletedTasks}/{project.myTasksCount} tasks ({project.myContributionPercentage}%)</strong>
                    </div>
                  </div>

                  <div className="project-meta-counters">
                    <span><CheckCircle2 size={13} /> {project.completedMilestones}/{project.milestonesCount} milestones</span>
                    <span><Paperclip size={13} /> {project.documentsCount || 0} docs</span>
                    <span><MessageSquare size={13} /> {project.commentsCount || 0} updates</span>
                  </div>

                  <div className="card-actions-row">
                    <button
                      className="btn-card-action primary"
                      onClick={() => openProject(project._id)}
                    >
                      <FolderOpen size={14} /> Open Project Workspace
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 4: 1.4 MY TASKS
         ========================================================================= */}
      {tab === 'tasks' && (
        <div className="employee-tasks-view">
          {/* Toolbar */}
          <div className="manager-toolbar">
            <div className="manager-search-box">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                placeholder="Search tasks by title, instructions, project..."
                value={taskSearch}
                onChange={(e) => setTaskSearch(e.target.value)}
              />
              {taskSearch && (
                <button className="clear-btn" onClick={() => setTaskSearch('')}>
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="manager-filters-group">
              <select value={taskStatusFilter} onChange={(e) => setTaskStatusFilter(e.target.value)}>
                <option value="">All Statuses</option>
                <option value="pending">To Do</option>
                <option value="in-process">In Progress</option>
                <option value="in-review">Under Review</option>
                <option value="completed">Completed</option>
              </select>

              <select value={taskPriorityFilter} onChange={(e) => setTaskPriorityFilter(e.target.value)}>
                <option value="">All Priorities</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>

              {(taskSearch || taskStatusFilter || taskPriorityFilter || taskQuickFilter !== 'all') && (
                <button
                  className="btn-ghost btn-small"
                  onClick={() => {
                    setTaskSearch('');
                    setTaskStatusFilter('');
                    setTaskPriorityFilter('');
                    setTaskQuickFilter('all');
                  }}
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Quick Filter Pills */}
          <div className="manager-quick-pills">
            <button
              className={`filter-pill ${taskQuickFilter === 'all' ? 'active' : ''}`}
              onClick={() => setTaskQuickFilter('all')}
            >
              All Tasks ({tasksList.length})
            </button>
            <button
              className={`filter-pill ${taskQuickFilter === 'pending' ? 'active' : ''}`}
              onClick={() => setTaskQuickFilter(taskQuickFilter === 'pending' ? 'all' : 'pending')}
            >
              To Do ({tasksList.filter(t => t.status === 'pending').length})
            </button>
            <button
              className={`filter-pill ${taskQuickFilter === 'inProgress' ? 'active' : ''}`}
              onClick={() => setTaskQuickFilter(taskQuickFilter === 'inProgress' ? 'all' : 'inProgress')}
            >
              In Progress ({tasksList.filter(t => t.status === 'in-process').length})
            </button>
            <button
              className={`filter-pill ${taskQuickFilter === 'inReview' ? 'active' : ''}`}
              onClick={() => setTaskQuickFilter(taskQuickFilter === 'inReview' ? 'all' : 'inReview')}
            >
              In Review ({tasksList.filter(t => t.status === 'in-review').length})
            </button>
            <button
              className={`filter-pill ${taskQuickFilter === 'completed' ? 'active' : ''}`}
              onClick={() => setTaskQuickFilter(taskQuickFilter === 'completed' ? 'all' : 'completed')}
            >
              Completed ({tasksList.filter(t => t.status === 'completed').length})
            </button>
            <button
              className={`filter-pill pill-overdue ${taskQuickFilter === 'overdue' ? 'active' : ''}`}
              onClick={() => setTaskQuickFilter(taskQuickFilter === 'overdue' ? 'all' : 'overdue')}
            >
              Overdue Tasks ({tasksList.filter(t => t.isOverdue).length})
            </button>
            <button
              className={`filter-pill pill-overdue ${taskQuickFilter === 'modification' ? 'active' : ''}`}
              onClick={() => setTaskQuickFilter(taskQuickFilter === 'modification' ? 'all' : 'modification')}
            >
              <AlertTriangle size={13} /> Modifications ({tasksList.filter(t => t.status !== 'completed' && (t.needsModification || t.reviewStatus === 'changes-requested')).length})
            </button>
          </div>

          {filteredTasks.length === 0 ? (
            <div className="manager-empty-box">
              <Briefcase size={36} className="text-muted" />
              <h4>No tasks match your search or filter criteria.</h4>
              <p>Tasks assigned to you by your Manager will appear here.</p>
            </div>
          ) : (
            <div className="manager-task-table-wrapper">
              <table className="manager-table">
                <thead>
                  <tr>
                    <th>Task Title</th>
                    <th>Project</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Estimated Time</th>
                    <th>Deadline</th>
                    <th>Review / Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.map((task) => {
                    const taskNeedsMod = task.status !== 'completed' && (task.needsModification || task.reviewStatus === 'changes-requested');
                    return (
                    <tr key={task._id} className={taskNeedsMod ? 'row-needs-mod' : task.isOverdue ? 'row-overdue' : ''}>
                      <td>
                        <div className="task-title-cell">
                          <strong>{task.title}</strong>
                          {taskNeedsMod && (
                            <span className="mod-pill">Modifications Requested</span>
                          )}
                          {task.isOverdue && (
                            <span className="overdue-pill">Overdue</span>
                          )}
                        </div>
                      </td>
                      <td>{task.project || 'General'}</td>
                      <td>
                        <span className={`badge-priority priority-${task.priority?.toLowerCase()}`}>
                          {task.priority}
                        </span>
                      </td>
                      <td>
                        <select
                          className={`status-select status-${task.status}`}
                          value={task.status}
                          onChange={(e) => handleTaskStatusChange(task._id, e.target.value)}
                        >
                          <option value="pending">To Do</option>
                          <option value="in-process">In Progress</option>
                          <option value="in-review">Under Review</option>
                          <option value="completed">Completed</option>
                        </select>
                      </td>
                      <td>{Math.floor((task.estimatedMinutes || 60) / 60)}h {(task.estimatedMinutes || 60) % 60}m</td>
                      <td>
                        {task.deadline ? (
                          <span className={task.isOverdue ? 'text-red' : ''}>
                            {new Date(task.deadline).toLocaleDateString()}
                          </span>
                        ) : 'Not set'}
                      </td>
                      <td>
                        <div className="task-row-actions">
                          <button
                            className="btn-card-action"
                            onClick={() => openTask(task._id, 'details')}
                            title="View task instructions & details"
                          >
                            <FileText size={13} />
                            <span>Details</span>
                          </button>
                          {task.status !== 'completed' && (
                            <button
                              className="btn-card-action primary"
                              onClick={() => openTask(task._id, 'submit')}
                              title={taskNeedsMod ? 'Resubmit revised work' : 'Submit completed work'}
                            >
                              <Send size={13} />
                              <span>{taskNeedsMod ? 'Resubmit' : 'Submit'}</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 5: MY LEAVE & QUOTA BALANCES
         ========================================================================= */}
      {tab === 'leave' && (
        <div className="employee-leave-view-container">
          <div className="manager-leave-hero">
            <div className="hero-text-col">
              <div className="hero-badge-pill">
                <CheckCircle2 size={14} />
                <span>Hierarchical Reporting Manager Approval</span>
              </div>
              <h3>My Leave &amp; Quota Balances</h3>
              <p>Apply for leave, track remaining quotas, and review approval decisions from your reporting manager or authorized Admin.</p>
            </div>
            <div className="hero-actions-col">
              <button
                type="button"
                className="btn-primary"
                onClick={openApplyLeaveModal}
              >
                <CalendarDays size={16} /> Apply for Leave
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={loadEmployeeLeaves}
                title="Refresh leave balances"
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

          {/* Assigned Reporting Manager Card */}
          <div className="reporting-manager-banner">
            <div className="manager-rep-info">
              <UserRound size={20} className="text-blue" />
              <div>
                <strong>Assigned Reporting Manager: {leaveOverview.assignedManager?.name || 'Assigned Manager'}</strong>
                <p>Email: {leaveOverview.assignedManager?.email || 'N/A'} · Designation: {leaveOverview.assignedManager?.designation || 'Manager'}</p>
              </div>
            </div>
            <div className="manager-routing-hint">
              <Sparkles size={16} />
              <span>Requests automatically route to your manager. If your manager is on approved leave, Taskflow seamlessly redirects the request to Admin.</span>
            </div>
          </div>

          {/* Leave History List */}
          <div className="emp-leave-history-section">
            <div className="section-head-bar">
              <h4>My Leave Requests History ({leaveOverview.leaveRequests?.length || 0})</h4>
            </div>

            {(!leaveOverview.leaveRequests || leaveOverview.leaveRequests.length === 0) ? (
              <div className="admin-empty-state leave-empty-state">
                <CalendarDays size={36} className="text-muted" />
                <h5>No leave requests submitted yet</h5>
                <p>Click &quot;Apply for Leave&quot; above to submit a new leave request.</p>
              </div>
            ) : (
              <div className="emp-leaves-grid">
                {leaveOverview.leaveRequests.map((l) => {
                  const wasForwarded = l.routingReason?.toLowerCase().includes('approved leave') || l.routingReason?.toLowerCase().includes('unavailable');
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

                      {wasForwarded && (
                        <div className="leave-forwarded-notice">
                          <AlertTriangle size={14} />
                          <div>
                            <strong>Forwarded to Admin:</strong>
                            <span>Your assigned manager was on approved leave during these dates; request was automatically forwarded to Admin for approval.</span>
                          </div>
                        </div>
                      )}

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
                            {l.approver?.name || (l.approverRole === 'Admin' ? 'Organization Admin' : 'Reporting Manager')}
                            <small className="approver-role-sub">({l.approverRole || 'Manager'})</small>
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
        </div>
      )}

      {/* =========================================================================
          TAB 6: MY EVERYDAY ATTENDANCE & WORKING HOURS
         ========================================================================= */}
      {tab === 'attendance' && (
        <MyAttendance user={user} isManager={false} refreshSignal={attendanceRefreshSignal} />
      )}

      {/* =========================================================================
          TAB 7: ANNOUNCEMENTS & BROADCASTS
         ========================================================================= */}
      {tab === 'announcements' && (
        <AnnouncementsPage user={user} />
      )}

      {/* =========================================================================
          TAB 8: DIRECT MESSAGES (CHAT)
         ========================================================================= */}
      {tab === 'chat' && (
        <ChatPage user={user} />
      )}

      {/* =========================================================================
          TAB 9: GOVERNMENT HOLIDAYS
         ========================================================================= */}
      {tab === 'holidays' && (
        <HolidayCalendar user={user} setView={setView} />
      )}

      {/* =========================================================================
          TAB 10: MY SALARY & PAYSLIPS
         ========================================================================= */}
      {tab === 'payroll' && (
        <EmployeeSalaryPortal user={user} setView={setView} />
      )}

      {/* =========================================================================
          MODAL: APPLY LEAVE (EMPLOYEE)
         ========================================================================= */}
      {leaveModalOpen && (
        <div className="manager-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setLeaveModalOpen(false); }}>
          <div className="manager-modal-box apply-leave-modal" role="dialog" aria-modal="true">
            <header className="manager-modal-header">
              <div className="modal-title-with-badge">
                <div className="modal-title-icon-box">
                  <CalendarDays size={20} className="text-blue" />
                </div>
                <div>
                  <h3 className="modal-heading-title">Apply for Leave</h3>
                  <p className="modal-heading-subtitle">Submit a leave request for reporting manager approval</p>
                </div>
              </div>
              <button type="button" className="icon-btn modal-close-btn" onClick={() => setLeaveModalOpen(false)} aria-label="Close">
                <X size={18} />
              </button>
            </header>
            <form onSubmit={handleLeaveSubmit}>
              <div className="modal-body-scroll">
                <div className="emp-routing-preview-banner">
                  <div className="routing-notice-icon-box">
                    <UserRound size={17} />
                  </div>
                  <div className="routing-notice-text">
                    <strong>Routing Notice</strong>
                    <p>Your request will be routed to your assigned reporting manager ({leaveOverview.assignedManager?.name || 'Manager'}). If your manager is on approved leave during your requested dates, Taskflow automatically redirects the request to Admin.</p>
                  </div>
                </div>

                <div className="form-group-field">
                  <label>Leave Type <span className="req">*</span></label>
                  <select
                    className="modal-select-input"
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
                      className="modal-date-input"
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
                      className="modal-date-input"
                      value={leaveForm.endDate}
                      min={leaveForm.startDate || new Date().toISOString().slice(0, 10)}
                      onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="calculated-days-strip">
                  <div className="calc-days-icon-wrap">
                    <Clock size={15} />
                  </div>
                  <span>Calculated Working Days: <strong>{calculatedLeaveDays} {calculatedLeaveDays === 1 ? 'day' : 'days'}</strong></span>
                </div>

                <div className="form-group-field">
                  <label>Reason for Leave <span className="req">*</span></label>
                  <textarea
                    rows={3}
                    className="modal-textarea-input"
                    placeholder="Provide a clear explanation for your leave..."
                    value={leaveForm.reason}
                    onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group-field">
                  <label>Supporting Document <span className="optional-tag">(Optional)</span></label>
                  <div className="file-upload-input-wrap">
                    <input
                      type="file"
                      className="modal-file-input"
                      accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                      onChange={(e) => setLeaveDocFile(e.target.files?.[0] || null)}
                    />
                  </div>
                  <small className="field-hint">Accepted formats: PDF, DOC, DOCX, PNG, JPG (Max 10MB)</small>
                </div>
              </div>

              <footer className="manager-modal-footer">
                <button type="button" className="btn-ghost modal-btn-cancel" onClick={() => setLeaveModalOpen(false)}>Cancel</button>
                <button
                  type="submit"
                  className="btn-primary modal-btn-submit"
                  disabled={leaveBusy}
                >
                  <Send size={15} />
                  <span>{leaveBusy ? 'Sending Request...' : 'Send Leave for Approval'}</span>
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: LEAVE AUDIT HISTORY (EMPLOYEE)
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
                <h4>{formatLeaveTypeName(leaveHistoryModal.leave.leaveType)}</h4>
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

      {/* =========================================================================
          MODAL: PROJECT DETAILS WORKSPACE FOR EMPLOYEE
         ========================================================================= */}
      {selectedProject && (
        <div className="manager-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelectedProject(null); }}>
          <div className="manager-modal-box project-detail-modal" role="dialog" aria-modal="true">
            {/* Elevated Header */}
            <header className="manager-modal-header proj-modal-header-elevated">
              <div className="project-detail-heading">
                <div className="heading-tags">
                  <span className={`priority-tag priority-${(selectedProject.project?.priority || 'normal').toLowerCase()}`}>
                    <span className="priority-dot" />
                    {selectedProject.project?.priority || 'Normal'} Priority
                  </span>
                  {selectedProject.project?.department?.name && (
                    <span className="dept-tag">
                      <Building2 size={12} />
                      {selectedProject.project.department.name}
                    </span>
                  )}
                  <span className="status-tag-subtle">
                    {selectedProject.project?.status || 'Active'}
                  </span>
                </div>
                <h3>{selectedProject.project?.name}</h3>
              </div>
              <button
                type="button"
                className="proj-close-btn"
                onClick={() => setSelectedProject(null)}
                aria-label="Close modal"
                title="Close"
              >
                <X size={18} />
              </button>
            </header>

            {/* Elevated Progress Strip */}
            <div className="modal-progress-strip">
              <div className="strip-labels">
                <div className="strip-left">
                  <span className="strip-title">Project Progress</span>
                  <span className="proj-completion-pill">
                    <strong>{selectedProject.project?.progress || 0}%</strong> Completed
                  </span>
                </div>
                <div className="strip-right">
                  <div className={`proj-deadline-chip ${selectedProject.project?.deadline && new Date(selectedProject.project.deadline) < new Date() && (selectedProject.project?.progress || 0) < 100 ? 'is-overdue' : ''}`}>
                    <Clock size={13} />
                    <span>Deadline: <strong>{selectedProject.project?.deadline ? new Date(selectedProject.project.deadline).toLocaleDateString() : 'N/A'}</strong></span>
                    {selectedProject.project?.deadline && new Date(selectedProject.project.deadline) < new Date() && (selectedProject.project?.progress || 0) < 100 && (
                      <span className="overdue-micro-badge"><AlertTriangle size={11} /> Overdue</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="workload-bar-track">
                <div
                  className="workload-bar-fill proj-bar-gradient"
                  style={{ width: `${Math.min(100, Math.max(0, selectedProject.project?.progress || 0))}%` }}
                />
              </div>
            </div>

            {/* Modern Tab Bar */}
            <div className="modal-subnav proj-modal-subnav">
              <button
                type="button"
                className={projectDetailTab === 'overview' ? 'active' : ''}
                onClick={() => setProjectDetailTab('overview')}
              >
                <Target size={15} />
                <span>Overview &amp; Deliverables</span>
              </button>
              <button
                type="button"
                className={projectDetailTab === 'milestones' ? 'active' : ''}
                onClick={() => setProjectDetailTab('milestones')}
              >
                <CheckCircle2 size={15} />
                <span>Milestones</span>
                <span className="tab-pill-count">{selectedProject.project?.milestones?.length || 0}</span>
              </button>
              <button
                type="button"
                className={projectDetailTab === 'tasks' ? 'active' : ''}
                onClick={() => setProjectDetailTab('tasks')}
              >
                <Briefcase size={15} />
                <span>My Tasks</span>
                <span className="tab-pill-count">{selectedProject.myTasks?.length || 0}</span>
              </button>
              <button
                type="button"
                className={projectDetailTab === 'documents' ? 'active' : ''}
                onClick={() => setProjectDetailTab('documents')}
              >
                <Paperclip size={15} />
                <span>Documents</span>
                <span className="tab-pill-count">{selectedProject.project?.documents?.length || 0}</span>
              </button>
              <button
                type="button"
                className={projectDetailTab === 'comments' ? 'active' : ''}
                onClick={() => setProjectDetailTab('comments')}
              >
                <MessageSquare size={15} />
                <span>Updates &amp; Comments</span>
                <span className="tab-pill-count">{selectedProject.project?.comments?.length || 0}</span>
              </button>
            </div>

            <div className="modal-body-scroll proj-modal-scroll">
              {/* TAB 1: OVERVIEW & DELIVERABLES */}
              {projectDetailTab === 'overview' && (
                <div className="detail-overview-tab">
                  {/* Hero Description Card */}
                  <div className="proj-scope-card proj-desc-hero-card">
                    <div className="scope-card-header">
                      <div className="scope-icon-wrap icon-blue">
                        <FileText size={16} />
                      </div>
                      <h4>Project Overview &amp; Description</h4>
                    </div>
                    <p className="scope-card-body">
                      {selectedProject.project?.description || 'No detailed description provided for this project.'}
                    </p>
                  </div>

                  {/* 2-Column Scope Grid */}
                  <div className="overview-cards-grid">
                    <div className="proj-scope-card">
                      <div className="scope-card-header">
                        <div className="scope-icon-wrap icon-purple">
                          <Target size={16} />
                        </div>
                        <h4>Strategic Objectives</h4>
                      </div>
                      <p className="scope-card-body">
                        {selectedProject.project?.objectives || 'No specific strategic objectives documented.'}
                      </p>
                    </div>

                    <div className="proj-scope-card">
                      <div className="scope-card-header">
                        <div className="scope-icon-wrap icon-emerald">
                          <Layers size={16} />
                        </div>
                        <h4>Requirements &amp; Deliverables Specifications</h4>
                      </div>
                      <p className="scope-card-body">
                        {selectedProject.project?.requirements || 'No specific technical requirements documented.'}
                      </p>
                    </div>
                  </div>

                  {/* 4 Metadata Cards */}
                  <div className="overview-meta-cards">
                    <div className="meta-metric-card">
                      <div className="meta-icon-bubble bubble-emerald">
                        <Briefcase size={16} />
                      </div>
                      <div className="meta-text">
                        <span className="meta-label">Project Manager</span>
                        <strong className="meta-value">{selectedProject.project?.manager?.name || 'Unassigned'}</strong>
                      </div>
                    </div>

                    <div className="meta-metric-card">
                      <div className="meta-icon-bubble bubble-purple">
                        <UserCheck size={16} />
                      </div>
                      <div className="meta-text">
                        <span className="meta-label">Project Lead</span>
                        <strong className="meta-value">{selectedProject.project?.teamLead?.name || 'Unassigned'}</strong>
                      </div>
                    </div>

                    <div className="meta-metric-card">
                      <div className="meta-icon-bubble bubble-blue">
                        <Calendar size={16} />
                      </div>
                      <div className="meta-text">
                        <span className="meta-label">Start Date</span>
                        <strong className="meta-value">
                          {selectedProject.project?.startDate ? new Date(selectedProject.project.startDate).toLocaleDateString() : 'N/A'}
                        </strong>
                      </div>
                    </div>

                    <div className="meta-metric-card">
                      <div className={`meta-icon-bubble ${selectedProject.project?.deadline && new Date(selectedProject.project.deadline) < new Date() && (selectedProject.project?.progress || 0) < 100 ? 'bubble-red' : 'bubble-amber'}`}>
                        <Clock size={16} />
                      </div>
                      <div className="meta-text">
                        <span className="meta-label">Target Deadline</span>
                        <strong className={`meta-value ${selectedProject.project?.deadline && new Date(selectedProject.project.deadline) < new Date() && (selectedProject.project?.progress || 0) < 100 ? 'text-red' : ''}`}>
                          {selectedProject.project?.deadline ? new Date(selectedProject.project.deadline).toLocaleDateString() : 'N/A'}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Associated Tasks Breakdown for Employee */}
                  <div className="overview-task-stats-elevated">
                    <div className="section-head-row">
                      <div className="section-head-left">
                        <Layers size={16} className="text-blue" />
                        <h4>My Assigned Tasks Breakdown</h4>
                      </div>
                      <span className="stats-total-pill">{selectedProject.myTasks?.length || 0} Total Assigned</span>
                    </div>

                    <div className="overview-task-metrics-grid">
                      <div className="stat-box-card">
                        <span className="stat-box-label">Assigned to Me</span>
                        <strong className="stat-box-val">{selectedProject.myTasks?.length || 0}</strong>
                      </div>
                      <div className="stat-box-card border-emerald">
                        <span className="stat-box-label">Completed</span>
                        <strong className="stat-box-val text-emerald">
                          {selectedProject.myTasks?.filter(t => t.status === 'completed').length || 0}
                        </strong>
                      </div>
                      <div className="stat-box-card border-blue">
                        <span className="stat-box-label">In Progress</span>
                        <strong className="stat-box-val text-blue">
                          {selectedProject.myTasks?.filter(t => t.status === 'in-process' || t.status === 'in-progress').length || 0}
                        </strong>
                      </div>
                      <div className="stat-box-card border-amber">
                        <span className="stat-box-label">Pending / To Do</span>
                        <strong className="stat-box-val text-amber">
                          {selectedProject.myTasks?.filter(t => t.status === 'pending' || t.status === 'todo').length || 0}
                        </strong>
                      </div>
                      <div className="stat-box-card border-indigo rate-card">
                        <span className="stat-box-label">My Completion</span>
                        <strong className="stat-box-val text-indigo">
                          {(selectedProject.myTasks?.length || 0) > 0
                            ? Math.round(((selectedProject.myTasks?.filter(t => t.status === 'completed').length || 0) / (selectedProject.myTasks?.length || 1)) * 100)
                            : 0}%
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: MILESTONES & DELIVERABLES */}
              {projectDetailTab === 'milestones' && (
                <div className="detail-milestones-tab">
                  <div className="section-head-row">
                    <div className="section-head-left">
                      <CheckCircle2 size={16} className="text-emerald" />
                      <h4>Project Milestones Checklist</h4>
                    </div>
                    <span className="milestones-progress-pill">
                      {selectedProject.project?.milestones?.filter(m => m.completed).length || 0} of {selectedProject.project?.milestones?.length || 0} completed
                    </span>
                  </div>

                  {(!selectedProject.project?.milestones || selectedProject.project.milestones.length === 0) ? (
                    <div className="proj-empty-card">
                      <CheckCircle2 size={32} className="empty-icon text-muted" />
                      <h5>No milestones configured yet</h5>
                      <p>Project leadership has not scheduled specific milestone deliverables for this project.</p>
                    </div>
                  ) : (
                    <div className="milestone-card-list">
                      {selectedProject.project.milestones.map((m) => (
                        <div key={m._id} className={`milestone-card-item ${m.completed ? 'is-completed' : ''}`}>
                          <div className="milestone-check-col">
                            <button
                              type="button"
                              className="milestone-toggle-check-btn"
                              onClick={() => handleToggleMilestone(m._id, !m.completed)}
                              disabled={projectBusy}
                              title={m.completed ? 'Click to mark as Pending' : 'Click to mark as Completed'}
                              aria-label={m.completed ? 'Mark as Pending' : 'Mark as Completed'}
                            >
                              <CheckCircle2 size={22} className={m.completed ? 'text-emerald' : 'text-muted'} />
                            </button>
                          </div>
                          <div className="milestone-info-col">
                            <div className="milestone-title-line">
                              <strong className={`milestone-title ${m.completed ? 'completed-text' : ''}`}>{m.title}</strong>
                              {m.dueDate && (
                                <span className="milestone-due-badge">
                                  <Calendar size={12} />
                                  Due {new Date(m.dueDate).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                            {m.deliverables && (
                              <div className="milestone-deliverable-line">
                                <span className="deliverable-label">Deliverable:</span>
                                <span className="deliverable-text">{m.deliverables}</span>
                              </div>
                            )}
                            {m.description && (
                              <p className="milestone-desc-text">{m.description}</p>
                            )}
                          </div>
                          <div className="milestone-actions-col">
                            <button
                              type="button"
                              className={`milestone-status-action-btn ${m.completed ? 'is-completed' : 'is-pending'}`}
                              onClick={() => handleToggleMilestone(m._id, !m.completed)}
                              disabled={projectBusy}
                              title={m.completed ? 'Click to mark as Pending' : 'Click to mark as Completed'}
                            >
                              {m.completed ? (
                                <>
                                  <Check size={14} /> Completed
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 size={14} /> Mark as Complete
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: MY TASKS */}
              {projectDetailTab === 'tasks' && (
                <div className="detail-tasks-tab">
                  <div className="section-head-row">
                    <div className="section-head-left">
                      <Briefcase size={16} className="text-blue" />
                      <h4>My Tasks in {selectedProject.project?.name}</h4>
                    </div>
                    <span className="stats-total-pill">{selectedProject.myTasks?.length || 0} Tasks</span>
                  </div>

                  {(!selectedProject.myTasks || selectedProject.myTasks.length === 0) ? (
                    <div className="proj-empty-card">
                      <Briefcase size={32} className="empty-icon text-muted" />
                      <h5>No tasks assigned to you in this project</h5>
                      <p>You have not been assigned any specific tasks for this project yet.</p>
                    </div>
                  ) : (
                    <div className="proj-table-card">
                      <table className="proj-data-table">
                        <thead>
                          <tr>
                            <th>Task Title</th>
                            <th>Priority</th>
                            <th>Status</th>
                            <th>Deadline</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedProject.myTasks.map((t) => (
                            <tr key={t._id}>
                              <td><strong>{t.title}</strong></td>
                              <td>
                                <span className={`badge-priority priority-${(t.priority || 'medium').toLowerCase()}`}>
                                  <span className="priority-indicator-dot" />
                                  {t.priority}
                                </span>
                              </td>
                              <td>
                                <span className={`task-status-chip status-${t.status}`}>
                                  {t.status === 'in-process' ? 'In Progress' : t.status === 'in-review' ? 'Under Review' : t.status === 'completed' ? 'Completed' : 'To Do'}
                                </span>
                              </td>
                              <td>{t.deadline ? new Date(t.deadline).toLocaleDateString() : 'N/A'}</td>
                              <td>
                                <button
                                  type="button"
                                  className="btn-ghost btn-small"
                                  onClick={() => {
                                    setSelectedProject(null);
                                    openTask(t._id);
                                  }}
                                >
                                  Open Task
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: DOCUMENTS */}
              {projectDetailTab === 'documents' && (
                <div className="detail-documents-tab">
                  <div className="document-uploader-card">
                    <div className="uploader-header">
                      <FileUp size={16} className="text-blue" />
                      <div>
                        <h5>Upload Project Document / Deliverable</h5>
                        <p>Attach project specifications, architecture notes, designs, or spreadsheets.</p>
                      </div>
                    </div>
                    <form onSubmit={handleProjectDocUpload} className="document-upload-composer">
                      <input
                        type="file"
                        id="emp-proj-doc-file-input"
                        style={{ display: 'none' }}
                        onChange={(e) => setProjectDocFile(e.target.files?.[0] || null)}
                      />
                      {!projectDocFile ? (
                        <label htmlFor="emp-proj-doc-file-input" className="file-drop-zone">
                          <Upload size={22} className="upload-zone-icon" />
                          <div className="upload-zone-text">
                            <span className="upload-main-text">Click to browse file from your device</span>
                            <span className="upload-sub-text">Supported: PDF, DOCX, XLSX, PNG, JPG (up to 25MB)</span>
                          </div>
                        </label>
                      ) : (
                        <div className="file-selected-card">
                          <div className="selected-file-left">
                            <FileText size={20} className="text-blue" />
                            <div className="selected-file-info">
                              <strong>{projectDocFile.name}</strong>
                              <small>{(projectDocFile.size / 1024).toFixed(1)} KB</small>
                            </div>
                          </div>
                          <div className="selected-file-actions">
                            <button
                              type="button"
                              className="btn-remove-selected"
                              onClick={() => setProjectDocFile(null)}
                            >
                              <X size={15} /> Remove
                            </button>
                            <button type="submit" className="btn-upload-submit" disabled={projectBusy}>
                              <Upload size={14} />
                              <span>{projectBusy ? 'Uploading...' : 'Upload File'}</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </form>
                  </div>

                  <div className="documents-section">
                    <div className="section-head-row">
                      <div className="section-head-left">
                        <Paperclip size={16} className="text-blue" />
                        <h4>Attached Project Documents</h4>
                      </div>
                      <span className="stats-total-pill">{selectedProject.project?.documents?.length || 0} Files</span>
                    </div>

                    {(!selectedProject.project?.documents || selectedProject.project.documents.length === 0) ? (
                      <div className="proj-empty-card">
                        <Paperclip size={32} className="empty-icon text-muted" />
                        <h5>No project documents uploaded yet</h5>
                        <p>Upload files above to share project assets and documentation with your team.</p>
                      </div>
                    ) : (
                      <div className="documents-grid-list">
                        {selectedProject.project.documents.map((doc) => (
                          <div key={doc._id} className="doc-item-card">
                            <div className="doc-item-left">
                              <div className="doc-icon-tile">
                                <FileText size={20} />
                              </div>
                              <div className="doc-item-details">
                                <strong className="doc-item-name" title={doc.originalName}>{doc.title || doc.originalName}</strong>
                                {doc.title && doc.title !== doc.originalName && (
                                  <span className="doc-sub-filename" style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)' }}>{doc.originalName}</span>
                                )}
                                {doc.notes && (
                                  <p className="doc-notes-text" style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}><em>Note: {doc.notes}</em></p>
                                )}
                                <div className="doc-item-meta">
                                  <span>{(doc.size / 1024).toFixed(1)} KB</span>
                                  <span className="meta-sep">·</span>
                                  <span>Uploaded by {doc.uploadedBy?.name || 'Admin'}</span>
                                  <span className="meta-sep">·</span>
                                  <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                                  {doc.targetAudience && (
                                    <>
                                      <span className="meta-sep">·</span>
                                      <span className="doc-audience-badge" style={{
                                        fontSize: '11px',
                                        padding: '2px 8px',
                                        borderRadius: '6px',
                                        fontWeight: 600,
                                        background: doc.targetAudience === 'All' ? '#eff6ff' : '#f0fdf4',
                                        color: doc.targetAudience === 'All' ? '#1d4ed8' : '#15803d',
                                        border: `1px solid ${doc.targetAudience === 'All' ? '#bfdbfe' : '#bbf7d0'}`
                                      }}>
                                        {doc.targetAudience === 'All' ? 'For Everyone' : 'For Employees'}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="doc-item-actions">
                              <a
                                href={`/api/manager/projects/${selectedProject.project._id}/documents/${doc._id}?token=${encodeURIComponent(localStorage.getItem('token') || '')}`}
                                download={doc.originalName}
                                className="btn-doc-download"
                                target="_blank"
                                rel="noreferrer"
                              >
                                <Download size={14} />
                                <span>Download</span>
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 5: COMMENTS & UPDATES */}
              {projectDetailTab === 'comments' && (
                <div className="detail-comments-tab">
                  <div className="comment-composer-card">
                    <div className="composer-header">
                      <MessageSquare size={16} className="text-blue" />
                      <div>
                        <h5>Post Project Update or Question</h5>
                        <p>Share progress updates, questions, or notes with your manager and teammates.</p>
                      </div>
                    </div>
                    <form onSubmit={handleProjectComment} className="comment-composer-form">
                      <textarea
                        rows={3}
                        placeholder="Add a project comment, progress update, or milestone note..."
                        value={projectCommentText}
                        onChange={(e) => setProjectCommentText(e.target.value)}
                        className="comment-textarea-elevated"
                        required
                      />
                      <div className="composer-footer-row">
                        <span className="composer-hint">Visible to your project manager, leads, and team.</span>
                        <button
                          type="submit"
                          className="btn-post-comment"
                          disabled={projectBusy || !projectCommentText.trim()}
                        >
                          <Send size={14} />
                          <span>{projectBusy ? 'Posting...' : 'Post Update'}</span>
                        </button>
                      </div>
                    </form>
                  </div>

                  <div className="comments-stream-section">
                    <div className="section-head-row">
                      <div className="section-head-left">
                        <MessageSquare size={16} className="text-blue" />
                        <h4>Discussion &amp; Update History</h4>
                      </div>
                      <span className="stats-total-pill">{selectedProject.project?.comments?.length || 0} Updates</span>
                    </div>

                    {(!selectedProject.project?.comments || selectedProject.project.comments.length === 0) ? (
                      <div className="proj-empty-card">
                        <MessageSquare size={32} className="empty-icon text-muted" />
                        <h5>No comments or updates yet</h5>
                        <p>Post the first update using the composer above to initiate communication with the team.</p>
                      </div>
                    ) : (
                      <div className="comments-timeline-stream">
                        {selectedProject.project?.comments?.slice().reverse().map((comm, idx) => (
                          <div key={comm._id || idx} className="comment-timeline-card">
                            <div className="comment-avatar-circle">
                              {(comm.user?.name || 'Team Member').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                            </div>
                            <div className="comment-content-bubble">
                              <div className="comment-bubble-header">
                                <strong className="comment-author-name">{comm.user?.name || 'Team Member'}</strong>
                                <span className="comment-time-pill">{new Date(comm.createdAt).toLocaleString()}</span>
                              </div>
                              <p className="comment-bubble-body">{comm.text}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: TASK DETAILS & WORK SUBMISSION FOR EMPLOYEE
         ========================================================================= */}
      {selectedTask && (
        <div className="manager-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelectedTask(null); }}>
          <div className="manager-modal-box task-detail-modal" role="dialog" aria-modal="true">
            <header className="manager-modal-header task-modal-header-elevated">
              <div className="task-modal-header-content">
                <div className="task-modal-badges">
                  <span className={`badge-priority priority-${selectedTask.priority?.toLowerCase()}`}>
                    <span className="priority-indicator-dot" />
                    {selectedTask.priority}
                  </span>
                  <span className={`task-status-chip status-${selectedTask.status}`}>
                    {selectedTask.status === 'in-process' ? 'In Progress' : selectedTask.status === 'in-review' ? 'Under Review' : selectedTask.status === 'completed' ? 'Completed' : 'To Do'}
                  </span>
                  {selectedTask.needsModification && (
                    <span className="mod-pill-highlight">
                      <AlertTriangle size={12} /> Modifications Requested
                    </span>
                  )}
                </div>
                <h3 className="task-modal-title">{selectedTask.title}</h3>
                <div className="task-modal-project-row">
                  <FolderOpen size={14} />
                  <span>Project: <strong>{selectedTask.project || 'General Platform'}</strong></span>
                </div>
              </div>
              <button className="icon-btn modal-close-btn" onClick={() => setSelectedTask(null)} title="Close" aria-label="Close modal">
                <X size={18} />
              </button>
            </header>

            {/* Alert banner if modifications are requested */}
            {selectedTask.needsModification && (
              <div className="task-needs-mod-banner">
                <AlertTriangle size={18} className="text-red" />
                <div>
                  <strong>Modifications Requested by Manager:</strong>
                  <p>Please review manager remarks below, make required updates to your work, and resubmit.</p>
                </div>
              </div>
            )}

            <div className="modal-subnav task-modal-subnav">
              <button className={taskModalTab === 'details' ? 'active' : ''} onClick={() => setTaskModalTab('details')}>
                <FileText size={15} />
                <span>Instructions &amp; Details</span>
              </button>
              <button className={taskModalTab === 'submit' ? 'active' : ''} onClick={() => setTaskModalTab('submit')}>
                <Send size={15} />
                <span>Submit Work for Review</span>
              </button>
              <button className={taskModalTab === 'progress' ? 'active' : ''} onClick={() => setTaskModalTab('progress')}>
                <TrendingUp size={15} />
                <span>Progress Updates</span>
                <span className="tab-counter-badge">{selectedTask.progressUpdates?.length || 0}</span>
              </button>
              <button className={taskModalTab === 'feedback' ? 'active' : ''} onClick={() => setTaskModalTab('feedback')}>
                <MessageSquare size={15} />
                <span>Manager Remarks</span>
                {selectedTask.managerFeedback?.length > 0 && (
                  <span className="tab-counter-badge active-feedback">{selectedTask.managerFeedback.length}</span>
                )}
              </button>
            </div>

            <div className="modal-body-scroll">
              {taskModalTab === 'details' && (
                <div className="task-details-view">
                  <div className="task-card-block">
                    <div className="task-block-heading">
                      <FileText size={16} />
                      <h4>Description</h4>
                    </div>
                    <p className="task-description-box">{selectedTask.description || 'No description provided.'}</p>
                  </div>

                  {selectedTask.instructions && (
                    <div className="task-card-block task-instructions-block">
                      <div className="task-block-heading">
                        <Megaphone size={16} />
                        <h4>Manager Instructions</h4>
                      </div>
                      <p className="task-instructions-box">{selectedTask.instructions}</p>
                    </div>
                  )}

                  <div className="task-metrics-grid">
                    <div className="task-metric-item">
                      <div className="metric-icon-box">
                        <Calendar size={18} />
                      </div>
                      <div className="metric-text-group">
                        <span className="metric-label">Start Date</span>
                        <strong className="metric-val">{selectedTask.startDate ? new Date(selectedTask.startDate).toLocaleDateString() : 'N/A'}</strong>
                      </div>
                    </div>

                    <div className="task-metric-item">
                      <div className={`metric-icon-box ${selectedTask.isOverdue ? 'metric-icon-red' : ''}`}>
                        <Clock size={18} />
                      </div>
                      <div className="metric-text-group">
                        <span className="metric-label">Deadline</span>
                        <strong className={`metric-val ${selectedTask.isOverdue ? 'text-red' : ''}`}>
                          {selectedTask.deadline ? new Date(selectedTask.deadline).toLocaleDateString() : 'N/A'}
                        </strong>
                      </div>
                    </div>

                    <div className="task-metric-item">
                      <div className="metric-icon-box">
                        <Timer size={18} />
                      </div>
                      <div className="metric-text-group">
                        <span className="metric-label">Estimated Hours</span>
                        <strong className="metric-val">
                          {Math.floor((selectedTask.estimatedMinutes || 60) / 60)}h {(selectedTask.estimatedMinutes || 60) % 60}m
                        </strong>
                      </div>
                    </div>

                    <div className="task-metric-item">
                      <div className="metric-icon-box">
                        <UserRound size={18} />
                      </div>
                      <div className="metric-text-group">
                        <span className="metric-label">Assigned By</span>
                        <strong className="metric-val">{selectedTask.assignedBy?.name || 'Manager'}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Subtasks */}
                  {selectedTask.subtasks?.length > 0 && (
                    <div className="subtasks-section-card">
                      <div className="subtasks-section-header">
                        <div className="subtasks-header-left">
                          <CheckCircle2 size={16} />
                          <h4>Subtasks Checklist</h4>
                        </div>
                        <span className="subtasks-count-pill">
                          {selectedTask.subtasks.filter(st => st.completed).length} / {selectedTask.subtasks.length} Completed
                        </span>
                      </div>
                      <div className="subtasks-progress-track">
                        <div
                          className="subtasks-progress-fill"
                          style={{
                            width: `${Math.round((selectedTask.subtasks.filter(st => st.completed).length / selectedTask.subtasks.length) * 100)}%`
                          }}
                        />
                      </div>
                      <ul className="subtasks-checklist">
                        {selectedTask.subtasks.map((st) => (
                          <li key={st._id} className={`checklist-item ${st.completed ? 'is-completed' : ''}`}>
                            <span className="check-bullet">
                              <CheckCircle2 size={15} />
                            </span>
                            <span className="checklist-title">{st.title}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {taskModalTab === 'submit' && (
                <form onSubmit={handleSubmitTaskWork} className="task-submit-form-elevated">
                  <div className="submit-intro-banner">
                    <div className="submit-intro-icon">
                      <Send size={18} />
                    </div>
                    <div>
                      <h4>{selectedTask.needsModification ? 'Resubmit Modified Task Work' : 'Submit Completed Work for Review'}</h4>
                      <p>Summarize completed deliverables, PR links, deployment URLs, or testing notes for manager verification.</p>
                    </div>
                  </div>

                  <div className="form-field-group">
                    <label htmlFor="submissionNotes" className="form-field-label">
                      <span>Submission Notes &amp; Summary of Completed Work</span>
                      <span className="req-asterisk">*</span>
                    </label>
                    <textarea
                      id="submissionNotes"
                      className="form-textarea-elevated"
                      rows={5}
                      placeholder="Detail what was completed, key deliverables, test results, or changes made..."
                      value={submissionNotes}
                      onChange={(e) => setSubmissionNotes(e.target.value)}
                      required
                    />
                  </div>

                  <div className="submission-tip-box">
                    <Sparkles size={16} />
                    <span>Your manager will review your submission and provide feedback or mark the task completed.</span>
                  </div>

                  <div className="submit-actions-row">
                    <button type="submit" className="btn-primary btn-submit-task" disabled={taskBusy}>
                      <Send size={14} /> {taskBusy ? 'Submitting...' : selectedTask.needsModification ? 'Resubmit Modified Work' : 'Submit for Manager Review'}
                    </button>
                  </div>
                </form>
              )}

              {taskModalTab === 'progress' && (
                <div className="task-progress-tab-elevated">
                  <form onSubmit={handleTaskProgressUpdate} className="progress-update-box-elevated">
                    <div className="progress-form-header">
                      <Activity size={16} />
                      <h5>Log Today&apos;s Progress</h5>
                    </div>
                    <textarea
                      className="form-textarea-elevated"
                      rows={2}
                      placeholder="What did you accomplish on this task today?"
                      value={progressUpdateInput.text}
                      onChange={(e) => setProgressUpdateInput({ ...progressUpdateInput, text: e.target.value })}
                      required
                    />
                    <div className="progress-slider-control">
                      <div className="progress-slider-header">
                        <span className="slider-label">Task Completion Rate:</span>
                        <strong className="slider-value-pill">{progressUpdateInput.progress}%</strong>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        className="modern-range-slider"
                        value={progressUpdateInput.progress}
                        onChange={(e) => setProgressUpdateInput({ ...progressUpdateInput, progress: Number(e.target.value) })}
                      />
                      <div className="progress-presets-row">
                        <span className="presets-caption">Quick preset:</span>
                        {[25, 50, 75, 100].map((val) => (
                          <button
                            key={val}
                            type="button"
                            className={`preset-pill ${progressUpdateInput.progress === val ? 'active' : ''}`}
                            onClick={() => setProgressUpdateInput({ ...progressUpdateInput, progress: val })}
                          >
                            {val}%
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="progress-action-row">
                      <button type="submit" className="btn-primary btn-small" disabled={taskBusy}>
                        <TrendingUp size={14} /> Post Progress Update
                      </button>
                    </div>
                  </form>

                  <div className="progress-history-wrapper">
                    <div className="progress-history-title">
                      <Clock size={16} />
                      <h4>Progress History</h4>
                      <span className="history-badge">{selectedTask.progressUpdates?.length || 0}</span>
                    </div>

                    {(!selectedTask.progressUpdates || selectedTask.progressUpdates.length === 0) ? (
                      <div className="task-empty-state">
                        <Activity size={32} />
                        <h5>No progress updates logged yet</h5>
                        <p>Keep your team updated by logging milestones and daily completion rates.</p>
                      </div>
                    ) : (
                      <div className="progress-history-stream">
                        {selectedTask.progressUpdates?.slice().reverse().map((pu, idx) => (
                          <div key={pu._id || idx} className="progress-history-card-elevated">
                            <div className="progress-card-info">
                              <p className="progress-card-text">{pu.text}</p>
                              <div className="progress-card-date">
                                <Clock size={12} />
                                <span>{new Date(pu.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                              </div>
                            </div>
                            <span className="badge-progress-pill">{pu.progress}%</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {taskModalTab === 'feedback' && (
                <div className="task-feedback-tab-elevated">
                  <div className="feedback-section-header">
                    <MessageSquare size={16} />
                    <h4>Manager Feedback &amp; Review Remarks</h4>
                  </div>

                  {(!selectedTask.managerFeedback || selectedTask.managerFeedback.length === 0) ? (
                    <div className="task-empty-state">
                      <CheckCircle2 size={32} />
                      <h5>No manager feedback on this task yet</h5>
                      <p>Once you submit your work for review, manager evaluation notes and remarks will appear here.</p>
                    </div>
                  ) : (
                    <div className="feedback-list-elevated">
                      {selectedTask.managerFeedback?.map((fb) => (
                        <div key={fb._id} className={`feedback-card-elevated ${fb.requestedChanges ? 'is-revision' : 'is-normal'}`}>
                          <div className="feedback-card-top">
                            <div className="feedback-author-meta">
                              <div className="feedback-avatar-circle">
                                {fb.manager?.name?.[0]?.toUpperCase() || 'M'}
                              </div>
                              <div>
                                <strong className="feedback-author-name">{fb.manager?.name || 'Manager'}</strong>
                                <span className="feedback-time">{new Date(fb.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                              </div>
                            </div>
                            {fb.requestedChanges ? (
                              <span className="badge-revision-pill">
                                <AlertTriangle size={12} /> Modifications Requested
                              </span>
                            ) : (
                              <span className="badge-approved-pill">
                                <Check size={12} /> Review Remark
                              </span>
                            )}
                          </div>
                          <p className="feedback-body-text">{fb.text}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <footer className="manager-modal-footer task-modal-footer-elevated">
              <button className="btn-ghost" onClick={() => setSelectedTask(null)}>Close</button>
              {taskModalTab !== 'submit' && selectedTask.status !== 'completed' && (
                <button className="btn-primary btn-small" onClick={() => setTaskModalTab('submit')}>
                  <Send size={14} /> {selectedTask.needsModification ? 'Resubmit Work' : 'Submit for Review'}
                </button>
              )}
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
