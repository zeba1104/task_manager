import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from '../api/axios';
import {
  getTeamMembers,
  getEmployeeProfile,
  addEmployeeFeedback,
  requestEmployeeTransfer,
  getTransferRequests,
  getTeamPerformanceReports,
} from '../api/managerApi';
import Swal from '../utils/swalConfig';
import {
  Users,
  Search,
  AlertTriangle,
  Eye,
  ArrowRightLeft,
  Star,
  Printer,
  Briefcase,
  ShieldAlert,
  X,
  TrendingUp,
  UserCheck,
  UserX,
} from 'lucide-react';

function EmployeeAvatar({ employee }) {
  const [imageUrl, setImageUrl] = useState('');

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    if (!employee?.profilePicture) {
      setImageUrl('');
      return () => { active = false; };
    }
    axios.get(`/users/${employee._id}/profile-picture`, { responseType: 'blob' })
      .then((response) => {
        objectUrl = URL.createObjectURL(response.data);
        if (active) setImageUrl(objectUrl);
      })
      .catch(() => { if (active) setImageUrl(''); });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [employee?._id, employee?.profilePicture]);

  return imageUrl ? (
    <img className="manager-emp-avatar" src={imageUrl} alt="" />
  ) : (
    <span className="manager-emp-avatar-fallback">{employee?.name?.[0]?.toUpperCase() || '?'}</span>
  );
}

export default function ManagerTeamManagement({ manager }) {
  const [subTab, setSubTab] = useState('directory'); // directory | reports | transfers
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [teamData, setTeamData] = useState({ employees: [], filterOptions: { teams: [], designations: [] }, summary: {} });
  
  // Search & Filter
  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [designationFilter, setDesignationFilter] = useState('');
  const [quickFilter, setQuickFilter] = useState('all'); // all | overdue | highWorkload | present | onLeave

  // Profile Modal State
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileTab, setProfileTab] = useState('overview'); // overview | tasks | attendance | leave | feedback

  // Feedback Modal State
  const [feedbackModal, setFeedbackModal] = useState({ open: false, employee: null });
  const [feedbackForm, setFeedbackForm] = useState({ feedbackType: 'Performance', rating: 5, comments: '' });
  const [feedbackBusy, setFeedbackBusy] = useState(false);

  // Transfer Request Modal State
  const [transferModal, setTransferModal] = useState({ open: false, employee: null });
  const [transferForm, setTransferForm] = useState({ targetDepartment: '', targetTeam: '', reason: '' });
  const [transferBusy, setTransferBusy] = useState(false);

  // Reports & Transfer Requests List State
  const [reportsData, setReportsData] = useState(null);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [transferRequests, setTransferRequests] = useState([]);
  const [transfersLoading, setTransfersLoading] = useState(false);

  // Fetch Team Directory
  const loadTeamData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getTeamMembers();
      setTeamData(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load assigned team members.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTeamData();
  }, [loadTeamData]);

  // Load Reports when switching to reports tab
  useEffect(() => {
    if (subTab === 'reports') {
      setReportsLoading(true);
      getTeamPerformanceReports()
        .then((res) => setReportsData(res.data))
        .catch((err) => setError(err.response?.data?.message || 'Could not load performance reports.'))
        .finally(() => setReportsLoading(false));
    } else if (subTab === 'transfers') {
      setTransfersLoading(true);
      getTransferRequests()
        .then((res) => setTransferRequests(res.data))
        .catch((err) => setError(err.response?.data?.message || 'Could not load transfer requests.'))
        .finally(() => setTransfersLoading(false));
    }
  }, [subTab]);

  // Open Employee Profile Modal
  const openEmployeeProfile = async (employee) => {
    setSelectedProfile({ employee, metrics: {}, tasks: [], attendance: [], leaveHistory: [], feedback: [], transferRequests: [] });
    setProfileLoading(true);
    setProfileTab('overview');
    try {
      const res = await getEmployeeProfile(employee._id);
      setSelectedProfile(res.data);
    } catch (err) {
      Swal.fire({ title: 'Error', text: err.response?.data?.message || 'Could not load employee profile', icon: 'error' });
      setSelectedProfile(null);
    } finally {
      setProfileLoading(false);
    }
  };

  // Open Feedback Modal
  const openFeedback = (employee) => {
    setFeedbackModal({ open: true, employee });
    setFeedbackForm({ feedbackType: 'Performance', rating: 5, comments: '' });
  };

  // Submit Feedback
  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    if (!feedbackModal.employee) return;
    setFeedbackBusy(true);
    try {
      await addEmployeeFeedback(feedbackModal.employee._id, feedbackForm);
      Swal.fire({ title: 'Feedback Recorded', text: `Feedback for ${feedbackModal.employee.name} saved.`, icon: 'success', timer: 2000, showConfirmButton: false });
      setFeedbackModal({ open: false, employee: null });
      if (selectedProfile && selectedProfile.employee._id === feedbackModal.employee._id) {
        openEmployeeProfile(feedbackModal.employee);
      }
    } catch (err) {
      Swal.fire({ title: 'Error', text: err.response?.data?.message || 'Could not submit feedback', icon: 'error' });
    } finally {
      setFeedbackBusy(false);
    }
  };

  // Open Transfer Modal
  const openTransfer = (employee) => {
    setTransferModal({ open: true, employee });
    setTransferForm({ targetDepartment: '', targetTeam: '', reason: '' });
  };

  // Submit Transfer Request
  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    if (!transferModal.employee) return;
    setTransferBusy(true);
    try {
      await requestEmployeeTransfer({
        employeeId: transferModal.employee._id,
        targetDepartment: transferForm.targetDepartment,
        targetTeam: transferForm.targetTeam,
        reason: transferForm.reason,
      });
      Swal.fire({ title: 'Transfer Request Sent', text: `Request for ${transferModal.employee.name} forwarded to Admin.`, icon: 'success', timer: 2200, showConfirmButton: false });
      setTransferModal({ open: false, employee: null });
      if (subTab === 'transfers') {
        const res = await getTransferRequests();
        setTransferRequests(res.data);
      }
    } catch (err) {
      Swal.fire({ title: 'Error', text: err.response?.data?.message || 'Could not submit transfer request', icon: 'error' });
    } finally {
      setTransferBusy(false);
    }
  };

  // Filtered employees list
  const filteredEmployees = useMemo(() => {
    let list = teamData.employees || [];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        (e.name && e.name.toLowerCase().includes(q)) ||
        (e.employeeId && e.employeeId.toLowerCase().includes(q)) ||
        (e.email && e.email.toLowerCase().includes(q))
      );
    }

    if (teamFilter) {
      list = list.filter(e => e.team === teamFilter);
    }

    if (designationFilter) {
      list = list.filter(e => e.designation === designationFilter);
    }

    if (quickFilter === 'overdue') {
      list = list.filter(e => e.hasOverdue);
    } else if (quickFilter === 'highWorkload') {
      list = list.filter(e => e.workload?.workloadLevel === 'High');
    } else if (quickFilter === 'present') {
      list = list.filter(e => ['present', 'late'].includes(e.todayAttendance?.status));
    } else if (quickFilter === 'onLeave') {
      list = list.filter(e => e.todayAttendance?.status === 'on-leave');
    }

    return list;
  }, [teamData.employees, search, teamFilter, designationFilter, quickFilter]);

  const summary = teamData.summary || {};

  return (
    <div className="manager-feature-page">
      {/* Scope Notice */}
      <div className="manager-scope-banner">
        <ShieldAlert size={18} className="text-blue-500" />
        <div>
          <strong>Managed Team Scope:</strong> Employees are assigned and managed organization-wide by Admin. As a Manager, you can monitor your team&apos;s workload, attendance, view profiles, provide performance feedback, and request employee transfers or team changes through Admin.
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="manager-stat-grid team-stat-grid">
        <div className="stat-card">
          <strong>{summary.totalEmployees || 0}</strong>
          <span>Assigned Team Members</span>
        </div>
        <div className="stat-card">
          <strong>{summary.totalTeams || 0}</strong>
          <span>Teams Monitored</span>
        </div>
        <div className="stat-card">
          <strong>{summary.totalTasks || 0}</strong>
          <span>Total Tasks Assigned</span>
        </div>
        <div className="stat-card">
          <strong className="text-emerald">{summary.completionRate || 0}%</strong>
          <span>Task Completion Rate</span>
        </div>
        <div className="stat-card highlight-overdue">
          <strong className={summary.overdueTasks > 0 ? 'text-red' : ''}>{summary.overdueTasks || 0}</strong>
          <span>Overdue Tasks</span>
        </div>
        <div className="stat-card">
          <strong>{summary.presentToday || 0} / {summary.totalEmployees || 0}</strong>
          <span>Present Today</span>
        </div>
      </div>

      {/* Sub Navigation */}
      <div className="manager-subnav">
        <button
          className={subTab === 'directory' ? 'active' : ''}
          onClick={() => setSubTab('directory')}
        >
          <Users size={16} /> Team Directory & Workload
        </button>
        <button
          className={subTab === 'reports' ? 'active' : ''}
          onClick={() => setSubTab('reports')}
        >
          <TrendingUp size={16} /> Team Performance Reports
        </button>
        <button
          className={subTab === 'transfers' ? 'active' : ''}
          onClick={() => setSubTab('transfers')}
        >
          <ArrowRightLeft size={16} /> Transfer Requests Tracker
        </button>
      </div>

      {error && <p className="error-text" role="alert">{error}</p>}

      {/* SUB-VIEW 1: TEAM DIRECTORY & WORKLOAD */}
      {subTab === 'directory' && (
        <div className="manager-team-directory">
          {/* Filters Bar */}
          <div className="manager-toolbar">
            <div className="manager-search-box">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                placeholder="Search by name, employee ID, or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button className="clear-btn" onClick={() => setSearch('')}>
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="manager-filters-group">
              <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}>
                <option value="">All Teams ({teamData.filterOptions?.teams?.length || 0})</option>
                {teamData.filterOptions?.teams?.map((team) => (
                  <option key={team} value={team}>{team}</option>
                ))}
              </select>

              <select value={designationFilter} onChange={(e) => setDesignationFilter(e.target.value)}>
                <option value="">All Designations ({teamData.filterOptions?.designations?.length || 0})</option>
                {teamData.filterOptions?.designations?.map((desig) => (
                  <option key={desig} value={desig}>{desig}</option>
                ))}
              </select>

              {(teamFilter || designationFilter || quickFilter !== 'all' || search) && (
                <button
                  className="btn-ghost btn-small"
                  onClick={() => {
                    setSearch('');
                    setTeamFilter('');
                    setDesignationFilter('');
                    setQuickFilter('all');
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
              className={`filter-pill ${quickFilter === 'all' ? 'active' : ''}`}
              onClick={() => setQuickFilter('all')}
            >
              All Members ({teamData.employees?.length || 0})
            </button>
            <button
              className={`filter-pill pill-overdue ${quickFilter === 'overdue' ? 'active' : ''}`}
              onClick={() => setQuickFilter('overdue')}
            >
              <AlertTriangle size={13} />
              With Overdue Tasks ({teamData.employees?.filter(e => e.hasOverdue).length || 0})
            </button>
            <button
              className={`filter-pill ${quickFilter === 'highWorkload' ? 'active' : ''}`}
              onClick={() => setQuickFilter('highWorkload')}
            >
              High Workload ({teamData.employees?.filter(e => e.workload?.workloadLevel === 'High').length || 0})
            </button>
            <button
              className={`filter-pill ${quickFilter === 'present' ? 'active' : ''}`}
              onClick={() => setQuickFilter('present')}
            >
              <UserCheck size={13} /> Present Today ({summary.presentToday || 0})
            </button>
            <button
              className={`filter-pill ${quickFilter === 'onLeave' ? 'active' : ''}`}
              onClick={() => setQuickFilter('onLeave')}
            >
              <UserX size={13} /> On Leave ({summary.onLeaveToday || 0})
            </button>
          </div>

          {loading ? (
            <p className="manager-loading">Loading assigned team members...</p>
          ) : filteredEmployees.length === 0 ? (
            <div className="manager-empty-box">
              <Users size={36} className="text-muted" />
              <h4>No employees match your search criteria.</h4>
              <p>Try clearing filters or searching for another name or employee ID.</p>
            </div>
          ) : (
            <div className="manager-employee-grid">
              {filteredEmployees.map((employee) => (
                <div
                  key={employee._id}
                  className={`manager-employee-card ${employee.hasOverdue ? 'has-overdue' : ''}`}
                >
                  <div className="card-top-row">
                    <EmployeeAvatar employee={employee} />
                    <div className="card-name-block">
                      <div className="card-title-row">
                        <h4>{employee.name}</h4>
                        {employee.employeeId && (
                          <span className="badge-emp-id">{employee.employeeId}</span>
                        )}
                      </div>
                      <p className="card-designation">
                        {employee.designation || 'Team Member'}
                      </p>
                      <p className="card-team-dept">
                        <Briefcase size={12} /> {employee.team || 'General Team'} · {employee.department}
                      </p>
                    </div>
                  </div>

                  <div className="card-meta-row">
                    <div className="meta-item">
                      <span className="meta-label">Joining Date:</span>
                      <strong>{employee.joiningDate ? new Date(employee.joiningDate).toLocaleDateString() : 'N/A'}</strong>
                    </div>
                    <div className="meta-item">
                      <span className="meta-label">Today:</span>
                      <span className={`status-pill status-${employee.todayAttendance?.status}`}>
                        {employee.todayAttendance?.status === 'present' ? 'Present' :
                         employee.todayAttendance?.status === 'late' ? 'Late Clock-in' :
                         employee.todayAttendance?.status === 'on-leave' ? `On Leave (${employee.todayAttendance?.leaveType || 'Leave'})` : 'Absent'}
                      </span>
                    </div>
                  </div>

                  {/* Workload Section */}
                  <div className="card-workload-section">
                    <div className="workload-header">
                      <span>Workload & Completion</span>
                      <strong className={`workload-level level-${employee.workload?.workloadLevel?.toLowerCase()}`}>
                        {employee.workload?.workloadLevel} ({employee.workload?.activeTasks} active)
                      </strong>
                    </div>
                    <div className="workload-bar-track">
                      <div
                        className="workload-bar-fill"
                        style={{ width: `${employee.workload?.completionRate || 0}%` }}
                      />
                    </div>
                    <div className="workload-stats-row">
                      <span>{employee.workload?.completedTasks}/{employee.workload?.totalTasks} completed ({employee.workload?.completionRate}%)</span>
                      {employee.hasOverdue && (
                        <span className="overdue-tag">
                          <AlertTriangle size={12} /> {employee.workload?.overdueTasksCount} overdue
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="card-actions-row">
                    <button
                      className="btn-card-action"
                      onClick={() => openEmployeeProfile(employee)}
                      title="View Complete Profile & History"
                    >
                      <Eye size={14} /> Profile
                    </button>
                    <button
                      className="btn-card-action"
                      onClick={() => openFeedback(employee)}
                      title="Provide Performance Feedback"
                    >
                      <Star size={14} /> Feedback
                    </button>
                    <button
                      className="btn-card-action"
                      onClick={() => openTransfer(employee)}
                      title="Request Transfer / Team Change to Admin"
                    >
                      <ArrowRightLeft size={14} /> Transfer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-VIEW 2: TEAM PERFORMANCE REPORTS */}
      {subTab === 'reports' && (
        <div className="manager-reports-view">
          <div className="reports-top-bar">
            <div>
              <h3>Team-Wise Performance Reports</h3>
              <p className="text-muted">Aggregated productivity, task completion rates, and attendance for teams under your management scope.</p>
            </div>
            <button className="btn-ghost btn-small" onClick={() => window.print()}>
              <Printer size={15} /> Print / Export Report
            </button>
          </div>

          {reportsLoading ? (
            <p className="manager-loading">Generating team performance reports...</p>
          ) : !reportsData || reportsData.reports?.length === 0 ? (
            <p className="manager-empty-box">No team performance data available.</p>
          ) : (
            <div className="team-reports-grid">
              {reportsData.reports.map((report) => (
                <div key={report.teamName} className="team-report-card">
                  <div className="report-card-header">
                    <div>
                      <h4>{report.teamName}</h4>
                      <span className="text-muted">{report.memberCount} Team Members</span>
                    </div>
                    <span className={`grade-badge grade-${report.performanceGrade?.toLowerCase().replace(/\s+/g, '-')}`}>
                      {report.performanceGrade}
                    </span>
                  </div>

                  <div className="report-metrics-grid">
                    <div>
                      <span>Total Tasks</span>
                      <strong>{report.totalTasks}</strong>
                    </div>
                    <div>
                      <span>Completed</span>
                      <strong className="text-emerald">{report.completedTasks}</strong>
                    </div>
                    <div>
                      <span>In Progress</span>
                      <strong>{report.inProgressTasks}</strong>
                    </div>
                    <div>
                      <span>Overdue</span>
                      <strong className={report.overdueTasks > 0 ? 'text-red' : ''}>{report.overdueTasks}</strong>
                    </div>
                  </div>

                  <div className="report-progress-block">
                    <div className="progress-labels">
                      <span>Task Completion Rate</span>
                      <strong>{report.completionRate}%</strong>
                    </div>
                    <div className="workload-bar-track">
                      <div className="workload-bar-fill" style={{ width: `${report.completionRate}%` }} />
                    </div>
                  </div>

                  <div className="report-progress-block">
                    <div className="progress-labels">
                      <span>Today's Attendance Rate</span>
                      <strong>{report.attendanceRate}% ({report.presentCount}/{report.memberCount} present)</strong>
                    </div>
                    <div className="workload-bar-track">
                      <div className="workload-bar-fill attendance-fill" style={{ width: `${report.attendanceRate}%` }} />
                    </div>
                  </div>

                  <div className="report-members-list">
                    <span className="members-label">Members:</span>
                    <div className="members-tags">
                      {report.members.map((m) => (
                        <span key={m.id} className="member-tag">{m.name}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-VIEW 3: TRANSFER REQUESTS TRACKER */}
      {subTab === 'transfers' && (
        <div className="manager-transfers-view">
          <div className="reports-top-bar">
            <div>
              <h3>Employee Transfer & Team Change Requests</h3>
              <p className="text-muted">Track all transfer requests submitted to Admin for approval.</p>
            </div>
          </div>

          {transfersLoading ? (
            <p className="manager-loading">Loading transfer requests...</p>
          ) : transferRequests.length === 0 ? (
            <div className="manager-empty-box">
              <ArrowRightLeft size={36} className="text-muted" />
              <h4>No transfer requests submitted yet.</h4>
              <p>You can request an employee transfer or team change using the &quot;Transfer&quot; button in the directory.</p>
            </div>
          ) : (
            <div className="transfer-table-wrapper">
              <table className="manager-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Current Dept / Team</th>
                    <th>Requested Dept / Team</th>
                    <th>Reason</th>
                    <th>Status</th>
                    <th>Submitted</th>
                    <th>Admin Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {transferRequests.map((req) => (
                    <tr key={req._id}>
                      <td>
                        <strong>{req.employee?.name || 'Unknown'}</strong>
                        {req.employee?.employeeId && <small> ({req.employee.employeeId})</small>}
                      </td>
                      <td>{req.currentDepartment} · {req.currentTeam || 'No team'}</td>
                      <td>
                        <strong className="text-blue">{req.targetDepartment}</strong>
                        {req.targetTeam && <span> ({req.targetTeam})</span>}
                      </td>
                      <td className="reason-cell">{req.reason}</td>
                      <td>
                        <span className={`status-badge status-${req.status}`}>
                          {req.status === 'approved' ? 'Approved' : req.status === 'rejected' ? 'Rejected' : 'Pending Review'}
                        </span>
                      </td>
                      <td>{new Date(req.createdAt).toLocaleDateString()}</td>
                      <td>{req.adminNotes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          MODAL 1: EMPLOYEE PROFILE & DETAILS MODAL
         ========================================================================= */}
      {selectedProfile && (
        <div className="manager-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelectedProfile(null); }}>
          <div className="manager-modal-box profile-modal" role="dialog" aria-modal="true">
            <header className="manager-modal-header">
              <div className="modal-profile-title">
                <EmployeeAvatar employee={selectedProfile.employee} />
                <div>
                  <h3>{selectedProfile.employee?.name}</h3>
                  <p className="text-muted">
                    {selectedProfile.employee?.designation || 'Team Member'} · {selectedProfile.employee?.team || 'General Team'} · {selectedProfile.employee?.department}
                  </p>
                </div>
              </div>
              <button className="icon-btn" onClick={() => setSelectedProfile(null)} aria-label="Close">
                <X size={20} />
              </button>
            </header>

            {/* Profile Navigation */}
            <div className="modal-subnav">
              <button className={profileTab === 'overview' ? 'active' : ''} onClick={() => setProfileTab('overview')}>
                Overview & Workload
              </button>
              <button className={profileTab === 'tasks' ? 'active' : ''} onClick={() => setProfileTab('tasks')}>
                Assigned Projects & Tasks ({selectedProfile.tasks?.length || 0})
              </button>
              <button className={profileTab === 'attendance' ? 'active' : ''} onClick={() => setProfileTab('attendance')}>
                Attendance History ({selectedProfile.attendance?.length || 0})
              </button>
              <button className={profileTab === 'leave' ? 'active' : ''} onClick={() => setProfileTab('leave')}>
                Leave History ({selectedProfile.leaveHistory?.length || 0})
              </button>
              <button className={profileTab === 'feedback' ? 'active' : ''} onClick={() => setProfileTab('feedback')}>
                Feedback & Reviews ({selectedProfile.feedback?.length || 0})
              </button>
            </div>

            <div className="modal-body-scroll">
              {profileLoading && <p className="manager-loading">Loading complete employee profile and workload records...</p>}
              {profileTab === 'overview' && (
                <div className="profile-overview-panel">
                  {/* Basic Facts */}
                  <div className="profile-facts-grid">
                    <div><span>Employee ID</span><strong>{selectedProfile.employee?.employeeId || 'Not assigned'}</strong></div>
                    <div><span>Email</span><strong>{selectedProfile.employee?.email}</strong></div>
                    <div><span>Phone</span><strong>{selectedProfile.employee?.phone || 'Not set'}</strong></div>
                    <div><span>Joining Date</span><strong>{selectedProfile.employee?.joiningDate ? new Date(selectedProfile.employee.joiningDate).toLocaleDateString() : 'Not set'}</strong></div>
                    <div><span>Team</span><strong>{selectedProfile.employee?.team || 'General Team'}</strong></div>
                    <div><span>Department</span><strong>{selectedProfile.employee?.department}</strong></div>
                    <div><span>Responsibilities</span><strong>{selectedProfile.employee?.responsibilities || 'None recorded'}</strong></div>
                  </div>

                  {/* Workload Highlights */}
                  <h4 className="section-title">Workload & Performance Summary</h4>
                  <div className="profile-stats-grid">
                    <div className="p-stat"><span>Total Tasks</span><strong>{selectedProfile.metrics?.totalTasks}</strong></div>
                    <div className="p-stat"><span>Completed</span><strong className="text-emerald">{selectedProfile.metrics?.completedTasks}</strong></div>
                    <div className="p-stat"><span>In Progress</span><strong>{selectedProfile.metrics?.inProgressTasks}</strong></div>
                    <div className="p-stat"><span>Pending</span><strong>{selectedProfile.metrics?.pendingTasks}</strong></div>
                    <div className="p-stat">
                      <span>Overdue Tasks</span>
                      <strong className={selectedProfile.metrics?.overdueTasksCount > 0 ? 'text-red' : ''}>
                        {selectedProfile.metrics?.overdueTasksCount}
                      </strong>
                    </div>
                    <div className="p-stat"><span>Completion Rate</span><strong>{selectedProfile.metrics?.completionRate}%</strong></div>
                  </div>

                  {/* Overdue Tasks Alert Section */}
                  {selectedProfile.overdueTasks?.length > 0 && (
                    <div className="overdue-alert-block">
                      <div className="overdue-alert-header">
                        <AlertTriangle size={18} className="text-red" />
                        <strong>Identified Overdue Tasks ({selectedProfile.overdueTasks.length})</strong>
                      </div>
                      <ul className="overdue-task-list">
                        {selectedProfile.overdueTasks.map((task) => (
                          <li key={task._id}>
                            <strong>{task.title}</strong>
                            <span>{task.project ? `[Project: ${task.project}]` : ''} Deadline was {new Date(task.deadline).toLocaleDateString()}</span>
                            <span className="badge-priority">{task.priority}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {profileTab === 'tasks' && (
                <div className="profile-tasks-panel">
                  <h4>Assigned Projects ({selectedProfile.projects?.length || 0})</h4>
                  {selectedProfile.projects?.length === 0 ? (
                    <p className="text-muted">No specific projects assigned yet.</p>
                  ) : (
                    <div className="assigned-projects-list">
                      {selectedProfile.projects.map((proj) => (
                        <div key={proj._id} className="assigned-project-item">
                          <div>
                            <strong>{proj.name}</strong>
                            <p>{proj.description || 'No description'}</p>
                          </div>
                          <div>
                            <span className={`status-badge status-${proj.status?.toLowerCase().replace(/\s+/g, '-')}`}>{proj.status}</span>
                            <small>Deadline: {proj.deadline ? new Date(proj.deadline).toLocaleDateString() : 'N/A'}</small>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <h4 style={{ marginTop: '20px' }}>Assigned Tasks ({selectedProfile.tasks?.length || 0})</h4>
                  {selectedProfile.tasks?.length === 0 ? (
                    <p className="text-muted">No tasks currently assigned.</p>
                  ) : (
                    <div className="assigned-tasks-table-wrapper">
                      <table className="manager-table">
                        <thead>
                          <tr>
                            <th>Task Title</th>
                            <th>Project</th>
                            <th>Priority</th>
                            <th>Status</th>
                            <th>Deadline</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedProfile.tasks.map((task) => {
                            const isOverdue = task.status !== 'completed' && task.deadline && new Date(task.deadline) < new Date();
                            return (
                              <tr key={task._id} className={isOverdue ? 'row-overdue' : ''}>
                                <td>
                                  <strong>{task.title}</strong>
                                  {isOverdue && <span className="overdue-pill">Overdue</span>}
                                </td>
                                <td>{task.project || 'General'}</td>
                                <td><span className={`badge-priority priority-${task.priority}`}>{task.priority}</span></td>
                                <td><span className={`status-badge status-${task.status}`}>{task.status}</span></td>
                                <td>{task.deadline ? new Date(task.deadline).toLocaleDateString() : 'None'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {profileTab === 'attendance' && (
                <div className="profile-attendance-panel">
                  <h4>Attendance Log (Recent 90 records)</h4>
                  {selectedProfile.attendance?.length === 0 ? (
                    <p className="text-muted">No attendance logs found.</p>
                  ) : (
                    <table className="manager-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Clock In</th>
                          <th>Clock Out</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedProfile.attendance.map((att) => {
                          const isLate = att.clockIn && new Date(att.clockIn).getHours() >= 9;
                          return (
                            <tr key={att._id || att.date}>
                              <td>{att.date}</td>
                              <td>{att.clockIn ? new Date(att.clockIn).toLocaleTimeString() : '—'}</td>
                              <td>{att.clockOut ? new Date(att.clockOut).toLocaleTimeString() : '—'}</td>
                              <td>
                                <span className={`status-badge ${isLate ? 'status-late' : 'status-present'}`}>
                                  {isLate ? 'Late' : 'Present'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {profileTab === 'leave' && (
                <div className="profile-leave-panel">
                  <h4>Leave Request History</h4>
                  {selectedProfile.leaveHistory?.length === 0 ? (
                    <p className="text-muted">No leave requests recorded.</p>
                  ) : (
                    <table className="manager-table">
                      <thead>
                        <tr>
                          <th>Leave Type</th>
                          <th>Period</th>
                          <th>Reason</th>
                          <th>Status</th>
                          <th>Requested On</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedProfile.leaveHistory.map((leave) => (
                          <tr key={leave._id}>
                            <td><strong>{leave.leaveType}</strong></td>
                            <td>{new Date(leave.startDate).toLocaleDateString()} – {new Date(leave.endDate).toLocaleDateString()}</td>
                            <td>{leave.reason || '—'}</td>
                            <td><span className={`status-badge status-${leave.status}`}>{leave.status}</span></td>
                            <td>{new Date(leave.createdAt).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {profileTab === 'feedback' && (
                <div className="profile-feedback-panel">
                  <div className="feedback-panel-header">
                    <h4>Manager Feedback & Reviews</h4>
                    <button className="btn-primary btn-small" onClick={() => openFeedback(selectedProfile.employee)}>
                      + Provide Feedback
                    </button>
                  </div>
                  {selectedProfile.feedback?.length === 0 ? (
                    <p className="text-muted">No performance feedback recorded yet.</p>
                  ) : (
                    <div className="feedback-list">
                      {selectedProfile.feedback.map((fb) => (
                        <div key={fb._id} className="feedback-item-card">
                          <div className="fb-header">
                            <div>
                              <strong>{fb.manager?.name || 'Manager'}</strong>
                              <span className="fb-type-tag">{fb.feedbackType}</span>
                            </div>
                            <div className="fb-rating">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  size={14}
                                  fill={star <= fb.rating ? '#f59e0b' : 'none'}
                                  color={star <= fb.rating ? '#f59e0b' : '#d1d5db'}
                                />
                              ))}
                              <time>{new Date(fb.createdAt).toLocaleDateString()}</time>
                            </div>
                          </div>
                          <p className="fb-comments">{fb.comments}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <footer className="manager-modal-footer">
              <button
                className="btn-ghost"
                onClick={() => openFeedback(selectedProfile.employee)}
              >
                <Star size={15} /> Provide Feedback
              </button>
              <button
                className="btn-ghost"
                onClick={() => openTransfer(selectedProfile.employee)}
              >
                <ArrowRightLeft size={15} /> Request Transfer
              </button>
              <button className="btn-primary btn-small" onClick={() => setSelectedProfile(null)}>
                Done
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: PROVIDE FEEDBACK MODAL
         ========================================================================= */}
      {feedbackModal.open && (
        <div className="manager-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setFeedbackModal({ open: false, employee: null }); }}>
          <div className="manager-modal-box action-modal" role="dialog" aria-modal="true">
            <header className="manager-modal-header">
              <h3>Provide Employee Feedback</h3>
              <button className="icon-btn" onClick={() => setFeedbackModal({ open: false, employee: null })}>
                <X size={18} />
              </button>
            </header>
            <form onSubmit={handleFeedbackSubmit}>
              <div className="feedback-target-summary">
                <EmployeeAvatar employee={feedbackModal.employee} />
                <div>
                  <strong>{feedbackModal.employee?.name}</strong>
                  <p>{feedbackModal.employee?.designation || 'Team Member'} · {feedbackModal.employee?.team || 'General'}</p>
                </div>
              </div>

              <label>
                Feedback Type
                <select
                  value={feedbackForm.feedbackType}
                  onChange={(e) => setFeedbackForm({ ...feedbackForm, feedbackType: e.target.value })}
                >
                  <option value="Performance">Performance Evaluation</option>
                  <option value="Praise">Praise & Recognition</option>
                  <option value="Improvement">Area for Improvement</option>
                  <option value="General">General Review / Note</option>
                </select>
              </label>

              <label>
                Rating (1 to 5 Stars)
                <div className="interactive-stars">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      type="button"
                      key={star}
                      className="star-btn"
                      onClick={() => setFeedbackForm({ ...feedbackForm, rating: star })}
                    >
                      <Star
                        size={22}
                        fill={star <= feedbackForm.rating ? '#f59e0b' : 'none'}
                        color={star <= feedbackForm.rating ? '#f59e0b' : '#9ca3af'}
                      />
                    </button>
                  ))}
                  <span className="star-text">{feedbackForm.rating} of 5 Stars</span>
                </div>
              </label>

              <label>
                Comments & Review Notes
                <textarea
                  rows={4}
                  placeholder="Provide constructive feedback, accomplishments, or areas to improve..."
                  value={feedbackForm.comments}
                  onChange={(e) => setFeedbackForm({ ...feedbackForm, comments: e.target.value })}
                  required
                />
              </label>

              <footer className="manager-modal-footer">
                <button type="button" className="btn-ghost" onClick={() => setFeedbackModal({ open: false, employee: null })}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary btn-small" disabled={feedbackBusy}>
                  {feedbackBusy ? 'Saving...' : 'Submit Feedback'}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 3: REQUEST TRANSFER OR TEAM CHANGE MODAL
         ========================================================================= */}
      {transferModal.open && (
        <div className="manager-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setTransferModal({ open: false, employee: null }); }}>
          <div className="manager-modal-box action-modal" role="dialog" aria-modal="true">
            <header className="manager-modal-header">
              <h3>Request Employee Transfer</h3>
              <button className="icon-btn" onClick={() => setTransferModal({ open: false, employee: null })}>
                <X size={18} />
              </button>
            </header>
            <form onSubmit={handleTransferSubmit}>
              <div className="feedback-target-summary">
                <EmployeeAvatar employee={transferModal.employee} />
                <div>
                  <strong>{transferModal.employee?.name}</strong>
                  <p>Current: {transferModal.employee?.department} · Team: {transferModal.employee?.team || 'General'}</p>
                </div>
              </div>

              <label>
                Target Department *
                <input
                  type="text"
                  placeholder="e.g. Engineering, Marketing, Operations..."
                  value={transferForm.targetDepartment}
                  onChange={(e) => setTransferForm({ ...transferForm, targetDepartment: e.target.value })}
                  required
                />
              </label>

              <label>
                Target Team (Optional)
                <input
                  type="text"
                  placeholder="e.g. Core Platform, Mobile, QA..."
                  value={transferForm.targetTeam}
                  onChange={(e) => setTransferForm({ ...transferForm, targetTeam: e.target.value })}
                />
              </label>

              <label>
                Reason & Justification for Transfer *
                <textarea
                  rows={4}
                  placeholder="Explain why this transfer or team change is requested for Admin approval..."
                  value={transferForm.reason}
                  onChange={(e) => setTransferForm({ ...transferForm, reason: e.target.value })}
                  required
                />
              </label>

              <footer className="manager-modal-footer">
                <button type="button" className="btn-ghost" onClick={() => setTransferModal({ open: false, employee: null })}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary btn-small" disabled={transferBusy}>
                  {transferBusy ? 'Sending Request...' : 'Send Request to Admin'}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
