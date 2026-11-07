const mongoose = require('mongoose');
const User = require('../models/User');
const ChatSession = require('../models/ChatSession');
const ChatMessage = require('../models/ChatMessage');
const AdminNotification = require('../models/AdminNotification');
const Activity = require('../models/Activity');

// Helper to log audit activity
const logChatActivity = async (actorId, action, targetType, targetName, details = '') => {
  try {
    await Activity.create({
      actor: actorId,
      action,
      targetType,
      targetName,
      details,
    });
  } catch (err) {
    console.error('Chat activity log failed:', err.message);
  }
};

/**
 * GET /api/chat/hierarchy-target
 * Returns hierarchical reporting contacts based on the user's role:
 * - Employee -> Assigned Reporting Manager
 * - Manager  -> Organization Admin(s) + Team Members (Reportees)
 * - Admin    -> Organization Managers
 */
exports.getHierarchyTarget = async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate('manager', 'name email designation department role profilePicture employeeId');
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.role === 'Employee') {
      let manager = user.manager;
      // Fallback: If not assigned, find department manager or any active manager
      if (!manager) {
        manager = await User.findOne({
          role: 'Manager',
          department: user.department,
          isActive: { $ne: false },
        }).select('name email designation department role profilePicture employeeId');
      }
      if (!manager) {
        manager = await User.findOne({
          role: 'Manager',
          isActive: { $ne: false },
        }).select('name email designation department role profilePicture employeeId');
      }
      if (!manager) {
        // Last fallback: Admin
        manager = await User.findOne({
          role: 'Admin',
          isActive: { $ne: false },
        }).select('name email designation department role profilePicture employeeId');
      }

      return res.json({
        role: 'Employee',
        targetManager: manager,
        hasTarget: !!manager,
      });
    }

    if (user.role === 'Manager') {
      // Primary Admin
      let admin = await User.findOne({
        role: 'Admin',
        isActive: { $ne: false },
      }).sort({ createdAt: 1 }).select('name email designation department role profilePicture employeeId');

      // Direct reportees or department team members
      const reportees = await User.find({
        role: 'Employee',
        isActive: { $ne: false },
        $or: [{ manager: user._id }, { department: user.department }],
      }).select('name email designation department role profilePicture employeeId');

      return res.json({
        role: 'Manager',
        targetAdmin: admin,
        reportees,
      });
    }

    // Admin role
    const managers = await User.find({
      role: 'Manager',
      isActive: { $ne: false },
    }).select('name email designation department role profilePicture employeeId');

    return res.json({
      role: 'Admin',
      managers,
    });
  } catch (err) {
    console.error('getHierarchyTarget error:', err);
    return res.status(500).json({ message: 'Could not load hierarchy target', error: err.message });
  }
};

/**
 * GET /api/chat/sessions
 * Returns all chat sessions where user is either initiator or recipient.
 */
exports.getSessions = async (req, res) => {
  try {
    const userId = req.userId;
    const userRole = req.userRole;

    let query = {
      $or: [{ initiator: userId }, { recipient: userId }],
    };

    // If Admin, also allow reviewing all MANAGER_ADMIN sessions
    if (userRole === 'Admin') {
      query = {
        $or: [{ initiator: userId }, { recipient: userId }, { type: 'MANAGER_ADMIN' }],
      };
    }

    const sessions = await ChatSession.find(query)
      .populate('initiator', 'name email designation department role profilePicture employeeId')
      .populate('recipient', 'name email designation department role profilePicture employeeId')
      .populate('approvedBy', 'name role')
      .populate('closedBy', 'name role')
      .sort({ updatedAt: -1 })
      .lean();

    return res.json(sessions);
  } catch (err) {
    console.error('getSessions error:', err);
    return res.status(500).json({ message: 'Could not fetch chat sessions', error: err.message });
  }
};

/**
 * POST /api/chat/request
 * Request permission to initiate a chat session.
 * Hierarchy rules:
 * - Employee can only request their Reporting Manager (or Admin if manager unavailable).
 * - Manager can only request an Admin.
 */
exports.requestChat = async (req, res) => {
  try {
    const userId = req.userId;
    const userRole = req.userRole;
    const { recipientId, subject = 'General Communication', requestNote = '' } = req.body;

    const sender = await User.findById(userId).populate('manager');
    if (!sender) return res.status(404).json({ message: 'Sender not found' });

    let targetRecipientId = recipientId;
    let recipientRole = 'Manager';
    let sessionType = 'EMPLOYEE_MANAGER';

    if (userRole === 'Employee') {
      sessionType = 'EMPLOYEE_MANAGER';
      if (!targetRecipientId) {
        targetRecipientId = sender.manager?._id;
      }
      if (!targetRecipientId) {
        // Fallback to department manager or admin
        const fallbackManager = await User.findOne({
          role: 'Manager',
          $or: [{ department: sender.department }, { isActive: { $ne: false } }],
        });
        targetRecipientId = fallbackManager?._id;
      }
      if (!targetRecipientId) {
        const adminUser = await User.findOne({ role: 'Admin', isActive: { $ne: false } });
        targetRecipientId = adminUser?._id;
        recipientRole = 'Admin';
      }
      const recipientUser = await User.findById(targetRecipientId);
      if (!recipientUser) {
        return res.status(400).json({ message: 'No valid reporting manager found to receive chat request.' });
      }
      recipientRole = recipientUser.role;
    } else if (userRole === 'Manager') {
      sessionType = 'MANAGER_ADMIN';
      recipientRole = 'Admin';
      if (!targetRecipientId) {
        const adminUser = await User.findOne({ role: 'Admin', isActive: { $ne: false } });
        targetRecipientId = adminUser?._id;
      }
      const recipientUser = await User.findById(targetRecipientId);
      if (!recipientUser || recipientUser.role !== 'Admin') {
        return res.status(400).json({ message: 'Managers must request chat permission from an authorized Admin.' });
      }
    } else {
      // Admin directly chatting with manager or employee -> auto-approved
      const recipientUser = await User.findById(targetRecipientId);
      if (!recipientUser) return res.status(400).json({ message: 'Recipient not found' });
      recipientRole = recipientUser.role;
      sessionType = recipientRole === 'Employee' ? 'EMPLOYEE_MANAGER' : 'MANAGER_ADMIN';
    }

    const isAutoApproved = userRole === 'Admin';

    // If a specific sessionId was passed or if an existing session with the same subject exists
    let existingSession = null;
    if (req.body.sessionId) {
      existingSession = await ChatSession.findById(req.body.sessionId)
        .populate('initiator', 'name email designation department role profilePicture employeeId')
        .populate('recipient', 'name email designation department role profilePicture employeeId');
    }

    if (!existingSession && subject) {
      existingSession = await ChatSession.findOne({
        initiator: userId,
        recipient: targetRecipientId,
        subject: { $regex: `^${subject.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
      })
        .populate('initiator', 'name email designation department role profilePicture employeeId')
        .populate('recipient', 'name email designation department role profilePicture employeeId');
    }

    if (!existingSession) {
      existingSession = await ChatSession.findOne({
        initiator: userId,
        recipient: targetRecipientId,
        status: { $in: ['pending', 'approved'] },
      })
        .populate('initiator', 'name email designation department role profilePicture employeeId')
        .populate('recipient', 'name email designation department role profilePicture employeeId');
    }

    if (existingSession) {
      if (existingSession.status === 'approved' || existingSession.status === 'pending') {
        return res.json({
          message: existingSession.status === 'approved'
            ? 'An active approved chat session already exists.'
            : 'A chat permission request is already pending review.',
          session: existingSession,
        });
      }

      // If existing session was closed or rejected, re-request it to resume the conversation!
      existingSession.status = isAutoApproved ? 'approved' : 'pending';
      existingSession.requestNote = requestNote.trim() || `Re-requested to resume discussion on "${existingSession.subject}".`;
      existingSession.rejectionReason = '';
      existingSession.closedBy = null;
      existingSession.closedAt = null;
      existingSession.approvedBy = isAutoApproved ? userId : null;
      existingSession.approvedAt = isAutoApproved ? new Date() : null;
      existingSession.lastMessageAt = new Date();
      await existingSession.save();

      await logChatActivity(
        userId,
        isAutoApproved ? 'resumed chat session on' : 're-requested chat permission on',
        'ChatSession',
        existingSession.recipient?.name || 'Manager',
        `Subject: ${existingSession.subject}`
      );

      return res.json({
        message: isAutoApproved
          ? 'Conversation resumed.'
          : 'Permission to resume conversation re-requested successfully.',
        session: existingSession,
      });
    }

    const newSession = await ChatSession.create({
      initiator: userId,
      initiatorRole: userRole,
      recipient: targetRecipientId,
      recipientRole,
      type: sessionType,
      status: isAutoApproved ? 'approved' : 'pending',
      subject: subject.trim() || 'General Communication',
      requestNote: requestNote.trim(),
      approvedBy: isAutoApproved ? userId : null,
      approvedAt: isAutoApproved ? new Date() : null,
    });

    const populatedSession = await ChatSession.findById(newSession._id)
      .populate('initiator', 'name email designation department role profilePicture employeeId')
      .populate('recipient', 'name email designation department role profilePicture employeeId');

    // Notify recipient
    if (recipientRole === 'Admin') {
      await AdminNotification.create({
        title: `Chat Permission Request: ${sender.name}`,
        message: `${sender.name} (${sender.role} - ${sender.department}) requested permission to chat: "${subject}".`,
        type: 'general',
        priority: 'Medium',
        sender: userId,
      });
    }

    await logChatActivity(
      userId,
      isAutoApproved ? 'started chat session with' : 'requested chat permission from',
      'ChatSession',
      populatedSession.recipient?.name || 'Manager',
      `Subject: ${subject}`
    );

    return res.status(201).json({
      message: isAutoApproved ? 'Chat session opened.' : 'Chat permission request submitted successfully.',
      session: populatedSession,
    });
  } catch (err) {
    console.error('requestChat error:', err);
    return res.status(500).json({ message: 'Could not create chat request', error: err.message });
  }
};

/**
 * POST /api/chat/sessions/:id/approve
 * Approves a pending chat request.
 * Hierarchy permission:
 * - Recipient of the request (or Admin) can approve.
 */
exports.approveSession = async (req, res) => {
  try {
    const { id } = req.params;
    const session = await ChatSession.findById(id)
      .populate('initiator', 'name email designation department role profilePicture employeeId')
      .populate('recipient', 'name email designation department role profilePicture employeeId');

    if (!session) return res.status(404).json({ message: 'Chat session not found' });

    const isDesignatedRecipient = String(session.recipient?._id) === String(req.userId);
    const isAdmin = req.userRole === 'Admin';

    if (!isDesignatedRecipient && !isAdmin) {
      return res.status(403).json({ message: 'Only the designated recipient or an Admin can approve this chat request.' });
    }

    if (session.status === 'approved') {
      return res.json({ message: 'Chat session is already approved.', session });
    }

    session.status = 'approved';
    session.approvedBy = req.userId;
    session.approvedAt = new Date();
    session.closedBy = null;
    session.closedAt = null;
    await session.save();

    // Create a system welcome message
    await ChatMessage.create({
      session: session._id,
      sender: req.userId,
      senderName: req.userRole === 'Admin' ? 'Admin' : 'Reporting Manager',
      senderRole: req.userRole,
      recipient: session.initiator?._id,
      message: `Chat request approved. You can now exchange messages directly regarding "${session.subject}".`,
      isRead: false,
    });

    session.lastMessage = 'Chat request approved. Messaging is now unlocked.';
    session.lastMessageAt = new Date();
    session.lastMessageSender = req.userId;
    await session.save();

    await logChatActivity(
      req.userId,
      'approved chat request from',
      'ChatSession',
      session.initiator?.name || 'Employee',
      `Subject: ${session.subject}`
    );

    return res.json({
      message: 'Chat request approved successfully. Conversation is active.',
      session,
    });
  } catch (err) {
    console.error('approveSession error:', err);
    return res.status(500).json({ message: 'Could not approve chat request', error: err.message });
  }
};

/**
 * POST /api/chat/sessions/:id/reject
 * Declines a pending chat request.
 */
exports.rejectSession = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionReason = '' } = req.body;

    const session = await ChatSession.findById(id)
      .populate('initiator', 'name email designation department role profilePicture employeeId')
      .populate('recipient', 'name email designation department role profilePicture employeeId');

    if (!session) return res.status(404).json({ message: 'Chat session not found' });

    const isDesignatedRecipient = String(session.recipient?._id) === String(req.userId);
    const isAdmin = req.userRole === 'Admin';

    if (!isDesignatedRecipient && !isAdmin) {
      return res.status(403).json({ message: 'Only the designated recipient or an Admin can reject this chat request.' });
    }

    session.status = 'rejected';
    session.rejectionReason = rejectionReason.trim() || 'Request was declined at this time.';
    await session.save();

    await logChatActivity(
      req.userId,
      'declined chat request from',
      'ChatSession',
      session.initiator?.name || 'Employee',
      `Reason: ${session.rejectionReason}`
    );

    return res.json({
      message: 'Chat request declined.',
      session,
    });
  } catch (err) {
    console.error('rejectSession error:', err);
    return res.status(500).json({ message: 'Could not reject chat request', error: err.message });
  }
};

/**
 * POST /api/chat/sessions/:id/close
 * Closes an active chat session.
 */
exports.closeSession = async (req, res) => {
  try {
    const { id } = req.params;
    const session = await ChatSession.findById(id);

    if (!session) return res.status(404).json({ message: 'Chat session not found' });

    const isParticipant =
      String(session.initiator) === String(req.userId) ||
      String(session.recipient) === String(req.userId);
    const isAdmin = req.userRole === 'Admin';

    if (!isParticipant && !isAdmin) {
      return res.status(403).json({ message: 'Access denied: You are not a participant in this chat session.' });
    }

    session.status = 'closed';
    session.closedBy = req.userId;
    session.closedAt = new Date();
    await session.save();

    // Concluding message
    await ChatMessage.create({
      session: session._id,
      sender: req.userId,
      senderName: req.userRole,
      senderRole: req.userRole,
      recipient: String(session.initiator) === String(req.userId) ? session.recipient : session.initiator,
      message: '[Chat session concluded and closed.]',
      isRead: true,
    });

    return res.json({
      message: 'Chat session closed successfully.',
      session,
    });
  } catch (err) {
    console.error('closeSession error:', err);
    return res.status(500).json({ message: 'Could not close chat session', error: err.message });
  }
};

/**
 * POST /api/chat/sessions/:id/re-request
 * Allows re-requesting permission to continue/resume an existing chat session.
 * Reuses the same session so all past messages remain intact.
 */
exports.reRequestSession = async (req, res) => {
  try {
    const { id } = req.params;
    const { requestNote = '' } = req.body;

    const session = await ChatSession.findById(id)
      .populate('initiator', 'name email designation department role profilePicture employeeId')
      .populate('recipient', 'name email designation department role profilePicture employeeId');

    if (!session) return res.status(404).json({ message: 'Chat session not found' });

    const isInitiator = String(session.initiator?._id) === String(req.userId);
    const isRecipient = String(session.recipient?._id) === String(req.userId);

    if (!isInitiator && !isRecipient && req.userRole !== 'Admin') {
      return res.status(403).json({ message: 'Access denied: You are not a participant in this conversation.' });
    }

    session.status = 'pending';
    session.requestNote = requestNote.trim() || `Re-requested to resume discussion on "${session.subject}".`;
    session.rejectionReason = '';
    session.closedBy = null;
    session.closedAt = null;
    session.lastMessageAt = new Date();
    await session.save();

    await logChatActivity(
      req.userId,
      're-requested chat permission on',
      'ChatSession',
      session.recipient?.name || 'Manager',
      `Subject: ${session.subject}`
    );

    if (session.recipientRole === 'Admin') {
      await AdminNotification.create({
        title: `Chat Resume Request: ${session.initiator?.name}`,
        message: `${session.initiator?.name} requested to resume conversation on "${session.subject}".`,
        type: 'general',
        priority: 'Medium',
        sender: req.userId,
      });
    }

    return res.json({
      message: 'Chat permission re-requested successfully. Waiting for approval to resume.',
      session,
    });
  } catch (err) {
    console.error('reRequestSession error:', err);
    return res.status(500).json({ message: 'Could not re-request chat session', error: err.message });
  }
};

/**
 * POST /api/chat/sessions/:id/reopen
 * Allows manager or admin to directly resume an existing closed conversation.
 */
exports.reopenSession = async (req, res) => {
  try {
    const { id } = req.params;

    const session = await ChatSession.findById(id)
      .populate('initiator', 'name email designation department role profilePicture employeeId')
      .populate('recipient', 'name email designation department role profilePicture employeeId');

    if (!session) return res.status(404).json({ message: 'Chat session not found' });

    const isApprover =
      String(session.recipient?._id) === String(req.userId) ||
      req.userRole === 'Admin';

    if (!isApprover) {
      return res.status(403).json({ message: 'Only the reporting authority or an Admin can directly resume this conversation.' });
    }

    session.status = 'approved';
    session.approvedBy = req.userId;
    session.approvedAt = new Date();
    session.closedBy = null;
    session.closedAt = null;
    session.rejectionReason = '';
    session.lastMessageAt = new Date();
    await session.save();

    await ChatMessage.create({
      session: session._id,
      sender: req.userId,
      senderName: req.userRole === 'Admin' ? 'Admin' : 'Reporting Manager',
      senderRole: req.userRole,
      recipient: session.initiator?._id,
      message: `[Conversation resumed by ${req.userRole === 'Admin' ? 'Admin' : 'Reporting Manager'}]. You can continue messaging on "${session.subject}".`,
      isRead: false,
    });

    await logChatActivity(
      req.userId,
      'resumed chat session with',
      'ChatSession',
      session.initiator?.name || 'Employee',
      `Subject: ${session.subject}`
    );

    return res.json({
      message: 'Conversation resumed and unlocked.',
      session,
    });
  } catch (err) {
    console.error('reopenSession error:', err);
    return res.status(500).json({ message: 'Could not resume chat session', error: err.message });
  }
};

/**
 * GET /api/chat/sessions/:id/messages
 * Retrieves all messages in a session. Marks received messages as read.
 */
exports.getMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const session = await ChatSession.findById(id)
      .populate('initiator', 'name email designation department role profilePicture employeeId')
      .populate('recipient', 'name email designation department role profilePicture employeeId');

    if (!session) return res.status(404).json({ message: 'Chat session not found' });

    const isParticipant =
      String(session.initiator?._id) === String(req.userId) ||
      String(session.recipient?._id) === String(req.userId);
    const isAdmin = req.userRole === 'Admin';

    if (!isParticipant && !isAdmin) {
      return res.status(403).json({ message: 'Access denied: You cannot view messages for this session.' });
    }

    // Mark unread messages sent to current user as read
    await ChatMessage.updateMany(
      { session: id, recipient: req.userId, isRead: false },
      { $set: { isRead: true } }
    );

    // Reset unread count
    if (String(session.initiator?._id) === String(req.userId)) {
      session.unreadByInitiator = 0;
    } else if (String(session.recipient?._id) === String(req.userId)) {
      session.unreadByRecipient = 0;
    }
    await session.save();

    const messages = await ChatMessage.find({ session: id })
      .populate('sender', 'name role profilePicture')
      .sort({ createdAt: 1 })
      .lean();

    return res.json({
      session,
      messages,
    });
  } catch (err) {
    console.error('getMessages error:', err);
    return res.status(500).json({ message: 'Could not fetch messages', error: err.message });
  }
};

/**
 * POST /api/chat/sessions/:id/messages
 * Sends a message in a chat session.
 * MANDATORY REQUIREMENT: Session MUST be approved!
 */
exports.sendMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ message: 'Message content cannot be empty.' });
    }

    const session = await ChatSession.findById(id);
    if (!session) return res.status(404).json({ message: 'Chat session not found.' });

    // Enforce Hierarchy Permission Check
    if (session.status !== 'approved') {
      return res.status(403).json({
        message: 'Chat permission is required. You can only send messages after the reporting manager or admin approves your request.',
        status: session.status,
      });
    }

    const isInitiator = String(session.initiator) === String(req.userId);
    const isRecipient = String(session.recipient) === String(req.userId);
    const isAdmin = req.userRole === 'Admin';

    if (!isInitiator && !isRecipient && !isAdmin) {
      return res.status(403).json({ message: 'Access denied: You are not a participant in this chat session.' });
    }

    const recipientId = isInitiator ? session.recipient : session.initiator;
    const senderUser = await User.findById(req.userId).select('name role profilePicture');

    const chatMsg = await ChatMessage.create({
      session: session._id,
      sender: req.userId,
      senderName: senderUser?.name || 'User',
      senderRole: req.userRole,
      recipient: recipientId,
      message: message.trim(),
      isRead: false,
    });

    session.lastMessage = message.trim();
    session.lastMessageSender = req.userId;
    session.lastMessageAt = new Date();

    if (isInitiator) {
      session.unreadByRecipient = (session.unreadByRecipient || 0) + 1;
    } else {
      session.unreadByInitiator = (session.unreadByInitiator || 0) + 1;
    }
    await session.save();

    const populatedMsg = await ChatMessage.findById(chatMsg._id)
      .populate('sender', 'name role profilePicture');

    return res.status(201).json(populatedMsg);
  } catch (err) {
    console.error('sendMessage error:', err);
    return res.status(500).json({ message: 'Could not send message', error: err.message });
  }
};
