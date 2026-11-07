import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar,
  Clock,
  Search,
  Building2,
  RefreshCw,
  X,
  Timer,
  AlertCircle,
  Users,
  Activity,
  Palmtree,
} from 'lucide-react';
import axios from '../api/axios';
import UserAvatar from './UserAvatar';

function AttendanceManager() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Filters
  const [filters, setFilters] = useState({
    employee: '',
    date: '',
    month: '',
    department: '',
  });

  const loadAttendance = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError('');
      const res = await axios.get('/attendance');
      setRecords(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load attendance records');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  // Live timer ticker for active sessions (ticks every second)
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Compute dynamic seconds accurately for any record
  const getDynamicSeconds = useCallback((record) => {
    if (!record.clockIn) return 0;
    if (record.clockOut) {
      const diff = Math.max(0, Math.round((new Date(record.clockOut).getTime() - new Date(record.clockIn).getTime()) / 1000));
      return Math.max(record.totalSeconds || 0, diff);
    }
    // Active session: compute real-time elapsed seconds from clockIn to current instant
    const inTime = new Date(record.clockIn).getTime();
    const elapsed = Math.max(0, Math.round((currentTime - inTime) / 1000));
    return Math.max(record.totalSeconds || 0, elapsed);
  }, [currentTime]);

  const formatTime = (dateStr) => {
    if (!dateStr) return '--:--';
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const formatHours = (seconds, isActive = false) => {
    if (!seconds || seconds <= 0) return '0h 0m';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (isActive) {
      return `${h}h ${m}m ${s}s`;
    }
    return `${h}h ${m}m`;
  };

  const hasActiveFilters = Boolean(
    filters.employee || filters.department || filters.date || filters.month
  );

  const resetFilters = () => {
    setFilters({ employee: '', date: '', month: '', department: '' });
  };

  // Filtered records list
  const displayRecords = useMemo(() => {
    return records.filter((r) => {
      if (filters.employee && !r.user?.name?.toLowerCase().includes(filters.employee.toLowerCase())) {
        return false;
      }
      if (filters.department && !r.user?.department?.toLowerCase().includes(filters.department.toLowerCase())) {
        return false;
      }
      if (filters.date && r.date !== filters.date) {
        return false;
      }
      if (filters.month && (!r.date || !r.date.startsWith(filters.month))) {
        return false;
      }
      return true;
    });
  }, [records, filters]);

  // Aggregate Metrics for Top Cards
  const stats = useMemo(() => {
    let totalSecs = 0;
    let activeCount = 0;
    let completedCount = 0;

    displayRecords.forEach((r) => {
      const secs = getDynamicSeconds(r);
      totalSecs += secs;
      if (r.clockIn && !r.clockOut) activeCount += 1;
      else if (r.clockIn && r.clockOut) completedCount += 1;
    });

    const totalH = Math.floor(totalSecs / 3600);
    const totalM = Math.floor((totalSecs % 3600) / 60);

    const validShifts = completedCount + activeCount;
    const avgSecs = validShifts > 0 ? Math.round(totalSecs / validShifts) : 0;
    const avgH = Math.floor(avgSecs / 3600);
    const avgM = Math.floor((avgSecs % 3600) / 60);

    return {
      totalRecords: displayRecords.length,
      activeNow: activeCount,
      completed: completedCount,
      totalHoursStr: `${totalH}h ${totalM}m`,
      avgHoursStr: `${avgH}h ${avgM}m`,
    };
  }, [displayRecords, getDynamicSeconds]);

  return (
    <div className="dashboard-page attendance-manager-page">
      {/* Page Header */}
      <div className="page-header-row">
        <div>
          <h2 className="page-main-title">Attendance &amp; Working Hours</h2>
          <p className="muted-text">Track employee clock-ins, clock-outs, and live real-time working hours</p>
        </div>
        <div className="page-header-actions">
          <button
            type="button"
            className="btn-secondary btn-small attendance-refresh-btn"
            onClick={() => loadAttendance(true)}
            disabled={loading || refreshing}
            title="Refresh attendance records"
          >
            <RefreshCw size={13} className={refreshing ? 'spinning' : ''} />
            <span>{refreshing ? 'Updating...' : 'Refresh'}</span>
          </button>
          <span className="header-date-badge">
            <Calendar size={13} /> {new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
      </div>

      {/* Metric Tiles Row */}
      <div className="attendance-metric-tiles-grid">
        <div className="attendance-tile tile-total">
          <div className="tile-icon-wrap">
            <Users size={18} />
          </div>
          <div className="tile-content">
            <span className="tile-label">Logged Records</span>
            <strong className="tile-value">{stats.totalRecords}</strong>
          </div>
        </div>

        <div className="attendance-tile tile-active">
          <div className="tile-icon-wrap active-pulse">
            <Activity size={18} />
          </div>
          <div className="tile-content">
            <span className="tile-label">Working Now (Live)</span>
            <strong className="tile-value text-emerald">{stats.activeNow}</strong>
          </div>
        </div>

        <div className="attendance-tile tile-hours">
          <div className="tile-icon-wrap">
            <Timer size={18} />
          </div>
          <div className="tile-content">
            <span className="tile-label">Total Hours Logged</span>
            <strong className="tile-value text-blue">{stats.totalHoursStr}</strong>
          </div>
        </div>

        <div className="attendance-tile tile-avg">
          <div className="tile-icon-wrap">
            <Clock size={18} />
          </div>
          <div className="tile-content">
            <span className="tile-label">Average Shift Duration</span>
            <strong className="tile-value">{stats.avgHoursStr}</strong>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="attendance-filter-card">
        <div className="filter-inputs-grid">
          <div className="filter-input-wrap">
            <Search size={15} className="filter-icon" />
            <input
              type="text"
              placeholder="Filter by Employee Name"
              value={filters.employee}
              onChange={(e) => setFilters({ ...filters, employee: e.target.value })}
              className="attendance-filter-input"
            />
            {filters.employee && (
              <button
                type="button"
                className="filter-clear-btn"
                onClick={() => setFilters({ ...filters, employee: '' })}
                title="Clear"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <div className="filter-input-wrap">
            <Building2 size={15} className="filter-icon" />
            <input
              type="text"
              placeholder="Filter by Department"
              value={filters.department}
              onChange={(e) => setFilters({ ...filters, department: e.target.value })}
              className="attendance-filter-input"
            />
            {filters.department && (
              <button
                type="button"
                className="filter-clear-btn"
                onClick={() => setFilters({ ...filters, department: '' })}
                title="Clear"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <div className="filter-date-wrap">
            <span className="filter-date-label">Specific Date</span>
            <div className="filter-input-wrap">
              <Calendar size={15} className="filter-icon" />
              <input
                type="date"
                value={filters.date}
                onChange={(e) => setFilters({ ...filters, date: e.target.value })}
                className="attendance-filter-input"
              />
            </div>
          </div>

          <div className="filter-date-wrap">
            <span className="filter-date-label">Month</span>
            <div className="filter-input-wrap">
              <Calendar size={15} className="filter-icon" />
              <input
                type="month"
                value={filters.month}
                onChange={(e) => setFilters({ ...filters, month: e.target.value })}
                className="attendance-filter-input"
              />
            </div>
          </div>
        </div>

        {hasActiveFilters && (
          <div className="filter-active-bar">
            <span className="filter-active-count">
              Showing {displayRecords.length} of {records.length} records matching active filters
            </span>
            <button type="button" className="btn-ghost btn-xs filter-reset-link" onClick={resetFilters}>
              <X size={12} /> Reset all filters
            </button>
          </div>
        )}
      </div>

      {error && <p className="error-text" role="alert">{error}</p>}

      {/* Attendance Table Card */}
      <div className="attendance-table-card">
        {loading ? (
          <div className="attendance-loading-state">
            <RefreshCw size={22} className="spinning text-blue" />
            <p>Loading attendance &amp; live working hours...</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="attendance-custom-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Date</th>
                  <th>Clock In</th>
                  <th>Clock Out</th>
                  <th>Total Hours</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {displayRecords.map((record) => {
                  const dynamicSecs = getDynamicSeconds(record);
                  const isWorkingNow = Boolean(record.clockIn && !record.clockOut);
                  const hasClocked = Boolean(record.clockIn);
                  const isOnLeave = Boolean(record.status === 'on-leave' || record.status === 'On Leave' || record.isOnLeave);

                  let statusBadge = null;
                  if (isOnLeave) {
                    statusBadge = (
                      <span className="shift-badge shift-leave">
                        <Palmtree size={12} /> Approved Leave
                      </span>
                    );
                  } else if (isWorkingNow) {
                    statusBadge = (
                      <span className="shift-badge shift-active">
                        <span className="live-pulse-dot" /> Working Now
                      </span>
                    );
                  } else if (hasClocked && record.clockOut) {
                    if (dynamicSecs >= 28800) {
                      statusBadge = <span className="shift-badge shift-full">Full Day (8h+)</span>;
                    } else if (dynamicSecs >= 14400) {
                      statusBadge = <span className="shift-badge shift-standard">Standard Shift</span>;
                    } else {
                      statusBadge = <span className="shift-badge shift-partial">Partial Day</span>;
                    }
                  } else {
                    statusBadge = <span className="shift-badge shift-off">Not Clocked</span>;
                  }

                  return (
                    <tr key={record._id} className={isWorkingNow ? 'row-active-shift' : isOnLeave ? 'row-leave-shift' : ''}>
                      <td>
                        <div className="attendance-user-cell">
                          <UserAvatar user={record.user} className="attendance-table-avatar" />
                          <div className="attendance-user-info">
                            <span className="attendance-user-name">{record.user?.name || 'Unknown Employee'}</span>
                            <div className="attendance-user-meta">
                              <span className="attendance-dept-tag">{record.user?.department || 'General'}</span>
                              {record.user?.employeeId && (
                                <span className="attendance-id-tag">{record.user.employeeId}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="attendance-date-cell">
                        <strong>
                          {new Date(record.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                        </strong>
                        <small>{new Date(record.date).getFullYear()}</small>
                      </td>

                      <td>
                        {isOnLeave ? (
                          <span className="time-pill leave">
                            <Calendar size={12} /> On Leave
                          </span>
                        ) : record.clockIn ? (
                          <span className="time-pill in">
                            <Clock size={12} /> {formatTime(record.clockIn)}
                          </span>
                        ) : (
                          <span className="text-muted">--:--</span>
                        )}
                      </td>

                      <td>
                        {isOnLeave ? (
                          <span className="time-pill leave">
                            <Calendar size={12} /> On Leave
                          </span>
                        ) : record.clockOut ? (
                          <span className="time-pill out">
                            <Clock size={12} /> {formatTime(record.clockOut)}
                          </span>
                        ) : record.clockIn ? (
                          <span className="time-pill working">
                            <span className="live-pulse-dot" /> In Progress
                          </span>
                        ) : (
                          <span className="text-muted">--:--</span>
                        )}
                      </td>

                      <td>
                        {isOnLeave ? (
                          <span className="time-pill leave">Excused</span>
                        ) : isWorkingNow ? (
                          <div className="dynamic-hours-cell">
                            <strong className="hours-val text-emerald">
                              {formatHours(dynamicSecs, true)}
                            </strong>
                            <span className="live-ticker-badge">Live Ticker</span>
                          </div>
                        ) : hasClocked ? (
                          <strong className="hours-val text-accent">
                            {formatHours(dynamicSecs, false)}
                          </strong>
                        ) : (
                          <span className="text-muted">0h 0m</span>
                        )}
                      </td>

                      <td>{statusBadge}</td>
                    </tr>
                  );
                })}

                {displayRecords.length === 0 && (
                  <tr>
                    <td colSpan={6} className="attendance-empty-cell">
                      <div className="attendance-empty-wrap">
                        <AlertCircle size={28} className="text-muted" />
                        <p>No attendance records match your current filter criteria.</p>
                        {hasActiveFilters && (
                          <button type="button" className="btn-secondary btn-small" onClick={resetFilters}>
                            Clear filters
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default AttendanceManager;
