import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend,
  PieChart, Pie, Cell
} from 'recharts';
import {
  ArrowRightLeft,
  Bell,
  Building2,
  Check,
  CheckCheck,
  FolderPlus,
  Megaphone,
  UserPlus,
  ShieldCheck,
  X,
  CalendarDays,
  ShieldAlert,
  Calendar,
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  History,
  Download,
  RefreshCw,
  Plus,
  Edit3,
  Power,
  Users,
  Briefcase,
  Layers,
  UserCheck,
  CheckSquare,
  Clock,
  TrendingUp,
  Paperclip,
  UploadCloud,
  Trash2,
} from 'lucide-react';
import {
  getAdminOverview,
  createDepartment,
  updateDepartment,
  createProject,
  createAnnouncement,
  reviewManagerProfileChange,
  reviewTransferRequest,
  markAdminNotificationRead,
  getProjectDocuments,
  uploadProjectDocument,
  deleteProjectDocument,
} from '../api/adminApi';
import {
  getAdminLeaveRequests,
  overrideLeaveAsAdmin,
} from '../api/leaveApi';
import { FILE_BASE_URL } from '../api/axios';
import Swal from '../utils/swalConfig';

const COLORS = ['#6366f1', '#10b981', '#f43f5e', '#f59e0b', '#8b5cf6'];

function AdminDashboard({ tasks, employees, user, logout, setView, onAddEmployee, activeSection }) {
  const [overview, setOverview] = useState(null);
  const [overviewError, setOverviewError] = useState('');
  const [actionType, setActionType] = useState('');
  const [editingDepartment, setEditingDepartment] = useState(null);
  const [actionError, setActionError] = useState('');
  const [savingAction, setSavingAction] = useState(false);
  const [actionForm, setActionForm] = useState({ name: '', code: '', description: '', department: '', manager: '', head: '', startDate: '', deadline: '', title: '', body: '', audience: 'all' });

  // Leave Management State
  const [leaveFilter, setLeaveFilter] = useState('all');
  const [adminLeaves, setAdminLeaves] = useState([]);
  const [leaveCounts, setLeaveCounts] = useState({
    all: 0,
    pending_admin: 0,
    pending_manager: 0,
    forwarded_to_admin: 0,
    approved: 0,
    rejected: 0,
    cancelled: 0,
  });
  const [leavesLoading, setLeavesLoading] = useState(false);
  const [overrideModal, setOverrideModal] = useState({ open: false, leave: null, action: 'approved', reason: '' });
  const [historyModal, setHistoryModal] = useState({ open: false, leave: null });
  const [overrideBusy, setOverrideBusy] = useState(false);

  // Project Document Hub State
  const [projectDocsModalOpen, setProjectDocsModalOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedProjectData, setSelectedProjectData] = useState(null);
  const [projectDocsList, setProjectDocsList] = useState([]);
  const [projectDocsLoading, setProjectDocsLoading] = useState(false);
  const [docUploadFile, setDocUploadFile] = useState(null);
  const [docUploadForm, setDocUploadForm] = useState({
    title: '',
    targetAudience: 'All',
    notes: '',
  });
  const [docUploading, setDocUploading] = useState(false);
  const [docUploadError, setDocUploadError] = useState('');

  const loadLeaves = useCallback(async (filter = leaveFilter) => {
    setLeavesLoading(true);
    try {
      const res = await getAdminLeaveRequests({ filter });
      setAdminLeaves(res.data.leaves || []);
      if (res.data.counts) setLeaveCounts(res.data.counts);
    } catch (err) {
      console.error('Failed to load admin leaves:', err);
    } finally {
      setLeavesLoading(false);
    }
  }, [leaveFilter]);

  useEffect(() => {
    loadLeaves(leaveFilter);
  }, [leaveFilter, loadLeaves]);

  useEffect(() => {
    let active = true;
    getAdminOverview()
      .then((response) => { if (active) setOverview(response.data); })
      .catch(() => { if (active) setOverviewError('Could not load live organization data.'); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (activeSection) {
      setTimeout(() => {
        const el = document.getElementById(activeSection);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    }
  }, [activeSection]);

  const refreshOverview = async () => {
    const response = await getAdminOverview();
    setOverview(response.data);
    setOverviewError('');
  };

  const openAction = (type, department = null) => {
    setActionType(type);
    setEditingDepartment(department);
    setActionError('');
    setActionForm(department
      ? { name: department.name, code: department.code || '', description: department.description || '', department: '', manager: '', head: department.head?._id || '', startDate: '', deadline: '', title: '', body: '', audience: 'all' }
      : { name: '', code: '', description: '', department: '', manager: '', head: '', startDate: '', deadline: '', title: '', body: '', audience: 'all' });
  };

  const submitQuickAction = async (event) => {
    event.preventDefault();
    setSavingAction(true);
    setActionError('');
    try {
      if (actionType === 'department') {
        if (editingDepartment) await updateDepartment(editingDepartment._id, actionForm);
        else await createDepartment(actionForm);
      }
      if (actionType === 'project') await createProject(actionForm);
      if (actionType === 'announcement') await createAnnouncement(actionForm);
      setActionType('');
      setEditingDepartment(null);
      await refreshOverview();
    } catch (error) {
      setActionError(error.response?.data?.message || 'Could not save this item.');
    } finally {
      setSavingAction(false);
    }
  };

  const handleLeaveReview = async (request, status) => {
    try {
      if (status === 'rejected') {
        const { value: reason } = await Swal.fire({
          title: 'Reject Leave Request',
          input: 'textarea',
          inputLabel: 'Rejection Reason',
          inputPlaceholder: 'Explain reason for rejecting this leave request...',
          inputValidator: (val) => !val?.trim() && 'A rejection reason is required.',
          showCancelButton: true,
          confirmButtonText: 'Confirm Rejection',
          confirmButtonColor: '#dc2626',
        });
        if (!reason) return;
        await overrideLeaveAsAdmin(request._id, 'rejected', reason);
      } else {
        await overrideLeaveAsAdmin(request._id, 'approved', 'Approved by Admin');
      }
      await loadLeaves();
      await refreshOverview();
      Swal.fire({
        title: status === 'approved' ? 'Leave Approved' : 'Leave Rejected',
        text: `Leave request has been ${status}.`,
        icon: 'success'
      });
    } catch (error) {
      Swal.fire({ title: 'Action Failed', text: error.response?.data?.message || 'Could not update leave request.', icon: 'error' });
    }
  };

  const handleOverrideSubmit = async (e) => {
    e.preventDefault();
    if (!overrideModal.leave) return;
    if (overrideModal.action === 'rejected' && !overrideModal.reason.trim()) {
      Swal.fire({ title: 'Rejection Reason Required', text: 'Please enter a reason for rejection.', icon: 'warning' });
      return;
    }
    setOverrideBusy(true);
    try {
      await overrideLeaveAsAdmin(overrideModal.leave._id, overrideModal.action, overrideModal.reason);
      Swal.fire({
        title: overrideModal.action === 'approved' ? 'Override: Approved' : 'Override: Rejected',
        text: `Leave request has been manually overridden by Admin.`,
        icon: 'success'
      });
      setOverrideModal({ open: false, leave: null, action: 'approved', reason: '' });
      await loadLeaves();
      await refreshOverview();
    } catch (err) {
      Swal.fire({ title: 'Override Failed', text: err.response?.data?.message || 'Could not perform override.', icon: 'error' });
    } finally {
      setOverrideBusy(false);
    }
  };

  const handleProfileChangeReview = async (request, status) => {
    try {
      await reviewManagerProfileChange(request._id, status);
      await refreshOverview();
    } catch (error) {
      setOverviewError(error.response?.data?.message || 'Could not review profile change.');
    }
  };

  const handleTransferReview = async (request, status) => {
    try {
      await reviewTransferRequest(request._id, { status });
      await refreshOverview();
    } catch (error) {
      setOverviewError(error.response?.data?.message || 'Could not review transfer request.');
    }
  };

  const handleNotificationRead = async (notifId) => {
    try {
      await markAdminNotificationRead(notifId);
      await refreshOverview();
    } catch (error) {
      setOverviewError(error.response?.data?.message || 'Could not mark notification read.');
    }
  };

  const toggleDepartment = async (department) => {
    try {
      await updateDepartment(department._id, { isActive: !department.isActive });
      await refreshOverview();
    } catch (error) {
      setOverviewError(error.response?.data?.message || 'Could not update department status.');
    }
  };

  const stats = useMemo(() => {
    const activeUsers = employees.filter(e => e.isActive !== false);
    const totalEmployees = activeUsers.filter(e => e.role === 'Employee').length;
    const totalManagers = activeUsers.filter(e => e.role === 'Manager').length;
    const distinctDepartments = new Set(activeUsers.map(e => String(e.department || '').trim().toLowerCase()).filter(Boolean)).size;
    const completedTasks = overview?.taskCounts?.completed ?? tasks.filter(t => t.status === 'completed').length;
    const pendingTasks = overview?.taskCounts?.pending ?? tasks.filter(t => t.status === 'pending').length;
    const overdueTasks = overview?.taskCounts?.overdue ?? tasks.filter(t => t.status !== 'completed' && t.deadline && new Date(t.deadline) < new Date()).length;
    const attendance = overview?.attendanceSummary || {};

    return {
      totalEmployees: overview?.stats?.employees ?? totalEmployees,
      totalManagers: overview?.stats?.managers ?? totalManagers,
      totalDepartments: overview?.stats?.departments ?? distinctDepartments,
      totalTeams: overview?.stats?.teams ?? 0,
      activeProjects: overview?.stats?.activeProjects ?? 0,
      totalTasks: overview?.stats?.tasks ?? tasks.length,
      completedTasks,
      pendingTasks,
      overdueTasks,
      inProgressTasks: overview?.taskCounts?.inProgress ?? tasks.filter(t => t.status === 'in-process').length,
      present: attendance.present ?? 0,
      absent: attendance.absent ?? 0,
      late: attendance.late ?? 0,
      onLeave: attendance.onLeave ?? 0,
    };
  }, [tasks, employees, overview]);

  const taskStatusData = [
    { name: 'Completed', value: stats.completedTasks },
    { name: 'Pending', value: stats.pendingTasks },
    { name: 'In Progress', value: stats.inProgressTasks },
    { name: 'Overdue', value: stats.overdueTasks },
  ].filter(d => d.value > 0);

  const attendanceData = [
    { name: 'Present', value: stats.present },
    { name: 'Absent', value: stats.absent },
    { name: 'Late', value: stats.late },
    { name: 'On Leave', value: stats.onLeave },
  ].filter(d => d.value > 0);

  const deptData = overview?.departmentDistribution || [];
  const departmentOptions = (overview?.departments || []).filter((department) => department.isActive);
  const projectProgress = useMemo(() => overview?.projects || [], [overview?.projects]);
  const activities = overview?.activities || [];
  const profileChangeRequests = overview?.profileChangeRequests || [];
  const transferRequests = overview?.transferRequests || [];
  const adminNotifications = overview?.adminNotifications || [];

  const formatLeaveTypeName = (type) => {
    const t = (type || '').toLowerCase();
    if (t === 'annual') return 'ANNUAL / EARNED LEAVE';
    if (t === 'sick') return 'SICK LEAVE';
    if (t === 'casual' || t === 'personal' || t === 'other') return 'CASUAL LEAVE';
    if (t === 'maternity_paternity' || t.includes('maternity')) return 'MATERNITY / PATERNITY LEAVE';
    return (type || 'LEAVE').toUpperCase() + ' LEAVE';
  };

  const openProjectDocModal = useCallback(async (project = null) => {
    setDocUploadError('');
    setDocUploadFile(null);
    setDocUploadForm({ title: '', targetAudience: 'All', notes: '' });
    setProjectDocsModalOpen(true);

    const targetProj = project || (projectProgress && projectProgress[0]) || null;
    if (targetProj && targetProj._id) {
      setSelectedProjectId(targetProj._id);
      setSelectedProjectData(targetProj);
      setProjectDocsLoading(true);
      try {
        const res = await getProjectDocuments(targetProj._id);
        setProjectDocsList(res.data.documents || []);
        if (res.data) {
          setSelectedProjectData((prev) => ({ ...prev, ...res.data }));
        }
      } catch (err) {
        console.error('Failed to load project docs:', err);
        setProjectDocsList(targetProj.documents || []);
      } finally {
        setProjectDocsLoading(false);
      }
    } else {
      setSelectedProjectId('');
      setSelectedProjectData(null);
      setProjectDocsList([]);
    }
  }, [projectProgress]);

  const handleSelectProjectForDocs = async (projId) => {
    setSelectedProjectId(projId);
    setDocUploadError('');
    setDocUploadFile(null);
    if (!projId) {
      setSelectedProjectData(null);
      setProjectDocsList([]);
      return;
    }
    const found = projectProgress.find((p) => p._id === projId);
    setSelectedProjectData(found || null);
    setProjectDocsLoading(true);
    try {
      const res = await getProjectDocuments(projId);
      setProjectDocsList(res.data.documents || []);
      if (res.data) {
        setSelectedProjectData((prev) => ({ ...prev, ...res.data }));
      }
    } catch (err) {
      console.error('Failed to load project docs:', err);
      setProjectDocsList(found?.documents || []);
    } finally {
      setProjectDocsLoading(false);
    }
  };

  const closeProjectDocModal = () => {
    if (docUploading) return;
    setProjectDocsModalOpen(false);
    setSelectedProjectId('');
    setSelectedProjectData(null);
    setProjectDocsList([]);
    setDocUploadFile(null);
    setDocUploadForm({ title: '', targetAudience: 'All', notes: '' });
    setDocUploadError('');
  };

  const handleUploadDocumentSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProjectId) {
      setDocUploadError('Please select a project first');
      return;
    }
    if (!docUploadFile) {
      setDocUploadError('Please select a file to upload');
      return;
    }

    setDocUploading(true);
    setDocUploadError('');

    try {
      const formData = new FormData();
      formData.append('document', docUploadFile);
      if (docUploadForm.title.trim()) {
        formData.append('title', docUploadForm.title.trim());
      }
      formData.append('targetAudience', docUploadForm.targetAudience);
      if (docUploadForm.notes.trim()) {
        formData.append('notes', docUploadForm.notes.trim());
      }

      const res = await uploadProjectDocument(selectedProjectId, formData);
      setProjectDocsList(res.data.documents || []);
      setDocUploadFile(null);
      setDocUploadForm({ title: '', targetAudience: 'All', notes: '' });

      Swal.fire({
        icon: 'success',
        title: 'Document Uploaded!',
        text: 'The document is now available to the project team.',
        timer: 2000,
        showConfirmButton: false,
      });

      refreshOverview();
    } catch (err) {
      console.error('Upload error:', err);
      setDocUploadError(err.response?.data?.message || 'Could not upload document');
    } finally {
      setDocUploading(false);
    }
  };

  const handleDeleteProjectDoc = async (projId, doc) => {
    const result = await Swal.fire({
      title: 'Remove Document?',
      text: `Are you sure you want to delete "${doc.title || doc.originalName}"? This action cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, delete',
      cancelButtonText: 'Cancel',
    });

    if (!result.isConfirmed) return;

    try {
      const res = await deleteProjectDocument(projId, doc._id);
      setProjectDocsList(res.data.documents || []);
      Swal.fire({
        icon: 'success',
        title: 'Deleted',
        text: 'Project document was removed.',
        timer: 1600,
        showConfirmButton: false,
      });
      refreshOverview();
    } catch (err) {
      console.error('Delete error:', err);
      Swal.fire({
        icon: 'error',
        title: 'Failed',
        text: err.response?.data?.message || 'Could not delete document',
      });
    }
  };

  const handleDownloadProjectDoc = (projId, doc) => {
    const token = localStorage.getItem('token');
    const downloadUrl = `/api/admin/projects/${projId}/documents/${doc._id}/download?token=${encodeURIComponent(token || '')}`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', doc.originalName || doc.title || 'document');
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const StatCard = ({ icon: Icon, label, value, colorClass, subtitle, onClick }) => (
    <div
      className={`dashboard-stat-card ${onClick ? 'is-clickable' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
    >
      <div className="stat-card-header">
        <div className={`stat-icon-bubble ${colorClass}`}>
          <Icon size={20} strokeWidth={2.2} />
        </div>
        {onClick && <span className="stat-card-arrow" title="View details">→</span>}
      </div>
      <div className="stat-card-content">
        <span className="stat-card-value">{value ?? 0}</span>
        <span className="stat-card-label">{label}</span>
        {subtitle && <span className="stat-card-subtitle">{subtitle}</span>}
      </div>
    </div>
  );

  return (
    <div className="dashboard-page admin-dashboard">
      {/* Clean Page Title Row matching Image 2 */}
      <div className="page-header-row">
        <div>
          <h2 className="page-main-title">Admin Control Center</h2>
        </div>
        <div className="page-header-actions">
          <span className="header-date-badge">
            <Calendar size={13} /> {new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
      </div>

      {/* Top Stat Cards - Grid */}
      <div className="admin-stat-grid">
        <StatCard icon={Users} label="Total Employees" value={stats.totalEmployees} colorClass="bubble-indigo" subtitle="Registered staff" />
        <StatCard icon={ShieldCheck} label="Total Managers" value={stats.totalManagers} colorClass="bubble-purple" subtitle="Department leads" />
        <StatCard icon={Building2} label="Departments" value={stats.totalDepartments} colorClass="bubble-teal" subtitle="Active divisions" onClick={() => setView('admin-departments')} />
        <StatCard icon={Layers} label="Teams" value={stats.totalTeams} colorClass="bubble-cyan" subtitle="Working squads" />
        <StatCard icon={Briefcase} label="Active Projects" value={stats.activeProjects} colorClass="bubble-orange" subtitle="In delivery" onClick={() => setView('tasks')} />
        <StatCard icon={CheckSquare} label="Total Tasks" value={stats.totalTasks} colorClass="bubble-blue" subtitle="All task items" onClick={() => setView('tasks')} />
        <StatCard icon={CheckCircle2} label="Completed Tasks" value={stats.completedTasks} colorClass="bubble-emerald" subtitle="Done & delivered" onClick={() => setView('tasks')} />
        <StatCard icon={Clock} label="Pending Tasks" value={stats.pendingTasks} colorClass="bubble-amber" subtitle="To do backlog" onClick={() => setView('tasks')} />
        <StatCard icon={TrendingUp} label="In Progress" value={stats.inProgressTasks} colorClass="bubble-sky" subtitle="Active working" onClick={() => setView('tasks')} />
        <StatCard icon={AlertTriangle} label="Overdue Tasks" value={stats.overdueTasks} colorClass="bubble-rose" subtitle="Requires attention" onClick={() => setView('tasks')} />
      </div>

      {overviewError && <p className="error-text" role="alert">{overviewError}</p>}

      <section className="dashboard-quick-actions-bar" aria-label="Admin quick actions">
        <div className="quick-actions-info">
          <h3>Quick actions</h3>
          <p>Manage your organization from one place.</p>
        </div>
        <div className="quick-actions-list">
          <button type="button" className="action-pill-btn action-pill-primary" onClick={() => onAddEmployee('Employee')}>
            <UserPlus size={15} />
            <span>Add Employee</span>
          </button>
          <button type="button" className="action-pill-btn action-pill-accent" onClick={() => onAddEmployee('Manager')}>
            <ShieldCheck size={15} />
            <span>Add Manager</span>
          </button>
          <button type="button" className="action-pill-btn action-pill-default" onClick={() => openAction('department')}>
            <Building2 size={15} />
            <span>Create department</span>
          </button>
          <button type="button" className="action-pill-btn action-pill-default" onClick={() => openAction('project')}>
            <FolderPlus size={15} />
            <span>Create project</span>
          </button>
          <button type="button" className="action-pill-btn action-pill-default" onClick={() => openProjectDocModal()}>
            <Paperclip size={15} />
            <span>Project documents</span>
          </button>
          <button type="button" className="action-pill-btn action-pill-default" onClick={() => openAction('announcement')}>
            <Megaphone size={15} />
            <span>Publish announcement</span>
          </button>
        </div>
      </section>

      <section className="admin-attendance-summary">
        <h3>Today's attendance</h3>
        <div className="attendance-summary-grid">
          <div><span className="attendance-summary-dot present" /><strong>{stats.present}</strong><span>Present</span></div>
          <div><span className="attendance-summary-dot absent" /><strong>{stats.absent}</strong><span>Absent</span></div>
          <div><span className="attendance-summary-dot late" /><strong>{stats.late}</strong><span>Late</span></div>
          <div><span className="attendance-summary-dot leave" /><strong>{stats.onLeave}</strong><span>On Leave</span></div>
        </div>
      </section>

      {actionType && (
        <div className="admin-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setActionType(''); }}>
          <section className="admin-action-modal" role="dialog" aria-modal="true" aria-labelledby="admin-action-title">
            <header>
              <h2 id="admin-action-title">{actionType === 'department' ? (editingDepartment ? 'Edit department' : 'Create department') : actionType === 'project' ? 'Create project' : 'Publish announcement'}</h2>
              <button type="button" className="icon-btn" onClick={() => { setActionType(''); setEditingDepartment(null); }} aria-label="Close"><X size={19} /></button>
            </header>
            <form onSubmit={submitQuickAction}>
              {actionType === 'announcement' ? (
                <>
                  <label>Title<input autoFocus maxLength={160} value={actionForm.title} onChange={(event) => setActionForm({ ...actionForm, title: event.target.value })} required /></label>
                  <label>Message<textarea rows={5} maxLength={5000} value={actionForm.body} onChange={(event) => setActionForm({ ...actionForm, body: event.target.value })} required /></label>
                  <label>Audience<select value={actionForm.audience} onChange={(event) => setActionForm({ ...actionForm, audience: event.target.value })}><option value="all">Everyone</option><option value="department">One department</option></select></label>
                  {actionForm.audience === 'department' && <label>Department<select value={actionForm.department} onChange={(event) => setActionForm({ ...actionForm, department: event.target.value })} required><option value="">Select department</option>{departmentOptions.map((department) => <option value={department._id} key={department._id}>{department.name}</option>)}</select></label>}
                </>
              ) : (
                <>
                  <label>{actionType === 'department' ? 'Department name' : 'Project name'}<input autoFocus maxLength={120} value={actionForm.name} onChange={(event) => setActionForm({ ...actionForm, name: event.target.value })} required /></label>
                  {actionType === 'department' && <>
                    <label>Department code<input maxLength={24} value={actionForm.code} onChange={(event) => setActionForm({ ...actionForm, code: event.target.value.toUpperCase() })} required /></label>
                    <label>Department head<select value={actionForm.head} onChange={(event) => setActionForm({ ...actionForm, head: event.target.value })}><option value="">Unassigned</option>{employees.filter((employee) => employee.role === 'Manager' && employee.isActive !== false).map((manager) => <option value={manager._id} key={manager._id}>{manager.name}</option>)}</select></label>
                  </>}
                  <label>Description<textarea rows={3} maxLength={1000} value={actionForm.description} onChange={(event) => setActionForm({ ...actionForm, description: event.target.value })} /></label>
                  {actionType === 'project' && <>
                    <label>Department<select value={actionForm.department} onChange={(event) => setActionForm({ ...actionForm, department: event.target.value })}><option value="">No department</option>{departmentOptions.map((department) => <option value={department._id} key={department._id}>{department.name}</option>)}</select></label>
                    <label>Project manager<select value={actionForm.manager} onChange={(event) => setActionForm({ ...actionForm, manager: event.target.value })}><option value="">Unassigned</option>{employees.filter((employee) => employee.role === 'Manager' && employee.isActive !== false).map((manager) => <option value={manager._id} key={manager._id}>{manager.name}</option>)}</select></label>
                    <div className="admin-modal-date-grid"><label>Start date<input type="date" value={actionForm.startDate} onChange={(event) => setActionForm({ ...actionForm, startDate: event.target.value })} /></label><label>Deadline<input type="date" value={actionForm.deadline} onChange={(event) => setActionForm({ ...actionForm, deadline: event.target.value })} /></label></div>
                  </>}
                </>
              )}
              {actionError && <p className="error-text" role="alert">{actionError}</p>}
              <footer><button type="button" className="btn-ghost" onClick={() => { setActionType(''); setEditingDepartment(null); }}>Cancel</button><button type="submit" className="btn-primary btn-small" disabled={savingAction}>{savingAction ? 'Saving...' : actionType === 'announcement' ? 'Publish' : editingDepartment ? 'Save changes' : 'Create'}</button></footer>
            </form>
          </section>
        </div>
      )}

      <div className="admin-overview-grid">
        {/* Project progress */}
        <section className="admin-overview-panel admin-project-progress-panel">
          <header className="project-panel-header">
            <div>
              <h3>Project progress</h3>
              <span>{projectProgress.length} {projectProgress.length === 1 ? 'project' : 'projects'}</span>
            </div>
            <button
              type="button"
              className="btn-ghost btn-small proj-docs-header-btn"
              onClick={() => openProjectDocModal()}
              title="Attach and manage project documents"
            >
              <Paperclip size={14} /> Project documents
            </button>
          </header>
          {projectProgress.length === 0 ? (
            <p className="admin-empty-state">No projects created yet.</p>
          ) : (
            projectProgress.slice(0, 6).map((project) => (
              <div className="project-progress-row" key={project._id}>
                <div className="project-progress-heading">
                  <span className="project-name-text"><strong>{project.name}</strong></span>
                  <div className="project-heading-right">
                    <button
                      type="button"
                      className="project-doc-chip"
                      onClick={() => openProjectDocModal(project)}
                      title={`Manage documents for ${project.name}`}
                    >
                      <Paperclip size={12} />
                      <span>{project.documents?.length || 0} Docs</span>
                    </button>
                    <span className="project-percent-text">{project.progress}%</span>
                  </div>
                </div>
                <div className="project-progress-track"><span style={{ width: `${project.progress}%` }} /></div>
                <div className="project-progress-footer-row">
                  <small>{project.completedTasks}/{project.taskCount} tasks complete · {project.status}</small>
                  {project.manager?.name && <small className="project-manager-tag">Manager: {project.manager.name}</small>}
                </div>
              </div>
            ))
          )}
        </section>

        {/* Departments */}
        <section id="departments-section" className="admin-overview-panel admin-departments-panel">
          <header className="dept-panel-header">
            <div className="dept-header-title-wrap">
              <div className="dept-header-icon-box">
                <Building2 size={18} />
              </div>
              <div>
                <h3>Departments</h3>
                <span className="dept-header-subtitle">
                  {(overview?.departments || []).length} configured {(overview?.departments || []).length === 1 ? 'unit' : 'units'}
                </span>
              </div>
            </div>
            <button
              type="button"
              className="dept-create-btn"
              onClick={() => openAction('department')}
            >
              <Plus size={14} color="#ffffff" />
              <span>Create department</span>
            </button>
          </header>

          {(overview?.departments || []).length === 0 ? (
            <div className="dept-empty-card">
              <Building2 size={36} className="dept-empty-icon" />
              <p className="dept-empty-title">No departments created yet</p>
              <p className="dept-empty-desc">Create your first department to organize teams, managers, and projects.</p>
              <button type="button" className="dept-create-btn" onClick={() => openAction('department')}>
                <Plus size={14} color="#ffffff" />
                <span>Create department</span>
              </button>
            </div>
          ) : (
            <div className="dept-cards-stack">
              {(overview.departments || []).map((department) => (
                <article
                  className={`dept-card ${department.isActive ? 'active' : 'inactive'}`}
                  key={department._id}
                >
                  <div className="dept-card-top">
                    <div className="dept-card-brand">
                      <div className="dept-card-avatar">
                        <Building2 size={18} />
                      </div>
                      <div className="dept-card-identity">
                        <div className="dept-name-row">
                          <h4 className="dept-card-name">{department.name}</h4>
                          {department.code && <span className="dept-code-tag">{department.code}</span>}
                        </div>
                        <div className="dept-head-info">
                          <UserCheck size={13} className="dept-head-icon" />
                          <span>Head: <strong>{department.head?.name || 'Unassigned'}</strong></span>
                        </div>
                      </div>
                    </div>
                    <span className={`dept-status-badge ${department.isActive ? 'active' : 'inactive'}`}>
                      <span className="status-dot" />
                      {department.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <div className="dept-metrics-grid">
                    <div className="dept-metric-chip" title="Employees">
                      <Users size={13} className="metric-chip-icon icon-employees" />
                      <span className="metric-chip-val">{department.metrics?.employees || 0}</span>
                      <span className="metric-chip-label">Employees</span>
                    </div>
                    <div className="dept-metric-chip" title="Managers">
                      <UserCheck size={13} className="metric-chip-icon icon-managers" />
                      <span className="metric-chip-val">{department.metrics?.managers || 0}</span>
                      <span className="metric-chip-label">Managers</span>
                    </div>
                    <div className="dept-metric-chip" title="Teams">
                      <Layers size={13} className="metric-chip-icon icon-teams" />
                      <span className="metric-chip-val">{department.metrics?.teams || 0}</span>
                      <span className="metric-chip-label">Teams</span>
                    </div>
                    <div className="dept-metric-chip" title="Projects">
                      <Briefcase size={13} className="metric-chip-icon icon-projects" />
                      <span className="metric-chip-val">{department.metrics?.projects || 0}</span>
                      <span className="metric-chip-label">Projects</span>
                    </div>
                    <div className="dept-metric-chip" title="Tasks">
                      <CheckSquare size={13} className="metric-chip-icon icon-tasks" />
                      <span className="metric-chip-val">{department.metrics?.tasks || 0}</span>
                      <span className="metric-chip-label">Tasks</span>
                    </div>
                  </div>

                  <div className="dept-progress-wrap">
                    <div className="dept-progress-meta">
                      <span className="dept-progress-title">Task Completion</span>
                      <span className="dept-progress-pct">
                        <strong>{department.metrics?.completionRate || 0}%</strong> complete
                      </span>
                    </div>
                    <div className="dept-progress-track">
                      <div
                        className="dept-progress-bar"
                        style={{
                          width: `${Math.min(100, Math.max(0, department.metrics?.completionRate || 0))}%`
                        }}
                      />
                    </div>
                  </div>

                  <div className="dept-card-footer">
                    <button
                      type="button"
                      className="dept-btn dept-btn-edit"
                      onClick={() => openAction('department', department)}
                    >
                      <Edit3 size={13} />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      className={`dept-btn ${department.isActive ? 'dept-btn-deactivate' : 'dept-btn-activate'}`}
                      onClick={() => toggleDepartment(department)}
                    >
                      <Power size={13} />
                      <span>{department.isActive ? 'Deactivate' : 'Activate'}</span>
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Transfer Requests from Managers */}
        <section className="admin-overview-panel admin-leave-panel">
          <header>
            <h3 style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <ArrowRightLeft size={16} color="#6366f1" /> Manager Transfer Requests
            </h3>
            <span>{transferRequests.length} awaiting review</span>
          </header>
          {transferRequests.length === 0 ? (
            <p className="admin-empty-state">No employee transfer requests pending.</p>
          ) : (
            transferRequests.map((req) => (
              <article className="leave-request-row" key={req._id}>
                <div>
                  <strong>{req.employee?.name || 'Employee'} ({req.employee?.employeeId || 'ID'})</strong>
                  <span>Transfer: {req.currentDepartment || req.employee?.department || 'Current'} → <b>{req.targetDepartment}</b> {req.targetTeam ? `(${req.targetTeam})` : ''}</span>
                  <small style={{ display: 'block', color: 'var(--text-muted, #64748b)', marginTop: '3px' }}>
                    Requested by: {req.requestedBy?.name || 'Manager'} · Reason: {req.reason || 'None provided'}
                  </small>
                </div>
                <div className="leave-request-actions">
                  <button type="button" className="leave-approve" onClick={() => handleTransferReview(req, 'approved')} title="Approve Transfer" aria-label="Approve Transfer">
                    <Check size={16} />
                  </button>
                  <button type="button" className="leave-reject" onClick={() => handleTransferReview(req, 'rejected')} title="Reject Transfer" aria-label="Reject Transfer">
                    <X size={16} />
                  </button>
                </div>
              </article>
            ))
          )}
        </section>

        {/* Manager Project Alerts & Priority Notifications */}
        <section className="admin-overview-panel">
          <header>
            <h3 style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <Bell size={16} color="#f59e0b" /> Priority Alerts &amp; Salary Notifications
            </h3>
            <span>{adminNotifications.filter(n => !n.isRead).length} unread</span>
          </header>
          {adminNotifications.length === 0 ? (
            <p className="admin-empty-state">No recent notifications or alerts.</p>
          ) : (
            adminNotifications.slice(0, 8).map((notif) => (
              <div key={notif._id} style={{
                padding: '12px 14px',
                borderRadius: '8px',
                border: '1px solid var(--border-color, #e2e8f0)',
                background: notif.isRead ? 'transparent' : 'rgba(99, 102, 241, 0.04)',
                marginBottom: '10px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '10px',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span className={`task-badge ${(notif.title || '').includes('💰') || (notif.title || '').includes('Salary') ? 'priority-high' : `priority-${(notif.priority || 'medium').toLowerCase()}`}`}>
                      {notif.priority || 'Normal'}
                    </span>
                    <strong style={{ fontSize: '13px' }}>{notif.title || 'Notification'}</strong>
                  </div>
                  <p style={{ margin: '4px 0', fontSize: '12.5px', color: 'var(--text-primary, #334155)', lineHeight: 1.4 }}>
                    {notif.message}
                  </p>
                  <small style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '11px' }}>
                    {notif.sender?.name ? `From: ${notif.sender.name}` : ''} {notif.project?.name ? `· Project: ${notif.project.name}` : ''} · {new Date(notif.createdAt).toLocaleDateString()}
                  </small>
                </div>
                {!notif.isRead && (
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => handleNotificationRead(notif._id)}
                    title="Mark as read"
                    style={{ padding: '4px 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    <CheckCheck size={14} /> Read
                  </button>
                )}
              </div>
            ))
          )}
        </section>

        {/* =========================================================================
            ADMIN LEAVE MANAGEMENT & HIERARCHICAL APPROVAL AUTHORITY
           ========================================================================= */}
        <section id="leave-management" className="admin-overview-panel admin-full-width-panel admin-leave-mgmt-section">
          <header className="leave-mgmt-header">
            <div className="leave-mgmt-title">
              <div className="icon-badge-indigo">
                <CalendarDays size={20} />
              </div>
              <div>
                <h3>Organization Leave Management &amp; Approval Authority</h3>
                <p>Monitor hierarchical routing, track manager unavailabilities, review manager leaves, and execute authorized overrides.</p>
              </div>
            </div>
            <button
              type="button"
              className="btn-ghost btn-small"
              onClick={() => loadLeaves(leaveFilter)}
              disabled={leavesLoading}
              title="Refresh leave requests"
            >
              <RefreshCw size={14} className={leavesLoading ? 'animate-spin' : ''} /> Refresh
            </button>
          </header>

          {/* Filter Pills Bar */}
          <div className="leave-filters-bar">
            {[
              { id: 'all', label: 'All Requests', count: leaveCounts.all },
              { id: 'pending_admin', label: 'Pending Admin', count: leaveCounts.pending_admin, badgeClass: 'badge-admin-req' },
              { id: 'forwarded_to_admin', label: 'Forwarded to Admin', count: leaveCounts.forwarded_to_admin, badgeClass: 'badge-fwd-req' },
              { id: 'pending_manager', label: 'Pending Manager', count: leaveCounts.pending_manager },
              { id: 'approved', label: 'Approved', count: leaveCounts.approved, badgeClass: 'badge-app-req' },
              { id: 'rejected', label: 'Rejected', count: leaveCounts.rejected, badgeClass: 'badge-rej-req' },
              { id: 'cancelled', label: 'Cancelled', count: leaveCounts.cancelled },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                className={`leave-filter-btn ${leaveFilter === f.id ? 'active' : ''}`}
                onClick={() => setLeaveFilter(f.id)}
              >
                <span>{f.label}</span>
                <span className={`leave-filter-count ${f.badgeClass || ''}`}>{f.count || 0}</span>
              </button>
            ))}
          </div>

          {/* Leave Requests Stream / Cards */}
          {leavesLoading ? (
            <div className="leave-loading-box">
              <div className="loading-spinner" />
              <p>Loading leave requests...</p>
            </div>
          ) : adminLeaves.length === 0 ? (
            <div className="admin-empty-state leave-empty-state">
              <CalendarDays size={36} className="text-muted" />
              <h5>No leave requests found</h5>
              <p>No records match the selected filter &quot;{leaveFilter.replace(/_/g, ' ')}&quot;.</p>
            </div>
          ) : (
            <div className="admin-leaves-grid">
              {adminLeaves.map((leave) => {
                const isForwarded = leave.routingReason?.toLowerCase().includes('approved leave') || leave.routingReason?.toLowerCase().includes('unavailable') || leave.routingReason?.toLowerCase().includes('inactive');
                const isManagerReq = leave.requesterRole === 'Manager';

                return (
                  <article key={leave._id} className={`admin-leave-card status-${leave.status}`}>
                    <div className="leave-card-top">
                      <div className="requester-profile-cell">
                        <div className={`user-avatar-badge ${isManagerReq ? 'avatar-manager' : 'avatar-employee'}`}>
                          {leave.user?.name?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <div className="requester-info">
                          <div className="requester-name-line">
                            <strong>{leave.user?.name || 'Unknown User'}</strong>
                            <span className={`role-tag-pill ${isManagerReq ? 'pill-manager' : 'pill-employee'}`}>
                              {leave.requesterRole || leave.user?.role || 'Employee'}
                            </span>
                          </div>
                          <div className="requester-sub-line">
                            {leave.user?.employeeId && <span>ID: <b>{leave.user.employeeId}</b></span>}
                            {leave.user?.department && <span>Dept: <b>{leave.user.department}</b></span>}
                          </div>
                        </div>
                      </div>

                      <div className="leave-status-group">
                        <span className={`leave-status-pill pill-${leave.status}`}>
                          {leave.status?.toUpperCase()}
                        </span>
                        <span className="leave-type-pill">
                          {formatLeaveTypeName(leave.leaveType)}
                        </span>
                      </div>
                    </div>

                    {/* Routing Alert Pill if Forwarded or Special Route */}
                    {isForwarded && (
                      <div className="leave-forwarded-notice">
                        <AlertTriangle size={15} />
                        <div>
                          <strong>Forwarded to Admin:</strong>
                          <span>Assigned reporting manager is on approved leave during requested dates.</span>
                        </div>
                      </div>
                    )}

                    {isManagerReq && (
                      <div className="leave-manager-req-notice">
                        <ShieldAlert size={14} />
                        <span>Manager leave request — direct Admin approval authority required.</span>
                      </div>
                    )}

                    {/* Leave Details Grid */}
                    <div className="leave-details-grid">
                      <div className="leave-detail-col">
                        <span className="detail-label">Requested Period</span>
                        <div className="detail-val-dates">
                          <CalendarDays size={14} />
                          <strong>
                            {new Date(leave.startDate).toLocaleDateString()} — {new Date(leave.endDate).toLocaleDateString()}
                          </strong>
                          <span className="days-badge">({leave.totalDays} {leave.totalDays === 1 ? 'day' : 'days'})</span>
                        </div>
                      </div>

                      <div className="leave-detail-col">
                        <span className="detail-label">Assigned Manager</span>
                        <span className="detail-val">
                          {leave.assignedManager?.name || 'None / Not Assigned'}
                        </span>
                      </div>

                      <div className="leave-detail-col">
                        <span className="detail-label">Designated Approver</span>
                        <span className="detail-val">
                          <b>{leave.approver?.name || (leave.approverRole === 'Admin' ? 'Admin Authority' : 'Manager')}</b>
                          <small className="approver-role-sub">({leave.approverRole || 'Admin'})</small>
                        </span>
                      </div>
                    </div>

                    {/* Reason */}
                    {leave.reason && (
                      <div className="leave-reason-box">
                        <span className="reason-label">Reason:</span>
                        <p className="reason-text">{leave.reason}</p>
                      </div>
                    )}

                    {/* Rejection / Override Remarks if any */}
                    {leave.rejectionReason && (
                      <div className="leave-rejection-box">
                        <span className="rejection-label">Rejection Remark:</span>
                        <p className="rejection-text">{leave.rejectionReason}</p>
                      </div>
                    )}

                    {/* Supporting Document */}
                    {leave.supportingDocument?.filename && (
                      <div className="leave-document-row">
                        <FileText size={14} className="text-blue" />
                        <span className="doc-name">{leave.supportingDocument.originalName || 'Supporting Document'}</span>
                        <a
                          href={`${FILE_BASE_URL}/uploads/leaveDocs/${leave.supportingDocument.filename}`}
                          target="_blank"
                          rel="noreferrer"
                          className="doc-link-btn"
                        >
                          <Download size={13} /> View Document
                        </a>
                      </div>
                    )}

                    {/* Card Actions Footer */}
                    <div className="leave-card-actions">
                      <div className="actions-left">
                        <button
                          type="button"
                          className="btn-history-pill"
                          onClick={() => setHistoryModal({ open: true, leave })}
                        >
                          <History size={13} /> View Audit History ({leave.approvalHistory?.length || 0})
                        </button>
                      </div>

                      <div className="actions-right">
                        {leave.status === 'pending' && (
                          <>
                            <button
                              type="button"
                              className="btn-leave-approve"
                              onClick={() => handleLeaveReview(leave, 'approved')}
                              title="Approve leave request"
                            >
                              <Check size={14} /> Approve
                            </button>
                            <button
                              type="button"
                              className="btn-leave-reject"
                              onClick={() => handleLeaveReview(leave, 'rejected')}
                              title="Reject leave request"
                            >
                              <X size={14} /> Reject
                            </button>
                          </>
                        )}

                        {/* Admin Manual Override button */}
                        <button
                          type="button"
                          className="btn-leave-override"
                          onClick={() => setOverrideModal({
                            open: true,
                            leave,
                            action: leave.status === 'approved' ? 'rejected' : 'approved',
                            reason: ''
                          })}
                          title="Authorized Admin Manual Override"
                        >
                          <ShieldAlert size={13} /> Admin Override
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Manager & Employee Profile-Change Requests */}
        <section className="admin-overview-panel admin-leave-panel">
          <header><h3>Profile change requests</h3><span>{profileChangeRequests.length} awaiting review</span></header>
          {profileChangeRequests.length === 0 ? <p className="admin-empty-state">No profile changes need review.</p> : profileChangeRequests.map((request) => (
            <article className="leave-request-row" key={request._id}>
              <div><strong>{request.user?.name || 'User'} ({request.user?.role || 'Staff'}) · {request.field}</strong><span>{request.currentValue || '—'} → {request.requestedValue}</span>{request.reason && <p>{request.reason}</p>}</div>
              <div className="leave-request-actions"><button type="button" className="leave-approve" onClick={() => handleProfileChangeReview(request, 'approved')} title="Approve change" aria-label="Approve profile change"><Check size={16} /></button><button type="button" className="leave-reject" onClick={() => handleProfileChangeReview(request, 'rejected')} title="Reject change" aria-label="Reject profile change"><X size={16} /></button></div>
            </article>
          ))}
        </section>

        {/* Recent activity */}
        <section className="admin-overview-panel admin-activity-panel">
          <header><h3>Recent activity</h3><span>Latest organization updates</span></header>
          {activities.length === 0 ? <p className="admin-empty-state">No recent activity yet.</p> : <ol className="admin-activity-list">
            {activities.map((activity) => <li key={activity._id}><span className="activity-mark" /><div><p><strong>{activity.actor?.name || 'System'}</strong> {activity.action} {activity.targetType} <b>{activity.targetName}</b></p>{activity.details && <small>{activity.details}</small>}<time>{new Date(activity.createdAt).toLocaleString()}</time></div></li>)}
          </ol>}
        </section>
      </div>

      {/* Charts Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px', position: 'relative', zIndex: 1, marginTop: '24px' }}>
        
        {/* Tasks Overview */}
        <div style={{ background: 'var(--bg-card, #ffffff)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color, rgba(0,0,0,0.06))', boxShadow: 'var(--card-shadow, 0 4px 6px -1px rgba(0, 0, 0, 0.05))', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h3 style={{ fontFamily: 'Inter', fontSize: '18px', fontWeight: 600, color: 'var(--text-primary, #111827)', margin: '0 0 20px 0', alignSelf: 'flex-start' }}>Task Status Overview</h3>
            <PieChart width={360} height={260}>
              <Pie data={taskStatusData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={6} dataKey="value">
                {taskStatusData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
              </Pie>
              <RechartsTooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff' }} itemStyle={{color: '#fff'}} />
              <Legend wrapperStyle={{ paddingTop: '16px' }} />
            </PieChart>
        </div>

        {/* Attendance */}
        <div style={{ background: 'var(--bg-card, #ffffff)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color, rgba(0,0,0,0.06))', boxShadow: 'var(--card-shadow, 0 4px 6px -1px rgba(0, 0, 0, 0.05))', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h3 style={{ fontFamily: 'Inter', fontSize: '18px', fontWeight: 600, color: 'var(--text-primary, #111827)', margin: '0 0 20px 0', alignSelf: 'flex-start' }}>Today's Attendance</h3>
            <PieChart width={360} height={260}>
              <Pie data={attendanceData} cx="50%" cy="50%" innerRadius={0} outerRadius={90} dataKey="value" stroke="none">
                {attendanceData.map((entry, index) => <Cell key={entry.name} fill={['#0f766e', '#94a3b8', '#d97706', '#2563eb'][index]} />)}
              </Pie>
              <RechartsTooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff' }} itemStyle={{color: '#fff'}} />
              <Legend wrapperStyle={{ paddingTop: '16px' }} />
            </PieChart>
        </div>

        {/* Department Distribution */}
        <div style={{ background: 'var(--bg-card, #ffffff)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color, rgba(0,0,0,0.06))', boxShadow: 'var(--card-shadow, 0 4px 6px -1px rgba(0, 0, 0, 0.05))', display: 'flex', flexDirection: 'column', alignItems: 'center', overflowX: 'auto' }}>
          <h3 style={{ fontFamily: 'Inter', fontSize: '18px', fontWeight: 600, color: 'var(--text-primary, #111827)', margin: '0 0 20px 0', alignSelf: 'flex-start' }}>Employees by Department</h3>
            <BarChart width={360} height={260} data={deptData} barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="name" stroke="#94a3b8" tickLine={false} axisLine={false} dy={8} fontSize={12} />
              <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} dx={-6} fontSize={12} />
              <RechartsTooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff' }} cursor={{fill: 'rgba(255,255,255,0.05)'}} />
              <Bar dataKey="count" name="Employees" fill="#0f766e" radius={[4, 4, 0, 0]} minPointSize={2} />
            </BarChart>
        </div>

      </div>

      {/* =========================================================================
          ADMIN MANUAL OVERRIDE MODAL
         ========================================================================= */}
      {overrideModal.open && overrideModal.leave && (
        <div className="admin-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setOverrideModal({ open: false, leave: null, action: 'approved', reason: '' }); }}>
          <div className="admin-action-modal leave-override-modal" role="dialog" aria-modal="true">
            <header>
              <div className="override-modal-header-title">
                <ShieldAlert size={20} className="text-amber" />
                <h3>Authorized Admin Manual Override</h3>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setOverrideModal({ open: false, leave: null, action: 'approved', reason: '' })}
              >
                <X size={18} />
              </button>
            </header>

            <form onSubmit={handleOverrideSubmit}>
              <div className="override-summary-card">
                <div className="summary-row">
                  <span>Requester:</span>
                  <strong>{overrideModal.leave.user?.name} ({overrideModal.leave.requesterRole || 'Employee'})</strong>
                </div>
                <div className="summary-row">
                  <span>Period &amp; Type:</span>
                  <strong>{formatLeaveTypeName(overrideModal.leave.leaveType)} · {new Date(overrideModal.leave.startDate).toLocaleDateString()} to {new Date(overrideModal.leave.endDate).toLocaleDateString()} ({overrideModal.leave.totalDays} days)</strong>
                </div>
                <div className="summary-row">
                  <span>Current Status:</span>
                  <span className={`status-badge-chip chip-${overrideModal.leave.status}`}>{overrideModal.leave.status?.toUpperCase()}</span>
                </div>
              </div>

              <div className="form-group-field" style={{ marginTop: '16px' }}>
                <label><b>Administrative Override Decision</b></label>
                <div className="override-actions-toggle">
                  <label className={`toggle-pill ${overrideModal.action === 'approved' ? 'is-active-approve' : ''}`}>
                    <input
                      type="radio"
                      name="overrideAction"
                      value="approved"
                      checked={overrideModal.action === 'approved'}
                      onChange={() => setOverrideModal({ ...overrideModal, action: 'approved' })}
                    />
                    <CheckCircle2 size={16} /> Override as APPROVED
                  </label>
                  <label className={`toggle-pill ${overrideModal.action === 'rejected' ? 'is-active-reject' : ''}`}>
                    <input
                      type="radio"
                      name="overrideAction"
                      value="rejected"
                      checked={overrideModal.action === 'rejected'}
                      onChange={() => setOverrideModal({ ...overrideModal, action: 'rejected' })}
                    />
                    <XCircle size={16} /> Override as REJECTED
                  </label>
                </div>
              </div>

              <div className="form-group-field" style={{ marginTop: '16px' }}>
                <label>
                  <b>Administrative Override Justification &amp; Audit Reason</b>
                  {overrideModal.action === 'rejected' && <span className="req">*</span>}
                </label>
                <textarea
                  rows={3}
                  className="form-textarea-elevated"
                  placeholder="Explain why Admin is executing manual override on this request..."
                  value={overrideModal.reason}
                  onChange={(e) => setOverrideModal({ ...overrideModal, reason: e.target.value })}
                  required={overrideModal.action === 'rejected'}
                />
              </div>

              <div className="override-audit-notice">
                <ShieldAlert size={14} />
                <span>Notice: This action will be permanently recorded in the immutable audit log and the requester will be notified.</span>
              </div>

              <footer>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setOverrideModal({ open: false, leave: null, action: 'approved', reason: '' })}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={overrideBusy}
                >
                  {overrideBusy ? 'Executing Override...' : 'Confirm Admin Override'}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          LEAVE AUDIT HISTORY TIMELINE MODAL
         ========================================================================= */}
      {historyModal.open && historyModal.leave && (
        <div className="admin-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setHistoryModal({ open: false, leave: null }); }}>
          <div className="admin-action-modal leave-history-modal" role="dialog" aria-modal="true">
            <header>
              <div className="override-modal-header-title">
                <History size={20} className="text-blue" />
                <h3>Leave Request Audit History</h3>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setHistoryModal({ open: false, leave: null })}
              >
                <X size={18} />
              </button>
            </header>

            <div className="history-modal-body">
              <div className="history-target-summary">
                <h4>{historyModal.leave.user?.name} · {formatLeaveTypeName(historyModal.leave.leaveType)}</h4>
                <p>
                  Dates: <b>{new Date(historyModal.leave.startDate).toLocaleDateString()}</b> to <b>{new Date(historyModal.leave.endDate).toLocaleDateString()}</b> ({historyModal.leave.totalDays} days) · Status: <b>{historyModal.leave.status?.toUpperCase()}</b>
                </p>
                {historyModal.leave.routingReason && (
                  <p className="routing-note">
                    <b>Hierarchical Route Note:</b> {historyModal.leave.routingReason}
                  </p>
                )}
              </div>

              <div className="audit-timeline-stream">
                {(!historyModal.leave.approvalHistory || historyModal.leave.approvalHistory.length === 0) ? (
                  <p className="admin-empty-state">No recorded history events.</p>
                ) : (
                  historyModal.leave.approvalHistory.map((item, idx) => (
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

            <footer>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setHistoryModal({ open: false, leave: null })}
              >
                Close History
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Project Documents Hub Modal */}
      {projectDocsModalOpen && (
        <div
          className="admin-modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !docUploading) closeProjectDocModal();
          }}
        >
          <section className="admin-project-docs-modal" role="dialog" aria-modal="true" aria-labelledby="project-docs-modal-title">
            <header className="docs-modal-header">
              <div className="docs-modal-title-wrap">
                <div className="docs-modal-icon-badge">
                  <Paperclip size={20} />
                </div>
                <div>
                  <h2 id="project-docs-modal-title">Project Documents Hub</h2>
                  <p className="docs-modal-subtitle">Upload and manage project documentation for Managers and Employees</p>
                </div>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={closeProjectDocModal}
                disabled={docUploading}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </header>

            <div className="docs-modal-body">
              {/* Project Picker */}
              <div className="docs-project-selector-bar">
                <label htmlFor="docs-project-select">
                  <FolderPlus size={16} />
                  <span>Target Project:</span>
                </label>
                <select
                  id="docs-project-select"
                  value={selectedProjectId}
                  onChange={(e) => handleSelectProjectForDocs(e.target.value)}
                  disabled={docUploading}
                >
                  <option value="">-- Choose a project --</option>
                  {projectProgress.map((proj) => (
                    <option key={proj._id} value={proj._id}>
                      {proj.name} {proj.department?.name ? `(${proj.department.name})` : ''} — {proj.documents?.length || 0} doc(s)
                    </option>
                  ))}
                </select>
              </div>

              {!selectedProjectId ? (
                <div className="docs-pick-project-prompt">
                  <FolderPlus size={44} className="prompt-icon" />
                  <h4>Select a project above</h4>
                  <p>Choose any project to attach documentation, specifications, or deliverables accessible to managers and team members.</p>
                </div>
              ) : (
                <>
                  {/* Selected Project Summary Strip */}
                  <div className="docs-project-summary-strip">
                    <div className="summary-left">
                      <strong>{selectedProjectData?.name}</strong>
                      <span className="summary-badge">{selectedProjectData?.department?.name || 'General'}</span>
                      {selectedProjectData?.manager?.name && (
                        <span className="summary-meta">Manager: {selectedProjectData.manager.name}</span>
                      )}
                    </div>
                    <div className="summary-right">
                      <span className="docs-count-pill">
                        <Paperclip size={13} /> {projectDocsList.length} Attached {projectDocsList.length === 1 ? 'Document' : 'Documents'}
                      </span>
                    </div>
                  </div>

                  {/* Upload Card */}
                  <div className="docs-upload-card">
                    <div className="upload-card-header">
                      <UploadCloud size={18} className="upload-icon" />
                      <div>
                        <h4>Attach New Document</h4>
                        <p>Upload project specifications, blueprints, or assets to share with team roles.</p>
                      </div>
                    </div>

                    <form onSubmit={handleUploadDocumentSubmit} className="docs-upload-form">
                      <div className="docs-form-grid">
                        <div className="docs-field">
                          <label>Document Title <span className="field-hint">(optional, defaults to file name)</span></label>
                          <input
                            type="text"
                            placeholder="e.g. Project Architecture Blueprint v2"
                            value={docUploadForm.title}
                            onChange={(e) => setDocUploadForm({ ...docUploadForm, title: e.target.value })}
                            disabled={docUploading}
                          />
                        </div>

                        <div className="docs-field">
                          <label>Target Audience <span className="field-required">*</span></label>
                          <div className="audience-toggle-group">
                            <label className={`audience-toggle-opt ${docUploadForm.targetAudience === 'All' ? 'active' : ''}`}>
                              <input
                                type="radio"
                                name="targetAudience"
                                value="All"
                                checked={docUploadForm.targetAudience === 'All'}
                                onChange={(e) => setDocUploadForm({ ...docUploadForm, targetAudience: e.target.value })}
                                disabled={docUploading}
                              />
                              <Users size={14} />
                              <span>Manager & Employees</span>
                            </label>
                            <label className={`audience-toggle-opt ${docUploadForm.targetAudience === 'Manager' ? 'active' : ''}`}>
                              <input
                                type="radio"
                                name="targetAudience"
                                value="Manager"
                                checked={docUploadForm.targetAudience === 'Manager'}
                                onChange={(e) => setDocUploadForm({ ...docUploadForm, targetAudience: e.target.value })}
                                disabled={docUploading}
                              />
                              <ShieldCheck size={14} />
                              <span>Manager Only</span>
                            </label>
                            <label className={`audience-toggle-opt ${docUploadForm.targetAudience === 'Employee' ? 'active' : ''}`}>
                              <input
                                type="radio"
                                name="targetAudience"
                                value="Employee"
                                checked={docUploadForm.targetAudience === 'Employee'}
                                onChange={(e) => setDocUploadForm({ ...docUploadForm, targetAudience: e.target.value })}
                                disabled={docUploading}
                              />
                              <Briefcase size={14} />
                              <span>Employees Only</span>
                            </label>
                          </div>
                        </div>
                      </div>

                      <div className="docs-field">
                        <label>Notes / Instructions for Team <span className="field-hint">(optional)</span></label>
                        <textarea
                          rows={2}
                          placeholder="e.g. Please review section 3 before the sprint kickoff."
                          value={docUploadForm.notes}
                          onChange={(e) => setDocUploadForm({ ...docUploadForm, notes: e.target.value })}
                          disabled={docUploading}
                        />
                      </div>

                      {/* File Dropzone */}
                      <div className="docs-dropzone-wrap">
                        <input
                          type="file"
                          id="admin-doc-file-input"
                          style={{ display: 'none' }}
                          onChange={(e) => setDocUploadFile(e.target.files?.[0] || null)}
                          disabled={docUploading}
                        />
                        {!docUploadFile ? (
                          <label htmlFor="admin-doc-file-input" className="docs-file-dropzone">
                            <UploadCloud size={28} className="dropzone-icon" />
                            <div className="dropzone-texts">
                              <span className="dropzone-main">Click or drop file to select document</span>
                              <span className="dropzone-sub">Supports PDF, DOCX, XLSX, TXT, PNG, JPG, ZIP (up to 50MB)</span>
                            </div>
                          </label>
                        ) : (
                          <div className="docs-file-selected-box">
                            <div className="selected-meta">
                              <FileText size={22} className="selected-icon text-indigo" />
                              <div>
                                <strong>{docUploadFile.name}</strong>
                                <small>{(docUploadFile.size / 1024).toFixed(1)} KB · {docUploadFile.type || 'Document'}</small>
                              </div>
                            </div>
                            <button
                              type="button"
                              className="btn-clear-file"
                              onClick={() => setDocUploadFile(null)}
                              disabled={docUploading}
                              title="Remove selected file"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        )}
                      </div>

                      {docUploadError && (
                        <p className="error-text" role="alert">{docUploadError}</p>
                      )}

                      <div className="docs-upload-footer">
                        <button
                          type="submit"
                          className="btn-primary btn-upload-doc"
                          disabled={!docUploadFile || docUploading}
                        >
                          <UploadCloud size={16} />
                          <span>{docUploading ? 'Uploading Document...' : 'Upload & Distribute to Project'}</span>
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Documents List */}
                  <div className="docs-list-section">
                    <div className="docs-list-head">
                      <h4>Attached Documents ({projectDocsList.length})</h4>
                      {projectDocsLoading && <span className="loading-badge">Refreshing...</span>}
                    </div>

                    {projectDocsLoading && projectDocsList.length === 0 ? (
                      <div className="docs-loading-box">Loading project documents...</div>
                    ) : projectDocsList.length === 0 ? (
                      <div className="docs-empty-state">
                        <Paperclip size={32} className="empty-icon" />
                        <h5>No documents uploaded for this project yet</h5>
                        <p>Upload project documentation above to make it instantly visible to the manager and assigned employees.</p>
                      </div>
                    ) : (
                      <div className="docs-grid-container">
                        {projectDocsList.map((doc) => (
                          <div key={doc._id} className="admin-doc-card">
                            <div className="doc-card-top">
                              <div className="doc-card-icon-wrap">
                                <FileText size={22} />
                              </div>
                              <div className="doc-card-main-info">
                                <h5 className="doc-card-title">{doc.title || doc.originalName}</h5>
                                {doc.title && doc.title !== doc.originalName && (
                                  <span className="doc-card-filename" title={doc.originalName}>{doc.originalName}</span>
                                )}
                              </div>
                              <div className="doc-card-badges">
                                {doc.targetAudience === 'Manager' ? (
                                  <span className="doc-pill-audience audience-mgr" title="Visible to Project Manager & Admin">
                                    <ShieldCheck size={12} /> Manager Only
                                  </span>
                                ) : doc.targetAudience === 'Employee' ? (
                                  <span className="doc-pill-audience audience-emp" title="Visible to Employees & Admin">
                                    <Briefcase size={12} /> Employees Only
                                  </span>
                                ) : (
                                  <span className="doc-pill-audience audience-all" title="Visible to Manager and all Employees">
                                    <Users size={12} /> Manager & Employees
                                  </span>
                                )}
                              </div>
                            </div>

                            {doc.notes && (
                              <div className="doc-card-notes">
                                <small><strong>Note:</strong> {doc.notes}</small>
                              </div>
                            )}

                            <div className="doc-card-footer">
                              <div className="doc-card-meta">
                                <span>{(doc.size / 1024).toFixed(1)} KB</span>
                                <span className="dot-sep">·</span>
                                <span>Uploaded by {doc.uploadedBy?.name || 'Admin'}</span>
                                <span className="dot-sep">·</span>
                                <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                              </div>

                              <div className="doc-card-actions">
                                <button
                                  type="button"
                                  className="btn-doc-download"
                                  onClick={() => handleDownloadProjectDoc(selectedProjectId, doc)}
                                  title="Download document"
                                >
                                  <Download size={14} /> Download
                                </button>
                                <button
                                  type="button"
                                  className="btn-doc-delete"
                                  onClick={() => handleDeleteProjectDoc(selectedProjectId, doc)}
                                  title="Delete document"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
