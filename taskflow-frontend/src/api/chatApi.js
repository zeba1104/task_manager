import api from './axios';

export const getHierarchyTarget = () => api.get('/chat/hierarchy-target');
export const getChatSessions = () => api.get('/chat/sessions');
export const requestChat = (data) => api.post('/chat/request', data);
export const approveChatSession = (sessionId) => api.post(`/chat/sessions/${sessionId}/approve`);
export const rejectChatSession = (sessionId, rejectionReason) =>
  api.post(`/chat/sessions/${sessionId}/reject`, { rejectionReason });
export const closeChatSession = (sessionId) => api.post(`/chat/sessions/${sessionId}/close`);
export const reRequestChatSession = (sessionId, requestNote = '') =>
  api.post(`/chat/sessions/${sessionId}/re-request`, { requestNote });
export const reopenChatSession = (sessionId) =>
  api.post(`/chat/sessions/${sessionId}/reopen`);
export const getSessionMessages = (sessionId) => api.get(`/chat/sessions/${sessionId}/messages`);
export const sendMessage = (sessionId, message) =>
  api.post(`/chat/sessions/${sessionId}/messages`, { message });
