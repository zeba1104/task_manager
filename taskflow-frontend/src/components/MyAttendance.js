import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar,
  Clock,
  RefreshCw,
  X,
  Timer,
  AlertCircle,
  CalendarDays,
  Activity,
} from 'lucide-react';
import axios from '../api/axios';

function MyAttendance({ user, isManager = false, refreshSignal = 0 }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Filters - default to current month YYYY-MM
  const [filters, setFilters] = useState({
    date: '',
    month: new Date().toISOString().slice(0, 7),
  });

  const loadMyAttendance = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      setError('');
      const res = await axios.get('/attendance/mine');
      setRecords(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load attendance records');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMyAttendance();
  }, [loadMyAttendance, refreshSignal]);

  // Live timer tick every second for real-time dynamic hours
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Dynamic seconds calculation
  const getDynamicSeconds = useCallback((record) => {
    if (!record.clockIn) return 0;
    if (record.clockOut) {
      const diff = Math.max(0, Math.round((new Date(record.clockOut).getTime() - new Date(record.clockIn).getTime()) / 1000));
      return Math.max(record.totalSeconds || 0, diff);
    }
    // Active session
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

  const formatMonthName = (monthStr) => {
    if (!monthStr) return 'All Months';
    const parts = monthStr.split('-');
    if (parts.length < 2) return monthStr;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const d = new Date(y, m - 1, 1);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const todayRecord = useMemo(() => {
    return records.find((r) => r.date === todayStr);
  }, [records, todayStr]);

  const isTodayActive = Boolean(todayRecord?.clockIn && !todayRecord?.clockOut);

  // Filtered records
  const displayRecords = useMemo(() => {
    return records.filter((r) => {
      if (filters.date && r.date !== filters.date) return false;
      if (filters.month && (!r.date || !r.date.startsWith(filters.month))) return false;
      return true;
    });
  }, [records, filters]);

  // Aggregate stats
  const stats = useMemo(() => {
    let totalSecs = 0;
    let daysCount = 0;

    displayRecords.forEach((r) => {
      if (r.clockIn && r.status !== 'on-leave') {
        daysCount += 1;
        const secs = getDynamicSeconds(r);
        totalSecs += secs;
      }
    });

    const totalH = Math.floor(totalSecs / 3600);
    const totalM = Math.floor((totalSecs % 3600) / 60);

    const avgSecs = daysCount > 0 ? Math.round(totalSecs / daysCount) : 0;
    const avgH = Math.floor(avgSecs / 3600);
    const avgM = Math.floor((avgSecs % 3600) / 60);

    const todaySecs = todayRecord ? getDynamicSeconds(todayRecord) : 0;

    return {
      totalHoursStr: `${totalH}h ${totalM}m`,
      avgHoursStr: `${avgH}h ${avgM}m`,
      daysPresent: daysCount,
      todayHoursStr: formatHours(todaySecs, isTodayActive),
    };
  }, [displayRecords, getDynamicSeconds, todayRecord, isTodayActive]);

  const hasActiveFilters = Boolean(filters.date || (filters.month && filters.month !== new Date().toISOString().slice(0, 7)));

  const resetFilters = () => {
    setFilters({ date: '', month: new Date().toISOString().slice(0, 7) });
  };

  return (
    <div className="my-attendance-page">
      {/* Subheader description */}
      <p className="attendance-page-description">
        Track your everyday clock-in, clock-out timestamps, shift status, and personal working hour records.
      </p>

      {/* Summary Metric Tiles (Clock In/Out is now located on the Main Dashboard) */}
      <div className="attendance-metric-tiles-grid">
        <div className="attendance-tile tile-hours">
          <div className="tile-icon-wrap">
            <Timer size={19} />
          </div>
          <div className="tile-content">
            <span className="tile-label">{filters.month ? 'Monthly Work Hours' : 'Total Work Hours'}</span>
            <strong className="tile-value text-blue">{stats.totalHoursStr}</strong>
            <span className="tile-subtext">{filters.month ? formatMonthName(filters.month) : 'All Recorded Shifts'}</span>
          </div>
        </div>

        <div className="attendance-tile tile-active">
          <div className={`tile-icon-wrap ${isTodayActive ? 'active-pulse' : ''}`}>
            <Activity size={19} />
          </div>
          <div className="tile-content">
            <span className="tile-label">Today's Work Duration</span>
            <strong className={`tile-value ${isTodayActive ? 'text-emerald' : ''}`}>
              {stats.todayHoursStr}
            </strong>
            <span className="tile-subtext">{isTodayActive ? 'Shift Currently Active' : todayRecord?.clockOut ? 'Completed Shift' : 'Not Clocked In Yet'}</span>
          </div>
        </div>

        <div className="attendance-tile tile-total">
          <div className="tile-icon-wrap">
            <CalendarDays size={19} />
          </div>
          <div className="tile-content">
            <span className="tile-label">Working Days Logged</span>
            <strong className="tile-value">{stats.daysPresent} Days</strong>
            <span className="tile-subtext">{filters.month ? 'In Selected Month' : 'Total Days Logged'}</span>
          </div>
        </div>

        <div className="attendance-tile tile-avg">
          <div className="tile-icon-wrap">
            <Clock size={19} />
          </div>
          <div className="tile-content">
            <span className="tile-label">Daily Average</span>
            <strong className="tile-value">{stats.avgHoursStr}</strong>
            <span className="tile-subtext">Avg Shift Duration</span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar Card */}
      <div className="attendance-filter-card">
        <div className="attendance-filter-header">
          <div className="filter-title-group">
            <Calendar size={15} className="text-blue" />
            <h4>Filter Attendance History</h4>
          </div>
          <div className="filter-actions-group">
            {filters.month ? (
              <button
                type="button"
                className="filter-pill-btn"
                onClick={() => setFilters({ ...filters, month: '' })}
              >
                Show All Months
              </button>
            ) : (
              <button
                type="button"
                className="filter-pill-btn"
                onClick={() => setFilters({ ...filters, month: new Date().toISOString().slice(0, 7) })}
              >
                Current Month
              </button>
            )}
            <button
              type="button"
              className={`filter-pill-btn ${filters.date === todayStr ? 'active' : ''}`}
              onClick={() => setFilters({ ...filters, date: filters.date === todayStr ? '' : todayStr })}
            >
              Today
            </button>
            {hasActiveFilters && (
              <button
                type="button"
                className="filter-pill-btn filter-reset-pill"
                onClick={resetFilters}
                title="Reset all filters"
              >
                <X size={13} /> Reset
              </button>
            )}
          </div>
        </div>

        <div className="attendance-filter-body">
          <div className="filter-field">
            <label className="filter-field-label">Month</label>
            <div className="filter-input-wrap">
              <Calendar size={14} className="filter-icon" />
              <input
                type="month"
                value={filters.month}
                onChange={(e) => setFilters({ ...filters, month: e.target.value })}
                className="attendance-filter-input"
              />
            </div>
          </div>

          <div className="filter-field">
            <label className="filter-field-label">Specific Date</label>
            <div className="filter-input-wrap">
              <Calendar size={14} className="filter-icon" />
              <input
                type="date"
                value={filters.date}
                onChange={(e) => setFilters({ ...filters, date: e.target.value })}
                className="attendance-filter-input"
              />
              {filters.date && (
                <button
                  type="button"
                  className="filter-clear-btn"
                  onClick={() => setFilters({ ...filters, date: '' })}
                  title="Clear date"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          <div className="filter-stats-indicator">
            <span className="indicator-count">
              Showing <strong>{displayRecords.length}</strong> {displayRecords.length === 1 ? 'record' : 'records'}
              {filters.month && <span> for <strong>{formatMonthName(filters.month)}</strong></span>}
            </span>
          </div>
        </div>
      </div>

      {error && <p className="error-text" role="alert">{error}</p>}

      {/* Attendance Table Card */}
      <div className="attendance-table-card">
        {loading ? (
          <div className="attendance-loading-state">
            <RefreshCw size={22} className="spinning text-blue" />
            <p>Loading your everyday attendance history...</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="attendance-custom-table">
              <thead>
                <tr>
                  <th style={{ width: '22%' }}>Date &amp; Day</th>
                  <th style={{ width: '18%' }}>Clock In</th>
                  <th style={{ width: '18%' }}>Clock Out</th>
                  <th style={{ width: '20%' }}>Total Hours</th>
                  <th style={{ width: '22%' }}>Shift Status</th>
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
                        <Calendar size={12} /> Approved Leave
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
                      statusBadge = <span className="shift-badge shift-full">Full Shift (8h+)</span>;
                    } else if (dynamicSecs >= 14400) {
                      statusBadge = <span className="shift-badge shift-standard">Standard Shift</span>;
                    } else {
                      statusBadge = <span className="shift-badge shift-partial">Partial Day</span>;
                    }
                  } else {
                    statusBadge = <span className="shift-badge shift-off">Not Clocked</span>;
                  }

                  const recordDate = new Date(record.date);
                  const isToday = record.date === todayStr;

                  return (
                    <tr key={record._id} className={isWorkingNow ? 'row-active-shift' : isOnLeave ? 'row-leave-shift' : ''}>
                      <td className="attendance-date-cell">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <strong>
                            {recordDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </strong>
                          {isToday && <span className="today-chip">Today</span>}
                        </div>
                        <small>{recordDate.toLocaleDateString('en-US', { weekday: 'long' })}</small>
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
                          <span className="text-muted font-medium">--</span>
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
                    <td colSpan={5} className="attendance-empty-cell">
                      <div className="attendance-empty-wrap">
                        <AlertCircle size={28} className="text-muted" />
                        <p>No attendance records found for this period.</p>
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

export default MyAttendance;
