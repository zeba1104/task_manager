import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Megaphone,
  Plus,
  Trash2,
  Calendar,
  UserRound,
  Search,
  Building2,
  Sparkles,
  RefreshCw,
  X,
  Send,
} from 'lucide-react';
import { getAnnouncements, createAnnouncement } from '../api/adminApi';
import axios from '../api/axios';
import Swal from '../utils/swalConfig';

function AnnouncementsPage({ user }) {
  const [announcements, setAnnouncements] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [audienceFilter, setAudienceFilter] = useState('all'); // all | company | department

  // Publish Modal State (Admin & Manager)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishForm, setPublishForm] = useState({
    title: '',
    body: '',
    audience: 'all',
    department: '',
  });

  const canPublish = user?.role === 'Admin' || user?.role === 'Manager';
  const isAdmin = user?.role === 'Admin';

  const loadAnnouncements = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError('');
      const [annRes, deptRes] = await Promise.all([
        getAnnouncements(),
        canPublish ? axios.get('/admin/departments').catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
      ]);
      setAnnouncements(annRes.data || []);
      setDepartments(deptRes.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load announcements');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canPublish]);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  const handlePublish = async (e) => {
    e.preventDefault();
    if (!publishForm.title.trim() || !publishForm.body.trim()) {
      Swal.fire('Required Fields', 'Please fill in both the title and announcement message.', 'warning');
      return;
    }
    if (publishForm.audience === 'department' && !publishForm.department) {
      Swal.fire('Select Department', 'Please select a target department for this announcement.', 'warning');
      return;
    }

    setPublishing(true);
    try {
      await createAnnouncement(publishForm);
      Swal.fire({
        title: 'Announcement Published',
        text: 'The announcement has been broadcasted successfully.',
        icon: 'success',
        timer: 1600,
        showConfirmButton: false,
      });
      setIsModalOpen(false);
      setPublishForm({ title: '', body: '', audience: 'all', department: '' });
      await loadAnnouncements(true);
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Could not publish announcement', 'error');
    } finally {
      setPublishing(false);
    }
  };

  const handleDelete = async (id, title) => {
    const result = await Swal.fire({
      title: 'Delete Announcement?',
      text: `Are you sure you want to remove "${title}"? This cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, Delete',
      confirmButtonColor: '#ef4444',
    });
    if (!result.isConfirmed) return;

    try {
      await axios.delete(`/admin/announcements/${id}`);
      Swal.fire({
        title: 'Deleted',
        text: 'Announcement has been removed.',
        icon: 'success',
        timer: 1400,
        showConfirmButton: false,
      });
      setAnnouncements((prev) => prev.filter((a) => a._id !== id));
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Could not delete announcement', 'error');
    }
  };

  // Filtered list
  const filteredAnnouncements = useMemo(() => {
    return announcements.filter((ann) => {
      if (audienceFilter === 'company' && ann.audience !== 'all') return false;
      if (audienceFilter === 'department' && ann.audience !== 'department') return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = ann.title?.toLowerCase().includes(q);
        const matchBody = ann.body?.toLowerCase().includes(q);
        const matchAuthor = ann.publishedBy?.name?.toLowerCase().includes(q);
        const matchDept = ann.department?.name?.toLowerCase().includes(q);
        if (!matchTitle && !matchBody && !matchAuthor && !matchDept) return false;
      }
      return true;
    });
  }, [announcements, audienceFilter, searchQuery]);

  return (
    <div className="announcements-page-view">
      {/* Page Header Row */}
      <div className="announcements-header-row">
        <div className="announcements-header-info">
          <div className="announcements-title-icon-box">
            <Megaphone size={22} />
          </div>
          <div>
            <h2 className="announcements-main-title">Announcements &amp; Broadcasts</h2>
            <p className="announcements-subtitle">
              Stay updated with official organization announcements, management updates, and department notices.
            </p>
          </div>
        </div>

        <div className="announcements-header-actions">
          {canPublish && (
            <button
              type="button"
              className="btn-primary btn-small btn-publish-ann"
              onClick={() => setIsModalOpen(true)}
            >
              <Plus size={15} /> <span>Publish Announcement</span>
            </button>
          )}
          <button
            type="button"
            className="btn-secondary btn-small attendance-refresh-btn"
            onClick={() => loadAnnouncements(true)}
            disabled={loading || refreshing}
            title="Refresh announcements"
          >
            <RefreshCw size={13} className={refreshing ? 'spinning' : ''} />
            <span>{refreshing ? 'Updating...' : 'Refresh'}</span>
          </button>
          <span className="header-date-badge">
            <Calendar size={13} /> {new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="announcements-filter-bar">
        <div className="ann-search-wrap">
          <Search size={15} className="ann-search-icon" />
          <input
            type="text"
            placeholder="Search announcements by title, content, or author..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="ann-search-input"
          />
          {searchQuery && (
            <button
              type="button"
              className="filter-clear-btn"
              onClick={() => setSearchQuery('')}
              title="Clear search"
            >
              <X size={13} />
            </button>
          )}
        </div>

        <div className="ann-audience-pills">
          <button
            type="button"
            className={`audience-pill ${audienceFilter === 'all' ? 'active' : ''}`}
            onClick={() => setAudienceFilter('all')}
          >
            All Announcements <span className="pill-count-badge">{announcements.length}</span>
          </button>
          <button
            type="button"
            className={`audience-pill ${audienceFilter === 'company' ? 'active' : ''}`}
            onClick={() => setAudienceFilter('company')}
          >
            Company-Wide <span className="pill-count-badge">{announcements.filter((a) => a.audience === 'all').length}</span>
          </button>
          <button
            type="button"
            className={`audience-pill ${audienceFilter === 'department' ? 'active' : ''}`}
            onClick={() => setAudienceFilter('department')}
          >
            Department Specific <span className="pill-count-badge">{announcements.filter((a) => a.audience === 'department').length}</span>
          </button>
        </div>
      </div>

      {error && <p className="error-text" role="alert">{error}</p>}

      {/* Announcements Stream */}
      {loading ? (
        <div className="attendance-loading-state">
          <RefreshCw size={24} className="spinning text-blue" />
          <p>Loading published announcements...</p>
        </div>
      ) : filteredAnnouncements.length === 0 ? (
        <div className="announcements-empty-state">
          <Megaphone size={36} className="text-muted" />
          <h4>No announcements found</h4>
          <p>
            {searchQuery
              ? 'No announcements match your search criteria. Try a different keyword.'
              : 'There are no announcements published for this audience category yet.'}
          </p>
          {(searchQuery || audienceFilter !== 'all') && (
            <button
              type="button"
              className="btn-secondary btn-small"
              onClick={() => { setSearchQuery(''); setAudienceFilter('all'); }}
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div className="announcements-stream-grid">
          {filteredAnnouncements.map((ann) => {
            const isAuthor = String(ann.publishedBy?._id || ann.publishedBy) === String(user?._id);
            const canDelete = isAdmin || isAuthor;
            const isDept = ann.audience === 'department';

            return (
              <article key={ann._id} className={`announcement-card-elevated ${isDept ? 'card-dept' : 'card-company'}`}>
                <header className="ann-card-header">
                  <div className="ann-card-title-group">
                    <div className={`ann-icon-badge ${isDept ? 'badge-dept' : 'badge-company'}`}>
                      <Megaphone size={18} />
                    </div>
                    <div className="ann-card-title-meta">
                      <div className="ann-title-top-line">
                        <h3 className="ann-card-title">{ann.title}</h3>
                        <span className={`ann-audience-pill ${isDept ? 'pill-dept' : 'pill-all'}`}>
                          {isDept ? (
                            <>
                              <Building2 size={12} />
                              <span>{ann.department?.name || 'Department'}</span>
                            </>
                          ) : (
                            <>
                              <Sparkles size={12} />
                              <span>COMPANY-WIDE</span>
                            </>
                          )}
                        </span>
                      </div>
                      <div className="ann-card-meta-line">
                        <span className="ann-meta-item">
                          <Calendar size={12} />
                          {new Date(ann.publishedAt || ann.createdAt).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                        <span className="meta-dot">·</span>
                        <span className="ann-meta-item">
                          <UserRound size={12} />
                          By <strong>{ann.publishedBy?.name || 'Management'}</strong>
                        </span>
                        {isDept && ann.department?.name && (
                          <>
                            <span className="meta-dot">·</span>
                            <span className="ann-meta-item">
                              <Building2 size={12} />
                              <span>{ann.department.name}</span>
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {canDelete && (
                    <button
                      type="button"
                      className="btn-delete-ann"
                      onClick={() => handleDelete(ann._id, ann.title)}
                      title="Delete announcement"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </header>

                <div className="ann-card-message-box">
                  <p>{ann.body}</p>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Publish Announcement Modal */}
      {isModalOpen && (
        <div
          className="manager-modal-backdrop"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setIsModalOpen(false); }}
        >
          <div className="manager-modal-box" role="dialog" aria-modal="true">
            <header className="manager-modal-header">
              <div className="modal-title-with-badge">
                <Megaphone size={18} className="text-blue" />
                <h3>Publish New Announcement</h3>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setIsModalOpen(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </header>

            <form onSubmit={handlePublish}>
              <div className="modal-body-scroll">
                <div className="form-group-field">
                  <label>Title <span className="req">*</span></label>
                  <input
                    type="text"
                    placeholder="e.g. Annual Company Townhall on Friday"
                    maxLength={160}
                    value={publishForm.title}
                    onChange={(e) => setPublishForm({ ...publishForm, title: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group-field">
                  <label>Announcement Message <span className="req">*</span></label>
                  <textarea
                    rows={5}
                    placeholder="Enter the full announcement text, key highlights, or guidelines..."
                    value={publishForm.body}
                    onChange={(e) => setPublishForm({ ...publishForm, body: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group-field">
                  <label>Broadcast Audience <span className="req">*</span></label>
                  <select
                    value={publishForm.audience}
                    onChange={(e) => setPublishForm({ ...publishForm, audience: e.target.value })}
                  >
                    <option value="all">Company-Wide (All Employees &amp; Managers)</option>
                    <option value="department">Specific Department Only</option>
                  </select>
                </div>

                {publishForm.audience === 'department' && (
                  <div className="form-group-field">
                    <label>Target Department <span className="req">*</span></label>
                    <select
                      value={publishForm.department}
                      onChange={(e) => setPublishForm({ ...publishForm, department: e.target.value })}
                      required
                    >
                      <option value="">Select Department...</option>
                      {departments.map((dept) => (
                        <option key={dept._id} value={dept._id}>
                          {dept.name} ({dept.code || 'GEN'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <footer className="manager-modal-footer">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={publishing}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                >
                  <Send size={14} />
                  <span>{publishing ? 'Publishing...' : 'Broadcast Announcement'}</span>
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AnnouncementsPage;
