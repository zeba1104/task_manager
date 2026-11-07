import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  MessageSquare,
  Send,
  CheckCircle2,
  Clock,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
  Lock,
  Check,
  X,
  Calendar,
  Building2,
  Users,
  Search,
  Sparkles,
  Archive,
  RotateCcw,
} from 'lucide-react';
import {
  getHierarchyTarget,
  getChatSessions,
  requestChat,
  approveChatSession,
  rejectChatSession,
  closeChatSession,
  reRequestChatSession,
  reopenChatSession,
  getSessionMessages,
  sendMessage,
} from '../api/chatApi';
import Swal from '../utils/swalConfig';

function ChatPage({ user }) {
  const role = user?.role || 'Employee';

  // Common State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hierarchyData, setHierarchyData] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);

  // Manager specific mode: 'team' | 'admin'
  const [managerMode, setManagerMode] = useState('team');

  // Permission Request Modal state
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [requestForm, setRequestForm] = useState({
    subject: '',
    requestNote: '',
    recipientId: '',
  });
  const [submittingRequest, setSubmittingRequest] = useState(false);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Messages auto-scroll ref
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Load Hierarchy Target & Sessions
  const loadInitialData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const [targetRes, sessionsRes] = await Promise.all([
        getHierarchyTarget().catch(() => ({ data: null })),
        getChatSessions().catch(() => ({ data: [] })),
      ]);

      setHierarchyData(targetRes.data || null);
      const allSessions = sessionsRes.data || [];
      setSessions(allSessions);

      // Auto-select session if employee or if existing selection
      if (role === 'Employee') {
        // Find latest active or pending session
        const current = allSessions.find(
          (s) => s.type === 'EMPLOYEE_MANAGER' && s.status !== 'closed'
        ) || allSessions[0] || null;
        setSelectedSession(current);
      } else {
        setSelectedSession((prev) => {
          if (!prev) return null;
          return allSessions.find((s) => s._id === prev._id) || prev;
        });
      }
    } catch (err) {
      console.error('Failed to load chat data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [role]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Load messages for the selected session
  const loadMessages = useCallback(async (sessionId, silent = false) => {
    if (!sessionId) return;
    try {
      const res = await getSessionMessages(sessionId);
      setMessages(res.data.messages || []);
      if (res.data.session) {
        setSelectedSession(res.data.session);
      }
      if (!silent) {
        setTimeout(scrollToBottom, 100);
      }
    } catch (err) {
      console.error('Error fetching messages:', err);
    }
  }, []);

  useEffect(() => {
    if (selectedSession?._id) {
      loadMessages(selectedSession._id);
    } else {
      setMessages([]);
    }
  }, [selectedSession?._id, loadMessages]);

  // Auto-poll messages and sessions every 3.5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      // Background poll
      if (selectedSession?._id && selectedSession.status === 'approved') {
        loadMessages(selectedSession._id, true);
      }
      getChatSessions()
        .then((res) => {
          setSessions(res.data || []);
          if (selectedSession?._id) {
            const updated = (res.data || []).find((s) => s._id === selectedSession._id);
            if (updated && updated.status !== selectedSession.status) {
              setSelectedSession(updated);
            }
          }
        })
        .catch(() => {});
    }, 3500);

    return () => clearInterval(interval);
  }, [selectedSession, loadMessages]);

  // Send Message
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!messageText.trim() || !selectedSession?._id) return;

    if (selectedSession.status !== 'approved') {
      Swal.fire({
        title: 'Permission Required',
        text: 'This chat session is not approved yet. Messages cannot be sent until permission is approved.',
        icon: 'warning',
      });
      return;
    }

    const sendingText = messageText.trim();
    setMessageText('');
    setSending(true);

    try {
      const res = await sendMessage(selectedSession._id, sendingText);
      setMessages((prev) => [...prev, res.data]);
      setTimeout(scrollToBottom, 100);
      // Update session lastMessage locally
      setSelectedSession((prev) => ({
        ...prev,
        lastMessage: sendingText,
        lastMessageAt: new Date().toISOString(),
      }));
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Could not send message', 'error');
      setMessageText(sendingText); // restore
    } finally {
      setSending(false);
    }
  };

  // Submit Permission Request
  const handleRequestSubmit = async (e) => {
    e.preventDefault();
    if (!requestForm.subject.trim()) {
      Swal.fire('Subject Required', 'Please provide a subject or discussion topic.', 'warning');
      return;
    }

    setSubmittingRequest(true);
    try {
      const res = await requestChat(requestForm);
      Swal.fire({
        title: 'Request Submitted',
        text: res.data.message || 'Chat permission request submitted successfully.',
        icon: 'success',
        timer: 1600,
        showConfirmButton: false,
      });
      setIsRequestModalOpen(false);
      setRequestForm({ subject: '', requestNote: '', recipientId: '' });
      await loadInitialData(true);
      if (res.data.session) {
        setSelectedSession(res.data.session);
      }
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to submit request', 'error');
    } finally {
      setSubmittingRequest(false);
    }
  };

  // Approve Permission Request
  const handleApprove = async (sessionId) => {
    try {
      const res = await approveChatSession(sessionId);
      Swal.fire({
        title: 'Chat Approved',
        text: 'You can now chat directly in real-time.',
        icon: 'success',
        timer: 1400,
        showConfirmButton: false,
      });
      await loadInitialData(true);
      if (res.data.session) {
        setSelectedSession(res.data.session);
      }
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Could not approve request', 'error');
    }
  };

  // Reject Permission Request
  const handleReject = async (sessionId) => {
    const { value: reason } = await Swal.fire({
      title: 'Decline Chat Request',
      input: 'textarea',
      inputLabel: 'Reason for declining (optional)',
      inputPlaceholder: 'e.g., Please address this in our next scheduled 1:1 sync or raise a task ticket...',
      showCancelButton: true,
      confirmButtonText: 'Decline Request',
      confirmButtonColor: '#ef4444',
    });

    if (reason !== undefined) {
      try {
        await rejectChatSession(sessionId, reason);
        Swal.fire({
          title: 'Request Declined',
          text: 'The chat request has been declined.',
          icon: 'info',
          timer: 1400,
          showConfirmButton: false,
        });
        await loadInitialData(true);
      } catch (err) {
        Swal.fire('Error', err.response?.data?.message || 'Could not decline request', 'error');
      }
    }
  };

  // Close Active Session
  const handleCloseSession = async (sessionId) => {
    const result = await Swal.fire({
      title: 'Conclude Chat Session?',
      text: 'Closing this session marks the discussion as completed. A new permission request will be required to start a future session.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, Conclude Session',
      confirmButtonColor: '#6366f1',
    });

    if (result.isConfirmed) {
      try {
        await closeChatSession(sessionId);
        Swal.fire({
          title: 'Session Concluded',
          text: 'The chat session has been closed.',
          icon: 'success',
          timer: 1400,
          showConfirmButton: false,
        });
        await loadInitialData(true);
      } catch (err) {
        Swal.fire('Error', err.response?.data?.message || 'Could not close session', 'error');
      }
    }
  };

  // Re-Request to Resume / Continue an existing chat topic
  const handleReRequest = async (session) => {
    if (!session?._id) return;
    const { value: note } = await Swal.fire({
      title: 'Continue This Topic?',
      text: `Re-request permission from your manager to resume discussing "${session.subject}"?`,
      input: 'textarea',
      inputLabel: 'Reason or context for continuing (optional)',
      inputPlaceholder: 'e.g., Quick follow up question regarding our earlier discussion...',
      showCancelButton: true,
      confirmButtonText: 'Submit Re-Request',
      confirmButtonColor: '#2563eb',
    });

    if (note !== undefined) {
      try {
        const res = await reRequestChatSession(session._id, note);
        Swal.fire({
          title: 'Re-Request Sent',
          text: 'Your request to continue this conversation has been sent to your manager.',
          icon: 'success',
          timer: 1600,
          showConfirmButton: false,
        });
        await loadInitialData(true);
        if (res.data.session) {
          setSelectedSession(res.data.session);
        }
      } catch (err) {
        Swal.fire('Error', err.response?.data?.message || 'Could not re-request chat', 'error');
      }
    }
  };

  // Reopen / Resume chat directly (Manager or Admin)
  const handleReopen = async (session) => {
    if (!session?._id) return;
    try {
      const res = await reopenChatSession(session._id);
      Swal.fire({
        title: 'Conversation Resumed',
        text: 'The chat session has been unlocked. All previous messages are preserved.',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false,
      });
      await loadInitialData(true);
      if (res.data.session) {
        setSelectedSession(res.data.session);
      }
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Could not resume conversation', 'error');
    }
  };

  // =========================================================================
  // RENDER: EMPLOYEE SIDE
  // =========================================================================
  if (role === 'Employee') {
    const manager = hierarchyData?.targetManager;
    const activeSession = sessions.find(
      (s) => s.type === 'EMPLOYEE_MANAGER' && s.status === 'approved'
    );
    const pendingSession = sessions.find(
      (s) => s.type === 'EMPLOYEE_MANAGER' && s.status === 'pending'
    );
    const recentRejectedSession = sessions.find(
      (s) => s.type === 'EMPLOYEE_MANAGER' && s.status === 'rejected'
    );
    const closedSessions = sessions.filter(
      (s) => s.type === 'EMPLOYEE_MANAGER' && s.status === 'closed'
    );

    const currentDisplaySession = activeSession || pendingSession || recentRejectedSession || selectedSession;

    return (
      <div className="chat-feature-page employee-chat-view">
        {/* Header */}
        <div className="chat-feature-header">
          <div className="chat-header-info">
            <div className="chat-title-icon-box">
              <MessageSquare size={22} />
            </div>
            <div>
              <h2 className="chat-main-title">Direct Messages with Reporting Manager</h2>
              <p className="chat-subtitle">
                Hierarchical communication channel. Request permission from your reporting manager to start an interactive chat session.
              </p>
            </div>
          </div>
          <div className="chat-header-actions">
            <button
              type="button"
              className="btn-secondary btn-small attendance-refresh-btn"
              onClick={() => loadInitialData(true)}
              disabled={loading || refreshing}
              title="Refresh conversation"
            >
              <RefreshCw size={13} className={refreshing ? 'spinning' : ''} />
              <span>{refreshing ? 'Syncing...' : 'Refresh'}</span>
            </button>
          </div>
        </div>

        {/* Assigned Manager Identity Card */}
        <div className="chat-manager-profile-card">
          <div className="manager-profile-left">
            <div className="manager-chat-avatar">
              {manager?.profilePicture ? (
                <img src={manager.profilePicture} alt={manager.name} />
              ) : (
                <span>{(manager?.name || 'M')[0].toUpperCase()}</span>
              )}
              <span className="online-indicator-dot" />
            </div>
            <div className="manager-chat-info">
              <div className="manager-title-row">
                <h3>{manager?.name || 'Assigned Reporting Manager'}</h3>
                <span className="reporting-badge">
                  <ShieldCheck size={13} /> Reporting Authority
                </span>
              </div>
              <p className="manager-meta-line">
                <span>{manager?.designation || 'Manager'}</span> ·{' '}
                <span>Department: {manager?.department || user?.department || 'General'}</span> ·{' '}
                <span>{manager?.email || 'N/A'}</span>
              </p>
            </div>
          </div>

          <div className="manager-profile-right">
            {!activeSession && !pendingSession && (
              <button
                type="button"
                className="btn-primary btn-request-chat"
                onClick={() => {
                  setRequestForm({
                    subject: '',
                    requestNote: '',
                    recipientId: manager?._id || '',
                  });
                  setIsRequestModalOpen(true);
                }}
              >
                <Sparkles size={15} />
                <span>Request Permission to Chat</span>
              </button>
            )}

            {pendingSession && (
              <div className="permission-pending-chip">
                <Clock size={15} className="text-amber" />
                <span>Permission Request Pending</span>
              </div>
            )}

            {activeSession && (
              <button
                type="button"
                className="btn-secondary btn-small btn-conclude-chat"
                onClick={() => handleCloseSession(activeSession._id)}
              >
                <CheckCircle2 size={14} className="text-emerald" />
                <span>End Active Session</span>
              </button>
            )}
          </div>
        </div>

        {/* Main Conversation Box */}
        <div className="chat-conversation-wrapper">
          {/* STATE 1: PENDING PERMISSION */}
          {pendingSession && !activeSession && (
            <div className="chat-permission-notice notice-pending">
              <div className="notice-icon-box amber">
                <Clock size={28} />
              </div>
              <div className="notice-body">
                <h4>Permission Request Sent to {manager?.name || 'Your Manager'}</h4>
                <p>
                  Your request to discuss <strong>"{pendingSession.subject}"</strong> was submitted on{' '}
                  {new Date(pendingSession.createdAt).toLocaleString()}. As soon as your manager reviews and approves this request, the chat room will unlock automatically.
                </p>
                {pendingSession.requestNote && (
                  <div className="notice-note-box">
                    <span>Note submitted:</span> "{pendingSession.requestNote}"
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STATE 2: REJECTED PERMISSION */}
          {recentRejectedSession && !activeSession && !pendingSession && (
            <div className="chat-permission-notice notice-rejected">
              <div className="notice-icon-box red">
                <AlertCircle size={28} />
              </div>
              <div className="notice-body">
                <h4>Permission Request Was Declined</h4>
                <p>
                  Your recent request for <strong>"{recentRejectedSession.subject}"</strong> was declined by your manager.
                </p>
                {recentRejectedSession.rejectionReason && (
                  <div className="notice-note-box rejected-note">
                    <span>Manager feedback:</span> "{recentRejectedSession.rejectionReason}"
                  </div>
                )}
                <button
                  type="button"
                  className="btn-secondary btn-small"
                  style={{ marginTop: '10px' }}
                  onClick={() => {
                    setRequestForm({
                      subject: '',
                      requestNote: '',
                      recipientId: manager?._id || '',
                    });
                    setIsRequestModalOpen(true);
                  }}
                >
                  <Sparkles size={13} />
                  <span>Submit New Request</span>
                </button>
              </div>
            </div>
          )}

          {/* STATE 3: NO SESSION & NO PENDING */}
          {!activeSession && !pendingSession && !recentRejectedSession && (
            <div className="chat-permission-notice notice-initial">
              <div className="notice-icon-box blue">
                <Lock size={28} />
              </div>
              <div className="notice-body">
                <h4>Hierarchical Permission Required</h4>
                <p>
                  To chat directly with your Reporting Manager, organization policy requires submitting a discussion topic for approval.
                  Once approved, you and your manager can chat back and forth in real-time.
                </p>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ marginTop: '10px' }}
                  onClick={() => {
                    setRequestForm({
                      subject: '',
                      requestNote: '',
                      recipientId: manager?._id || '',
                    });
                    setIsRequestModalOpen(true);
                  }}
                >
                  <Sparkles size={14} />
                  <span>Request Permission to Chat</span>
                </button>
              </div>
            </div>
          )}

          {/* STATE 4: APPROVED ACTIVE CHAT (OR VIEWING A SESSION) */}
          {currentDisplaySession && (
            <div className="chat-active-window">
              {/* Chat Session Status Bar */}
              <div className="chat-session-status-bar">
                <div className="status-bar-left">
                  <span className={`status-pill ${currentDisplaySession.status}`}>
                    {currentDisplaySession.status === 'approved' ? '● Session Active (Approved)' :
                     currentDisplaySession.status === 'pending' ? '⏳ Pending Approval' :
                     currentDisplaySession.status === 'rejected' ? '✕ Request Declined' : 'Concluded'}
                  </span>
                  <strong className="chat-topic-text">Topic: {currentDisplaySession.subject}</strong>
                </div>
                <div className="status-bar-right">
                  <span className="session-date-text">
                    <Calendar size={12} /> {new Date(currentDisplaySession.createdAt).toLocaleDateString()}
                  </span>
                  {currentDisplaySession.status === 'closed' && (
                    <button
                      type="button"
                      className="btn-primary btn-small btn-rerequest-pill"
                      onClick={() => handleReRequest(currentDisplaySession)}
                      title="Continue talking about this topic"
                    >
                      <RotateCcw size={12} />
                      <span>Re-Request Topic</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Messages Stream */}
              <div className="chat-messages-container">
                {messages.length === 0 ? (
                  <div className="chat-empty-thread">
                    <MessageSquare size={36} className="text-muted" />
                    <p>No messages yet in this session.</p>
                    {currentDisplaySession.status === 'approved' && (
                      <small>Say hello to your manager to begin the discussion!</small>
                    )}
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMe = String(msg.sender?._id || msg.sender) === String(user.id);
                    return (
                      <div
                        key={msg._id}
                        className={`chat-bubble-row ${isMe ? 'bubble-outgoing' : 'bubble-incoming'}`}
                      >
                        {!isMe && (
                          <div className="bubble-avatar">
                            {manager?.profilePicture ? (
                              <img src={manager.profilePicture} alt="Manager" />
                            ) : (
                              <span>{(msg.senderName || 'M')[0].toUpperCase()}</span>
                            )}
                          </div>
                        )}
                        <div className="bubble-content-wrap">
                          <div className="bubble-meta">
                            <strong>{isMe ? 'You' : msg.senderName || 'Manager'}</strong>
                            <span className="bubble-time">
                              {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className="bubble-text">{msg.message}</div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Composer Bar */}
              {currentDisplaySession.status === 'approved' ? (
                <form className="chat-composer-bar" onSubmit={handleSendMessage}>
                  <input
                    type="text"
                    placeholder={`Type your reply to ${manager?.name || 'manager'}... (Enter to send)`}
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    disabled={sending}
                  />
                  <button
                    type="submit"
                    className="btn-primary btn-chat-send"
                    disabled={sending || !messageText.trim()}
                  >
                    <Send size={15} />
                    <span>Send</span>
                  </button>
                </form>
              ) : (
                <div className="chat-composer-locked flex-col-wrap">
                  <div className="locked-info-line">
                    <Lock size={15} className="text-muted" />
                    <span>
                      {currentDisplaySession.status === 'pending'
                        ? 'Waiting for manager approval...'
                        : currentDisplaySession.status === 'rejected'
                        ? 'This request was declined.'
                        : 'This conversation session has concluded.'}
                    </span>
                  </div>
                  {currentDisplaySession.status === 'closed' && (
                    <button
                      type="button"
                      className="btn-primary btn-small btn-rerequest-chat"
                      onClick={() => handleReRequest(currentDisplaySession)}
                    >
                      <RotateCcw size={14} />
                      <span>Re-Request to Continue This Topic</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Past Sessions Accordion / History */}
          {closedSessions.length > 0 && (
            <div className="chat-history-section">
              <div className="history-header">
                <Archive size={15} />
                <h4>Concluded Conversations Archive ({closedSessions.length})</h4>
              </div>
              <div className="history-list">
                {closedSessions.map((s) => (
                  <div
                    key={s._id}
                    className={`history-card ${selectedSession?._id === s._id ? 'selected' : ''}`}
                    onClick={() => setSelectedSession(s)}
                  >
                    <div>
                      <strong>{s.subject}</strong>
                      <p>{s.lastMessage || 'Concluded discussion.'}</p>
                    </div>
                    <div className="history-right-col">
                      <span className="history-time">
                        {new Date(s.closedAt || s.updatedAt).toLocaleDateString()}
                      </span>
                      <button
                        type="button"
                        className="btn-ghost btn-xs btn-history-resume"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSession(s);
                          handleReRequest(s);
                        }}
                        title="Continue this topic"
                      >
                        <RotateCcw size={11} />
                        <span>Continue</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal: Request Permission to Chat */}
        {isRequestModalOpen && (
          <div
            className="admin-modal-backdrop"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setIsRequestModalOpen(false);
            }}
          >
            <section className="admin-action-modal chat-request-modal" role="dialog" aria-modal="true">
              <header>
                <h2>Request Chat Permission</h2>
                <button className="icon-btn" onClick={() => setIsRequestModalOpen(false)}>
                  <X size={18} />
                </button>
              </header>
              <form onSubmit={handleRequestSubmit}>
                <div className="modal-context-badge">
                  <ShieldCheck size={14} className="text-blue" />
                  <span>Routing to Reporting Manager: <b>{manager?.name || 'Assigned Manager'}</b></span>
                </div>

                <label>
                  Discussion Topic / Subject <span className="text-red">*</span>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Task roadblock, Project timeline sync, Shift inquiry..."
                    value={requestForm.subject}
                    onChange={(e) => setRequestForm({ ...requestForm, subject: e.target.value })}
                  />
                </label>

                <label>
                  Additional Context / Initial Note (Optional)
                  <textarea
                    rows={3}
                    placeholder="Briefly state why you'd like to talk so your manager can review..."
                    value={requestForm.requestNote}
                    onChange={(e) => setRequestForm({ ...requestForm, requestNote: e.target.value })}
                  />
                </label>

                <footer>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => setIsRequestModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={submittingRequest}
                  >
                    {submittingRequest ? 'Submitting...' : 'Send Permission Request'}
                  </button>
                </footer>
              </form>
            </section>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // RENDER: MANAGER SIDE (Dual: Team Member Reportees + Admin Communication)
  // =========================================================================
  if (role === 'Manager') {
    const adminContact = hierarchyData?.targetAdmin;

    // Filter sessions
    const teamSessions = sessions.filter((s) => s.type === 'EMPLOYEE_MANAGER');
    const adminSessions = sessions.filter((s) => s.type === 'MANAGER_ADMIN');

    // Pending requests from reportees
    const pendingTeamRequests = teamSessions.filter((s) => s.status === 'pending');
    const activeTeamSessions = teamSessions.filter((s) => s.status === 'approved');
    const closedTeamSessions = teamSessions.filter((s) => s.status === 'closed');

    // Admin communication status for Manager
    const activeAdminSession = adminSessions.find((s) => s.status === 'approved');
    const pendingAdminSession = adminSessions.find((s) => s.status === 'pending');
    const rejectedAdminSession = adminSessions.find((s) => s.status === 'rejected');
    const closedAdminSessions = adminSessions.filter((s) => s.status === 'closed');
    const currentAdminSession =
      managerMode === 'admin' && selectedSession?.type === 'MANAGER_ADMIN'
        ? selectedSession
        : (activeAdminSession || pendingAdminSession || closedAdminSessions[0] || null);

    return (
      <div className="chat-feature-page manager-chat-view">
        {/* Header */}
        <div className="chat-feature-header">
          <div className="chat-header-info">
            <div className="chat-title-icon-box">
              <MessageSquare size={22} />
            </div>
            <div>
              <h2 className="chat-main-title">Manager Direct Communications</h2>
              <p className="chat-subtitle">
                Review and approve chat permission requests from your team members, and communicate with Executive Administration.
              </p>
            </div>
          </div>
          <div className="chat-header-actions">
            <button
              type="button"
              className="btn-secondary btn-small attendance-refresh-btn"
              onClick={() => loadInitialData(true)}
              disabled={loading || refreshing}
              title="Refresh messages and requests"
            >
              <RefreshCw size={13} className={refreshing ? 'spinning' : ''} />
              <span>{refreshing ? 'Syncing...' : 'Refresh'}</span>
            </button>
          </div>
        </div>

        {/* Manager Navigation Mode Pills: Team Communication vs Admin Communication */}
        <div className="manager-chat-tabs">
          <button
            type="button"
            className={`chat-tab-btn ${managerMode === 'team' ? 'active' : ''}`}
            onClick={() => {
              setManagerMode('team');
              setSelectedSession(activeTeamSessions[0] || pendingTeamRequests[0] || null);
            }}
          >
            <Users size={16} />
            <span>Team Member Communications</span>
            {pendingTeamRequests.length > 0 && (
              <span className="pending-counter-pill">{pendingTeamRequests.length} Pending</span>
            )}
          </button>
          <button
            type="button"
            className={`chat-tab-btn ${managerMode === 'admin' ? 'active' : ''}`}
            onClick={() => {
              setManagerMode('admin');
              setSelectedSession(activeAdminSession || pendingAdminSession || adminSessions[0] || null);
            }}
          >
            <Building2 size={16} />
            <span>Admin Communication</span>
            {pendingAdminSession && <span className="pending-counter-pill">Waiting</span>}
          </button>
        </div>

        {/* MODE A: TEAM MEMBER COMMUNICATIONS (EMPLOYEE <-> MANAGER) */}
        {managerMode === 'team' && (
          <div className="chat-master-detail-grid">
            {/* Left Panel: Requests & Active Team Sessions */}
            <div className="chat-sidebar-column">
              {/* Search */}
              <div className="chat-search-wrap">
                <Search size={14} className="text-muted" />
                <input
                  type="text"
                  placeholder="Filter team members or topics..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Pending Requests List */}
              <div className="sidebar-group">
                <div className="sidebar-group-title">
                  <span>Pending Permission Requests</span>
                  <span className="group-count">{pendingTeamRequests.length}</span>
                </div>

                {pendingTeamRequests.length === 0 ? (
                  <p className="sidebar-empty-hint">No pending requests from team members.</p>
                ) : (
                  pendingTeamRequests.map((req) => {
                    const isResume = Boolean(req.closedAt || req.requestNote?.toLowerCase().includes('re-request'));
                    return (
                      <div
                        key={req._id}
                        className={`chat-request-item ${selectedSession?._id === req._id ? 'selected' : ''}`}
                        onClick={() => setSelectedSession(req)}
                      >
                        <div className="request-item-top">
                          <div className="request-sender">
                            <strong>{req.initiator?.name || 'Employee'}</strong>
                            <span className="dept-tag">{req.initiator?.department || 'Team'}</span>
                            {isResume && (
                              <span className="resume-tag">
                                <RotateCcw size={10} /> Resumed Topic
                              </span>
                            )}
                          </div>
                          <span className="request-time">
                            {new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="request-topic">
                          <b>Topic:</b> {req.subject}
                        </div>
                        {req.requestNote && (
                          <p className="request-snippet">"{req.requestNote}"</p>
                        )}
                        <div className="request-action-row" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="btn-approve-chat"
                            onClick={() => handleApprove(req._id)}
                          >
                            <Check size={13} />
                            <span>{isResume ? 'Approve & Resume' : 'Approve'}</span>
                          </button>
                          <button
                            type="button"
                            className="btn-reject-chat"
                            onClick={() => handleReject(req._id)}
                          >
                            <X size={13} />
                            <span>Decline</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Active Sessions List */}
              <div className="sidebar-group">
                <div className="sidebar-group-title">
                  <span>Active Approved Chats</span>
                  <span className="group-count">{activeTeamSessions.length}</span>
                </div>

                {activeTeamSessions.length === 0 ? (
                  <p className="sidebar-empty-hint">No active ongoing chat sessions.</p>
                ) : (
                  activeTeamSessions.map((session) => (
                    <div
                      key={session._id}
                      className={`chat-session-item ${selectedSession?._id === session._id ? 'selected' : ''}`}
                      onClick={() => setSelectedSession(session)}
                    >
                      <div className="session-item-avatar">
                        {session.initiator?.profilePicture ? (
                          <img src={session.initiator.profilePicture} alt="User" />
                        ) : (
                          <span>{(session.initiator?.name || 'E')[0].toUpperCase()}</span>
                        )}
                        <span className="active-green-dot" />
                      </div>
                      <div className="session-item-body">
                        <div className="session-item-top">
                          <strong>{session.initiator?.name || 'Employee'}</strong>
                          <span className="session-time">
                            {new Date(session.lastMessageAt || session.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="session-item-snippet">
                          {session.lastMessage || session.subject || 'Session started'}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Concluded / Closed */}
              {closedTeamSessions.length > 0 && (
                <div className="sidebar-group">
                  <div className="sidebar-group-title">
                    <span>Closed Conversations</span>
                    <span className="group-count">{closedTeamSessions.length}</span>
                  </div>
                  {closedTeamSessions.map((s) => (
                    <div
                      key={s._id}
                      className={`chat-session-item closed ${selectedSession?._id === s._id ? 'selected' : ''}`}
                      onClick={() => setSelectedSession(s)}
                    >
                      <div className="session-item-body">
                        <strong>{s.initiator?.name || 'Employee'}</strong>
                        <p className="session-item-snippet">{s.subject}</p>
                      </div>
                      <div className="session-item-right-actions" onClick={(e) => e.stopPropagation()}>
                        <span className="status-closed-badge">Closed</span>
                        <button
                          type="button"
                          className="btn-history-resume"
                          onClick={() => handleReopen(s)}
                          title="Resume conversation directly"
                        >
                          <RotateCcw size={11} />
                          <span>Resume</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right Panel: Selected Chat Room */}
            <div className="chat-main-window">
              {selectedSession ? (
                <>
                  <div className="chat-window-header">
                    <div className="window-header-left">
                      <div className="header-avatar">
                        {selectedSession.initiator?.profilePicture ? (
                          <img src={selectedSession.initiator.profilePicture} alt="User" />
                        ) : (
                          <span>{(selectedSession.initiator?.name || 'E')[0].toUpperCase()}</span>
                        )}
                      </div>
                      <div>
                        <h3>{selectedSession.initiator?.name || 'Team Member'}</h3>
                        <p>
                          <span>{selectedSession.initiator?.designation || 'Employee'}</span> ·{' '}
                          <span>Dept: {selectedSession.initiator?.department || 'General'}</span> ·{' '}
                          <span className={`status-badge ${selectedSession.status}`}>
                            {selectedSession.status === 'approved' ? 'Active Approved' :
                             selectedSession.status === 'pending' ? 'Pending Approval' : selectedSession.status}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="window-header-actions">
                      {selectedSession.status === 'pending' && (
                        <>
                          <button
                            type="button"
                            className="btn-approve-chat"
                            onClick={() => handleApprove(selectedSession._id)}
                          >
                            <Check size={14} />
                            <span>
                              {(selectedSession.closedAt || selectedSession.requestNote?.toLowerCase().includes('re-request'))
                                ? 'Approve & Resume'
                                : 'Approve Chat'}
                            </span>
                          </button>
                          <button
                            type="button"
                            className="btn-reject-chat"
                            onClick={() => handleReject(selectedSession._id)}
                          >
                            <X size={14} />
                            <span>Decline</span>
                          </button>
                        </>
                      )}
                      {selectedSession.status === 'approved' && (
                        <button
                          type="button"
                          className="btn-secondary btn-small"
                          onClick={() => handleCloseSession(selectedSession._id)}
                        >
                          <CheckCircle2 size={14} className="text-emerald" />
                          <span>Conclude Session</span>
                        </button>
                      )}
                      {selectedSession.status === 'closed' && (
                        <button
                          type="button"
                          className="btn-primary btn-small btn-resume-chat"
                          onClick={() => handleReopen(selectedSession)}
                          title="Resume this conversation with employee"
                        >
                          <RotateCcw size={14} />
                          <span>Resume Conversation</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="chat-session-meta-banner">
                    <strong>Discussion Topic: {selectedSession.subject}</strong>
                    {selectedSession.requestNote && (
                      <span>Context: "{selectedSession.requestNote}"</span>
                    )}
                  </div>

                  {/* Messages */}
                  <div className="chat-messages-container">
                    {messages.length === 0 ? (
                      <div className="chat-empty-thread">
                        <MessageSquare size={36} className="text-muted" />
                        <p>No messages exchanged in this session yet.</p>
                        {selectedSession.status === 'approved' && (
                          <small>Send a greeting to begin the discussion!</small>
                        )}
                      </div>
                    ) : (
                      messages.map((msg) => {
                        const isMe = String(msg.sender?._id || msg.sender) === String(user.id);
                        return (
                          <div
                            key={msg._id}
                            className={`chat-bubble-row ${isMe ? 'bubble-outgoing' : 'bubble-incoming'}`}
                          >
                            {!isMe && (
                              <div className="bubble-avatar">
                                <span>{(msg.senderName || 'E')[0].toUpperCase()}</span>
                              </div>
                            )}
                            <div className="bubble-content-wrap">
                              <div className="bubble-meta">
                                <strong>{isMe ? 'You (Manager)' : msg.senderName || 'Employee'}</strong>
                                <span className="bubble-time">
                                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <div className="bubble-text">{msg.message}</div>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Composer */}
                  {selectedSession.status === 'approved' ? (
                    <form className="chat-composer-bar" onSubmit={handleSendMessage}>
                      <input
                        type="text"
                        placeholder="Reply to team member... (Enter to send)"
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        disabled={sending}
                      />
                      <button
                        type="submit"
                        className="btn-primary btn-chat-send"
                        disabled={sending || !messageText.trim()}
                      >
                        <Send size={15} />
                        <span>Send</span>
                      </button>
                    </form>
                  ) : selectedSession.status === 'closed' ? (
                    <div className="chat-composer-locked flex-col-wrap">
                      <div className="locked-info-line">
                        <Lock size={15} className="text-muted" />
                        <span>This conversation is concluded. Click below to resume and continue this conversation thread.</span>
                      </div>
                      <button
                        type="button"
                        className="btn-primary btn-small btn-resume-chat"
                        onClick={() => handleReopen(selectedSession)}
                      >
                        <RotateCcw size={14} />
                        <span>Resume &amp; Continue Conversation</span>
                      </button>
                    </div>
                  ) : selectedSession.status === 'pending' ? (
                    <div className="chat-composer-locked flex-col-wrap">
                      <div className="locked-info-line">
                        <Lock size={15} className="text-muted" />
                        <span>
                          {(selectedSession.closedAt || selectedSession.requestNote?.toLowerCase().includes('re-request'))
                            ? 'Employee requested to resume this conversation topic.'
                            : 'This chat request is awaiting your permission approval.'}
                        </span>
                      </div>
                      <div className="composer-pending-actions">
                        <button
                          type="button"
                          className="btn-approve-chat"
                          onClick={() => handleApprove(selectedSession._id)}
                        >
                          <Check size={14} />
                          <span>{(selectedSession.closedAt || selectedSession.requestNote?.toLowerCase().includes('re-request')) ? 'Approve & Resume' : 'Approve Chat'}</span>
                        </button>
                        <button
                          type="button"
                          className="btn-reject-chat"
                          onClick={() => handleReject(selectedSession._id)}
                        >
                          <X size={14} />
                          <span>Decline</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="chat-composer-locked">
                      <Lock size={15} className="text-muted" />
                      <span>This conversation has been concluded.</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="chat-no-selection">
                  <MessageSquare size={44} className="text-muted" />
                  <h4>Select a Conversation</h4>
                  <p>Choose a pending request or active chat from the left panel to review and communicate.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* MODE B: MANAGER <-> ADMIN COMMUNICATIONS */}
        {managerMode === 'admin' && (
          <div className="manager-admin-chat-view">
            {/* Admin Contact Card */}
            <div className="chat-manager-profile-card">
              <div className="manager-profile-left">
                <div className="manager-chat-avatar admin-avatar">
                  <span>{(adminContact?.name || 'A')[0].toUpperCase()}</span>
                  <span className="online-indicator-dot" />
                </div>
                <div className="manager-chat-info">
                  <div className="manager-title-row">
                    <h3>{adminContact?.name || 'Executive Administration'}</h3>
                    <span className="reporting-badge admin-badge">
                      <ShieldCheck size={13} /> Organization Admin
                    </span>
                  </div>
                  <p className="manager-meta-line">
                    <span>Direct Admin Support</span> ·{' '}
                    <span>{adminContact?.email || 'admin@taskflow.com'}</span>
                  </p>
                </div>
              </div>

              <div className="manager-profile-right">
                {!activeAdminSession && !pendingAdminSession && (
                  <button
                    type="button"
                    className="btn-primary btn-request-chat"
                    onClick={() => {
                      setRequestForm({
                        subject: '',
                        requestNote: '',
                        recipientId: adminContact?._id || '',
                      });
                      setIsRequestModalOpen(true);
                    }}
                  >
                    <Sparkles size={15} />
                    <span>Request Permission to Chat with Admin</span>
                  </button>
                )}

                {pendingAdminSession && (
                  <div className="permission-pending-chip">
                    <Clock size={15} className="text-amber" />
                    <span>Waiting for Admin Approval</span>
                  </div>
                )}

                {activeAdminSession && (
                  <button
                    type="button"
                    className="btn-secondary btn-small"
                    onClick={() => handleCloseSession(activeAdminSession._id)}
                  >
                    <CheckCircle2 size={14} className="text-emerald" />
                    <span>End Admin Session</span>
                  </button>
                )}
              </div>
            </div>

            {/* Conversation Window */}
            <div className="chat-conversation-wrapper">
              {pendingAdminSession && !activeAdminSession && (!currentAdminSession || currentAdminSession._id === pendingAdminSession._id) && (
                <div className="chat-permission-notice notice-pending">
                  <div className="notice-icon-box amber">
                    <Clock size={28} />
                  </div>
                  <div className="notice-body">
                    <h4>Admin Permission Request Pending</h4>
                    <p>
                      Your request to discuss <strong>"{pendingAdminSession.subject}"</strong> has been sent to Executive Administration.
                      The conversation window will activate as soon as an Admin approves your request.
                    </p>
                  </div>
                </div>
              )}

              {rejectedAdminSession && !activeAdminSession && !pendingAdminSession && (!currentAdminSession || currentAdminSession._id === rejectedAdminSession._id) && (
                <div className="chat-permission-notice notice-rejected">
                  <div className="notice-icon-box red">
                    <AlertCircle size={28} />
                  </div>
                  <div className="notice-body">
                    <h4>Admin Declined Chat Request</h4>
                    <p>"{rejectedAdminSession.rejectionReason || 'Declined at this time.'}"</p>
                    <button
                      type="button"
                      className="btn-secondary btn-small"
                      onClick={() => {
                        setRequestForm({
                          subject: '',
                          requestNote: '',
                          recipientId: adminContact?._id || '',
                        });
                        setIsRequestModalOpen(true);
                      }}
                    >
                      Submit New Request
                    </button>
                  </div>
                </div>
              )}

              {!activeAdminSession && !pendingAdminSession && !rejectedAdminSession && !currentAdminSession && (
                <div className="chat-permission-notice notice-initial">
                  <div className="notice-icon-box blue">
                    <Lock size={28} />
                  </div>
                  <div className="notice-body">
                    <h4>Executive Administration Permission Required</h4>
                    <p>
                      Manager communication with Executive Administration requires submitting a chat permission request.
                    </p>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => {
                        setRequestForm({
                          subject: '',
                          requestNote: '',
                          recipientId: adminContact?._id || '',
                        });
                        setIsRequestModalOpen(true);
                      }}
                    >
                      Request Permission to Chat with Admin
                    </button>
                  </div>
                </div>
              )}

              {/* Chat Thread */}
              {currentAdminSession && (
                <div className="chat-active-window">
                  <div className="chat-session-status-bar">
                    <div className="status-bar-left">
                      <span className={`status-pill ${currentAdminSession.status}`}>
                        {currentAdminSession.status === 'approved' ? '● Admin Session Active' :
                         currentAdminSession.status === 'pending' ? '⏳ Pending Approval' : 'Concluded'}
                      </span>
                      <strong>Topic: {currentAdminSession.subject}</strong>
                    </div>
                    <div className="status-bar-right">
                      {currentAdminSession.status === 'closed' && (
                        <button
                          type="button"
                          className="btn-primary btn-small btn-rerequest-pill"
                          onClick={() => handleReRequest(currentAdminSession)}
                          title="Continue talking about this topic with Admin"
                        >
                          <RotateCcw size={12} />
                          <span>Re-Request Topic</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="chat-messages-container">
                    {messages.length === 0 ? (
                      <div className="chat-empty-thread">
                        <MessageSquare size={36} className="text-muted" />
                        <p>No messages yet. Send a message to start communicating with Admin.</p>
                      </div>
                    ) : (
                      messages.map((msg) => {
                        const isMe = String(msg.sender?._id || msg.sender) === String(user.id);
                        return (
                          <div
                            key={msg._id}
                            className={`chat-bubble-row ${isMe ? 'bubble-outgoing' : 'bubble-incoming'}`}
                          >
                            <div className="bubble-content-wrap">
                              <div className="bubble-meta">
                                <strong>{isMe ? 'You (Manager)' : 'Executive Admin'}</strong>
                                <span className="bubble-time">
                                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <div className="bubble-text">{msg.message}</div>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {currentAdminSession.status === 'approved' ? (
                    <form className="chat-composer-bar" onSubmit={handleSendMessage}>
                      <input
                        type="text"
                        placeholder="Type message to Admin..."
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        disabled={sending}
                      />
                      <button
                        type="submit"
                        className="btn-primary btn-chat-send"
                        disabled={sending || !messageText.trim()}
                      >
                        <Send size={15} />
                        <span>Send</span>
                      </button>
                    </form>
                  ) : currentAdminSession.status === 'closed' ? (
                    <div className="chat-composer-locked flex-col-wrap">
                      <div className="locked-info-line">
                        <Lock size={15} className="text-muted" />
                        <span>This conversation with Executive Administration has concluded. You can re-request this chat anytime to continue discussing this topic.</span>
                      </div>
                      <button
                        type="button"
                        className="btn-primary btn-small btn-rerequest-chat"
                        onClick={() => handleReRequest(currentAdminSession)}
                      >
                        <RotateCcw size={14} />
                        <span>Re-Request to Continue This Topic</span>
                      </button>
                    </div>
                  ) : (
                    <div className="chat-composer-locked">
                      <Lock size={15} />
                      <span>Messaging locked. Waiting for Admin approval.</span>
                    </div>
                  )}
                </div>
              )}

              {/* Archive of Concluded Admin Discussions */}
              {closedAdminSessions.length > 0 && (
                <div className="chat-history-section">
                  <div className="history-header">
                    <Archive size={15} />
                    <h4>Concluded Admin Conversations Archive ({closedAdminSessions.length})</h4>
                  </div>
                  <div className="history-list">
                    {closedAdminSessions.map((s) => (
                      <div
                        key={s._id}
                        className={`history-card ${currentAdminSession?._id === s._id ? 'selected' : ''}`}
                        onClick={() => setSelectedSession(s)}
                      >
                        <div>
                          <strong>{s.subject}</strong>
                          <p>{s.lastMessage || 'Concluded executive topic.'}</p>
                        </div>
                        <div className="history-right-col">
                          <span className="history-time">
                            {new Date(s.closedAt || s.updatedAt).toLocaleDateString()}
                          </span>
                          <button
                            type="button"
                            className="btn-ghost btn-xs btn-history-resume"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSession(s);
                              handleReRequest(s);
                            }}
                            title="Continue this topic with Admin"
                          >
                            <RotateCcw size={11} />
                            <span>Continue</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal: Request Permission to Chat with Admin */}
        {isRequestModalOpen && (
          <div
            className="admin-modal-backdrop"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setIsRequestModalOpen(false);
            }}
          >
            <section className="admin-action-modal chat-request-modal" role="dialog" aria-modal="true">
              <header>
                <h2>Request Permission to Chat with Admin</h2>
                <button className="icon-btn" onClick={() => setIsRequestModalOpen(false)}>
                  <X size={18} />
                </button>
              </header>
              <form onSubmit={handleRequestSubmit}>
                <div className="modal-context-badge">
                  <ShieldCheck size={14} className="text-blue" />
                  <span>Routing to Executive Administration</span>
                </div>

                <label>
                  Discussion Topic / Purpose <span className="text-red">*</span>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Department budget sync, Policy escalation, New hire approval..."
                    value={requestForm.subject}
                    onChange={(e) => setRequestForm({ ...requestForm, subject: e.target.value })}
                  />
                </label>

                <label>
                  Context / Notes (Optional)
                  <textarea
                    rows={3}
                    placeholder="Details for the Admin to review..."
                    value={requestForm.requestNote}
                    onChange={(e) => setRequestForm({ ...requestForm, requestNote: e.target.value })}
                  />
                </label>

                <footer>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => setIsRequestModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={submittingRequest}
                  >
                    {submittingRequest ? 'Submitting...' : 'Send Request to Admin'}
                  </button>
                </footer>
              </form>
            </section>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // RENDER: ADMIN SIDE (Reviewing Manager Chat Requests & Active Discussions)
  // =========================================================================
  const managerChatSessions = sessions.filter((s) => s.type === 'MANAGER_ADMIN');
  const pendingAdminRequests = managerChatSessions.filter((s) => s.status === 'pending');
  const activeAdminSessions = managerChatSessions.filter((s) => s.status === 'approved');
  const closedAdminSessions = managerChatSessions.filter((s) => s.status === 'closed');

  return (
    <div className="chat-feature-page admin-chat-view">
      {/* Header */}
      <div className="chat-feature-header">
        <div className="chat-header-info">
          <div className="chat-title-icon-box">
            <MessageSquare size={22} />
          </div>
          <div>
            <h2 className="chat-main-title">Executive Communication &amp; Chat Governance</h2>
            <p className="chat-subtitle">
              Review and approve incoming chat permission requests from Managers and communicate in real-time.
            </p>
          </div>
        </div>
        <div className="chat-header-actions">
          <button
            type="button"
            className="btn-secondary btn-small attendance-refresh-btn"
            onClick={() => loadInitialData(true)}
            disabled={loading || refreshing}
            title="Refresh conversations"
          >
            <RefreshCw size={13} className={refreshing ? 'spinning' : ''} />
            <span>{refreshing ? 'Syncing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      <div className="chat-master-detail-grid">
        {/* Left Sidebar */}
        <div className="chat-sidebar-column">
          {/* Search */}
          <div className="chat-search-wrap">
            <Search size={14} className="text-muted" />
            <input
              type="text"
              placeholder="Search managers or topics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Pending Requests from Managers */}
          <div className="sidebar-group">
            <div className="sidebar-group-title">
              <span>Manager Chat Requests</span>
              <span className="group-count">{pendingAdminRequests.length}</span>
            </div>

            {pendingAdminRequests.length === 0 ? (
              <p className="sidebar-empty-hint">No pending manager chat requests.</p>
            ) : (
              pendingAdminRequests.map((req) => {
                const isResume = Boolean(req.closedAt || req.requestNote?.toLowerCase().includes('re-request'));
                return (
                  <div
                    key={req._id}
                    className={`chat-request-item ${selectedSession?._id === req._id ? 'selected' : ''}`}
                    onClick={() => setSelectedSession(req)}
                  >
                    <div className="request-item-top">
                      <div className="request-sender">
                        <strong>{req.initiator?.name || 'Manager'}</strong>
                        <span className="dept-tag">{req.initiator?.department || 'Operations'}</span>
                        {isResume && (
                          <span className="resume-tag">
                            <RotateCcw size={10} /> Resumed Topic
                          </span>
                        )}
                      </div>
                      <span className="request-time">
                        {new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="request-topic">
                      <b>Topic:</b> {req.subject}
                    </div>
                    {req.requestNote && (
                      <p className="request-snippet">"{req.requestNote}"</p>
                    )}
                    <div className="request-action-row" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="btn-approve-chat"
                        onClick={() => handleApprove(req._id)}
                      >
                        <Check size={13} />
                        <span>{isResume ? 'Approve & Resume' : 'Approve Chat'}</span>
                      </button>
                      <button
                        type="button"
                        className="btn-reject-chat"
                        onClick={() => handleReject(req._id)}
                      >
                        <X size={13} />
                        <span>Decline</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Active Manager Chats */}
          <div className="sidebar-group">
            <div className="sidebar-group-title">
              <span>Active Manager Chats</span>
              <span className="group-count">{activeAdminSessions.length}</span>
            </div>

            {activeAdminSessions.length === 0 ? (
              <p className="sidebar-empty-hint">No active ongoing manager chats.</p>
            ) : (
              activeAdminSessions.map((session) => (
                <div
                  key={session._id}
                  className={`chat-session-item ${selectedSession?._id === session._id ? 'selected' : ''}`}
                  onClick={() => setSelectedSession(session)}
                >
                  <div className="session-item-avatar admin-mgr-avatar">
                    <span>{(session.initiator?.name || 'M')[0].toUpperCase()}</span>
                    <span className="active-green-dot" />
                  </div>
                  <div className="session-item-body">
                    <div className="session-item-top">
                      <strong>{session.initiator?.name || 'Manager'}</strong>
                      <span className="session-time">
                        {new Date(session.lastMessageAt || session.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="session-item-snippet">
                      {session.lastMessage || session.subject || 'Session active'}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Concluded Sessions */}
          {closedAdminSessions.length > 0 && (
            <div className="sidebar-group">
              <div className="sidebar-group-title">
                <span>Closed Archive</span>
                <span className="group-count">{closedAdminSessions.length}</span>
              </div>
              {closedAdminSessions.map((s) => (
                <div
                  key={s._id}
                  className={`chat-session-item closed ${selectedSession?._id === s._id ? 'selected' : ''}`}
                  onClick={() => setSelectedSession(s)}
                >
                  <div className="session-item-body">
                    <strong>{s.initiator?.name || 'Manager'}</strong>
                    <p className="session-item-snippet">{s.subject}</p>
                  </div>
                  <div className="session-item-right-actions" onClick={(e) => e.stopPropagation()}>
                    <span className="status-closed-badge">Closed</span>
                    <button
                      type="button"
                      className="btn-history-resume"
                      onClick={() => handleReopen(s)}
                      title="Resume conversation"
                    >
                      <RotateCcw size={11} />
                      <span>Resume</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Chat Window */}
        <div className="chat-main-window">
          {selectedSession ? (
            <>
              <div className="chat-window-header">
                <div className="window-header-left">
                  <div className="header-avatar admin-mgr-avatar">
                    <span>{(selectedSession.initiator?.name || 'M')[0].toUpperCase()}</span>
                  </div>
                  <div>
                    <h3>{selectedSession.initiator?.name || 'Manager'}</h3>
                    <p>
                      <span>Role: Manager</span> ·{' '}
                      <span>Dept: {selectedSession.initiator?.department || 'Department'}</span> ·{' '}
                      <span className={`status-badge ${selectedSession.status}`}>
                        {selectedSession.status === 'approved' ? 'Active Approved' :
                         selectedSession.status === 'pending' ? 'Pending Review' : selectedSession.status}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="window-header-actions">
                  {selectedSession.status === 'pending' && (
                    <>
                      <button
                        type="button"
                        className="btn-approve-chat"
                        onClick={() => handleApprove(selectedSession._id)}
                      >
                        <Check size={14} />
                        <span>
                          {(selectedSession.closedAt || selectedSession.requestNote?.toLowerCase().includes('re-request'))
                            ? 'Approve & Resume'
                            : 'Approve'}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="btn-reject-chat"
                        onClick={() => handleReject(selectedSession._id)}
                      >
                        <X size={14} />
                        <span>Decline</span>
                      </button>
                    </>
                  )}
                  {selectedSession.status === 'approved' && (
                    <button
                      type="button"
                      className="btn-secondary btn-small"
                      onClick={() => handleCloseSession(selectedSession._id)}
                    >
                      <CheckCircle2 size={14} className="text-emerald" />
                      <span>Conclude Session</span>
                    </button>
                  )}
                  {selectedSession.status === 'closed' && (
                    <button
                      type="button"
                      className="btn-primary btn-small btn-resume-chat"
                      onClick={() => handleReopen(selectedSession)}
                      title="Resume conversation with Manager"
                    >
                      <RotateCcw size={13} />
                      <span>Resume Conversation</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="chat-session-meta-banner">
                <strong>Topic: {selectedSession.subject}</strong>
                {selectedSession.requestNote && (
                  <span>Manager Note: "{selectedSession.requestNote}"</span>
                )}
              </div>

              {/* Messages */}
              <div className="chat-messages-container">
                {messages.length === 0 ? (
                  <div className="chat-empty-thread">
                    <MessageSquare size={36} className="text-muted" />
                    <p>No messages exchanged in this session yet.</p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMe = String(msg.sender?._id || msg.sender) === String(user.id);
                    return (
                      <div
                        key={msg._id}
                        className={`chat-bubble-row ${isMe ? 'bubble-outgoing' : 'bubble-incoming'}`}
                      >
                        <div className="bubble-content-wrap">
                          <div className="bubble-meta">
                            <strong>{isMe ? 'You (Admin)' : msg.senderName || 'Manager'}</strong>
                            <span className="bubble-time">
                              {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className="bubble-text">{msg.message}</div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Composer */}
              {selectedSession.status === 'approved' ? (
                <form className="chat-composer-bar" onSubmit={handleSendMessage}>
                  <input
                    type="text"
                    placeholder="Type executive message to Manager... (Enter to send)"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    disabled={sending}
                  />
                  <button
                    type="submit"
                    className="btn-primary btn-chat-send"
                    disabled={sending || !messageText.trim()}
                  >
                    <Send size={15} />
                    <span>Send</span>
                  </button>
                </form>
              ) : selectedSession.status === 'closed' ? (
                <div className="chat-composer-locked flex-col-wrap">
                  <div className="locked-info-line">
                    <Lock size={15} className="text-muted" />
                    <span>This executive conversation has been concluded. You can resume it anytime to continue discussion on this topic.</span>
                  </div>
                  <button
                    type="button"
                    className="btn-primary btn-small btn-resume-chat"
                    onClick={() => handleReopen(selectedSession)}
                  >
                    <RotateCcw size={14} />
                    <span>Resume &amp; Continue Conversation</span>
                  </button>
                </div>
              ) : selectedSession.status === 'pending' ? (
                <div className="chat-composer-locked flex-col-wrap">
                  <div className="locked-info-line">
                    <Lock size={15} className="text-muted" />
                    <span>
                      {(selectedSession.closedAt || selectedSession.requestNote?.toLowerCase().includes('re-request'))
                        ? 'Manager requested to resume this topic.'
                        : 'Manager chat request is awaiting your executive approval.'}
                    </span>
                  </div>
                  <div className="composer-pending-actions">
                    <button
                      type="button"
                      className="btn-approve-chat"
                      onClick={() => handleApprove(selectedSession._id)}
                    >
                      <Check size={14} />
                      <span>{(selectedSession.closedAt || selectedSession.requestNote?.toLowerCase().includes('re-request')) ? 'Approve & Resume' : 'Approve'}</span>
                    </button>
                    <button
                      type="button"
                      className="btn-reject-chat"
                      onClick={() => handleReject(selectedSession._id)}
                    >
                      <X size={14} />
                      <span>Decline</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="chat-composer-locked">
                  <Lock size={15} className="text-muted" />
                  <span>This conversation has concluded.</span>
                </div>
              )}
            </>
          ) : (
            <div className="chat-no-selection">
              <MessageSquare size={44} className="text-muted" />
              <h4>Select a Manager Chat</h4>
              <p>Review pending permission requests or select an active conversation from the left sidebar.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ChatPage;
