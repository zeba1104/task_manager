import { useState, useEffect } from 'react';

const emptyForm = { title: '', description: '', status: 'pending', priority: 'medium', project: '', assignedTo: '', deadline: '', estimatedMinutes: 60 };

function TaskForm({ initialData, onSubmit, onCancel, employees = [], projects = [], userRole }) {
  const [formData, setFormData] = useState(emptyForm);

  useEffect(() => {
    if (initialData) {
      setFormData({
        title: initialData.title || '',
        description: initialData.description || '',
        status: initialData.status || 'pending',
        priority: initialData.priority || 'medium',
        project: initialData.project || '',
        assignedTo: initialData.user?._id || '',
        deadline: initialData.deadline ? initialData.deadline.substring(0, 16) : '',
        estimatedMinutes: initialData.estimatedMinutes ?? 60,
      });
    } else {
      setFormData(emptyForm);
    }
  }, [initialData]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      deadline: formData.deadline || null,
      estimatedMinutes: Number(formData.estimatedMinutes) || 0,
    });
  };

  return (
    <form className="task-form modern-task-form" onSubmit={handleSubmit}>
      <div className="task-form-header-bar">
        <h4>{initialData ? 'Edit Task Details' : 'Create New Task'}</h4>
        <p>Define task objectives, assignment, priority level, and completion timeline.</p>
      </div>

      <div className="form-group">
        <label htmlFor="task-title">
          Task Title <span className="req">*</span>
        </label>
        <input
          id="task-title"
          type="text"
          name="title"
          placeholder="e.g. Build API endpoints for authentication"
          value={formData.title}
          onChange={handleChange}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="task-desc">Task Description (Optional)</label>
        <textarea
          id="task-desc"
          name="description"
          placeholder="Add comprehensive specifications, context, or deliverables..."
          value={formData.description}
          onChange={handleChange}
          rows={3}
        />
      </div>

      <div className="task-form-grid modern-form-grid">
        <div className="form-group">
          <label htmlFor="task-status">Status</label>
          <select id="task-status" name="status" value={formData.status} onChange={handleChange}>
            <option value="pending">To Do</option>
            <option value="in-process">In Progress</option>
            <option value="in-review">In Review</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="task-priority">Priority</label>
          <select id="task-priority" name="priority" value={formData.priority} onChange={handleChange}>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="task-project">Assigned Project</label>
          {projects.length > 0 ? (
            <select id="task-project" name="project" value={formData.project} onChange={handleChange} aria-label="Project">
              <option value="">No Project Assigned</option>
              {initialData?.project && !projects.some((project) => project.name === initialData.project) && (
                <option value={initialData.project}>{initialData.project}</option>
              )}
              {projects.map((project) => <option key={project._id} value={project.name}>{project.name}</option>)}
            </select>
          ) : (
            <input id="task-project" type="text" name="project" placeholder="Project name" value={formData.project} onChange={handleChange} maxLength={100} />
          )}
        </div>

        {(userRole === 'Manager' || userRole === 'Admin') && (
          <div className="form-group">
            <label htmlFor="task-assignee">Assign Member</label>
            <select id="task-assignee" name="assignedTo" value={formData.assignedTo} onChange={handleChange}>
              <option value="">Assign to (Self)</option>
              {employees.map(emp => (
                <option key={emp._id} value={emp._id}>{emp.name} ({emp.role})</option>
              ))}
            </select>
          </div>
        )}

        <div className="form-group">
          <label htmlFor="task-deadline">Completion Deadline</label>
          <input id="task-deadline" type="datetime-local" name="deadline" value={formData.deadline} onChange={handleChange} title="Task Deadline" />
        </div>

        <div className="form-group">
          <label htmlFor="task-est">Est. Duration (Minutes)</label>
          <input id="task-est" type="number" name="estimatedMinutes" min="0" step="15" value={formData.estimatedMinutes} onChange={handleChange} aria-label="Estimated time in minutes" placeholder="e.g. 60" />
        </div>
      </div>

      <div className="task-form-actions">
        <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn-primary">
          {initialData ? 'Save Changes' : '+ Create Task'}
        </button>
      </div>
    </form>
  );
}

export default TaskForm;