import React, { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';

const PRIORITY_COLORS = { high: '#f43f5e', medium: '#f59e0b', low: '#10b981' };

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', padding: '10px 14px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
        <p style={{ margin: '0 0 6px 0', fontWeight: 600, color: '#111827', fontSize: '13px' }}>{label}</p>
        {payload.map((entry, index) => (
          <p key={index} style={{ margin: '2px 0', color: entry.color || '#6b7280', fontSize: '13px' }}>
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

function EmployeeAnalytics({ tasks, attendance }) {
  const [filter, setFilter] = useState('week'); // today, week, month, custom
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  
  const filteredData = useMemo(() => {
      const now = new Date();
      now.setHours(23, 59, 59, 999);
      
      let startDate = new Date(0); 
      let endDate = now;

      if (filter === 'today') {
          startDate = new Date();
          startDate.setHours(0, 0, 0, 0);
      } else if (filter === 'week') {
          startDate = new Date();
          startDate.setDate(startDate.getDate() - 7);
      } else if (filter === 'month') {
          startDate = new Date();
          startDate.setMonth(startDate.getMonth() - 1);
      } else if (filter === 'custom' && customRange.start && customRange.end) {
          startDate = new Date(customRange.start);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(customRange.end);
          endDate.setHours(23, 59, 59, 999);
      }
      
      const filteredTasks = tasks.filter(t => {
          const tDate = new Date(t.updatedAt || t.createdAt);
          return tDate >= startDate && tDate <= endDate;
      });
      
      const filteredAttendance = attendance.filter(a => {
          const aDate = new Date(a.date);
          return aDate >= startDate && aDate <= endDate;
      });
      
      return { filteredTasks, filteredAttendance };
  }, [tasks, attendance, filter, customRange]);

  const { filteredTasks, filteredAttendance } = filteredData;

  const completedVsPending = useMemo(() => {
      let completed = 0;
      let pending = 0;
      filteredTasks.forEach(t => {
          if (t.status === 'completed') completed++;
          else pending++;
      });
      return [
          { name: 'Completed', value: completed },
          { name: 'Pending', value: pending }
      ];
  }, [filteredTasks]);

  const priorityDistribution = useMemo(() => {
      let high = 0, medium = 0, low = 0;
      filteredTasks.forEach(t => {
          if (t.priority === 'high') high++;
          else if (t.priority === 'medium') medium++;
          else low++;
      });
      return [
          { name: 'High', value: high },
          { name: 'Medium', value: medium },
          { name: 'Low', value: low }
      ];
  }, [filteredTasks]);

  const dailyTrend = useMemo(() => {
      const daysMap = {};
      
      // Calculate effective start and end dates for the trend
      let startTrend = new Date();
      startTrend.setHours(0, 0, 0, 0);
      let endTrend = new Date();
      
      if (filter === 'today') {
          // just today
      } else if (filter === 'week') {
          startTrend.setDate(startTrend.getDate() - 6); // last 7 days
      } else if (filter === 'month') {
          startTrend.setDate(startTrend.getDate() - 29); // last 30 days
      } else if (filter === 'custom' && customRange.start && customRange.end) {
          startTrend = new Date(customRange.start);
          startTrend.setHours(0, 0, 0, 0);
          endTrend = new Date(customRange.end);
      } else {
          startTrend.setDate(startTrend.getDate() - 13); // fallback 14 days
      }

      // Pre-fill daysMap with all dates in range
      for (let d = new Date(startTrend); d <= endTrend; d.setDate(d.getDate() + 1)) {
          const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
          daysMap[dateStr] = { date: dateStr, completed: 0, created: 0, hours: 0 };
      }
      
      filteredTasks.forEach(t => {
          const d = new Date(t.updatedAt || t.createdAt);
          const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
          if (daysMap[dateStr]) {
              if (t.status === 'completed') daysMap[dateStr].completed++;
              daysMap[dateStr].created++;
          }
      });
      
      filteredAttendance.forEach(a => {
          const d = new Date(a.createdAt || a.date);
          const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
          if (daysMap[dateStr]) {
              daysMap[dateStr].hours = parseFloat(((a.totalSeconds || 0) / 3600).toFixed(1));
          }
      });
      
      return Object.values(daysMap).sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [filteredTasks, filteredAttendance, filter, customRange]);

  const chartContainerStyle = {
      background: '#ffffff',
      border: '1px solid rgba(0,0,0,0.05)',
      borderRadius: '12px',
      padding: '24px',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
      display: 'flex',
      flexDirection: 'column'
  };

  const titleStyle = {
      fontFamily: 'Inter',
      fontSize: '16px',
      fontWeight: 600,
      color: '#111827',
      margin: '0 0 20px 0'
  };

    if (tasks.length === 0 && attendance.length === 0) return null;

  return (
    <div style={{ marginTop: '40px', marginBottom: '40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <h2 style={{ margin: 0, fontFamily: 'Inter', fontSize: '20px', fontWeight: 700, color: '#111827', marginTop: '6px' }}>My Productivity Analytics</h2>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {['today', 'week', 'month', 'custom'].map(f => (
                      <button 
                          key={f}
                          onClick={() => setFilter(f)}
                          style={{
                              padding: '6px 14px',
                              border: '1px solid',
                              borderColor: filter === f ? '#3b82f6' : '#e5e7eb',
                              borderRadius: '20px',
                              background: filter === f ? '#eff6ff' : '#ffffff',
                              color: filter === f ? '#1d4ed8' : '#6b7280',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              textTransform: 'capitalize',
                              transition: 'all 0.2s'
                          }}
                      >
                          {f === 'week' ? 'This Week' : f === 'month' ? 'This Month' : f === 'custom' ? 'Custom Range' : f}
                      </button>
                  ))}
              </div>
              
              {filter === 'custom' && (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input 
                          type="date" 
                          value={customRange.start}
                          onChange={(e) => setCustomRange({...customRange, start: e.target.value})}
                          style={{ padding: '6px 10px', fontSize: '12px', border: '1px solid #e5e7eb', borderRadius: '6px', outline: 'none' }}
                      />
                      <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 600 }}>to</span>
                      <input 
                          type="date" 
                          value={customRange.end}
                          onChange={(e) => setCustomRange({...customRange, end: e.target.value})}
                          style={{ padding: '6px 10px', fontSize: '12px', border: '1px solid #e5e7eb', borderRadius: '6px', outline: 'none' }}
                      />
                  </div>
              )}
          </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
          
          {/* Daily Trend (Tasks & Hours) */}
          <div style={{ ...chartContainerStyle, gridColumn: 'span 2' }}>
              <h3 style={titleStyle}>Activity Trend (Tasks & Hours Worked)</h3>
              <div style={{ width: '100%', height: 260, minWidth: 0, minHeight: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={dailyTrend} margin={{ top: 5, right: 20, bottom: 5, left: -20 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                          <XAxis dataKey="date" stroke="#9ca3af" tick={{fontSize: 12}} tickLine={false} axisLine={false} dy={10} tickFormatter={(val) => val.slice(5)} />
                          <YAxis yAxisId="left" stroke="#9ca3af" tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                          <YAxis yAxisId="right" orientation="right" stroke="#9ca3af" tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                          <Tooltip content={<CustomTooltip />} />
                          <Legend wrapperStyle={{ fontSize: '13px', paddingTop: '10px' }} />
                          <Line yAxisId="left" type="monotone" dataKey="completed" name="Tasks Completed" stroke="#10b981" strokeWidth={3} dot={{r: 4}} activeDot={{r: 6}} />
                          <Line yAxisId="right" type="monotone" dataKey="hours" name="Hours Worked" stroke="#6366f1" strokeWidth={3} dot={{r: 4}} activeDot={{r: 6}} />
                      </LineChart>
                  </ResponsiveContainer>
              </div>
          </div>

          {/* Completed vs Pending */}
          <div style={{ ...chartContainerStyle }}>
              <h3 style={titleStyle}>Completion Rate</h3>
              <div style={{ width: '100%', height: 260, minWidth: 0, minHeight: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                          <Pie data={completedVsPending} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={5} dataKey="value" stroke="none">
                              {completedVsPending.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.name === 'Completed' ? '#10b981' : '#f3f4f6'} />
                              ))}
                          </Pie>
                          <Tooltip content={<CustomTooltip />} />
                          <Legend wrapperStyle={{ fontSize: '13px' }} />
                      </PieChart>
                  </ResponsiveContainer>
              </div>
          </div>

          {/* Priority Distribution */}
          <div style={{ ...chartContainerStyle }}>
              <h3 style={titleStyle}>Task Priority Breakdown</h3>
              <div style={{ width: '100%', height: 260, minWidth: 0, minHeight: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                          <Pie data={priorityDistribution} cx="50%" cy="50%" innerRadius={0} outerRadius={85} dataKey="value" stroke="none">
                              {priorityDistribution.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={PRIORITY_COLORS[entry.name.toLowerCase()]} />
                              ))}
                          </Pie>
                          <Tooltip content={<CustomTooltip />} />
                          <Legend wrapperStyle={{ fontSize: '13px' }} />
                      </PieChart>
                  </ResponsiveContainer>
              </div>
          </div>

          {/* Productivity Bar Chart */}
          <div style={{ ...chartContainerStyle, gridColumn: 'span 2' }}>
              <h3 style={titleStyle}>Tasks Created vs Completed</h3>
              <div style={{ width: '100%', height: 260, minWidth: 0, minHeight: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dailyTrend} margin={{ top: 5, right: 20, bottom: 5, left: -20 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                          <XAxis dataKey="date" stroke="#9ca3af" tick={{fontSize: 12}} tickLine={false} axisLine={false} dy={10} tickFormatter={(val) => val.slice(5)} />
                          <YAxis stroke="#9ca3af" tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                          <Tooltip content={<CustomTooltip />} />
                          <Legend wrapperStyle={{ fontSize: '13px', paddingTop: '10px' }} />
                          <Bar dataKey="created" name="Assigned" fill="#e5e7eb" radius={[4, 4, 0, 0]} barSize={20} />
                          <Bar dataKey="completed" name="Completed" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
                      </BarChart>
                  </ResponsiveContainer>
              </div>
          </div>
      </div>
    </div>
  );
}

export default EmployeeAnalytics;
