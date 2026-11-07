import { useState, useEffect } from 'react';
import axios from '../api/axios';
import Swal from '../utils/swalConfig';

function TimeTracker() {
  const [isWorking, setIsWorking] = useState(false);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const savedState = localStorage.getItem('timeTrackerState');
    if (savedState) {
      const parsed = JSON.parse(savedState);
      setIsWorking(parsed.isWorking);
      if (parsed.isWorking && parsed.lastTick) {
        const passedSeconds = Math.floor((Date.now() - parsed.lastTick) / 1000);
        setSeconds(parsed.seconds + passedSeconds);
      } else {
        setSeconds(parsed.seconds);
      }
    }
  }, []);

  useEffect(() => {
    let interval = null;
    if (isWorking) {
      // Save start state when un-pausing
      localStorage.setItem('timeTrackerState', JSON.stringify({ isWorking: true, seconds, lastTick: Date.now() }));
      
      interval = setInterval(() => {
        setSeconds((s) => {
          const newSeconds = s + 1;
          localStorage.setItem('timeTrackerState', JSON.stringify({ isWorking: true, seconds: newSeconds, lastTick: Date.now() }));
          return newSeconds;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWorking]); // Run only when isWorking toggles

  const toggleTimer = async () => {
    if (isWorking) {
      // Pausing
      localStorage.setItem('timeTrackerState', JSON.stringify({ isWorking: false, seconds, lastTick: Date.now() }));
    } else {
      // Starting / Resuming
      try {
        await axios.post('/attendance/in');
      } catch (err) {
        console.error('Failed to log clock in');
      }
    }
    setIsWorking(!isWorking);
  };

  const handleClockOut = async () => {
    const result = await Swal.fire({
      title: 'End Day?',
      text: 'This will save your total time to the system and reset the timer.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, end day',
      cancelButtonText: 'Cancel'
    });

    if (result.isConfirmed) {
      try {
        await axios.post('/attendance/out', { seconds });
        
        // Save to timeLogs for export
        const logs = JSON.parse(localStorage.getItem('timeLogs') || '[]');
        const todayDate = new Date().toLocaleDateString();
        const todayIndex = logs.findIndex(l => l.date === todayDate);
        if (todayIndex >= 0) {
            logs[todayIndex].seconds += seconds;
        } else {
            logs.push({ date: todayDate, seconds });
        }
        localStorage.setItem('timeLogs', JSON.stringify(logs));

        setIsWorking(false);
        setSeconds(0);
        localStorage.removeItem('timeTrackerState');
        Swal.fire({
          title: 'Success!',
          text: 'Time log saved successfully.',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });
      } catch (err) {
        Swal.fire({
          title: 'Error',
          text: 'Failed to save time log to server',
          icon: 'error'
        });
      }
    }
  };

  const formatTime = (totalSeconds) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="timer-card" style={{
      background: '#ffffff',
      border: '1px solid rgba(0,0,0,0.05)',
      borderRadius: '12px',
      padding: '22px 24px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-start',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 10px 15px -3px rgba(0, 0, 0, 0.1)',
      position: 'relative',
      overflow: 'hidden',
      height: '100%',
      flex: 1
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: '#6366f1' }} />
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'Inter', fontSize: '34px', fontWeight: 700, color: '#111827', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{formatTime(seconds)}</div>
          <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '12px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>Time Worked Today</div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            <button className={`btn-primary btn-small ${isWorking ? 'btn-pause' : ''}`} onClick={toggleTimer} style={{ flex: 1, padding: '10px' }}>
              {isWorking ? 'Pause' : 'Start'}
            </button>
            {seconds > 0 && (
              <button className="btn-ghost btn-small" onClick={handleClockOut} style={{ flex: 1, padding: '10px' }}>End</button>
            )}
          </div>
      </div>
    </div>
  );
}

export default TimeTracker;
