import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Swal from 'sweetalert2';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Trash2,
  Edit2,
  X,
  Clock,
  Sparkles,
  PartyPopper,
  CalendarDays,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import {
  getHolidays,
  getUpcomingHoliday,
  createHoliday,
  updateHoliday,
  deleteHoliday,
} from '../api/holidayApi';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const CATEGORIES = [
  'All',
  'National Holiday',
  'Gazetted Holiday',
  'Public Holiday',
  'Restricted Holiday',
  'Company Holiday',
];

function HolidayCalendar({ user, setView }) {
  const isAdmin = user?.role === 'Admin';

  const [holidays, setHolidays] = useState([]);
  const [upcomingHoliday, setUpcomingHoliday] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // View mode: 'dual' (Calendar + List), 'calendar', 'list'
  const [viewMode, setViewMode] = useState('dual');

  // Filter states
  const [selectedYear, setSelectedYear] = useState('2026');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Calendar navigation state (defaults to current month: November 2026)
  const [calendarDate, setCalendarDate] = useState(() => new Date(2026, 10, 1));

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState(null);
  const [selectedHolidayDetail, setSelectedHolidayDetail] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    date: '',
    type: 'Gazetted Holiday',
    description: '',
    isMandatory: true,
  });

  // Load holidays from API
  const fetchHolidays = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (selectedYear !== 'all') params.year = selectedYear;
      if (selectedCategory !== 'All') params.type = selectedCategory;
      if (selectedMonth !== 'all') params.month = selectedMonth;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const [holidaysRes, upcomingRes] = await Promise.all([
        getHolidays(params),
        getUpcomingHoliday().catch(() => ({ data: null })),
      ]);

      setHolidays(holidaysRes.data || []);
      setUpcomingHoliday(upcomingRes.data || null);
    } catch (err) {
      console.error('Failed to load holidays:', err);
      setError('Unable to load government holidays. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedCategory, selectedMonth, searchQuery]);

  useEffect(() => {
    fetchHolidays();
  }, [fetchHolidays]);

  // Keep calendar year in sync when year filter changes
  useEffect(() => {
    if (selectedYear !== 'all') {
      const y = Number(selectedYear);
      setCalendarDate((prev) => new Date(y, prev.getMonth(), 1));
    }
  }, [selectedYear]);

  // Open modal for Create
  const handleOpenCreateModal = () => {
    setEditingHoliday(null);
    setFormData({
      name: '',
      date: `${calendarDate.getFullYear()}-${String(calendarDate.getMonth() + 1).padStart(2, '0')}-01`,
      type: 'Gazetted Holiday',
      description: '',
      isMandatory: true,
    });
    setShowModal(true);
  };

  // Open modal for Edit
  const handleOpenEditModal = (h, e) => {
    if (e) e.stopPropagation();
    setEditingHoliday(h);
    setFormData({
      name: h.name || '',
      date: h.date || '',
      type: h.type || 'Gazetted Holiday',
      description: h.description || '',
      isMandatory: h.isMandatory !== undefined ? h.isMandatory : true,
    });
    setShowModal(true);
  };

  // Submit modal (Create or Update)
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.date) {
      Swal.fire('Required Fields', 'Holiday name and date are required.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      if (editingHoliday) {
        await updateHoliday(editingHoliday._id, formData);
        Swal.fire({
          icon: 'success',
          title: 'Holiday Updated',
          text: `"${formData.name}" has been updated successfully.`,
          timer: 1600,
          showConfirmButton: false,
        });
      } else {
        await createHoliday(formData);
        Swal.fire({
          icon: 'success',
          title: 'Holiday Added',
          text: `"${formData.name}" has been scheduled in the calendar.`,
          timer: 1600,
          showConfirmButton: false,
        });
      }
      setShowModal(false);
      setEditingHoliday(null);
      fetchHolidays();
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to save holiday.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete holiday
  const handleDelete = async (h, e) => {
    if (e) e.stopPropagation();
    const result = await Swal.fire({
      title: 'Delete Holiday?',
      text: `Are you sure you want to remove "${h.name}" (${h.date}) from official government holidays?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, Delete',
      cancelButtonText: 'Cancel',
    });

    if (result.isConfirmed) {
      try {
        await deleteHoliday(h._id);
        Swal.fire({
          icon: 'success',
          title: 'Deleted',
          text: `"${h.name}" was removed from the calendar.`,
          timer: 1500,
          showConfirmButton: false,
        });
        if (selectedHolidayDetail?._id === h._id) {
          setSelectedHolidayDetail(null);
        }
        fetchHolidays();
      } catch (err) {
        Swal.fire('Error', err.response?.data?.message || 'Failed to delete holiday.', 'error');
      }
    }
  };

  // Calendar calculations
  const calYear = calendarDate.getFullYear();
  const calMonth = calendarDate.getMonth();

  const prevMonth = () => {
    setCalendarDate(new Date(calYear, calMonth - 1, 1));
  };

  const nextMonth = () => {
    setCalendarDate(new Date(calYear, calMonth + 1, 1));
  };

  const jumpToToday = () => {
    const now = new Date();
    setCalendarDate(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  // Map holidays by date string 'YYYY-MM-DD'
  const holidaysByDate = useMemo(() => {
    const map = new Map();
    holidays.forEach((h) => {
      if (!map.has(h.date)) {
        map.set(h.date, []);
      }
      map.get(h.date).push(h);
    });
    return map;
  }, [holidays]);

  // Calendar grid cells
  const calendarCells = useMemo(() => {
    const firstDayIndex = new Date(calYear, calMonth, 1).getDay(); // 0 = Sun
    const totalDaysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

    const cells = [];
    // Leading blanks
    for (let i = 0; i < firstDayIndex; i++) {
      cells.push({ isBlank: true, key: `blank-${i}` });
    }

    const todayStr = new Date().toISOString().split('T')[0];

    // Days in current month
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayOfWeek = (firstDayIndex + d - 1) % 7;
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isToday = dateStr === todayStr;
      const dayHolidays = holidaysByDate.get(dateStr) || [];

      cells.push({
        isBlank: false,
        key: dateStr,
        dayNumber: d,
        dateStr,
        dayOfWeek,
        isWeekend,
        isToday,
        holidays: dayHolidays,
      });
    }

    return cells;
  }, [calYear, calMonth, holidaysByDate]);

  // Statistics counters
  const totalCount = holidays.length;
  const nationalCount = holidays.filter((h) => h.type === 'National Holiday').length;
  const gazettedCount = holidays.filter((h) => h.type === 'Gazetted Holiday').length;
  const publicCount = holidays.filter((h) => h.type === 'Public Holiday' || h.type === 'Company Holiday').length;

  // Format date helper: "26 Jan 2026"
  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const y = parts[0];
    const m = MONTH_NAMES[parseInt(parts[1], 10) - 1]?.slice(0, 3) || parts[1];
    const d = parts[2];
    return `${d} ${m} ${y}`;
  };

  // Helper to compute countdown
  const getCountdownText = (dateStr) => {
    if (!dateStr) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr + 'T00:00:00');
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return { label: 'Today', status: 'today', color: '#10b981' };
    if (diffDays === 1) return { label: 'Tomorrow', status: 'upcoming', color: '#3b82f6' };
    if (diffDays > 1) return { label: `In ${diffDays} days`, status: 'upcoming', color: '#3b82f6' };
    return { label: `${Math.abs(diffDays)} days ago`, status: 'past', color: '#94a3b8' };
  };

  // Badge class for holiday category
  const getTypeBadgeClass = (type) => {
    switch (type) {
      case 'National Holiday':
        return 'holiday-badge-national';
      case 'Gazetted Holiday':
        return 'holiday-badge-gazetted';
      case 'Public Holiday':
        return 'holiday-badge-public';
      default:
        return 'holiday-badge-default';
    }
  };

  return (
    <div className="holiday-page-container">
      {/* 1. Header Banner */}
      <div className="holiday-header-card">
        <div className="holiday-header-content page-header-row" style={{ margin: 0, padding: 0 }}>
          <div className="page-header-info">
            <div className="page-title-icon-box">
              <CalendarDays size={22} />
            </div>
            <div>
              <h2 className="page-main-title">Government &amp; Public Holidays</h2>
              <p className="page-subtitle">
                Verified gazetted, national, and statutory public holidays. Excluded from working shift obligations and employee absent logs.
              </p>
            </div>
          </div>

          <div className="holiday-header-actions">
            {/* View Mode Toggle */}
            <div className="holiday-view-toggle">
              <button
                type="button"
                className={`toggle-btn ${viewMode === 'dual' ? 'active' : ''}`}
                onClick={() => setViewMode('dual')}
                title="Calendar and List side-by-side"
              >
                <CalendarDays size={15} /> Both
              </button>
              <button
                type="button"
                className={`toggle-btn ${viewMode === 'calendar' ? 'active' : ''}`}
                onClick={() => setViewMode('calendar')}
                title="Calendar Grid view"
              >
                <CalendarIcon size={15} /> Calendar
              </button>
              <button
                type="button"
                className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
                title="Chronological List view with dates"
              >
                <Clock size={15} /> List
              </button>
            </div>

            {isAdmin && (
              <button
                type="button"
                className="btn-primary holiday-add-btn"
                onClick={handleOpenCreateModal}
              >
                <Plus size={16} /> Add Holiday
              </button>
            )}
          </div>
        </div>

        {/* Upcoming Holiday Spotlight Alert */}
        {upcomingHoliday && (
          <div className="holiday-upcoming-spotlight">
            <div className="spotlight-icon-box">
              <PartyPopper size={20} />
            </div>
            <div className="spotlight-info">
              <span className="spotlight-tag">Next Government Holiday</span>
              <div className="spotlight-main">
                <strong className="spotlight-name">{upcomingHoliday.name}</strong>
                <span className="spotlight-date">
                  • {formatDateDisplay(upcomingHoliday.date)} ({upcomingHoliday.day || 'Day'})
                </span>
                <span className={`spotlight-badge ${getTypeBadgeClass(upcomingHoliday.type)}`}>
                  {upcomingHoliday.type}
                </span>
              </div>
              {upcomingHoliday.description && (
                <p className="spotlight-desc">{upcomingHoliday.description}</p>
              )}
            </div>
            <div className="spotlight-countdown">
              {(() => {
                const count = getCountdownText(upcomingHoliday.date);
                return (
                  <span className={`countdown-pill countdown-${count?.status}`}>
                    <Clock size={13} /> {count?.label}
                  </span>
                );
              })()}
            </div>
          </div>
        )}
      </div>

      {/* 2. Stats Bar */}
      <div className="holiday-metrics-grid">
        <div className="holiday-stat-card">
          <div className="stat-label">Total Holidays ({selectedYear === 'all' ? 'All Years' : selectedYear})</div>
          <div className="stat-value">{totalCount}</div>
          <div className="stat-sub">Recognized non-working days</div>
        </div>

        <div className="holiday-stat-card border-national">
          <div className="stat-label">National Holidays</div>
          <div className="stat-value text-national">{nationalCount}</div>
          <div className="stat-sub">Mandatory across all states</div>
        </div>

        <div className="holiday-stat-card border-gazetted">
          <div className="stat-label">Gazetted Holidays</div>
          <div className="stat-value text-gazetted">{gazettedCount}</div>
          <div className="stat-sub">Official central government dates</div>
        </div>

        <div className="holiday-stat-card border-public">
          <div className="stat-label">Festive & State Holidays</div>
          <div className="stat-value text-public">{publicCount}</div>
          <div className="stat-sub">Statutory cultural observances</div>
        </div>
      </div>

      {/* 3. Toolbar: Search, Year, Month, Category Filters */}
      <div className="holiday-toolbar-card">
        <div className="holiday-toolbar-row">
          {/* Search Input */}
          <div className="holiday-search-box">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search holiday by name (e.g., Diwali, Eid, Republic Day)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="holiday-search-input"
            />
            {searchQuery && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => setSearchQuery('')}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Year Filter Pills */}
          <div className="holiday-filter-group">
            <span className="filter-group-label">Year:</span>
            {['2026', '2027', 'all'].map((y) => (
              <button
                key={y}
                type="button"
                className={`filter-pill ${selectedYear === y ? 'active' : ''}`}
                onClick={() => setSelectedYear(y)}
              >
                {y === 'all' ? 'All Years' : y}
              </button>
            ))}
          </div>

          {/* Month Dropdown Filter */}
          <div className="holiday-select-box">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="holiday-select"
            >
              <option value="all">All 12 Months</option>
              {MONTH_NAMES.map((m, idx) => (
                <option key={m} value={String(idx + 1).padStart(2, '0')}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Category Pills */}
        <div className="holiday-category-pills">
          <span className="category-pills-label">Category:</span>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`cat-pill ${selectedCategory === cat ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Loading & Error States */}
      {loading && (
        <div className="holiday-loading-box">
          <Clock size={24} className="spinning" />
          <span>Loading official government calendar...</span>
        </div>
      )}

      {error && (
        <div className="holiday-error-banner">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* 4. Main Body: Calendar and/or List View */}
      {!loading && !error && (
        <div className={`holiday-main-layout layout-${viewMode}`}>
          {/* CALENDAR VIEW */}
          {(viewMode === 'dual' || viewMode === 'calendar') && (
            <div className="holiday-calendar-pane">
              <div className="calendar-pane-card">
                {/* Calendar Header Navigation */}
                <div className="calendar-nav-bar">
                  <div className="calendar-nav-title">
                    <CalendarIcon size={18} className="text-primary" />
                    <h2>
                      {MONTH_NAMES[calMonth]} {calYear}
                    </h2>
                  </div>

                  <div className="calendar-nav-controls">
                    <button
                      type="button"
                      className="cal-btn-arrow"
                      onClick={prevMonth}
                      title="Previous Month"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <button
                      type="button"
                      className="cal-btn-today"
                      onClick={jumpToToday}
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      className="cal-btn-arrow"
                      onClick={nextMonth}
                      title="Next Month"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </div>

                {/* Calendar Grid */}
                <div className="calendar-grid-wrapper">
                  {/* Weekday Row */}
                  <div className="calendar-weekdays-row">
                    {WEEKDAYS.map((wd, i) => (
                      <div
                        key={wd}
                        className={`weekday-header ${i === 0 || i === 6 ? 'is-weekend-head' : ''}`}
                      >
                        {wd}
                      </div>
                    ))}
                  </div>

                  {/* Day Cells */}
                  <div className="calendar-days-grid">
                    {calendarCells.map((cell) => {
                      if (cell.isBlank) {
                        return <div key={cell.key} className="cal-cell is-blank" />;
                      }

                      const hasHolidays = cell.holidays && cell.holidays.length > 0;

                      return (
                        <div
                          key={cell.key}
                          className={`cal-cell ${cell.isToday ? 'is-today' : ''} ${
                            cell.isWeekend ? 'is-weekend' : ''
                          } ${hasHolidays ? 'has-holiday' : ''}`}
                          onClick={() => {
                            if (hasHolidays) {
                              setSelectedHolidayDetail(cell.holidays[0]);
                            }
                          }}
                        >
                          <div className="cal-cell-header">
                            <span className="cal-day-num">{cell.dayNumber}</span>
                            {cell.isToday && <span className="cal-today-tag">Today</span>}
                          </div>

                          {/* Holiday Chips */}
                          <div className="cal-holidays-list">
                            {cell.holidays.map((h) => (
                              <div
                                key={h._id}
                                className={`cal-holiday-chip ${getTypeBadgeClass(h.type)}`}
                                title={`${h.name} (${h.type}) - Click to view`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedHolidayDetail(h);
                                }}
                              >
                                <span className="chip-dot" />
                                <span className="chip-name">{h.name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Calendar Legend */}
                <div className="calendar-legend-bar">
                  <div className="legend-item">
                    <span className="legend-dot dot-national" />
                    <span>National Holiday</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-dot dot-gazetted" />
                    <span>Gazetted Holiday</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-dot dot-public" />
                    <span>Public / Festive</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-dot dot-weekend" />
                    <span>Weekend (Sat / Sun)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* LIST VIEW (With Date, Day, Category, and Details) */}
          {(viewMode === 'dual' || viewMode === 'list') && (
            <div className="holiday-list-pane">
              <div className="list-pane-card">
                <div className="list-pane-header">
                  <div>
                    <h2 className="list-pane-title">Government Holiday List</h2>
                    <span className="list-pane-sub">
                      Showing {holidays.length} holiday{holidays.length === 1 ? '' : 's'} with confirmed dates
                    </span>
                  </div>
                  <span className="list-pane-count-badge">
                    {selectedYear === 'all' ? 'All Years' : `Year ${selectedYear}`}
                  </span>
                </div>

                {holidays.length === 0 ? (
                  <div className="holiday-empty-state">
                    <CalendarIcon size={36} className="text-muted" />
                    <h3>No Holidays Found</h3>
                    <p>No government holidays match your current filter or search criteria.</p>
                    <button
                      type="button"
                      className="btn-ghost btn-small"
                      onClick={() => {
                        setSelectedYear('2026');
                        setSelectedCategory('All');
                        setSelectedMonth('all');
                        setSearchQuery('');
                      }}
                    >
                      Reset All Filters
                    </button>
                  </div>
                ) : (
                  <div className="holiday-items-list">
                    {holidays.map((h) => {
                      const count = getCountdownText(h.date);
                      const parts = h.date.split('-');
                      const mShort = MONTH_NAMES[parseInt(parts[1], 10) - 1]?.slice(0, 3).toUpperCase() || '';
                      const dayNum = parts[2];

                      return (
                        <div
                          key={h._id}
                          className={`holiday-item-row ${selectedHolidayDetail?._id === h._id ? 'selected-row' : ''}`}
                          onClick={() => setSelectedHolidayDetail(h)}
                        >
                          {/* Calendar Leaf Date Badge */}
                          <div className="holiday-date-leaf">
                            <div className="leaf-month">{mShort}</div>
                            <div className="leaf-day">{dayNum}</div>
                            <div className="leaf-weekday">{h.day ? h.day.slice(0, 3).toUpperCase() : 'DAY'}</div>
                          </div>

                          {/* Holiday Details */}
                          <div className="holiday-item-details">
                            <div className="holiday-title-line">
                              <h3 className="holiday-item-name">{h.name}</h3>
                              <span className={`holiday-category-badge ${getTypeBadgeClass(h.type)}`}>
                                {h.type}
                              </span>
                            </div>

                            <p className="holiday-item-desc">
                              {h.description || 'Official government holiday. Workplace shifts & attendance requirements are paused.'}
                            </p>

                            <div className="holiday-meta-line">
                              <span className="meta-full-date">
                                <CalendarIcon size={13} /> {formatDateDisplay(h.date)} • {h.day || 'Weekday'}
                              </span>
                              {count && (
                                <span className={`meta-countdown-pill countdown-${count.status}`}>
                                  <Clock size={12} /> {count.label}
                                </span>
                              )}
                              {h.isMandatory && (
                                <span className="meta-mandatory-pill">
                                  <CheckCircle2 size={12} /> Mandatory
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Actions (Admin Only) */}
                          {isAdmin && (
                            <div className="holiday-row-actions">
                              <button
                                type="button"
                                className="action-btn btn-edit"
                                title="Edit Holiday"
                                onClick={(e) => handleOpenEditModal(h, e)}
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                type="button"
                                className="action-btn btn-delete"
                                title="Delete Holiday"
                                onClick={(e) => handleDelete(h, e)}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. Holiday Detail Drawer / Modal (When Clicked) */}
      {selectedHolidayDetail && (
        <div className="holiday-detail-overlay" onClick={() => setSelectedHolidayDetail(null)}>
          <div className="holiday-detail-modal" onClick={(e) => e.stopPropagation()}>
            <header className="detail-modal-header">
              <div className="detail-header-tag">
                <Sparkles size={14} /> Holiday Information
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setSelectedHolidayDetail(null)}
              >
                <X size={18} />
              </button>
            </header>

            <div className="detail-modal-body">
              <div className="detail-date-badge-box">
                <span className="detail-badge-month">
                  {MONTH_NAMES[parseInt(selectedHolidayDetail.date.split('-')[1], 10) - 1]}
                </span>
                <span className="detail-badge-day">{selectedHolidayDetail.date.split('-')[2]}</span>
                <span className="detail-badge-year">{selectedHolidayDetail.date.split('-')[0]}</span>
              </div>

              <h2 className="detail-holiday-name">{selectedHolidayDetail.name}</h2>
              <div className="detail-badge-row">
                <span className={`holiday-category-badge ${getTypeBadgeClass(selectedHolidayDetail.type)}`}>
                  {selectedHolidayDetail.type}
                </span>
                <span className="detail-day-pill">
                  {selectedHolidayDetail.day || 'Confirmed Date'}
                </span>
                {(() => {
                  const count = getCountdownText(selectedHolidayDetail.date);
                  return (
                    count && (
                      <span className={`countdown-pill countdown-${count.status}`}>
                        <Clock size={13} /> {count.label}
                      </span>
                    )
                  );
                })()}
              </div>

              <div className="detail-desc-card">
                <h4>Significance & Description</h4>
                <p>
                  {selectedHolidayDetail.description ||
                    'Official public holiday recognized by government statute. Workplace operations and standard attendance logs are paused on this day.'}
                </p>
              </div>

              <div className="detail-facts-grid">
                <div className="fact-item">
                  <span className="fact-title">Calendar Date</span>
                  <span className="fact-value">{formatDateDisplay(selectedHolidayDetail.date)}</span>
                </div>
                <div className="fact-item">
                  <span className="fact-title">Day of Week</span>
                  <span className="fact-value">{selectedHolidayDetail.day || 'Official Day'}</span>
                </div>
                <div className="fact-item">
                  <span className="fact-title">Working Day Impact</span>
                  <span className="fact-value text-success">Excused / No Absence</span>
                </div>
                <div className="fact-item">
                  <span className="fact-title">Category</span>
                  <span className="fact-value">{selectedHolidayDetail.type}</span>
                </div>
              </div>
            </div>

            <footer className="detail-modal-footer">
              {isAdmin && (
                <div className="admin-detail-actions">
                  <button
                    type="button"
                    className="btn-outline-danger"
                    onClick={(e) => handleDelete(selectedHolidayDetail, e)}
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                  <button
                    type="button"
                    className="btn-outline-primary"
                    onClick={(e) => handleOpenEditModal(selectedHolidayDetail, e)}
                  >
                    <Edit2 size={14} /> Edit
                  </button>
                </div>
              )}
              <button
                type="button"
                className="btn-primary"
                onClick={() => setSelectedHolidayDetail(null)}
              >
                Close
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* 6. Add / Edit Holiday Modal (Admin Only) */}
      {showModal && (
        <div className="holiday-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="holiday-form-modal" onClick={(e) => e.stopPropagation()}>
            <header className="form-modal-header">
              <h2>{editingHoliday ? 'Edit Government Holiday' : 'Add New Government Holiday'}</h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowModal(false)}
              >
                <X size={18} />
              </button>
            </header>

            <form onSubmit={handleSubmit} className="form-modal-body">
              <div className="form-group">
                <label className="form-label">
                  Holiday Name <span className="required-star">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Republic Day, Diwali, Eid..."
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="form-input"
                />
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label">
                    Date (YYYY-MM-DD) <span className="required-star">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Category / Classification</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="form-select"
                  >
                    <option value="National Holiday">National Holiday</option>
                    <option value="Gazetted Holiday">Gazetted Holiday</option>
                    <option value="Public Holiday">Public Holiday</option>
                    <option value="Restricted Holiday">Restricted Holiday</option>
                    <option value="Company Holiday">Company Holiday</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Description / Historical Significance</label>
                <textarea
                  rows={3}
                  placeholder="Details about the celebration, tradition, or observance..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="form-textarea"
                />
              </div>

              <div className="form-checkbox-row">
                <label className="checkbox-container">
                  <input
                    type="checkbox"
                    checked={formData.isMandatory}
                    onChange={(e) => setFormData({ ...formData, isMandatory: e.target.checked })}
                  />
                  <span className="checkbox-label">
                    Mandatory Government Holiday (All departments and offices closed)
                  </span>
                </label>
              </div>

              <footer className="form-modal-footer">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary"
                >
                  {submitting ? 'Saving...' : editingHoliday ? 'Update Holiday' : 'Create Holiday'}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default HolidayCalendar;
