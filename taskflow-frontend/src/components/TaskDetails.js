import { useEffect, useRef, useState } from 'react';
import {
  addTaskComment,
  deleteTaskAttachment,
  downloadTaskAttachment,
  getTaskById,
  updateTask,
  uploadTaskAttachment,
} from '../api/taskApi';
import {
  AlertCircle,
  CalendarDays,
  Check,
  Clock3,
  Download,
  ListChecks,
  MessageSquare,
  Paperclip,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react';

const statusLabels = {
  pending: 'To Do',
  'in-process': 'In Progress',
  'in-review': 'In Review',
  completed: 'Completed',
};

const formatFileSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

function TaskDetails({ task, onClose, onUpdated }) {
  const [details, setDetails] = useState(task);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const fileInput = useRef(null);

  const reloadDetails = async () => {
    const response = await getTaskById(task._id);
    setDetails(response.data);
  };

  useEffect(() => {
    let active = true;
    getTaskById(task._id)
      .then((response) => { if (active) setDetails(response.data); })
      .catch(() => { if (active) setError('Could not load task details.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [task._id]);

  const saveSubtasks = async (subtasks) => {
    setBusy(true);
    setError('');
    try {
      await updateTask(task._id, { subtasks });
      await reloadDetails();
      onUpdated();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not update subtasks.');
    } finally {
      setBusy(false);
    }
  };

  const addSubtask = async (event) => {
    event.preventDefault();
    const title = subtaskTitle.trim();
    if (!title) return;
    await saveSubtasks([...(details.subtasks || []), { title, completed: false }]);
    setSubtaskTitle('');
  };

  const toggleSubtask = (subtaskId) => {
    const subtasks = details.subtasks.map((subtask) => (
      subtask._id === subtaskId ? { ...subtask, completed: !subtask.completed } : subtask
    ));
    saveSubtasks(subtasks);
  };

  const removeSubtask = (subtaskId) => {
    saveSubtasks(details.subtasks.filter((subtask) => subtask._id !== subtaskId));
  };

  const submitComment = async (event) => {
    event.preventDefault();
    const text = comment.trim();
    if (!text) return;
    setBusy(true);
    setError('');
    try {
      await addTaskComment(task._id, text);
      setComment('');
      await reloadDetails();
      onUpdated();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not add comment.');
    } finally {
      setBusy(false);
    }
  };

  const uploadAttachment = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError('Files must be 10 MB or smaller.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await uploadTaskAttachment(task._id, file);
      await reloadDetails();
      onUpdated();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not upload attachment.');
    } finally {
      setBusy(false);
    }
  };

  const downloadAttachment = async (attachment) => {
    setError('');
    try {
      const response = await downloadTaskAttachment(task._id, attachment._id);
      const url = URL.createObjectURL(new Blob([response.data], { type: attachment.contentType }));
      const link = document.createElement('a');
      link.href = url;
      link.download = attachment.originalName;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not download attachment.');
    }
  };

  const removeAttachment = async (attachmentId) => {
    setBusy(true);
    setError('');
    try {
      await deleteTaskAttachment(task._id, attachmentId);
      await reloadDetails();
      onUpdated();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not delete attachment.');
    } finally {
      setBusy(false);
    }
  };

  const completedSubtasks = (details.subtasks || []).filter((subtask) => subtask.completed).length;

  return (
    <div
      className="task-detail-backdrop"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <section className="task-detail-panel" role="dialog" aria-modal="true" aria-labelledby="task-detail-title">
        <header className="task-detail-header">
          <div>
            <p className="task-detail-eyebrow">{details.category || 'General'} · {statusLabels[details.status] || details.status}</p>
            <h2 id="task-detail-title">{details.title}</h2>
          </div>
          <button className="icon-btn" type="button" onClick={onClose} aria-label="Close task details" title="Close">
            <X size={20} />
          </button>
        </header>

        {error && <p className="task-detail-error"><AlertCircle size={15} />{error}</p>}
        {loading ? <p className="task-detail-loading">Loading task details...</p> : (
          <div className="task-detail-content">
            <section className="task-detail-section">
              <h3>Description</h3>
              <p className="task-detail-description">{details.description || 'No description added.'}</p>
              <div className="task-detail-facts">
                <span><CalendarDays size={15} />{details.deadline ? new Date(details.deadline).toLocaleDateString() : 'No deadline'}</span>
                <span><Clock3 size={15} />{details.estimatedMinutes || 0} min estimate</span>
                <span className={`detail-priority priority-${details.priority}`}>{details.priority}</span>
              </div>
            </section>

            <section className="task-detail-section">
              <div className="task-detail-section-heading">
                <h3><ListChecks size={17} />Subtasks</h3>
                <span>{completedSubtasks}/{(details.subtasks || []).length} done</span>
              </div>
              <form className="task-detail-inline-form" onSubmit={addSubtask}>
                <input
                  value={subtaskTitle}
                  onChange={(event) => setSubtaskTitle(event.target.value)}
                  placeholder="Add a subtask"
                  maxLength={160}
                  aria-label="Subtask title"
                  disabled={busy}
                />
                <button className="detail-icon-action" type="submit" title="Add subtask" aria-label="Add subtask" disabled={busy || !subtaskTitle.trim()}>
                  <Plus size={18} />
                </button>
              </form>
              {(details.subtasks || []).length === 0 ? <p className="task-detail-empty">Break this task into smaller steps.</p> : (
                <ul className="task-subtask-list">
                  {details.subtasks.map((subtask) => (
                    <li key={subtask._id}>
                      <label>
                        <input type="checkbox" checked={subtask.completed} onChange={() => toggleSubtask(subtask._id)} disabled={busy} />
                        <span className={subtask.completed ? 'is-complete' : ''}>{subtask.title}</span>
                      </label>
                      <button className="detail-icon-action danger" type="button" onClick={() => removeSubtask(subtask._id)} title="Delete subtask" aria-label={`Delete ${subtask.title}`} disabled={busy}>
                        <Trash2 size={15} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="task-detail-section">
              <div className="task-detail-section-heading">
                <h3><Paperclip size={17} />Attachments</h3>
                <button className="detail-text-action" type="button" onClick={() => fileInput.current?.click()} disabled={busy}>
                  <Upload size={15} />Add file
                </button>
                <input ref={fileInput} className="visually-hidden" type="file" onChange={uploadAttachment} />
              </div>
              {(details.attachments || []).length === 0 ? <p className="task-detail-empty">No files attached. Maximum file size: 10 MB.</p> : (
                <ul className="task-attachment-list">
                  {details.attachments.map((attachment) => (
                    <li key={attachment._id}>
                      <div className="attachment-file-icon"><Paperclip size={16} /></div>
                      <div className="attachment-file-info">
                        <strong title={attachment.originalName}>{attachment.originalName}</strong>
                        <span>{formatFileSize(attachment.size)}</span>
                      </div>
                      <button className="detail-icon-action" type="button" onClick={() => downloadAttachment(attachment)} title="Download attachment" aria-label={`Download ${attachment.originalName}`}>
                        <Download size={16} />
                      </button>
                      <button className="detail-icon-action danger" type="button" onClick={() => removeAttachment(attachment._id)} title="Delete attachment" aria-label={`Delete ${attachment.originalName}`} disabled={busy}>
                        <Trash2 size={15} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="task-detail-section task-comments-section">
              <div className="task-detail-section-heading">
                <h3><MessageSquare size={17} />Comments</h3>
                <span>{(details.comments || []).length}</span>
              </div>
              <form className="task-comment-form" onSubmit={submitComment}>
                <textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Write a comment..." rows={3} maxLength={2000} disabled={busy} />
                <button className="btn-primary btn-small" type="submit" disabled={busy || !comment.trim()}><Check size={15} />Post comment</button>
              </form>
              {(details.comments || []).length === 0 ? <p className="task-detail-empty">No comments yet.</p> : (
                <ul className="task-comment-list">
                  {details.comments.map((item) => (
                    <li key={item._id}>
                      <div className="comment-author-row">
                        <strong>{item.user?.name || 'Team member'}</strong>
                        <time>{new Date(item.createdAt).toLocaleString()}</time>
                      </div>
                      <p>{item.text}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </section>
    </div>
  );
}

export default TaskDetails;