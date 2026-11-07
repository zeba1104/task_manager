import TiltCard from './TiltCard';
import { CalendarClock, ClipboardList, Clock3, MessageSquare, Paperclip, Pencil, Trash2 } from 'lucide-react';

function TaskCard({ task, onEdit, onDelete, onStatusChange, onDetails, canDelete = true }) {
  let deadlineText = null;
  let deadlineColor = 'var(--muted)';
  if (task.deadline && task.status !== 'completed') {
      const ms = new Date(task.deadline).getTime() - Date.now();
      const hours = Math.round(ms / (1000 * 60 * 60));
      if (hours < 0) {
          deadlineText = `Overdue by ${Math.abs(hours)}h`;
          deadlineColor = '#f43f5e'; // red
      } else if (hours < 24) {
          deadlineText = `Due in ${hours}h`;
          deadlineColor = '#f59e0b'; // orange
      } else {
          deadlineText = `Due in ${Math.round(hours/24)}d`;
      }
  }
  const estimatedMinutes = Number(task.estimatedMinutes || 0);
  const estimateText = estimatedMinutes >= 60
    ? `${Math.round((estimatedMinutes / 60) * 10) / 10}h estimate`
    : `${estimatedMinutes}m estimate`;

  return (
    <TiltCard className={`task-card ${task.status === 'completed' ? 'task-completed' : ''}`}>
      <div className="task-card-top">
        <span className={`priority-dot priority-${task.priority}`}></span>
        <h4 title={task.title}>{task.title}</h4>
      </div>
      {task.description && <p className="task-desc">{task.description}</p>}
      <div className="task-tags">
        {task.project && <span className="tag project-tag">{task.project}</span>}
        <span className="tag category-tag">{task.category || 'general'}</span>
        <span className={`tag priority-tag priority-${task.priority}`}>{task.priority}</span>
        {deadlineText && <span className="tag deadline-tag" style={{ color: deadlineColor, borderColor: `${deadlineColor}40`, background: `${deadlineColor}10` }}><CalendarClock size={12} />{deadlineText}</span>}
      </div>
      <div className="task-card-meta">
        <span><Clock3 size={13} />{estimateText}</span>
        <span><ClipboardList size={13} />{task.subtasks?.filter((item) => item.completed).length || 0}/{task.subtasks?.length || 0}</span>
        <span><MessageSquare size={13} />{task.comments?.length || 0}</span>
        <span><Paperclip size={13} />{task.attachments?.length || 0}</span>
      </div>
      <div className="task-card-footer">
        <select
          className="status-select"
          value={task.status}
          aria-label={`Change status for ${task.title}`}
          onChange={(e) => onStatusChange(task._id, e.target.value)}
        >
          <option value="pending">To Do</option>
          <option value="in-process">In Progress</option>
          <option value="in-review">In Review</option>
          <option value="completed">Completed</option>
        </select>
        <div className="task-actions">
          <button className="icon-btn" onClick={onDetails} title="Task details" aria-label="Task details"><ClipboardList size={16} /></button>
          <button className="icon-btn" onClick={() => onEdit(task)} title="Edit task" aria-label="Edit task"><Pencil size={15} /></button>
          {canDelete && <button className="icon-btn danger" onClick={() => onDelete(task._id)} title="Delete task" aria-label="Delete task"><Trash2 size={15} /></button>}
        </div>
      </div>
    </TiltCard>
  );
}

export default TaskCard;