import * as XLSX from 'xlsx';
import Swal from './swalConfig';

export function exportDailyReportToExcel(allTasks, userName = 'User') {
  if (!allTasks || allTasks.length === 0) {
    Swal.fire({
      title: 'No Data',
      text: 'No tasks to export yet.',
      icon: 'info'
    });
    return;
  }

  // Calculate live time worked today
  let todaySeconds = 0;
  const savedState = localStorage.getItem('timeTrackerState');
  if (savedState) {
    const parsed = JSON.parse(savedState);
    todaySeconds = parsed.seconds || 0;
    if (parsed.isWorking && parsed.lastTick) {
      todaySeconds += Math.floor((Date.now() - parsed.lastTick) / 1000);
    }
  }

  const formatTime = (totalSeconds) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 1. Prepare Tasks Sheet
  const taskRows = allTasks.map((task, index) => ({
    'S.No': index + 1,
    'Title': task.title,
    'Description': task.description || '-',
    'Category': task.category || 'general',
    'Priority': task.priority,
    'Status': task.status,
    'Last Updated': new Date(task.updatedAt).toLocaleDateString(),
  }));

  const taskSheet = XLSX.utils.json_to_sheet(taskRows);
  taskSheet['!cols'] = [
    { wch: 8 }, { wch: 25 }, { wch: 45 }, { wch: 15 }, { wch: 12 }, { wch: 15 }
  ];

  // 2. Prepare Time Logs Sheet
  const logs = JSON.parse(localStorage.getItem('timeLogs') || '[]');
  const todayDate = new Date().toLocaleDateString();
  
  const exportLogs = [...logs];
  if (todaySeconds > 0) {
    const todayIndex = exportLogs.findIndex(l => l.date === todayDate);
    if (todayIndex >= 0) {
        exportLogs[todayIndex] = { ...exportLogs[todayIndex], seconds: exportLogs[todayIndex].seconds + todaySeconds };
    } else {
        exportLogs.push({ date: todayDate, seconds: todaySeconds });
    }
  }

  const logRows = exportLogs.map((log, index) => ({
    'S.No': index + 1,
    'Date': log.date,
    'Time Worked': formatTime(log.seconds),
  }));

  if (logRows.length > 0) {
      const totalAllTime = exportLogs.reduce((acc, log) => acc + log.seconds, 0);
      logRows.push({});
      logRows.push({ 'S.No': 'TOTAL ALL TIME:', 'Date': '', 'Time Worked': formatTime(totalAllTime) });
  }

  const logSheet = logRows.length > 0 ? XLSX.utils.json_to_sheet(logRows) : XLSX.utils.json_to_sheet([{"Note": "No time logged yet"}]);
  logSheet['!cols'] = [{ wch: 18 }, { wch: 15 }, { wch: 20 }];

  // 3. Combine into workbook
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, taskSheet, 'All Tasks');
  XLSX.utils.book_append_sheet(workbook, logSheet, 'Working Days Log');

  const todayStr = new Date().toISOString().split('T')[0];
  const safeName = (userName || 'user').replace(/\s+/g, '_');
  XLSX.writeFile(workbook, `${safeName}-Work-Report-${todayStr}.xlsx`);
}