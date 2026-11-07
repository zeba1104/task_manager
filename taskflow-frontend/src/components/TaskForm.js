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
    <form className="task-form" onSubmit={handleSubmit}>
      <div className="task-form-row">
        <input type="text" name="title" placeholder="Task title" value={formData.title} onChange={handleChange} required />
      </div>
      <div className="task-form-row">
        <textarea name="description" placeholder="Description (optional)" value={formData.description} onChange={handleChange} rows={2} />
      </div>
      <div className="task-form-grid">
        <select name="status" value={formData.status} onChange={handleChange}>
          <option value="pending">To Do</option>
          <option value="in-process">In Progress</option>
          <option value="in-review">In Review</option>
          <option value="completed">Completed</option>
        </select>
        <select name="priority" value={formData.priority} onChange={handleChange}>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        {projects.length > 0 ? (
          <select name="project" value={formData.project} onChange={handleChange} aria-label="Project">
            <option value="">No project</option>
            {initialData?.project && !projects.some((project) => project.name === initialData.project) && (
              <option value={initialData.project}>{initialData.project}</option>
            )}
            {projects.map((project) => <option key={project._id} value={project.name}>{project.name}</option>)}
          </select>
        ) : (
          <input type="text" name="project" placeholder="Project name" value={formData.project} onChange={handleChange} maxLength={100} />
        )}
        {(userRole === 'Manager' || userRole === 'Admin') && (
          <select name="assignedTo" value={formData.assignedTo} onChange={handleChange}>
            <option value="">Assign to (Self)</option>
            {employees.map(emp => (
              <option key={emp._id} value={emp._id}>{emp.name} ({emp.role})</option>
            ))}
          </select>
        )}
        <input type="datetime-local" name="deadline" value={formData.deadline} onChange={handleChange} title="Task Deadline" />
        <input type="number" name="estimatedMinutes" min="0" step="15" value={formData.estimatedMinutes} onChange={handleChange} aria-label="Estimated time in minutes" placeholder="Estimated minutes" />
      </div>
      <div className="task-form-actions">
        <button type="submit" className="btn-primary btn-small">
          {initialData ? 'Save Changes' : 'Add Task'}
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

export default TaskForm;