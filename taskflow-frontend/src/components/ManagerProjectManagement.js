import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import axios from '../api/axios';
import {
  getManagerProjects,
  getManagerProjectDetails,
  createManagerProject,
  updateManagerProject,
  addProjectMilestone,
  updateProjectMilestone,
  deleteProjectMilestone,
  uploadProjectDocument,
  deleteProjectDocument,
  addProjectComment,
  notifyAdminProjectUpdate,
  generateProjectProgressReport,
} from '../api/managerApi';
import Swal from '../utils/swalConfig';
import {
  FolderPlus,
  FolderOpen,
  Search,
  Calendar,
  AlertTriangle,
  Clock,
  CheckCircle2,
  FileText,
  Upload,
  Download,
  Trash2,
  MessageSquare,
  Bell,
  Printer,
  X,
  Users,
  Briefcase,
  Flag,
  Target,
  Paperclip,
  Building2,
  Plus,
  Send,
  UserCheck,
  Layers,
  FileUp,
} from 'lucide-react';

const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch (e) {
    return 'N/A';
  }
};

const getInitials = (name) => {
  if (!name) return '??';
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

function UserAvatar({ user }) {
  const [imageUrl, setImageUrl] = useState('');

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    if (!user?.profilePicture) {
      setImageUrl('');
      return () => { active = false; };
    }
    axios.get(`/users/${user._id}/profile-picture`, { responseType: 'blob' })
      .then((response) => {
        objectUrl = URL.createObjectURL(response.data);
        if (active) setImageUrl(objectUrl);
      })
      .catch(() => { if (active) setImageUrl(''); });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [user?._id, user?.profilePicture]);

  return imageUrl ? (
    <img className="manager-user-avatar" src={imageUrl} alt="" />
  ) : (
    <span className="manager-user-avatar-fallback">{user?.name?.[0]?.toUpperCase() || '?'}</span>
  );
}

export default function ManagerProjectManagement({ manager, authorizedEmployees = [], department = null }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Search & Filter
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [activeProjectDetail, setActiveProjectDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState('overview'); // overview | milestones | contributions | documents | comments

  // Report Modal
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);

  // Notify Admin Modal
  const [notifyModalOpen, setNotifyModalOpen] = useState(false);
  const [notifyTargetProject, setNotifyTargetProject] = useState(null);
  const [notifyForm, setNotifyForm] = useState({ title: '', message: '', priority: 'High' });
  const [notifyBusy, setNotifyBusy] = useState(false);

  // Project Form State
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    objectives: '',
    requirements: '',
    startDate: new Date().toISOString().slice(0, 10),
    deadline: '',
    priority: 'Medium',
    status: 'Planning',
    teamLead: '',
    assignedEmployees: [],
    progress: 0,
    milestones: [],
  });
  const [newMilestoneInput, setNewMilestoneInput] = useState({ title: '', description: '', deliverables: '', dueDate: '' });
  const [formBusy, setFormBusy] = useState(false);

  // Detail Modal Sub-forms
  const [milestoneForm, setMilestoneForm] = useState({ title: '', description: '', deliverables: '', dueDate: '' });
  const [milestoneBusy, setMilestoneBusy] = useState(false);
  const [documentFile, setDocumentFile] = useState(null);
  const [documentBusy, setDocumentBusy] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentBusy, setCommentBusy] = useState(false);
  const docInputRef = useRef(null);

  // Fetch Projects
  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getManagerProjects();
      setProjects(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load projects.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Open Create Modal
  const openCreateModal = () => {
    setEditingProject(null);
    setFormData({
      name: '',
      description: '',
      objectives: '',
      requirements: '',
      startDate: new Date().toISOString().slice(0, 10),
      deadline: '',
      priority: 'Medium',
      status: 'Planning',
      teamLead: '',
      assignedEmployees: [],
      progress: 0,
      milestones: [],
    });
    setNewMilestoneInput({ title: '', description: '', deliverables: '', dueDate: '' });
    setCreateModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (project) => {
    setEditingProject(project);
    setFormData({
      name: project.name || '',
      description: project.description || '',
      objectives: project.objectives || '',
      requirements: project.requirements || '',
      startDate: project.startDate ? new Date(project.startDate).toISOString().slice(0, 10) : '',
      deadline: project.deadline ? new Date(project.deadline).toISOString().slice(0, 10) : '',
      priority: project.priority || 'Medium',
      status: project.status || 'Planning',
      teamLead: project.teamLead?._id || project.teamLead || '',
      assignedEmployees: (project.assignedEmployees || []).map(e => e._id || e),
      progress: project.progress || 0,
      milestones: project.milestones || [],
    });
    setCreateModalOpen(true);
  };

  // Save Project (Create / Update)
  const handleSaveProject = async (e) => {
    e.preventDefault();
    setFormBusy(true);
    try {
      if (editingProject) {
        await updateManagerProject(editingProject._id, formData);
        Swal.fire({ title: 'Project Updated', text: `Project "${formData.name}" has been updated.`, icon: 'success', timer: 1800, showConfirmButton: false });
      } else {
        await createManagerProject(formData);
        Swal.fire({ title: 'Project Created', text: `Project "${formData.name}" created within authorized department.`, icon: 'success', timer: 2000, showConfirmButton: false });
      }
      setCreateModalOpen(false);
      await fetchProjects();
    } catch (err) {
      Swal.fire({ title: 'Error', text: err.response?.data?.message || 'Could not save project', icon: 'error' });
    } finally {
      setFormBusy(false);
    }
  };

  // Add initial milestone in create form
  const handleAddInitialMilestone = () => {
    if (!newMilestoneInput.title.trim()) return;
    setFormData({
      ...formData,
      milestones: [...formData.milestones, { ...newMilestoneInput, completed: false }],
    });
    setNewMilestoneInput({ title: '', description: '', deliverables: '', dueDate: '' });
  };

  const handleRemoveInitialMilestone = (index) => {
    setFormData({
      ...formData,
      milestones: formData.milestones.filter((_, i) => i !== index),
    });
  };

  // Open Project Details Workspace Modal
  const openProjectDetails = async (projectId) => {
    setDetailModalOpen(true);
    setDetailLoading(true);
    setDetailTab('overview');
    try {
      const res = await getManagerProjectDetails(projectId);
      setActiveProjectDetail(res.data);
    } catch (err) {
      Swal.fire({ title: 'Error', text: err.response?.data?.message || 'Could not load project details', icon: 'error' });
      setDetailModalOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  // Quick Status Updater from Card
  const handleQuickStatusChange = async (project, newStatus) => {
    try {
      await updateManagerProject(project._id, { status: newStatus });
      fetchProjects();
    } catch (err) {
      Swal.fire({ title: 'Error', text: err.response?.data?.message || 'Could not update status', icon: 'error' });
    }
  };

  // Milestone actions inside Detail Modal
  const handleAddMilestone = async (e) => {
    e.preventDefault();
    if (!milestoneForm.title.trim() || !activeProjectDetail) return;
    setMilestoneBusy(true);
    try {
      const res = await addProjectMilestone(activeProjectDetail.project._id, milestoneForm);
      setActiveProjectDetail({
        ...activeProjectDetail,
        project: { ...activeProjectDetail.project, milestones: res.data },
      });
      setMilestoneForm({ title: '', description: '', deliverables: '', dueDate: '' });
      fetchProjects();
      Swal.fire({ title: 'Milestone Added', icon: 'success', timer: 1400, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ title: 'Error', text: err.response?.data?.message || 'Could not add milestone', icon: 'error' });
    } finally {
      setMilestoneBusy(false);
    }
  };

  const handleToggleMilestone = async (milestone) => {
    if (!activeProjectDetail) return;
    try {
      const res = await updateProjectMilestone(activeProjectDetail.project._id, milestone._id, {
        completed: !milestone.completed,
      });
      setActiveProjectDetail({
        ...activeProjectDetail,
        project: { ...activeProjectDetail.project, milestones: res.data },
      });
      fetchProjects();
    } catch (err) {
      Swal.fire({ title: 'Error', text: err.response?.data?.message || 'Could not update milestone', icon: 'error' });
    }
  };

  const handleDeleteMilestone = async (milestoneId) => {
    if (!activeProjectDetail) return;
    try {
      const res = await deleteProjectMilestone(activeProjectDetail.project._id, milestoneId);
      setActiveProjectDetail({
        ...activeProjectDetail,
        project: { ...activeProjectDetail.project, milestones: res.data },
      });
      fetchProjects();
    } catch (err) {
      Swal.fire({ title: 'Error', text: err.response?.data?.message || 'Could not delete milestone', icon: 'error' });
    }
  };

  // Document upload inside Detail Modal
  const handleUploadDocument = async (e) => {
    e.preventDefault();
    if (!documentFile || !activeProjectDetail) return;
    setDocumentBusy(true);
    const form = new FormData();
    form.append('document', documentFile);
    try {
      const res = await uploadProjectDocument(activeProjectDetail.project._id, form);
      setActiveProjectDetail({
        ...activeProjectDetail,
        project: { ...activeProjectDetail.project, documents: res.data },
      });
      setDocumentFile(null);
      if (docInputRef.current) docInputRef.current.value = '';
      fetchProjects();
      Swal.fire({ title: 'Document Uploaded', icon: 'success', timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ title: 'Upload Failed', text: err.response?.data?.message || 'Could not upload document', icon: 'error' });
    } finally {
      setDocumentBusy(false);
    }
  };

  const handleDeleteDocument = async (docId) => {
    if (!activeProjectDetail) return;
    try {
      const res = await deleteProjectDocument(activeProjectDetail.project._id, docId);
      setActiveProjectDetail({
        ...activeProjectDetail,
        project: { ...activeProjectDetail.project, documents: res.data.documents },
      });
      fetchProjects();
    } catch (err) {
      Swal.fire({ title: 'Error', text: err.response?.data?.message || 'Could not delete document', icon: 'error' });
    }
  };

  // Add Comment inside Detail Modal
  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim() || !activeProjectDetail) return;
    setCommentBusy(true);
    try {
      const res = await addProjectComment(activeProjectDetail.project._id, { text: commentText });
      setActiveProjectDetail({
        ...activeProjectDetail,
        project: { ...activeProjectDetail.project, comments: res.data },
      });
      setCommentText('');
    } catch (err) {
      Swal.fire({ title: 'Error', text: err.response?.data?.message || 'Could not add comment', icon: 'error' });
    } finally {
      setCommentBusy(false);
    }
  };

  // Open Progress Report Modal
  const openProgressReport = async (projectId) => {
    setReportModalOpen(true);
    setReportLoading(true);
    try {
      const res = await generateProjectProgressReport(projectId);
      setReportData(res.data);
    } catch (err) {
      Swal.fire({ title: 'Error', text: err.response?.data?.message || 'Could not load report', icon: 'error' });
      setReportModalOpen(false);
    } finally {
      setReportLoading(false);
    }
  };

  // Open Notify Admin Modal
  const openNotifyAdmin = (project) => {
    setNotifyTargetProject(project);
    setNotifyForm({
      title: `Update on ${project.name}`,
      message: '',
      priority: project.priority || 'High',
    });
    setNotifyModalOpen(true);
  };

  // Submit Notify Admin
  const handleNotifyAdmin = async (e) => {
    e.preventDefault();
    if (!notifyTargetProject) return;
    setNotifyBusy(true);
    try {
      await notifyAdminProjectUpdate(notifyTargetProject._id, notifyForm);
      Swal.fire({
        title: 'Admin Notified',
        text: `Your update on "${notifyTargetProject.name}" has been delivered to Admin notifications.`,
        icon: 'success',
      });
      setNotifyModalOpen(false);
    } catch (err) {
      Swal.fire({ title: 'Error', text: err.response?.data?.message || 'Could not notify Admin', icon: 'error' });
    } finally {
      setNotifyBusy(false);
    }
  };

  // Filtered Projects
  const filteredProjects = useMemo(() => {
    let list = projects;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.description && p.description.toLowerCase().includes(q)) ||
        (p.objectives && p.objectives.toLowerCase().includes(q))
      );
    }
    if (statusFilter) {
      list = list.filter(p => p.status === statusFilter);
    }
    if (priorityFilter) {
      list = list.filter(p => p.priority === priorityFilter);
    }
    return list;
  }, [projects, search, statusFilter, priorityFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = projects.length;
    const planning = projects.filter(p => p.status === 'Planning').length;
    const inProgress = projects.filter(p => p.status === 'In Progress').length;
    const onHold = projects.filter(p => p.status === 'On Hold').length;
    const completed = projects.filter(p => p.status === 'Completed').length;
    const overdue = projects.filter(p => p.isOverdue).length;
    return { total, planning, inProgress, onHold, completed, overdue };
  }, [projects]);

  return (
    <div className="manager-feature-page">
      {/* Top Scope Notice */}
      <div className="manager-scope-banner">
        <Briefcase size={18} className="text-blue-500" />
        <div>
          <strong>Department Project Authority:</strong> Projects are scoped within your authorized department ({department?.name || 'Assigned Department'}). You can assign authorized team members and project leads, set deliverables &amp; milestones, track progress, manage documents, and notify Admin about critical updates.
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="manager-stat-grid project-stat-grid">
        <div className="stat-card">
          <strong>{stats.total}</strong>
          <span>Total Projects</span>
        </div>
        <div className="stat-card">
          <strong className="text-purple">{stats.planning}</strong>
          <span>Planning</span>
        </div>
        <div className="stat-card">
          <strong className="text-blue">{stats.inProgress}</strong>
          <span>In Progress</span>
        </div>
        <div className="stat-card">
          <strong className="text-amber">{stats.onHold}</strong>
          <span>On Hold</span>
        </div>
        <div className="stat-card">
          <strong className="text-emerald">{stats.completed}</strong>
          <span>Completed</span>
        </div>
        <div className="stat-card highlight-overdue">
          <strong className={stats.overdue > 0 ? 'text-red' : ''}>{stats.overdue}</strong>
          <span>Overdue Projects</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="manager-toolbar">
        <div className="manager-search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search projects by name, objectives, description..."
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
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="Planning">Planning</option>
            <option value="In Progress">In Progress</option>
            <option value="On Hold">On Hold</option>
            <option value="Completed">Completed</option>
          </select>

          <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
            <option value="">All Priorities</option>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
            <option value="Critical">Critical</option>
          </select>

          {(search || statusFilter || priorityFilter) && (
            <button
              className="btn-ghost btn-small"
              onClick={() => {
                setSearch('');
                setStatusFilter('');
                setPriorityFilter('');
              }}
            >
              Reset
            </button>
          )}

          <button className="btn-primary btn-small" onClick={openCreateModal}>
            <FolderPlus size={16} /> Create Project
          </button>
        </div>
      </div>

      {error && <p className="error-text" role="alert">{error}</p>}

      {/* Projects Grid */}
      {loading ? (
        <p className="manager-loading">Loading projects...</p>
      ) : filteredProjects.length === 0 ? (
        <div className="manager-empty-box">
          <FolderOpen size={36} className="text-muted" />
          <h4>No projects match your filter.</h4>
          <p>Create a new project for your assigned team or adjust your search parameters.</p>
          <button className="btn-primary btn-small" onClick={openCreateModal} style={{ marginTop: '12px' }}>
            <FolderPlus size={15} /> Create First Project
          </button>
        </div>
      ) : (
        <div className="manager-project-grid">
          {filteredProjects.map((project) => (
            <div
              key={project._id}
              className={`manager-project-card ${project.isOverdue ? 'has-overdue' : ''}`}
            >
              {/* Header */}
              <div className="project-card-header">
                <div>
                  <div className="card-badge-row">
                    <span className={`priority-tag priority-${project.priority?.toLowerCase()}`}>
                      <Flag size={11} /> {project.priority}
                    </span>
                    <span className="dept-tag">
                      {project.department?.name || 'Department'}
                    </span>
                  </div>
                  <h4 className="project-card-title">{project.name}</h4>
                </div>

                <select
                  className={`status-select status-${project.status?.toLowerCase().replace(/\s+/g, '-')}`}
                  value={project.status}
                  onChange={(e) => handleQuickStatusChange(project, e.target.value)}
                  title="Update project status"
                >
                  <option value="Planning">Planning</option>
                  <option value="In Progress">In Progress</option>
                  <option value="On Hold">On Hold</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>

              {project.description && (
                <p className="project-card-desc">{project.description}</p>
              )}

              {/* Progress Bar */}
              <div className="project-progress-wrap">
                <div className="progress-text-row">
                  <span>Progress</span>
                  <strong>{project.progress}%</strong>
                </div>
                <div className="workload-bar-track">
                  <div
                    className="workload-bar-fill"
                    style={{ width: `${project.progress}%` }}
                  />
                </div>
              </div>

              {/* Deadline & Countdown */}
              <div className="project-deadline-row">
                <div className="deadline-item">
                  <Calendar size={13} className="text-muted" />
                  <span>
                    Deadline: <b>{project.deadline ? new Date(project.deadline).toLocaleDateString() : 'Not set'}</b>
                  </span>
                </div>
                {project.deadline && (
                  <span className={`days-countdown ${project.isOverdue ? 'overdue' : project.daysRemaining <= 3 ? 'soon' : 'ok'}`}>
                    {project.isOverdue ? (
                      <><AlertTriangle size={12} /> Overdue by {Math.abs(project.daysRemaining)}d</>
                    ) : project.daysRemaining === 0 ? (
                      <><Clock size={12} /> Due Today</>
                    ) : (
                      <><Clock size={12} /> {project.daysRemaining}d left</>
                    )}
                  </span>
                )}
              </div>

              {/* Team Lead & Members */}
              <div className="project-team-row">
                <div className="lead-col">
                  <span className="sub-label">Team Lead:</span>
                  <div className="lead-badge">
                    {project.teamLead ? (
                      <>
                        <UserAvatar user={project.teamLead} />
                        <span>{project.teamLead.name}</span>
                      </>
                    ) : (
                      <span className="text-muted">Unassigned</span>
                    )}
                  </div>
                </div>

                <div className="members-col">
                  <span className="sub-label">Assigned ({project.assignedEmployees?.length || 0}):</span>
                  <div className="member-avatar-stack">
                    {(project.assignedEmployees || []).slice(0, 4).map((emp) => (
                      <div key={emp._id || emp} className="avatar-stack-item" title={emp.name || 'Member'}>
                        <UserAvatar user={emp} />
                      </div>
                    ))}
                    {(project.assignedEmployees?.length || 0) > 4 && (
                      <span className="avatar-stack-more">
                        +{project.assignedEmployees.length - 4}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Milestones, Docs, Comments Counters */}
              <div className="project-meta-counters">
                <span>
                  <CheckCircle2 size={13} /> {project.completedMilestonesCount}/{project.milestonesCount} milestones
                </span>
                <span>
                  <Paperclip size={13} /> {project.documentsCount || 0} docs
                </span>
                <span>
                  <MessageSquare size={13} /> {project.commentsCount || 0} updates
                </span>
              </div>

              {/* Actions Row */}
              <div className="card-actions-row">
                <button
                  className="btn-card-action primary"
                  onClick={() => openProjectDetails(project._id)}
                  title="Open Project Workspace, Milestones & Contributions"
                >
                  <FolderOpen size={14} /> Workspace
                </button>
                <button
                  className="btn-card-action"
                  onClick={() => openProgressReport(project._id)}
                  title="Generate Executive Progress Report"
                >
                  <FileText size={14} /> Report
                </button>
                <button
                  className="btn-card-action"
                  onClick={() => openNotifyAdmin(project)}
                  title="Notify Admin of Important Update"
                >
                  <Bell size={14} /> Notify Admin
                </button>
                <button
                  className="btn-card-action"
                  onClick={() => openEditModal(project)}
                  title="Edit Project Configuration"
                >
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* =========================================================================
          MODAL 1: CREATE / EDIT PROJECT MODAL
         ========================================================================= */}
      {createModalOpen && (
        <div className="manager-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setCreateModalOpen(false); }}>
          <div className="manager-modal-box form-modal" role="dialog" aria-modal="true">
            <header className="manager-modal-header">
              <h3>{editingProject ? 'Edit Project' : 'Create New Project'}</h3>
              <button className="icon-btn" onClick={() => setCreateModalOpen(false)}>
                <X size={20} />
              </button>
            </header>

            <form onSubmit={handleSaveProject} className="project-create-form">
              <div className="form-grid-2">
                <label>
                  Project Name *
                  <input
                    type="text"
                    placeholder="e.g. Mobile App V2, Migration..."
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </label>

                <label>
                  Authorized Department
                  <input
                    type="text"
                    value={department?.name || 'Assigned Department'}
                    disabled
                    className="input-disabled"
                  />
                </label>
              </div>

              <label>
                Description
                <textarea
                  rows={2}
                  placeholder="High-level project description..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </label>

              <div className="form-grid-2">
                <label>
                  Project Objectives *
                  <textarea
                    rows={3}
                    placeholder="Key strategic goals and targets this project will achieve..."
                    value={formData.objectives}
                    onChange={(e) => setFormData({ ...formData, objectives: e.target.value })}
                    required
                  />
                </label>

                <label>
                  Requirements &amp; Deliverables *
                  <textarea
                    rows={3}
                    placeholder="Core requirements, quality standards, and deliverable specs..."
                    value={formData.requirements}
                    onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                    required
                  />
                </label>
              </div>

              <div className="form-grid-4">
                <label>
                  Start Date
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  />
                </label>

                <label>
                  Deadline *
                  <input
                    type="date"
                    value={formData.deadline}
                    onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                    required
                  />
                </label>

                <label>
                  Priority
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </label>

                <label>
                  Status
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option value="Planning">Planning</option>
                    <option value="In Progress">In Progress</option>
                    <option value="On Hold">On Hold</option>
                    <option value="Completed">Completed</option>
                  </select>
                </label>
              </div>

              <div className="form-grid-2">
                <label>
                  Assign Project Leader / Team Lead
                  <select
                    value={formData.teamLead}
                    onChange={(e) => setFormData({ ...formData, teamLead: e.target.value })}
                  >
                    <option value="">Select Team Lead (Optional)</option>
                    {authorizedEmployees.map((emp) => (
                      <option key={emp._id} value={emp._id}>
                        {emp.name} ({emp.designation || emp.role} - {emp.team || 'Team'})
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Progress ({formData.progress}%)
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={formData.progress}
                    onChange={(e) => setFormData({ ...formData, progress: Number(e.target.value) })}
                  />
                </label>
              </div>

              {/* Assign Employees from Authorized Teams */}
              <label>
                Assign Employees from Authorized Team ({formData.assignedEmployees.length} selected)
                <div className="member-checkbox-list">
                  {authorizedEmployees.map((emp) => {
                    const isSelected = formData.assignedEmployees.includes(emp._id);
                    return (
                      <label key={emp._id} className={`member-check-item ${isSelected ? 'selected' : ''}`}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({
                                ...formData,
                                assignedEmployees: [...formData.assignedEmployees, emp._id],
                              });
                            } else {
                              setFormData({
                                ...formData,
                                assignedEmployees: formData.assignedEmployees.filter(id => id !== emp._id),
                              });
                            }
                          }}
                        />
                        <span>{emp.name} <small>({emp.designation || 'Member'} · {emp.team || 'General'})</small></span>
                      </label>
                    );
                  })}
                </div>
              </label>

              {/* Initial Milestones Section */}
              <div className="milestones-form-section">
                <h4>Project Milestones &amp; Deliverables</h4>
                {formData.milestones.length > 0 && (
                  <ul className="milestone-preview-list">
                    {formData.milestones.map((m, idx) => (
                      <li key={idx}>
                        <div>
                          <strong>{m.title}</strong>
                          {m.deliverables && <span> · Deliverable: {m.deliverables}</span>}
                          {m.dueDate && <small> · Due {new Date(m.dueDate).toLocaleDateString()}</small>}
                        </div>
                        <button type="button" onClick={() => handleRemoveInitialMilestone(idx)} className="text-red">
                          <X size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="milestone-add-row">
                  <input
                    type="text"
                    placeholder="Milestone title..."
                    value={newMilestoneInput.title}
                    onChange={(e) => setNewMilestoneInput({ ...newMilestoneInput, title: e.target.value })}
                  />
                  <input
                    type="text"
                    placeholder="Expected deliverables..."
                    value={newMilestoneInput.deliverables}
                    onChange={(e) => setNewMilestoneInput({ ...newMilestoneInput, deliverables: e.target.value })}
                  />
                  <input
                    type="date"
                    value={newMilestoneInput.dueDate}
                    onChange={(e) => setNewMilestoneInput({ ...newMilestoneInput, dueDate: e.target.value })}
                  />
                  <button type="button" className="btn-ghost btn-small" onClick={handleAddInitialMilestone}>
                    + Add
                  </button>
                </div>
              </div>

              <footer className="manager-modal-footer">
                <button type="button" className="btn-ghost" onClick={() => setCreateModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary btn-small" disabled={formBusy}>
                  {formBusy ? 'Saving...' : editingProject ? 'Update Project' : 'Create Project'}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: PROJECT WORKSPACE & DETAILS MODAL
         ========================================================================= */}
      {detailModalOpen && (
        <div className="manager-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setDetailModalOpen(false); }}>
          <div className="manager-modal-box project-detail-modal" role="dialog" aria-modal="true">
            {detailLoading || !activeProjectDetail ? (
              <div className="proj-modal-loading-box">
                <div className="loading-spinner" />
                <p>Loading project workspace...</p>
              </div>
            ) : (
              <>
                <header className="manager-modal-header proj-modal-header-elevated">
                  <div className="project-detail-heading">
                    <div className="heading-tags">
                      <span className={`priority-tag priority-${activeProjectDetail.project?.priority?.toLowerCase()}`}>
                        <span className="priority-dot" />
                        {activeProjectDetail.project?.priority || 'Normal'}
                      </span>
                      {activeProjectDetail.project?.department?.name && (
                        <span className="dept-tag">
                          <Building2 size={12} />
                          {activeProjectDetail.project?.department?.name}
                        </span>
                      )}
                      <span className="status-tag-subtle">
                        {activeProjectDetail.project?.status || 'Active'}
                      </span>
                    </div>
                    <h3>{activeProjectDetail.project?.name}</h3>
                  </div>

                  <div className="detail-header-actions">
                    <button type="button" className="proj-action-btn" onClick={() => openProgressReport(activeProjectDetail.project._id)} title="Generate Progress Report">
                      <FileText size={14} /> <span>Progress Report</span>
                    </button>
                    <button type="button" className="proj-action-btn" onClick={() => openNotifyAdmin(activeProjectDetail.project)} title="Notify Administrators">
                      <Bell size={14} /> <span>Notify Admin</span>
                    </button>
                    <button type="button" className="proj-close-btn" onClick={() => setDetailModalOpen(false)} aria-label="Close modal">
                      <X size={18} />
                    </button>
                  </div>
                </header>

                {/* Progress banner in header */}
                <div className="modal-progress-strip">
                  <div className="strip-labels">
                    <div className="strip-left">
                      <span className="strip-title">Project Progress</span>
                      <span className="proj-completion-pill">
                        <strong>{activeProjectDetail.project?.progress || 0}%</strong> Completed
                      </span>
                    </div>
                    <div className="strip-right">
                      <div className={`proj-deadline-chip ${activeProjectDetail.project?.isOverdue ? 'is-overdue' : ''}`}>
                        <Clock size={13} />
                        <span>Deadline: <strong>{formatDate(activeProjectDetail.project?.deadline)}</strong></span>
                        {activeProjectDetail.project?.isOverdue && (
                          <span className="overdue-micro-badge"><AlertTriangle size={11} /> Overdue</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="workload-bar-track">
                    <div
                      className="workload-bar-fill proj-bar-gradient"
                      style={{ width: `${Math.min(100, Math.max(0, activeProjectDetail.project?.progress || 0))}%` }}
                    />
                  </div>
                </div>

                {/* Tabs */}
                <div className="modal-subnav proj-modal-subnav">
                  <button type="button" className={detailTab === 'overview' ? 'active' : ''} onClick={() => setDetailTab('overview')}>
                    <Target size={15} />
                    <span>Overview &amp; Scope</span>
                  </button>
                  <button type="button" className={detailTab === 'milestones' ? 'active' : ''} onClick={() => setDetailTab('milestones')}>
                    <CheckCircle2 size={15} />
                    <span>Milestones &amp; Deliverables</span>
                    <span className="tab-pill-count">{activeProjectDetail.project?.milestones?.length || 0}</span>
                  </button>
                  <button type="button" className={detailTab === 'contributions' ? 'active' : ''} onClick={() => setDetailTab('contributions')}>
                    <Users size={15} />
                    <span>Employee Contributions</span>
                    <span className="tab-pill-count">{activeProjectDetail.contributions?.length || 0}</span>
                  </button>
                  <button type="button" className={detailTab === 'documents' ? 'active' : ''} onClick={() => setDetailTab('documents')}>
                    <Paperclip size={15} />
                    <span>Documents</span>
                    <span className="tab-pill-count">{activeProjectDetail.project?.documents?.length || 0}</span>
                  </button>
                  <button type="button" className={detailTab === 'comments' ? 'active' : ''} onClick={() => setDetailTab('comments')}>
                    <MessageSquare size={15} />
                    <span>Comments &amp; Updates</span>
                    <span className="tab-pill-count">{activeProjectDetail.project?.comments?.length || 0}</span>
                  </button>
                </div>

                <div className="modal-body-scroll proj-modal-scroll">
                  {/* TAB 1: OVERVIEW & SCOPE */}
                  {detailTab === 'overview' && (
                    <div className="detail-overview-tab">
                      <div className="overview-cards-grid">
                        <div className="proj-scope-card">
                          <div className="scope-card-header">
                            <div className="scope-icon-wrap icon-purple">
                              <Target size={16} />
                            </div>
                            <h4>Project Objectives</h4>
                          </div>
                          <p className="scope-card-body">
                            {activeProjectDetail.project?.objectives || 'No objectives stated for this project.'}
                          </p>
                        </div>

                        <div className="proj-scope-card">
                          <div className="scope-card-header">
                            <div className="scope-icon-wrap icon-blue">
                              <Layers size={16} />
                            </div>
                            <h4>Requirements &amp; Deliverables Specifications</h4>
                          </div>
                          <p className="scope-card-body">
                            {activeProjectDetail.project?.requirements || 'No specific technical requirements documented.'}
                          </p>
                        </div>
                      </div>

                      {/* 4 Metadata Cards */}
                      <div className="overview-meta-cards">
                        <div className="meta-metric-card">
                          <div className="meta-icon-bubble bubble-blue">
                            <Calendar size={16} />
                          </div>
                          <div className="meta-text">
                            <span className="meta-label">Start Date</span>
                            <strong className="meta-value">{formatDate(activeProjectDetail.project?.startDate)}</strong>
                          </div>
                        </div>

                        <div className="meta-metric-card">
                          <div className={`meta-icon-bubble ${activeProjectDetail.project?.isOverdue ? 'bubble-red' : 'bubble-amber'}`}>
                            <Clock size={16} />
                          </div>
                          <div className="meta-text">
                            <span className="meta-label">Target Deadline</span>
                            <strong className={`meta-value ${activeProjectDetail.project?.isOverdue ? 'text-red' : ''}`}>
                              {formatDate(activeProjectDetail.project?.deadline)}
                            </strong>
                          </div>
                        </div>

                        <div className="meta-metric-card">
                          <div className="meta-icon-bubble bubble-purple">
                            <UserCheck size={16} />
                          </div>
                          <div className="meta-text">
                            <span className="meta-label">Project Leader</span>
                            <strong className="meta-value">{activeProjectDetail.project?.teamLead?.name || 'Unassigned'}</strong>
                          </div>
                        </div>

                        <div className="meta-metric-card">
                          <div className="meta-icon-bubble bubble-emerald">
                            <Briefcase size={16} />
                          </div>
                          <div className="meta-text">
                            <span className="meta-label">Manager</span>
                            <strong className="meta-value">{activeProjectDetail.project?.manager?.name || 'Unassigned'}</strong>
                          </div>
                        </div>
                      </div>

                      {/* Associated Tasks Breakdown */}
                      <div className="overview-task-stats-elevated">
                        <div className="section-head-row">
                          <div className="section-head-left">
                            <Layers size={16} className="text-blue" />
                            <h4>Associated Tasks Breakdown</h4>
                          </div>
                          <span className="stats-total-pill">{activeProjectDetail.taskStats?.total || 0} Total Tasks</span>
                        </div>

                        <div className="overview-task-metrics-grid">
                          <div className="stat-box-card">
                            <span className="stat-box-label">Total Tasks</span>
                            <strong className="stat-box-val">{activeProjectDetail.taskStats?.total || 0}</strong>
                          </div>
                          <div className="stat-box-card border-emerald">
                            <span className="stat-box-label">Completed</span>
                            <strong className="stat-box-val text-emerald">{activeProjectDetail.taskStats?.completed || 0}</strong>
                          </div>
                          <div className="stat-box-card border-blue">
                            <span className="stat-box-label">In Progress</span>
                            <strong className="stat-box-val text-blue">{activeProjectDetail.taskStats?.inProgress || 0}</strong>
                          </div>
                          <div className="stat-box-card border-amber">
                            <span className="stat-box-label">Pending</span>
                            <strong className="stat-box-val text-amber">{activeProjectDetail.taskStats?.pending || 0}</strong>
                          </div>
                          <div className={`stat-box-card ${activeProjectDetail.taskStats?.overdue > 0 ? 'border-red alert-card' : ''}`}>
                            <span className="stat-box-label">Overdue</span>
                            <strong className={`stat-box-val ${activeProjectDetail.taskStats?.overdue > 0 ? 'text-red' : ''}`}>
                              {activeProjectDetail.taskStats?.overdue || 0}
                            </strong>
                          </div>
                          <div className="stat-box-card border-indigo rate-card">
                            <span className="stat-box-label">Completion Rate</span>
                            <strong className="stat-box-val text-indigo">{activeProjectDetail.taskStats?.completionRate || 0}%</strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: MILESTONES & DELIVERABLES */}
                  {detailTab === 'milestones' && (
                    <div className="detail-milestones-tab">
                      <div className="milestone-composer-card">
                        <div className="composer-header">
                          <Plus size={16} className="text-blue" />
                          <div>
                            <h5>Define New Milestone &amp; Deliverable</h5>
                            <p>Set key milestones and deadlines to track project deliverables.</p>
                          </div>
                        </div>
                        <form onSubmit={handleAddMilestone} className="milestone-form-grid">
                          <div className="form-group-field">
                            <label>Milestone Title <span className="req">*</span></label>
                            <input
                              type="text"
                              placeholder="e.g. Backend API Hardening"
                              value={milestoneForm.title}
                              onChange={(e) => setMilestoneForm({ ...milestoneForm, title: e.target.value })}
                              required
                            />
                          </div>
                          <div className="form-group-field">
                            <label>Deliverables Description</label>
                            <input
                              type="text"
                              placeholder="e.g. Unit tests, Swagger docs, JWT auth"
                              value={milestoneForm.deliverables}
                              onChange={(e) => setMilestoneForm({ ...milestoneForm, deliverables: e.target.value })}
                            />
                          </div>
                          <div className="form-group-field date-field">
                            <label>Target Due Date</label>
                            <input
                              type="date"
                              value={milestoneForm.dueDate}
                              onChange={(e) => setMilestoneForm({ ...milestoneForm, dueDate: e.target.value })}
                            />
                          </div>
                          <div className="form-group-btn">
                            <button type="submit" className="btn-add-milestone" disabled={milestoneBusy || !milestoneForm.title.trim()}>
                              <Plus size={15} />
                              <span>{milestoneBusy ? 'Adding...' : 'Add Milestone'}</span>
                            </button>
                          </div>
                        </form>
                      </div>

                      <div className="milestones-checklist-section">
                        <div className="checklist-header-row">
                          <div className="section-title-wrap">
                            <CheckCircle2 size={16} className="text-emerald" />
                            <h4>Milestones Checklist</h4>
                          </div>
                          <span className="milestones-progress-pill">
                            {activeProjectDetail.project?.milestones?.filter(m => m.completed).length || 0} of {activeProjectDetail.project?.milestones?.length || 0} completed
                          </span>
                        </div>

                        {(!activeProjectDetail.project?.milestones || activeProjectDetail.project.milestones.length === 0) ? (
                          <div className="proj-empty-card">
                            <CheckCircle2 size={32} className="empty-icon text-muted" />
                            <h5>No milestones defined yet</h5>
                            <p>Add key project milestones using the form above to track phase-by-phase completion.</p>
                          </div>
                        ) : (
                          <div className="milestone-card-list">
                            {activeProjectDetail.project?.milestones?.map((milestone) => (
                              <div key={milestone._id} className={`milestone-card-item ${milestone.completed ? 'is-completed' : ''}`}>
                                <div className="milestone-check-col">
                                  <input
                                    type="checkbox"
                                    id={`ms-${milestone._id}`}
                                    checked={milestone.completed}
                                    onChange={() => handleToggleMilestone(milestone)}
                                    className="milestone-custom-check"
                                  />
                                </div>
                                <div className="milestone-info-col">
                                  <div className="milestone-title-line">
                                    <label htmlFor={`ms-${milestone._id}`} className={`milestone-title ${milestone.completed ? 'completed-text' : ''}`}>
                                      {milestone.title}
                                    </label>
                                    {milestone.dueDate && (
                                      <span className="milestone-due-badge">
                                        <Calendar size={12} />
                                        Due {formatDate(milestone.dueDate)}
                                      </span>
                                    )}
                                  </div>
                                  {milestone.deliverables && (
                                    <div className="milestone-deliverable-line">
                                      <span className="deliverable-label">Deliverable:</span>
                                      <span className="deliverable-text">{milestone.deliverables}</span>
                                    </div>
                                  )}
                                  {milestone.description && (
                                    <p className="milestone-desc-text">{milestone.description}</p>
                                  )}
                                </div>
                                <div className="milestone-actions-col">
                                  <span className={`status-badge-chip ${milestone.completed ? 'chip-completed' : 'chip-pending'}`}>
                                    {milestone.completed ? 'Completed' : 'Pending'}
                                  </span>
                                  <button
                                    type="button"
                                    className="milestone-delete-btn"
                                    onClick={() => handleDeleteMilestone(milestone._id)}
                                    title="Delete Milestone"
                                    aria-label="Delete Milestone"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 3: INDIVIDUAL EMPLOYEE CONTRIBUTIONS */}
                  {detailTab === 'contributions' && (
                    <div className="detail-contributions-tab">
                      <div className="contributions-header-banner">
                        <div className="banner-title">
                          <Users size={18} className="text-blue" />
                          <div>
                            <h4>Individual Employee Contributions</h4>
                            <p>Track work completed, tasks in progress, and workload balance across project contributors.</p>
                          </div>
                        </div>
                      </div>

                      {(!activeProjectDetail.contributions || activeProjectDetail.contributions.length === 0) ? (
                        <div className="proj-empty-card">
                          <Users size={32} className="empty-icon text-muted" />
                          <h5>No employee contributions recorded yet</h5>
                          <p>When team members are assigned tasks and log progress on this project, their contribution metrics will appear here.</p>
                        </div>
                      ) : (
                        <div className="proj-table-card">
                          <div className="proj-table-wrapper">
                            <table className="proj-data-table">
                              <thead>
                                <tr>
                                  <th>Team Member</th>
                                  <th>Designation &amp; Team</th>
                                  <th className="text-center">Assigned</th>
                                  <th className="text-center">Completed</th>
                                  <th className="text-center">In Progress</th>
                                  <th className="text-center">Overdue</th>
                                  <th>Completion Rate</th>
                                  <th className="text-center">Contribution</th>
                                </tr>
                              </thead>
                              <tbody>
                                {activeProjectDetail.contributions?.map((emp) => (
                                  <tr key={emp.id}>
                                    <td>
                                      <div className="emp-name-cell">
                                        <div className="emp-avatar-circle">
                                          {getInitials(emp.name)}
                                        </div>
                                        <div className="emp-identity">
                                          <strong className="emp-full-name">{emp.name}</strong>
                                          {emp.employeeId && <span className="emp-id-sub">{emp.employeeId}</span>}
                                        </div>
                                      </div>
                                    </td>
                                    <td>
                                      <div className="emp-role-cell">
                                        <span className="emp-role-title">{emp.designation || 'Team Member'}</span>
                                        <span className="emp-role-dept">{emp.team || 'General'}</span>
                                      </div>
                                    </td>
                                    <td className="text-center">
                                      <span className="count-pill pill-total">{emp.assignedTasks}</span>
                                    </td>
                                    <td className="text-center">
                                      <span className="count-pill pill-completed">{emp.completedTasks}</span>
                                    </td>
                                    <td className="text-center">
                                      <span className="count-pill pill-inprogress">{emp.inProgressTasks}</span>
                                    </td>
                                    <td className="text-center">
                                      <span className={`count-pill ${emp.overdueTasks > 0 ? 'pill-overdue' : 'pill-zero'}`}>
                                        {emp.overdueTasks}
                                      </span>
                                    </td>
                                    <td>
                                      <div className="contrib-progress-cell">
                                        <div className="contrib-track">
                                          <div className="contrib-bar-fill" style={{ width: `${emp.completionRate}%` }} />
                                        </div>
                                        <span className="contrib-pct">{emp.completionRate}%</span>
                                      </div>
                                    </td>
                                    <td className="text-center">
                                      <span className="badge-share-pill">{emp.contributionShare}%</span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 4: DOCUMENTS */}
                  {detailTab === 'documents' && (
                    <div className="detail-documents-tab">
                      <div className="document-uploader-card">
                        <div className="uploader-header">
                          <FileUp size={16} className="text-blue" />
                          <div>
                            <h5>Upload Project Document</h5>
                            <p>Attach project specifications, design links, architecture docs, or spreadsheets.</p>
                          </div>
                        </div>
                        <form onSubmit={handleUploadDocument} className="document-upload-composer">
                          <input
                            type="file"
                            id="proj-doc-file-input"
                            ref={docInputRef}
                            style={{ display: 'none' }}
                            onChange={(e) => setDocumentFile(e.target.files?.[0] || null)}
                          />
                          {!documentFile ? (
                            <label htmlFor="proj-doc-file-input" className="file-drop-zone">
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
                                  <strong>{documentFile.name}</strong>
                                  <small>{(documentFile.size / 1024).toFixed(1)} KB</small>
                                </div>
                              </div>
                              <div className="selected-file-actions">
                                <button
                                  type="button"
                                  className="btn-remove-selected"
                                  onClick={() => {
                                    setDocumentFile(null);
                                    if (docInputRef.current) docInputRef.current.value = '';
                                  }}
                                >
                                  <X size={15} /> Remove
                                </button>
                                <button type="submit" className="btn-upload-submit" disabled={documentBusy}>
                                  <Upload size={14} />
                                  <span>{documentBusy ? 'Uploading...' : 'Upload File'}</span>
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
                            <h4>Project Documents</h4>
                          </div>
                          <span className="stats-total-pill">{activeProjectDetail.project?.documents?.length || 0} Files</span>
                        </div>

                        {(!activeProjectDetail.project?.documents || activeProjectDetail.project.documents.length === 0) ? (
                          <div className="proj-empty-card">
                            <Paperclip size={32} className="empty-icon text-muted" />
                            <h5>No project documents uploaded yet</h5>
                            <p>Upload files above to share project assets and documentation with your team.</p>
                          </div>
                        ) : (
                          <div className="documents-grid-list">
                            {activeProjectDetail.project?.documents?.map((doc) => (
                              <div key={doc._id} className="doc-item-card">
                                <div className="doc-item-left">
                                  <div className="doc-icon-tile">
                                    <FileText size={20} />
                                  </div>
                                  <div className="doc-item-details">
                                    <strong className="doc-item-name" title={doc.originalName}>{doc.originalName}</strong>
                                    <div className="doc-item-meta">
                                      <span>{(doc.size / 1024).toFixed(1)} KB</span>
                                      <span className="meta-sep">·</span>
                                      <span>Uploaded by {doc.uploadedBy?.name || 'Manager'}</span>
                                      <span className="meta-sep">·</span>
                                      <span>{formatDate(doc.createdAt)}</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="doc-item-actions">
                                  <a
                                    href={`/api/manager/projects/${activeProjectDetail.project._id}/documents/${doc._id}`}
                                    download={doc.originalName}
                                    className="btn-doc-download"
                                    target="_blank"
                                    rel="noreferrer"
                                    title="Download Document"
                                  >
                                    <Download size={14} /> <span>Download</span>
                                  </a>
                                  <button
                                    type="button"
                                    className="btn-doc-delete"
                                    onClick={() => handleDeleteDocument(doc._id)}
                                    title="Delete Document"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 5: COMMENTS & UPDATES */}
                  {detailTab === 'comments' && (
                    <div className="detail-comments-tab">
                      <div className="comment-composer-card">
                        <div className="composer-header">
                          <MessageSquare size={16} className="text-blue" />
                          <div>
                            <h5>Post Project Update or Note</h5>
                            <p>Share updates, highlight milestones, or communicate requirements to project members.</p>
                          </div>
                        </div>
                        <form onSubmit={handleAddComment} className="comment-composer-form">
                          <textarea
                            rows={3}
                            placeholder="Add a project comment, status update, or milestone note..."
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            className="comment-textarea-elevated"
                            required
                          />
                          <div className="composer-footer-row">
                            <span className="composer-hint">Visible to all assigned team members and management.</span>
                            <button
                              type="submit"
                              className="btn-post-comment"
                              disabled={commentBusy || !commentText.trim()}
                            >
                              <Send size={14} />
                              <span>{commentBusy ? 'Posting...' : 'Post Update'}</span>
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
                          <span className="stats-total-pill">{activeProjectDetail.project?.comments?.length || 0} Updates</span>
                        </div>

                        {(!activeProjectDetail.project?.comments || activeProjectDetail.project.comments.length === 0) ? (
                          <div className="proj-empty-card">
                            <MessageSquare size={32} className="empty-icon text-muted" />
                            <h5>No comments or updates yet</h5>
                            <p>Post the first update using the composer above to initiate communication with the team.</p>
                          </div>
                        ) : (
                          <div className="comments-timeline-stream">
                            {activeProjectDetail.project?.comments?.slice().reverse().map((comm, idx) => (
                              <div key={comm._id || idx} className="comment-timeline-card">
                                <div className="comment-avatar-circle">
                                  {getInitials(comm.user?.name || 'Team Member')}
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
              </>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 3: PROJECT PROGRESS REPORT MODAL
         ========================================================================= */}
      {reportModalOpen && (
        <div className="manager-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setReportModalOpen(false); }}>
          <div className="manager-modal-box report-modal printable-report" role="dialog" aria-modal="true">
            {reportLoading || !reportData ? (
              <p className="manager-loading">Generating project progress report...</p>
            ) : (
              <>
                <header className="report-modal-header no-print">
                  <h3>Project Progress Report</h3>
                  <div className="report-actions">
                    <button className="btn-ghost btn-small" onClick={() => window.print()}>
                      <Printer size={15} /> Print / Export PDF
                    </button>
                    <button className="icon-btn" onClick={() => setReportModalOpen(false)}>
                      <X size={20} />
                    </button>
                  </div>
                </header>

                <div className="report-document-body">
                  <div className="report-banner">
                    <div className="report-brand">
                      <h2>TASKFLOW ENTERPRISE</h2>
                      <span>Project Progress &amp; Executive Status Report</span>
                    </div>
                    <div className="report-date-box">
                      <span>Generated: {new Date(reportData.summary?.generatedAt).toLocaleString()}</span>
                      <span className={`status-badge status-${reportData.project?.status?.toLowerCase().replace(/\s+/g, '-')}`}>
                        {reportData.project?.status}
                      </span>
                    </div>
                  </div>

                  {/* Summary Grid */}
                  <div className="report-project-header">
                    <h3>{reportData.project?.name}</h3>
                    <p className="report-dept">
                      Department: {reportData.project?.department?.name} ({reportData.project?.department?.code}) · Priority: <b>{reportData.project?.priority}</b>
                    </p>
                    <div className="report-key-facts">
                      <div><span>Manager:</span> <strong>{reportData.project?.manager?.name}</strong></div>
                      <div><span>Team Lead:</span> <strong>{reportData.project?.teamLead?.name || 'None'}</strong></div>
                      <div><span>Start Date:</span> <strong>{reportData.project?.startDate ? new Date(reportData.project.startDate).toLocaleDateString() : 'N/A'}</strong></div>
                      <div><span>Target Deadline:</span> <strong>{reportData.project?.deadline ? new Date(reportData.project.deadline).toLocaleDateString() : 'N/A'}</strong></div>
                      <div><span>Overall Progress:</span> <strong className="text-emerald">{reportData.summary?.overallProgress}%</strong></div>
                      <div><span>Overdue Status:</span> <strong>{reportData.summary?.isOverdue ? 'YES - OVERDUE' : 'On Track'}</strong></div>
                    </div>
                  </div>

                  {/* Objectives & Scope */}
                  <div className="report-section">
                    <h4>1. Project Objectives</h4>
                    <p>{reportData.project?.objectives || 'No objectives stated.'}</p>
                  </div>

                  <div className="report-section">
                    <h4>2. Requirements &amp; Deliverables</h4>
                    <p>{reportData.project?.requirements || 'No requirements stated.'}</p>
                  </div>

                  {/* Milestone Progress Table */}
                  <div className="report-section">
                    <h4>3. Milestones &amp; Deliverables Status ({reportData.summary?.completedMilestones}/{reportData.summary?.totalMilestones} Completed)</h4>
                    {reportData.milestones?.length === 0 ? (
                      <p className="text-muted">No milestones configured.</p>
                    ) : (
                      <table className="manager-table report-table">
                        <thead>
                          <tr>
                            <th>Milestone</th>
                            <th>Expected Deliverable</th>
                            <th>Due Date</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.milestones.map((m) => (
                            <tr key={m._id}>
                              <td><strong>{m.title}</strong></td>
                              <td>{m.deliverables || '—'}</td>
                              <td>{m.dueDate ? new Date(m.dueDate).toLocaleDateString() : '—'}</td>
                              <td>
                                <span className={`status-badge ${m.completed ? 'status-completed' : 'status-pending'}`}>
                                  {m.completed ? 'Completed' : 'Pending'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {/* Individual Contributions Table */}
                  <div className="report-section">
                    <h4>4. Individual Employee Contributions Breakdown</h4>
                    {reportData.contributions?.length === 0 ? (
                      <p className="text-muted">No individual contributions recorded.</p>
                    ) : (
                      <table className="manager-table report-table">
                        <thead>
                          <tr>
                            <th>Member</th>
                            <th>Designation</th>
                            <th>Tasks Assigned</th>
                            <th>Completed</th>
                            <th>In Progress</th>
                            <th>Overdue</th>
                            <th>Completion Rate</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.contributions.map((c) => (
                            <tr key={c.id}>
                              <td><strong>{c.name}</strong></td>
                              <td>{c.designation || 'Member'}</td>
                              <td>{c.assignedTasks}</td>
                              <td><strong className="text-emerald">{c.completedTasks}</strong></td>
                              <td>{c.inProgressTasks}</td>
                              <td><strong className={c.overdueTasks > 0 ? 'text-red' : ''}>{c.overdueTasks}</strong></td>
                              <td><strong>{c.completionRate}%</strong></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {/* Task Workload Summary */}
                  <div className="report-section">
                    <h4>5. Task Metrics Summary</h4>
                    <div className="report-kpi-row">
                      <div className="kpi-box"><span>Total Tasks</span><strong>{reportData.summary?.totalTasks}</strong></div>
                      <div className="kpi-box"><span>Completed</span><strong className="text-emerald">{reportData.summary?.completedTasks}</strong></div>
                      <div className="kpi-box"><span>In Progress</span><strong>{reportData.summary?.inProgressTasks}</strong></div>
                      <div className="kpi-box"><span>Pending</span><strong>{reportData.summary?.pendingTasks}</strong></div>
                      <div className="kpi-box"><span>Overdue</span><strong className={reportData.summary?.overdueTasks > 0 ? 'text-red' : ''}>{reportData.summary?.overdueTasks}</strong></div>
                    </div>
                  </div>
                </div>

                <footer className="manager-modal-footer no-print">
                  <button className="btn-primary btn-small" onClick={() => setReportModalOpen(false)}>
                    Close
                  </button>
                </footer>
              </>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 4: NOTIFY ADMIN ABOUT IMPORTANT PROJECT UPDATE
         ========================================================================= */}
      {notifyModalOpen && (
        <div className="manager-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setNotifyModalOpen(false); }}>
          <div className="manager-modal-box action-modal" role="dialog" aria-modal="true">
            <header className="manager-modal-header">
              <h3>Notify Admin about Project Update</h3>
              <button className="icon-btn" onClick={() => setNotifyModalOpen(false)}>
                <X size={18} />
              </button>
            </header>

            <form onSubmit={handleNotifyAdmin}>
              <div className="notify-project-target">
                <FolderOpen size={20} className="text-blue" />
                <div>
                  <strong>{notifyTargetProject?.name}</strong>
                  <p>Department: {notifyTargetProject?.department?.name || 'Department'}</p>
                </div>
              </div>

              <label>
                Update Subject / Title *
                <input
                  type="text"
                  placeholder="e.g. Critical Milestone Completed, Timeline Adjustment..."
                  value={notifyForm.title}
                  onChange={(e) => setNotifyForm({ ...notifyForm, title: e.target.value })}
                  required
                />
              </label>

              <label>
                Notification Priority
                <select
                  value={notifyForm.priority}
                  onChange={(e) => setNotifyForm({ ...notifyForm, priority: e.target.value })}
                >
                  <option value="Low">Low Priority</option>
                  <option value="Medium">Medium Priority</option>
                  <option value="High">High Priority</option>
                  <option value="Critical">Critical Alert</option>
                </select>
              </label>

              <label>
                Update Message &amp; Justification *
                <textarea
                  rows={4}
                  placeholder="Detail the update, deliverables, risks, or support needed from Admin..."
                  value={notifyForm.message}
                  onChange={(e) => setNotifyForm({ ...notifyForm, message: e.target.value })}
                  required
                />
              </label>

              <footer className="manager-modal-footer">
                <button type="button" className="btn-ghost" onClick={() => setNotifyModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary btn-small" disabled={notifyBusy}>
                  {notifyBusy ? 'Sending...' : 'Send to Admin'}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
