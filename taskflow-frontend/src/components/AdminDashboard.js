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
  const projectProgress = overview?.projects || [];
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

  const StatCard = ({ label, value, color }) => (
    <div style={{
      background: 'var(--bg-card, #ffffff)',
      border: '1px solid var(--border-color, rgba(0,0,0,0.06))',
      borderRadius: '12px',
      padding: '24px 28px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      boxShadow: 'var(--card-shadow, 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 10px 15px -3px rgba(0, 0, 0, 0.1))',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: color
      }} />
      <span style={{ fontFamily: 'Inter', fontSize: '36px', fontWeight: 700, color: 'var(--text-primary, #111827)', lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: '13px', color: 'var(--text-muted, #6b7280)', marginTop: '10px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>{label}</span>
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
        <StatCard label="Total Employees" value={stats.totalEmployees} color="#6366f1" />
        <StatCard label="Total Managers" value={stats.totalManagers} color="#8b5cf6" />
        <StatCard label="Departments" value={stats.totalDepartments} color="#0f766e" />
        <StatCard label="Teams" value={stats.totalTeams} color="#0891b2" />
        <StatCard label="Active Projects" value={stats.activeProjects} color="#c2410c" />
        <StatCard label="Total Tasks" value={stats.totalTasks} color="#3b82f6" />
        <StatCard label="Completed Tasks" value={stats.completedTasks} color="#10b981" />
        <StatCard label="Pending Tasks" value={stats.pendingTasks} color="#f59e0b" />
        <StatCard label="In Progress" value={stats.inProgressTasks} color="#0ea5e9" />
        <StatCard label="Overdue Tasks" value={stats.overdueTasks} color="#f43f5e" />
      </div>

      {overviewError && <p className="error-text" role="alert">{overviewError}</p>}

      <section className="admin-quick-actions" aria-label="Admin quick actions">
        <div>
          <h3>Quick actions</h3>
          <p>Manage your organization from one place.</p>
        </div>
        <div className="admin-quick-action-buttons">
          <button type="button" className="btn-primary btn-small" onClick={() => onAddEmployee('Employee')}><UserPlus size={16} />Add Employee</button>
          <button type="button" className="btn-primary btn-small add-mgr-btn" onClick={() => onAddEmployee('Manager')} style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)', borderColor: '#4f46e5' }}><ShieldCheck size={16} />Add Manager</button>
          <button type="button" className="btn-ghost btn-small" onClick={() => openAction('department')}><Building2 size={16} />Create department</button>
          <button type="button" className="btn-ghost btn-small" onClick={() => openAction('project')}><FolderPlus size={16} />Create project</button>
          <button type="button" className="btn-ghost btn-small" onClick={() => openAction('announcement')}><Megaphone size={16} />Publish announcement</button>
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
        <section className="admin-overview-panel">
          <header><h3>Project progress</h3><span>{projectProgress.length} projects</span></header>
          {projectProgress.length === 0 ? <p className="admin-empty-state">No projects created yet.</p> : projectProgress.slice(0, 6).map((project) => (
            <div className="project-progress-row" key={project._id}>
              <div className="project-progress-heading"><strong>{project.name}</strong><span>{project.progress}%</span></div>
              <div className="project-progress-track"><span style={{ width: `${project.progress}%` }} /></div>
              <small>{project.completedTasks}/{project.taskCount} tasks complete · {project.status}</small>
            </div>
          ))}
        </section>

        {/* Departments */}
        <section id="departments-section" className="admin-overview-panel admin-departments-panel">
          <header><h3>Departments</h3><button type="button" className="detail-text-action" onClick={() => openAction('department')}>Create department</button></header>
          {(overview?.departments || []).length === 0 ? <p className="admin-empty-state">No departments created yet.</p> : (overview.departments || []).map((department) => (
            <article className={`admin-department-row ${department.isActive ? '' : 'is-inactive'}`} key={department._id}>
              <div className="admin-department-title">
                <div>
                  <strong>{department.name} {department.code ? `(${department.code})` : ''}</strong>
                  <span>Head: {department.head?.name || 'Unassigned'}</span>
                </div>
                <span className={`employee-status ${department.isActive ? 'active' : 'inactive'}`}>
                  {department.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="admin-department-metrics"><span><b>{department.metrics?.employees || 0}</b> employees</span><span><b>{department.metrics?.managers || 0}</b> managers</span><span><b>{department.metrics?.teams || 0}</b> teams</span><span><b>{department.metrics?.projects || 0}</b> projects</span><span><b>{department.metrics?.tasks || 0}</b> tasks</span><span><b>{department.metrics?.completionRate || 0}%</b> complete</span></div>
              <div className="admin-department-progress"><span style={{ width: `${department.metrics?.completionRate || 0}%` }} /></div>
              <div className="admin-department-actions"><button type="button" className="icon-btn" onClick={() => openAction('department', department)}>Edit</button><button type="button" className="icon-btn" onClick={() => toggleDepartment(department)}>{department.isActive ? 'Deactivate' : 'Activate'}</button></div>
            </article>
          ))}
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
              <Bell size={16} color="#f59e0b" /> Manager Project Alerts
            </h3>
            <span>{adminNotifications.filter(n => !n.isRead).length} unread</span>
          </header>
          {adminNotifications.length === 0 ? (
            <p className="admin-empty-state">No alerts received from managers.</p>
          ) : (
            adminNotifications.slice(0, 6).map((notif) => (
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
                    <span className={`task-badge priority-${(notif.priority || 'medium').toLowerCase()}`}>
                      {notif.priority || 'Normal'}
                    </span>
                    <strong style={{ fontSize: '13px' }}>{notif.title || 'Project Notification'}</strong>
                  </div>
                  <p style={{ margin: '4px 0', fontSize: '12.5px', color: 'var(--text-primary, #334155)', lineHeight: 1.4 }}>
                    {notif.message}
                  </p>
                  <small style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '11px' }}>
                    From: {notif.sender?.name || 'Manager'} {notif.project?.name ? `· Project: ${notif.project.name}` : ''} · {new Date(notif.createdAt).toLocaleDateString()}
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
    </div>
  );
}

export default AdminDashboard;
