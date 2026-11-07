import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios, { FILE_BASE_URL } from '../api/axios';
import {
  getEmployeeDashboard,
  getEmployeeProfile,
  updatePermittedProfile,
  changeEmployeePassword,
  requestProfileChange,
  uploadProfilePicture,
  deleteProfilePicture,
  getMyProjects,
  getProjectDetails,
  uploadProjectDocument,
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
  Search,
  Star,
  Upload,
  Download,
  MessageSquare,
  Paperclip,
  ShieldAlert,
  FileText,
  Megaphone,
  Send,
  KeyRound,
  RotateCcw,
  Flag,
  CalendarDays,
  Activity,
  Timer,
  Sparkles,
  Check,
  History,
  RefreshCw,
  Camera,
  Trash2,
  LogIn,
  LogOut,
  Palmtree,
  Building2,
  Hash,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';


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
    if (activeTab && activeTab !== tab) {
      setTab(activeTab);
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const { updateUser } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

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

  // Profile Form State
  const [profileData, setProfileData] = useState(null);
  const [profileForm, setProfileForm] = useState({ firstName: '', lastName: '', phone: '' });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '' });
  const [changeForm, setChangeForm] = useState({ field: 'department', requestedValue: '', reason: '' });
  const [profileBusy, setProfileBusy] = useState(false);

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
      const res = await getEmployeeDashboard();
      setDashboardData(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load your dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // Load Profile when tab changes
  useEffect(() => {
    if (tab === 'profile') {
      getEmployeeProfile().then((res) => {
        setProfileData(res.data);
        const nameParts = String(res.data.user.name || '').trim().split(/\s+/);
        setProfileForm({
          firstName: res.data.user.firstName || nameParts[0] || '',
          lastName: res.data.user.lastName || nameParts.slice(1).join(' ') || '',
          phone: res.data.user.phone || '',
        });
      }).catch(() => {});
    } else if (tab === 'projects') {
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

  // Profile: Save Permitted Info
  const handleSavePermittedProfile = async (e) => {
    e.preventDefault();
    setProfileBusy(true);
    try {
      await updatePermittedProfile(profileForm);
      Swal.fire({ title: 'Profile Updated', icon: 'success', timer: 1600, showConfirmButton: false });
      const res = await getEmployeeProfile();
      setProfileData(res.data);
    } catch (err) {
      Swal.fire({ title: 'Error', text: err.response?.data?.message || 'Could not update profile', icon: 'error' });
    } finally {
      setProfileBusy(false);
    }
  };

  const handlePhotoUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      Swal.fire({ title: 'Invalid Image', text: 'Please select a JPG, PNG, or WebP image.', icon: 'error' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      Swal.fire({ title: 'File Too Large', text: 'Profile picture must be 5MB or smaller.', icon: 'error' });
      return;
    }

    const targetId = profileData?.user?._id || user?._id;
    if (!targetId) return;

    setUploadingPhoto(true);
    const formData = new FormData();
    formData.append('picture', file);

    try {
      const res = await uploadProfilePicture(targetId, formData);
      const newPic = res.data?.profilePicture;
      setProfileData((prev) => (prev ? {
        ...prev,
        user: { ...prev.user, profilePicture: newPic },
      } : prev));
      if (updateUser) updateUser({ profilePicture: newPic });
      Swal.fire({
        title: 'Profile Photo Updated',
        text: 'Your new profile picture has been saved successfully.',
        icon: 'success',
        timer: 1600,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire({
        title: 'Upload Failed',
        text: err.response?.data?.message || 'Could not upload profile picture.',
        icon: 'error',
      });
    } finally {
      setUploadingPhoto(false);
      event.target.value = '';
    }
  };

  const handlePhotoRemove = async () => {
    const targetId = profileData?.user?._id || user?._id;
    if (!targetId) return;

    const result = await Swal.fire({
      title: 'Remove Profile Photo?',
      text: 'Are you sure you want to remove your photo? Your name initials will be displayed instead.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, remove photo',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#ef4444',
    });
    if (!result.isConfirmed) return;

    setUploadingPhoto(true);
    try {
      await deleteProfilePicture(targetId);
      setProfileData((prev) => (prev ? {
        ...prev,
        user: { ...prev.user, profilePicture: null },
      } : prev));
      if (updateUser) updateUser({ profilePicture: null });
      Swal.fire({
        title: 'Photo Removed',
        text: 'Your profile picture has been removed.',
        icon: 'success',
        timer: 1600,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire({
        title: 'Error',
        text: err.response?.data?.message || 'Could not remove profile picture.',
        icon: 'error',
      });
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Profile: Change Password
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setProfileBusy(true);
    try {
      await changeEmployeePassword(passwordForm);
      setPasswordForm({ currentPassword: '', newPassword: '' });
      Swal.fire({ title: 'Password Changed', text: 'Your password was changed successfully.', icon: 'success', timer: 1800, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ title: 'Error', text: err.response?.data?.message || 'Could not change password', icon: 'error' });
    } finally {
      setProfileBusy(false);
    }
  };

  // Profile: Request Restricted Change
  const handleRequestProfileChange = async (e) => {
    e.preventDefault();
    setProfileBusy(true);
    try {
      await requestProfileChange(changeForm);
      setChangeForm({ ...changeForm, requestedValue: '', reason: '' });
      Swal.fire({ title: 'Request Sent', text: 'Profile change request sent to Admin for review.', icon: 'success', timer: 1800, showConfirmButton: false });
      const res = await getEmployeeProfile();
      setProfileData(res.data);
    } catch (err) {
      Swal.fire({ title: 'Error', text: err.response?.data?.message || 'Could not submit request', icon: 'error' });
    } finally {
      setProfileBusy(false);
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
      {tab !== 'announcements' && tab !== 'chat' && (
        <div className="page-header-row">
          <div>
            <h2 className="page-main-title">
              {tab === 'dashboard' ? 'Team Dashboard' :
               tab === 'tasks' ? 'My Assigned Tasks' :
               tab === 'projects' ? 'My Projects' :
               tab === 'leave' ? 'Leave & Quotas' :
               tab === 'attendance' ? 'My Everyday Attendance & Working Hours' :
               tab === 'profile' ? 'My Profile & Settings' : 'Employee Workspace'}
            </h2>
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
            <div className="stat-card">
              <strong>{stats.totalProjects || 0}</strong>
              <span>Assigned Projects</span>
            </div>
            <div className="stat-card">
              <strong>{stats.totalTasks || 0}</strong>
              <span>Total Tasks</span>
            </div>
            <div className="stat-card">
              <strong className="text-amber">{stats.pendingTasks || 0}</strong>
              <span>To Do (Pending)</span>
            </div>
            <div className="stat-card">
              <strong className="text-blue">{stats.inProgressTasks || 0}</strong>
              <span>In Progress</span>
            </div>
            <div className="stat-card">
              <strong className="text-purple">{stats.inReviewTasks || 0}</strong>
              <span>Under Review</span>
            </div>
            <div className="stat-card">
              <strong className="text-emerald">{stats.completedTasks || 0}</strong>
              <span>Completed</span>
            </div>
            <div className="stat-card highlight-overdue">
              <strong className={stats.overdueTasks > 0 ? 'text-red' : ''}>{stats.overdueTasks || 0}</strong>
              <span>Overdue Tasks</span>
            </div>
            <div className="stat-card">
              <strong className="text-emerald">{stats.completionRate || 0}%</strong>
              <span>Completion Rate</span>
            </div>
          </div>

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
                  <span>Projects &amp; Tasks</span>
                </header>

                {dashboardData.upcomingDeadlines?.length === 0 ? (
                  <p className="admin-empty-state">No upcoming deadlines.</p>
                ) : (
                  <ul className="emp-deadline-list">
                    {dashboardData.upcomingDeadlines.map((item) => (
                      <li key={`${item.type}-${item.id}`} className={item.isOverdue ? 'overdue-item' : ''}>
                        <span className={`item-type-badge type-${item.type}`}>{item.type}</span>
                        <div className="deadline-item-info">
                          <strong>{item.title}</strong>
                          {item.project && <small>[Project: {item.project}]</small>}
                        </div>
                        <span className={`countdown-badge ${item.isOverdue ? 'badge-overdue' : item.daysRemaining <= 3 ? 'badge-soon' : 'badge-ok'}`}>
                          {item.isOverdue ? `Overdue by ${Math.abs(item.daysRemaining)}d` :
                           item.daysRemaining === 0 ? 'Due Today' : `${item.daysRemaining}d left`}
                        </span>
                      </li>
                    ))}
                  </ul>
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
          TAB 2: 1.2 MY PROFILE & DEPARTMENT INFORMATION
         ========================================================================= */}
      {tab === 'profile' && profileData && (
        <div className="employee-profile-view">
          <div className="manager-scope-banner">
            <ShieldAlert size={18} className="text-blue-500" />
            <div>
              <strong>Organizational Record:</strong> Your official department, designation, employee ID, team, and reporting manager are configured and managed by the Admin. You can update permitted personal contact information directly or submit a formal change request to Admin for review.
            </div>
          </div>

          <div className="employee-profile-layout">
            {/* Left: Professional & Department Details */}
            <section className="emp-panel profile-details-panel">
              <header>
                <h3>Professional &amp; Department Details</h3>
                <span className={`status-badge status-${profileData.employmentStatus?.toLowerCase()}`}>
                  {profileData.employmentStatus}
                </span>
              </header>

              <div className="profile-identity-strip">
                <div className="profile-avatar-wrapper">
                  <UserAvatar user={profileData.user} className="emp-avatar-large" />
                  <label className="profile-avatar-badge" title="Change profile photo">
                    <Camera size={13} />
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      style={{ display: 'none' }}
                      onChange={handlePhotoUpload}
                      disabled={uploadingPhoto}
                    />
                  </label>
                </div>
                <div className="profile-identity-content">
                  <h3>{profileData.user?.name}</h3>
                  <p className="text-muted">{profileData.user?.designation || 'Team Member'} · {profileData.department?.name || profileData.user?.department}</p>
                  <div className="profile-photo-actions-row">
                    <label className="btn-secondary btn-small profile-photo-btn" style={{ cursor: uploadingPhoto ? 'not-allowed' : 'pointer' }}>
                      <Camera size={13} />
                      <span>{uploadingPhoto ? 'Uploading...' : profileData.user?.profilePicture ? 'Change Photo' : 'Upload Photo'}</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        style={{ display: 'none' }}
                        onChange={handlePhotoUpload}
                        disabled={uploadingPhoto}
                      />
                    </label>
                    {profileData.user?.profilePicture && (
                      <button
                        type="button"
                        className="btn-ghost btn-small profile-photo-remove-btn"
                        onClick={handlePhotoRemove}
                        disabled={uploadingPhoto}
                        title="Remove current photo"
                      >
                        <Trash2 size={13} />
                        <span>Remove</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="manager-profile-facts">
                <div><span>Employee ID</span><strong>{profileData.user?.employeeId || 'Not set'}</strong></div>
                <div><span>Email Address</span><strong>{profileData.user?.email}</strong></div>
                <div><span>Phone</span><strong>{profileData.user?.phone || 'Not provided'}</strong></div>
                <div><span>Designation</span><strong>{profileData.user?.designation || 'Employee'}</strong></div>
                <div><span>Department</span><strong>{profileData.department?.name || profileData.user?.department} ({profileData.department?.code || 'GEN'})</strong></div>
                <div><span>Assigned Team</span><strong>{profileData.user?.team || 'General Team'}</strong></div>
                <div><span>Joining Date</span><strong>{profileData.user?.joiningDate ? new Date(profileData.user.joiningDate).toLocaleDateString() : 'Not set'}</strong></div>
                <div><span>Reporting Manager</span><strong>{profileData.user?.manager?.name || 'Department Head'}</strong></div>
                <div><span>Employment Status</span><strong>{profileData.employmentStatus}</strong></div>
                <div className="manager-responsibilities">
                  <span>Assigned Responsibilities</span>
                  <strong>{profileData.user?.responsibilities || 'No specific responsibilities logged.'}</strong>
                </div>
              </div>

              {/* Team Members List */}
              <div className="team-members-colleagues">
                <h4>Team Colleagues ({profileData.teamMembers?.length || 0})</h4>
                {profileData.teamMembers?.length === 0 ? (
                  <p className="text-muted">No other team members assigned yet.</p>
                ) : (
                  <div className="colleagues-grid">
                    {profileData.teamMembers.map((member) => (
                      <div key={member._id} className="colleague-card">
                        <UserAvatar user={member} className="emp-avatar-small" />
                        <div>
                          <strong>{member.name}</strong>
                          <small>{member.designation || 'Member'}</small>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* Right: Update Permitted Info & Change Password & Restricted Requests */}
            <div className="profile-actions-stack">
              {/* Permitted Info Edit Form */}
              <section className="emp-panel">
                <header>
                  <h3>Update Personal Details</h3>
                  <span>Permitted updates save instantly</span>
                </header>
                <form onSubmit={handleSavePermittedProfile} className="profile-edit-form">
                  <label>
                    First Name
                    <input
                      type="text"
                      value={profileForm.firstName}
                      onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })}
                      required
                    />
                  </label>
                  <label>
                    Last Name
                    <input
                      type="text"
                      value={profileForm.lastName}
                      onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })}
                    />
                  </label>
                  <label>
                    Phone Number
                    <input
                      type="tel"
                      value={profileForm.phone}
                      onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                      placeholder="+1 555-0199"
                    />
                  </label>
                  <button type="submit" className="btn-primary btn-small" disabled={profileBusy}>
                    {profileBusy ? 'Saving...' : 'Save Personal Details'}
                  </button>
                </form>
              </section>

              {/* Change Password */}
              <section className="emp-panel">
                <header>
                  <h3>Change Password</h3>
                  <span>Security</span>
                </header>
                <form onSubmit={handleChangePassword} className="profile-edit-form">
                  <label>
                    Current Password
                    <input
                      type="password"
                      autoComplete="current-password"
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                      required
                    />
                  </label>
                  <label>
                    New Password (min 8 characters)
                    <input
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                      required
                    />
                  </label>
                  <button type="submit" className="btn-primary btn-small" disabled={profileBusy}>
                    <KeyRound size={14} /> Change Password
                  </button>
                </form>
              </section>

              {/* Request Restricted Profile Changes */}
              <section className="emp-panel">
                <header>
                  <h3>Request Profile Change</h3>
                  <span>Admin review required</span>
                </header>
                <form onSubmit={handleRequestProfileChange} className="profile-edit-form">
                  <label>
                    Restricted Field
                    <select
                      value={changeForm.field}
                      onChange={(e) => setChangeForm({ ...changeForm, field: e.target.value })}
                    >
                      <option value="department">Department</option>
                      <option value="designation">Designation</option>
                      <option value="employeeId">Employee ID</option>
                      <option value="team">Assigned Team</option>
                      <option value="manager">Reporting Manager</option>
                      <option value="joiningDate">Joining Date</option>
                    </select>
                  </label>
                  <label>
                    Requested Value *
                    <input
                      type={changeForm.field === 'joiningDate' ? 'date' : 'text'}
                      value={changeForm.requestedValue}
                      onChange={(e) => setChangeForm({ ...changeForm, requestedValue: e.target.value })}
                      placeholder="Enter new desired value..."
                      required
                    />
                  </label>
                  <label>
                    Reason &amp; Justification
                    <textarea
                      rows={2}
                      value={changeForm.reason}
                      onChange={(e) => setChangeForm({ ...changeForm, reason: e.target.value })}
                      placeholder="Explain reason for requested adjustment..."
                    />
                  </label>
                  <button type="submit" className="btn-ghost btn-small" disabled={profileBusy}>
                    Submit Request to Admin
                  </button>
                </form>

                {profileData.changeRequests?.length > 0 && (
                  <div className="past-change-requests-list">
                    <h5>Submitted Requests ({profileData.changeRequests.length})</h5>
                    {profileData.changeRequests.map((req) => (
                      <div key={req._id} className="change-req-row">
                        <span>{req.field}: {req.currentValue || '—'} → {req.requestedValue}</span>
                        <strong className={`status-badge status-${req.status}`}>{req.status}</strong>
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
              className={`filter-pill pill-overdue ${taskQuickFilter === 'modification' ? 'active' : ''}`}
              onClick={() => setTaskQuickFilter('modification')}
            >
              <AlertTriangle size={13} /> Modifications Requested ({tasksList.filter(t => t.status !== 'completed' && (t.needsModification || t.reviewStatus === 'changes-requested')).length})
            </button>
            <button
              className={`filter-pill pill-overdue ${taskQuickFilter === 'overdue' ? 'active' : ''}`}
              onClick={() => setTaskQuickFilter('overdue')}
            >
              Overdue Tasks ({tasksList.filter(t => t.isOverdue).length})
            </button>
            <button
              className={`filter-pill ${taskQuickFilter === 'inProgress' ? 'active' : ''}`}
              onClick={() => setTaskQuickFilter('inProgress')}
            >
              In Progress ({tasksList.filter(t => t.status === 'in-process').length})
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
          MODAL: APPLY LEAVE (EMPLOYEE)
         ========================================================================= */}
      {leaveModalOpen && (
        <div className="manager-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setLeaveModalOpen(false); }}>
          <div className="manager-modal-box apply-leave-modal" role="dialog" aria-modal="true">
            <header className="manager-modal-header">
              <div className="modal-title-with-badge">
                <CalendarDays size={18} className="text-blue" />
                <h3>Apply for Leave</h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  className="btn-primary btn-small"
                  onClick={handleLeaveSubmit}
                  disabled={leaveBusy}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600, padding: '6px 14px', fontSize: '12px' }}
                >
                  <Send size={13} /> {leaveBusy ? 'Sending...' : 'Send for Approval'}
                </button>
                <button className="icon-btn" onClick={() => setLeaveModalOpen(false)} aria-label="Close">
                  <X size={18} />
                </button>
              </div>
            </header>
            <form onSubmit={handleLeaveSubmit}>
              <div className="modal-body-scroll">
                <div className="emp-routing-preview-banner">
                  <UserRound size={16} />
                  <div>
                    <strong>Routing Notice:</strong>
                    <p>Your request will be routed to your assigned reporting manager ({leaveOverview.assignedManager?.name || 'Manager'}). If your manager is on approved leave during your requested dates, Taskflow automatically redirects the request to Admin.</p>
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
                  <span>Calculated Working Days: <strong>{calculatedLeaveDays} {calculatedLeaveDays === 1 ? 'day' : 'days'}</strong></span>
                </div>

                <div className="form-group-field">
                  <label>Reason for Leave <span className="req">*</span></label>
                  <textarea
                    rows={3}
                    placeholder="Provide a clear explanation for your leave..."
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
                <button type="button" className="btn-ghost" onClick={() => setLeaveModalOpen(false)}>Cancel</button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={leaveBusy}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '9px 18px', fontWeight: 600 }}
                >
                  <Send size={15} />
                  {leaveBusy ? 'Sending Request...' : 'Send Leave for Approval'}
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
            <header className="manager-modal-header">
              <div className="project-detail-heading">
                <div className="heading-tags">
                  <span className={`priority-tag priority-${selectedProject.project?.priority?.toLowerCase()}`}>
                    {selectedProject.project?.priority}
                  </span>
                  <span className="dept-tag">{selectedProject.project?.department?.name}</span>
                </div>
                <h3>{selectedProject.project?.name}</h3>
              </div>
              <button className="icon-btn" onClick={() => setSelectedProject(null)}><X size={20} /></button>
            </header>

            <div className="modal-progress-strip">
              <div className="strip-labels">
                <span>Project Progress: <b>{selectedProject.project?.progress || 0}%</b></span>
                <span>Deadline: <b>{selectedProject.project?.deadline ? new Date(selectedProject.project.deadline).toLocaleDateString() : 'N/A'}</b></span>
              </div>
              <div className="workload-bar-track">
                <div className="workload-bar-fill" style={{ width: `${selectedProject.project?.progress || 0}%` }} />
              </div>
            </div>

            <div className="modal-subnav">
              <button className={projectDetailTab === 'overview' ? 'active' : ''} onClick={() => setProjectDetailTab('overview')}>
                Objectives &amp; Deliverables
              </button>
              <button className={projectDetailTab === 'milestones' ? 'active' : ''} onClick={() => setProjectDetailTab('milestones')}>
                Milestones ({selectedProject.project?.milestones?.length || 0})
              </button>
              <button className={projectDetailTab === 'tasks' ? 'active' : ''} onClick={() => setProjectDetailTab('tasks')}>
                My Tasks in this Project ({selectedProject.myTasks?.length || 0})
              </button>
              <button className={projectDetailTab === 'documents' ? 'active' : ''} onClick={() => setProjectDetailTab('documents')}>
                Documents ({selectedProject.project?.documents?.length || 0})
              </button>
              <button className={projectDetailTab === 'comments' ? 'active' : ''} onClick={() => setProjectDetailTab('comments')}>
                Updates &amp; Comments ({selectedProject.project?.comments?.length || 0})
              </button>
            </div>

            <div className="modal-body-scroll">
              {projectDetailTab === 'overview' && (
                <div className="detail-overview-tab">
                  <div className="overview-section">
                    <h4>Description</h4>
                    <p className="p-box">{selectedProject.project?.description || 'No description provided.'}</p>
                  </div>
                  <div className="overview-section">
                    <h4>Strategic Objectives</h4>
                    <p className="p-box">{selectedProject.project?.objectives || 'No objectives stated.'}</p>
                  </div>
                  <div className="overview-section">
                    <h4>Requirements &amp; Expected Deliverables</h4>
                    <p className="p-box">{selectedProject.project?.requirements || 'No requirements stated.'}</p>
                  </div>
                  <div className="overview-meta-grid">
                    <div><span>Manager:</span><strong>{selectedProject.project?.manager?.name}</strong></div>
                    <div><span>Project Lead:</span><strong>{selectedProject.project?.teamLead?.name || 'Unassigned'}</strong></div>
                    <div><span>Start Date:</span><strong>{selectedProject.project?.startDate ? new Date(selectedProject.project.startDate).toLocaleDateString() : 'N/A'}</strong></div>
                    <div><span>Deadline:</span><strong>{selectedProject.project?.deadline ? new Date(selectedProject.project.deadline).toLocaleDateString() : 'N/A'}</strong></div>
                  </div>
                </div>
              )}

              {projectDetailTab === 'milestones' && (
                <div className="detail-milestones-tab">
                  <h4>Project Milestones Checklist</h4>
                  {selectedProject.project?.milestones?.length === 0 ? (
                    <p className="text-muted">No milestones defined for this project.</p>
                  ) : (
                    <div className="milestone-cards-list">
                      {selectedProject.project?.milestones?.map((m) => (
                        <div key={m._id} className={`milestone-item-row ${m.completed ? 'completed' : ''}`}>
                          <CheckCircle2 size={18} className={m.completed ? 'text-emerald' : 'text-muted'} />
                          <div className="milestone-content">
                            <strong>{m.title}</strong>
                            {m.deliverables && <p className="milestone-deliverable"><b>Expected Deliverable:</b> {m.deliverables}</p>}
                            {m.dueDate && <small>Due: {new Date(m.dueDate).toLocaleDateString()}</small>}
                          </div>
                          <span className={`status-badge ${m.completed ? 'status-completed' : 'status-pending'}`}>
                            {m.completed ? 'Completed' : 'Pending'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {projectDetailTab === 'tasks' && (
                <div className="detail-tasks-tab">
                  <h4>My Tasks in {selectedProject.project?.name}</h4>
                  {selectedProject.myTasks?.length === 0 ? (
                    <p className="text-muted">No tasks currently assigned to you for this project.</p>
                  ) : (
                    <table className="manager-table">
                      <thead>
                        <tr>
                          <th>Task Title</th>
                          <th>Priority</th>
                          <th>Status</th>
                          <th>Deadline</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedProject.myTasks?.map((t) => (
                          <tr key={t._id}>
                            <td><strong>{t.title}</strong></td>
                            <td><span className={`badge-priority priority-${t.priority}`}>{t.priority}</span></td>
                            <td><span className={`status-badge status-${t.status}`}>{t.status}</span></td>
                            <td>{t.deadline ? new Date(t.deadline).toLocaleDateString() : 'N/A'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {projectDetailTab === 'documents' && (
                <div className="detail-documents-tab">
                  <div className="document-upload-box">
                    <h5>Upload Project Document / File</h5>
                    <form onSubmit={handleProjectDocUpload} className="document-upload-form">
                      <input
                        type="file"
                        onChange={(e) => setProjectDocFile(e.target.files?.[0] || null)}
                        required
                      />
                      <button type="submit" className="btn-primary btn-small" disabled={projectBusy || !projectDocFile}>
                        <Upload size={14} /> Upload
                      </button>
                    </form>
                  </div>

                  <h4>Attached Project Documents ({selectedProject.project?.documents?.length || 0})</h4>
                  {selectedProject.project?.documents?.length === 0 ? (
                    <p className="text-muted">No documents uploaded for this project yet.</p>
                  ) : (
                    <div className="documents-list">
                      {selectedProject.project?.documents?.map((doc) => (
                        <div key={doc._id} className="document-item-row">
                          <div className="doc-info">
                            <FileText size={18} className="text-blue" />
                            <div>
                              <strong>{doc.originalName}</strong>
                              <small>{(doc.size / 1024).toFixed(1)} KB · Uploaded by {doc.uploadedBy?.name || 'Member'} on {new Date(doc.createdAt).toLocaleDateString()}</small>
                            </div>
                          </div>
                          <a
                            href={`/api/manager/projects/${selectedProject.project._id}/documents/${doc._id}`}
                            download={doc.originalName}
                            className="btn-ghost btn-small"
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Download size={14} /> Download
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {projectDetailTab === 'comments' && (
                <div className="detail-comments-tab">
                  <form onSubmit={handleProjectComment} className="comment-post-box">
                    <textarea
                      rows={3}
                      placeholder="Post a project progress update or team comment..."
                      value={projectCommentText}
                      onChange={(e) => setProjectCommentText(e.target.value)}
                      required
                    />
                    <button type="submit" className="btn-primary btn-small" disabled={projectBusy || !projectCommentText.trim()}>
                      <Send size={14} /> Post Update
                    </button>
                  </form>

                  <h4>Project Updates &amp; Comments</h4>
                  <div className="comments-stream">
                    {selectedProject.project?.comments?.slice().reverse().map((comm, idx) => (
                      <div key={comm._id || idx} className="comment-card">
                        <div className="comment-header">
                          <strong>{comm.user?.name || 'Team Member'}</strong>
                          <small>{new Date(comm.createdAt).toLocaleString()}</small>
                        </div>
                        <p className="comment-body">{comm.text}</p>
                      </div>
                    ))}
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
