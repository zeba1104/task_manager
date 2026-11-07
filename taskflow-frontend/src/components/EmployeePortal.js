import { useEffect, useState } from 'react';
import { CalendarDays, Megaphone, Plus, X } from 'lucide-react';
import { createLeaveRequest, getAnnouncements, getMyLeaveRequests } from '../api/adminApi';

const emptyRequest = { leaveType: 'annual', startDate: '', endDate: '', reason: '' };

function EmployeePortal() {
  const [requests, setRequests] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [form, setForm] = useState(emptyRequest);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const loadPortalData = async () => {
    const [leaveResponse, announcementResponse] = await Promise.all([
      getMyLeaveRequests(),
      getAnnouncements(),
    ]);
    setRequests(leaveResponse.data);
    setAnnouncements(announcementResponse.data);
  };

  useEffect(() => {
    loadPortalData().catch(() => setError('Could not load leave requests and announcements.'));
  }, []);

  const submitRequest = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await createLeaveRequest(form);
      setForm(emptyRequest);
      setFormOpen(false);
      await loadPortalData();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not submit leave request.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="employee-portal-grid">
      <div className="employee-portal-panel">
        <header>
          <div><CalendarDays size={18} /><h3>Leave requests</h3></div>
          <button type="button" className="btn-primary btn-small" onClick={() => setFormOpen(!formOpen)}>
            {formOpen ? <X size={15} /> : <Plus size={15} />}{formOpen ? 'Close' : 'Request leave'}
          </button>
        </header>
        {error && <p className="error-text" role="alert">{error}</p>}
        {formOpen && (
          <form className="leave-request-form" onSubmit={submitRequest}>
            <label>Leave type<select value={form.leaveType} onChange={(event) => setForm({ ...form, leaveType: event.target.value })}><option value="annual">Annual / Earned</option><option value="sick">Sick</option><option value="casual">Casual</option><option value="maternity_paternity">Maternity / Paternity</option></select></label>
            <label>From<input type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} required /></label>
            <label>To<input type="date" value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} required /></label>
            <label className="leave-reason-field">Reason<textarea rows={2} maxLength={1000} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} /></label>
            <button type="submit" className="btn-primary btn-small" disabled={saving}>{saving ? 'Submitting...' : 'Submit request'}</button>
          </form>
        )}
        {requests.length === 0 ? <p className="admin-empty-state">No leave requests yet.</p> : (
          <ul className="employee-leave-list">
            {requests.slice(0, 5).map((request) => (
              <li key={request._id}><span>{request.leaveType} · {new Date(request.startDate).toLocaleDateString()} – {new Date(request.endDate).toLocaleDateString()}</span><strong className={`leave-status-${request.status}`}>{request.status}</strong></li>
            ))}
          </ul>
        )}
      </div>

      <div className="employee-portal-panel">
        <header><div><Megaphone size={18} /><h3>Announcements</h3></div></header>
        {announcements.length === 0 ? <p className="admin-empty-state">No announcements yet.</p> : (
          <ul className="employee-announcement-list">
            {announcements.slice(0, 5).map((announcement) => (
              <li key={announcement._id}><strong>{announcement.title}</strong><p>{announcement.body}</p><time>{new Date(announcement.publishedAt).toLocaleDateString()}</time></li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export default EmployeePortal;