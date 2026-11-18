import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import TiltCard from '../components/TiltCard';
import TaskForm from '../components/TaskForm';
import TaskCard from '../components/TaskCard';
import TaskDetails from '../components/TaskDetails';
import { getTasks, createTask, updateTask, deleteTask, getUsers } from '../api/taskApi';
import { exportDailyReportToExcel } from '../utils/exportExcel';
import AdminDashboard from '../components/AdminDashboard';
import ManagerDashboard from '../components/ManagerDashboard';
import EmployeeDashboard from '../components/EmployeeDashboard';
import EmployeeManager from '../components/EmployeeManager';
import AttendanceManager from '../components/AttendanceManager';
import AnnouncementsPage from '../components/AnnouncementsPage';
import ChatPage from '../components/ChatPage';
import FocusMode from '../components/FocusMode';
import AppLayout from '../components/AppLayout';
import HolidayCalendar from '../components/HolidayCalendar';
import Swal from '../utils/swalConfig';
import { getProjects } from '../api/adminApi';
import { Calendar } from 'lucide-react';

const boardColumns = [
  { status: 'pending', title: 'To Do' },
  { status: 'in-process', title: 'In Progress' },
  { status: 'in-review', title: 'In Review' },
  { status: 'completed', title: 'Completed' },
];

function Dashboard() {
  const { user, logout } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [advFilters, setAdvFilters] = useState({ employee: '', manager: '', department: '', status: '', priority: '', startDate: '', endDate: '', deadlineBefore: '' });
  const [showFilters, setShowFilters] = useState(false);
  const [view, setView] = useState('tasks');
  const [managerTab, setManagerTab] = useState('overview');
  const [employeeTab, setEmployeeTab] = useState('dashboard');
  const [showFocusMode, setShowFocusMode] = useState(false);
  const [projectOptions, setProjectOptions] = useState([]);
  const [openEmployeeFormOnView, setOpenEmployeeFormOnView] = useState(false);

  const handleNavigate = useCallback((item) => {
    if (item.view) {
      setView(item.view);
    }
    if (user?.role === 'Manager' && item.tab) {
      setManagerTab(item.tab);
    }
    if (user?.role === 'Employee' && item.tab) {
      setEmployeeTab(item.tab);
    }
    if (item.section) {
      setTimeout(() => {
        const el = document.getElementById(item.section);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [user]);

  const openAddEmployee = (role = 'Employee') => {
    setOpenEmployeeFormOnView(role);
    setView('employees');
  };

  const handleEmployeeFormOpened = useCallback(() => {
    setOpenEmployeeFormOnView(false);
  }, []);

  useEffect(() => {
    if (user?.role === 'Admin') {
      setView('admin');
    } else if (user?.role === 'Manager') {
      setView('manager');
    } else if (user?.role === 'Employee') {
      setView('employee');
    }
  }, [user]);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (categoryFilter) params.category = categoryFilter;
      const res = await getTasks(params);
      setTasks(res.data);
      
      if (user && (user.role === 'Manager' || user.role === 'Admin')) {
        const empRes = await getUsers();
        setEmployees(empRes.data);
      }
    } catch (err) {
      setError('Could not load tasks');
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, user]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    let active = true;
    getProjects()
      .then((response) => { if (active) setProjectOptions(response.data); })
      .catch(() => { if (active) setProjectOptions([]); });
    return () => { active = false; };
  }, [user, view]);

  const handleCreate = async (formData) => {
    try {
      await createTask(formData);
      setShowForm(false);
      fetchTasks();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create task. Check the connection and try again.');
    }
  };

  const handleUpdate = async (formData) => {
    try {
      await updateTask(editingTask._id, formData);
      setEditingTask(null);
      setShowForm(false);
      fetchTasks();
    } catch (err) {
      setError('Could not update task');
    }
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: 'Delete Task?',
      text: 'Are you sure you want to delete this task?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#b91c1c'
    });
    if (!result.isConfirmed) return;
    try {
      await deleteTask(id);
      fetchTasks();
      Swal.fire({ title: 'Deleted!', text: 'Task has been deleted.', icon: 'success', timer: 2000, showConfirmButton: false });
    } catch (err) {
      setError('Could not delete task');
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await updateTask(id, { status });
      fetchTasks();
    } catch (err) {
      setError('Could not update status');
    }
  };

  const openEdit = (task) => {
    setEditingTask(task);
    setShowForm(true);
  };

  let displayTasks = tasks;
  
  if (categoryFilter) {
      displayTasks = displayTasks.filter(t => t.category?.toLowerCase().includes(categoryFilter.toLowerCase()));
  }
  
  if (user?.role === 'Admin' || user?.role === 'Manager') {
      if (advFilters.employee) displayTasks = displayTasks.filter(t => (t.user?._id || t.user) === advFilters.employee);
      
      if (advFilters.department) {
          displayTasks = displayTasks.filter(t => {
              const emp = employees.find(e => e._id === (t.user?._id || t.user));
              return emp && emp.department === advFilters.department;
          });
      }

      if (advFilters.manager) {
          displayTasks = displayTasks.filter(t => {
              const emp = employees.find(e => e._id === (t.user?._id || t.user));
              return emp && (emp.manager?._id || emp.manager) === advFilters.manager;
          });
      }

      if (advFilters.status) displayTasks = displayTasks.filter(t => t.status === advFilters.status);
      if (advFilters.priority) displayTasks = displayTasks.filter(t => t.priority === advFilters.priority);
      if (advFilters.startDate) displayTasks = displayTasks.filter(t => new Date(t.createdAt) >= new Date(advFilters.startDate));
      if (advFilters.endDate) displayTasks = displayTasks.filter(t => new Date(t.createdAt) <= new Date(advFilters.endDate));
      if (advFilters.deadlineBefore) displayTasks = displayTasks.filter(t => t.deadline && new Date(t.deadline) <= new Date(advFilters.deadlineBefore));
  }

  const pendingTasks = displayTasks.filter((t) => t.status === 'pending');
  const inProcessTasks = displayTasks.filter((t) => t.status === 'in-process');
  const inReviewTasks = displayTasks.filter((t) => t.status === 'in-review');
  const completedTasks = displayTasks.filter((t) => t.status === 'completed');

  const taskForm = showForm && (
    <TiltCard className="task-form-card">
      <TaskForm
        initialData={editingTask}
        onSubmit={editingTask ? handleUpdate : handleCreate}
        onCancel={() => { setShowForm(false); setEditingTask(null); }}
        employees={employees}
        userRole={user?.role}
        projects={projectOptions}
      />
    </TiltCard>
  );

  const currentActiveTab = user?.role === 'Manager' ? managerTab : (user?.role === 'Employee' ? employeeTab : null);

  return (
    <AppLayout
      user={user}
      activeView={view}
      activeTab={currentActiveTab}
      onNavigate={handleNavigate}
      logout={logout}
    >
      {(view === 'admin' || view === 'admin-leaves' || view === 'admin-departments') && user?.role === 'Admin' ? (
        <AdminDashboard
          tasks={tasks}
          employees={employees}
          user={user}
          logout={logout}
          setView={setView}
          onAddEmployee={openAddEmployee}
          activeSection={view === 'admin-leaves' ? 'leave-management' : view === 'admin-departments' ? 'departments-section' : null}
        />
      ) : view === 'employees' && user?.role === 'Admin' ? (
        <EmployeeManager employees={employees} fetchEmployees={fetchTasks} setView={setView} tasks={tasks} initialShowForm={openEmployeeFormOnView} onInitialShowHandled={handleEmployeeFormOpened} />
      ) : view === 'attendance' && user?.role === 'Admin' ? (
        <AttendanceManager setView={setView} />
      ) : view === 'holidays' ? (
        <HolidayCalendar user={user} setView={setView} />
      ) : view === 'announcements' ? (
        <AnnouncementsPage user={user} />
      ) : view === 'chat' ? (
        <ChatPage user={user} />
      ) : view === 'manager' && user?.role === 'Manager' ? (
        <ManagerDashboard user={user} logout={logout} setView={setView} activeTab={managerTab} onTabChange={setManagerTab} />
      ) : view === 'employee' && user?.role === 'Employee' ? (
        <EmployeeDashboard user={user} logout={logout} setView={setView} activeTab={employeeTab} onTabChange={setEmployeeTab} />
      ) : (
      <div className="dashboard-page task-board-page">
        {/* Clean Page Title Row matching Image 2 */}
        <div className="page-header-row">
          <div>
            <h2 className="page-main-title">Task Management Board</h2>
          </div>
          <div className="page-header-actions">
            <span className="header-date-badge">
              <Calendar size={13} /> {new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        </div>

      <div className="task-toolbar">
        <div className="filters">
          <input type="text" placeholder="Filter by category" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} />
          {(user?.role === 'Admin' || user?.role === 'Manager') && (
            <button className="btn-ghost btn-small" onClick={() => setShowFilters(!showFilters)}>
              {showFilters ? 'Hide Advanced Filters' : 'Advanced Filters'}
            </button>
          )}
        </div>
        <div className="toolbar-actions">
          <button
            className="btn-ghost"
            onClick={() => exportDailyReportToExcel(displayTasks, user?.name)}
            disabled={displayTasks.length === 0}
          >
            Export Daily Report (Excel)
          </button>
          <button className="btn-primary btn-small" onClick={() => { setEditingTask(null); setShowForm((s) => !s); }}>
            {showForm && !editingTask ? 'Close' : '+ New Task'}
          </button>
          {user?.role === 'Employee' && (
              <button className="btn-primary btn-small" onClick={() => setShowFocusMode(true)}>
                Start Focus Mode
              </button>
          )}
        </div>
      </div>

      {taskForm}

      {/* Advanced Filters */}
      {showFilters && (user?.role === 'Admin' || user?.role === 'Manager') && (
        <div style={{ background: 'var(--panel)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border)', marginBottom: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
          
          <select value={advFilters.employee} onChange={e => setAdvFilters({...advFilters, employee: e.target.value})} style={{background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '8px', padding: '10px'}}>
            <option value="">All Employees</option>
            {employees.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}
          </select>

          <select value={advFilters.manager} onChange={e => setAdvFilters({...advFilters, manager: e.target.value})} style={{background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '8px', padding: '10px'}}>
            <option value="">All Managers</option>
            {employees.filter(e => e.role === 'Manager' || e.role === 'Admin').map(m => <option key={m._id} value={m._id}>{m.name}</option>)}
          </select>

          <input type="text" placeholder="Department" value={advFilters.department} onChange={e => setAdvFilters({...advFilters, department: e.target.value})} style={{background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '8px', padding: '10px'}} />
          
          <select value={advFilters.status} onChange={e => setAdvFilters({...advFilters, status: e.target.value})} style={{background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '8px', padding: '10px'}}>
            <option value="">All Statuses</option>
            <option value="pending">To Do</option>
            <option value="in-process">In Progress</option>
            <option value="in-review">In Review</option>
            <option value="completed">Completed</option>
          </select>

          <select value={advFilters.priority} onChange={e => setAdvFilters({...advFilters, priority: e.target.value})} style={{background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '8px', padding: '10px'}}>
            <option value="">All Priorities</option>
            <option value="critical">Critical</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>Created After</span>
            <input type="date" value={advFilters.startDate} onChange={e => setAdvFilters({...advFilters, startDate: e.target.value})} style={{background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '8px', padding: '10px'}} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>Created Before</span>
            <input type="date" value={advFilters.endDate} onChange={e => setAdvFilters({...advFilters, endDate: e.target.value})} style={{background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '8px', padding: '10px'}} />
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>Deadline Before</span>
            <input type="datetime-local" value={advFilters.deadlineBefore} onChange={e => setAdvFilters({...advFilters, deadlineBefore: e.target.value})} style={{background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '8px', padding: '10px'}} />
          </div>
          
          <button className="btn-ghost" onClick={() => setAdvFilters({ employee: '', manager: '', department: '', status: '', priority: '', startDate: '', endDate: '', deadlineBefore: '' })}>Clear Filters</button>
        </div>
      )}

      {error && <p className="error-text">{error}</p>}

      {/* Interactive Status Filter Navigation */}
      <div className="task-status-filter-nav">
        <div className="status-filter-pills">
          <button
            type="button"
            className={`status-pill ${statusFilter === 'all' ? 'active' : ''}`}
            onClick={() => {
              setStatusFilter('all');
              setAdvFilters((prev) => ({ ...prev, status: '' }));
            }}
          >
            <span>All Tasks</span>
            <span className="pill-badge">{tasks.length}</span>
          </button>
          <button
            type="button"
            className={`status-pill pill-pending ${statusFilter === 'pending' ? 'active' : ''}`}
            onClick={() => {
              const next = statusFilter === 'pending' ? 'all' : 'pending';
              setStatusFilter(next);
              setAdvFilters((prev) => ({ ...prev, status: next === 'all' ? '' : next }));
            }}
          >
            <span className="pill-dot dot-pending" />
            <span>To Do</span>
            <span className="pill-badge">{pendingTasks.length}</span>
          </button>
          <button
            type="button"
            className={`status-pill pill-in-process ${statusFilter === 'in-process' ? 'active' : ''}`}
            onClick={() => {
              const next = statusFilter === 'in-process' ? 'all' : 'in-process';
              setStatusFilter(next);
              setAdvFilters((prev) => ({ ...prev, status: next === 'all' ? '' : next }));
            }}
          >
            <span className="pill-dot dot-in-process" />
            <span>In Progress</span>
            <span className="pill-badge">{inProcessTasks.length}</span>
          </button>
          <button
            type="button"
            className={`status-pill pill-in-review ${statusFilter === 'in-review' ? 'active' : ''}`}
            onClick={() => {
              const next = statusFilter === 'in-review' ? 'all' : 'in-review';
              setStatusFilter(next);
              setAdvFilters((prev) => ({ ...prev, status: next === 'all' ? '' : next }));
            }}
          >
            <span className="pill-dot dot-in-review" />
            <span>In Review</span>
            <span className="pill-badge">{inReviewTasks.length}</span>
          </button>
          <button
            type="button"
            className={`status-pill pill-completed ${statusFilter === 'completed' ? 'active' : ''}`}
            onClick={() => {
              const next = statusFilter === 'completed' ? 'all' : 'completed';
              setStatusFilter(next);
              setAdvFilters((prev) => ({ ...prev, status: next === 'all' ? '' : next }));
            }}
          >
            <span className="pill-dot dot-completed" />
            <span>Completed</span>
            <span className="pill-badge">{completedTasks.length}</span>
          </button>
        </div>

        {statusFilter !== 'all' && (
          <button
            type="button"
            className="view-all-cols-btn"
            onClick={() => {
              setStatusFilter('all');
              setAdvFilters((prev) => ({ ...prev, status: '' }));
            }}
          >
            Show All Columns
          </button>
        )}
      </div>

      {loading ? (
        <p className="muted-text">Loading tasks...</p>
      ) : (
        <div className={`kanban-scroll ${statusFilter !== 'all' ? 'single-column-scroll' : ''}`}>
          <div className={`kanban-board ${statusFilter !== 'all' ? 'single-column-active' : ''}`}>
            {(statusFilter === 'all' ? boardColumns : boardColumns.filter((col) => col.status === statusFilter)).map((column) => {
              const columnTasks = displayTasks.filter((task) => task.status === column.status);
              return (
                <section className={`kanban-column status-${column.status}`} key={column.status}>
                  <header className="kanban-column-header">
                    <div className="kanban-column-title">
                      <span className="kanban-status-dot" />
                      <h3>{column.title}</h3>
                      <span className="section-count">{columnTasks.length}</span>
                    </div>
                    {statusFilter === 'all' ? (
                      <button
                        type="button"
                        className="btn-column-focus"
                        onClick={() => {
                          setStatusFilter(column.status);
                          setAdvFilters((prev) => ({ ...prev, status: column.status }));
                        }}
                        title={`Focus on ${column.title} only`}
                      >
                        Focus
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn-column-focus"
                        onClick={() => {
                          setStatusFilter('all');
                          setAdvFilters((prev) => ({ ...prev, status: '' }));
                        }}
                        title="Show all columns"
                      >
                        All Columns
                      </button>
                    )}
                  </header>
                  <div className="kanban-card-list">
                    {columnTasks.map((task) => (
                      <TaskCard
                        key={task._id}
                        task={task}
                        onEdit={openEdit}
                        onDelete={handleDelete}
                        onStatusChange={handleStatusChange}
                        onDetails={() => setSelectedTask(task)}
                        canDelete={user?.role !== 'Manager'}
                      />
                    ))}
                    {columnTasks.length === 0 && (
                      <div className="kanban-empty">
                        <p>No tasks in {column.title}</p>
                        {statusFilter !== 'all' && (
                          <button
                            type="button"
                            className="btn-ghost btn-small"
                            onClick={() => {
                              setStatusFilter('all');
                              setAdvFilters((prev) => ({ ...prev, status: '' }));
                            }}
                          >
                            View All Columns
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
          {displayTasks.length === 0 && <p className="muted-text">No tasks found matching your filters.</p>}
        </div>
      )}
      </div>
      )}
      {selectedTask && (
        <TaskDetails
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdated={fetchTasks}
        />
      )}
      {showFocusMode && (
          <FocusMode 
              tasks={displayTasks} 
              onClose={() => setShowFocusMode(false)} 
              onSessionEnd={fetchTasks} 
          />
      )}
    </AppLayout>
  );
}

export default Dashboard;