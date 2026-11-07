import React, { useState, useEffect } from 'react';
import { startFocusSession, stopFocusSession } from '../api/taskApi';
import Swal from '../utils/swalConfig';

const FocusMode = ({ tasks, onClose, onSessionEnd }) => {
    const [selectedTaskId, setSelectedTaskId] = useState('');
    const [session, setSession] = useState(null);
    const [seconds, setSeconds] = useState(0);
    const [isPaused, setIsPaused] = useState(false);

    useEffect(() => {
        let interval = null;
        if (session && !isPaused) {
            interval = setInterval(() => {
                setSeconds(s => s + 1);
            }, 1000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [session, isPaused]);

    const handleStart = async () => {
        if (!selectedTaskId) {
            Swal.fire({ title: 'Select a Task', text: 'Please select a task to focus on', icon: 'warning' });
            return;
        }
        try {
            const res = await startFocusSession({ taskId: selectedTaskId });
            setSession(res.data);
            setSeconds(0);
            setIsPaused(false);
        } catch (err) {
            Swal.fire({ title: 'Error', text: 'Could not start focus session', icon: 'error' });
        }
    };

    const handleStop = async () => {
        if (!session) return;
        try {
            await stopFocusSession({ sessionId: session._id, durationSeconds: seconds });
            onSessionEnd();
            onClose();
        } catch (err) {
            Swal.fire({ title: 'Error', text: 'Could not stop focus session properly', icon: 'error' });
        }
    };

    const formatTime = (totalSeconds) => {
        const hrs = Math.floor(totalSeconds / 3600);
        const mins = Math.floor((totalSeconds % 3600) / 60);
        const secs = totalSeconds % 60;
        return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const selectedTask = tasks.find(t => t._id === selectedTaskId);

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            background: '#ffffff', zIndex: 9999, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', padding: '40px'
        }}>
            <button onClick={onClose} style={{
                position: 'absolute', top: '30px', right: '40px', background: 'transparent',
                border: 'none', fontSize: '15px', fontWeight: 600, color: '#6b7280', cursor: 'pointer'
            }}>
                Exit Focus Mode
            </button>

            {!session ? (
                <div style={{ width: '100%', maxWidth: '500px', textAlign: 'center' }}>
                    <h1 style={{ fontFamily: 'Inter', fontSize: '32px', fontWeight: 700, color: '#111827', marginBottom: '30px' }}>What are you focusing on?</h1>
                    
                    <select 
                        value={selectedTaskId} 
                        onChange={(e) => setSelectedTaskId(e.target.value)}
                        style={{
                            width: '100%', padding: '16px', borderRadius: '12px', border: '1px solid #e5e7eb',
                            fontSize: '16px', outline: 'none', marginBottom: '24px', background: '#f9fafb'
                        }}
                    >
                        <option value="">-- Select a Task --</option>
                        {tasks.filter(t => t.status !== 'completed').map(t => (
                            <option key={t._id} value={t._id}>{t.title}</option>
                        ))}
                    </select>

                    <button onClick={handleStart} style={{
                        width: '100%', padding: '16px', borderRadius: '12px', border: 'none',
                        background: '#111827', color: '#ffffff', fontSize: '18px', fontWeight: 600, cursor: 'pointer'
                    }}>
                        Start Focusing
                    </button>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                    <h2 style={{ fontFamily: 'Inter', fontSize: '20px', fontWeight: 600, color: '#6b7280', marginBottom: '10px' }}>Currently Focusing On</h2>
                    <h1 style={{ fontFamily: 'Inter', fontSize: '42px', fontWeight: 800, color: '#111827', margin: '0 0 20px 0', maxWidth: '800px' }}>
                        {selectedTask?.title}
                    </h1>
                    
                    <div style={{ display: 'flex', gap: '16px', marginBottom: '60px' }}>
                        <span style={{ padding: '6px 12px', borderRadius: '20px', background: '#f3f4f6', color: '#374151', fontSize: '14px', fontWeight: 600, textTransform: 'capitalize' }}>
                            Priority: {selectedTask?.priority}
                        </span>
                        {selectedTask?.deadline && (
                            <span style={{ padding: '6px 12px', borderRadius: '20px', background: '#fef3c7', color: '#92400e', fontSize: '14px', fontWeight: 600 }}>
                                Deadline: {new Date(selectedTask.deadline).toLocaleDateString()}
                            </span>
                        )}
                    </div>

                    <div style={{ fontFamily: 'Inter', fontSize: '120px', fontWeight: 800, color: '#111827', lineHeight: 1, letterSpacing: '-2px', marginBottom: '60px' }}>
                        {formatTime(seconds)}
                    </div>

                    <div style={{ display: 'flex', gap: '20px' }}>
                        <button onClick={() => setIsPaused(!isPaused)} style={{
                            padding: '16px 40px', borderRadius: '40px', border: '2px solid #111827',
                            background: isPaused ? '#111827' : 'transparent', color: isPaused ? '#ffffff' : '#111827',
                            fontSize: '18px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s'
                        }}>
                            {isPaused ? 'Resume' : 'Pause'}
                        </button>
                        
                        <button onClick={handleStop} style={{
                            padding: '16px 40px', borderRadius: '40px', border: 'none',
                            background: '#ef4444', color: '#ffffff',
                            fontSize: '18px', fontWeight: 600, cursor: 'pointer'
                        }}>
                            Stop Session
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FocusMode;
