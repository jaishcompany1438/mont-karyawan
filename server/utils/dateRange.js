const pad = (value) => String(value).padStart(2, '0');

function formatMidnight(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} 00:00:00`;
}

// Rentang [start, end) untuk "hari ini" berdasarkan tanggal sistem server.
function getTodayRange(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return { start: formatMidnight(start), end: formatMidnight(end) };
}

module.exports = { getTodayRange };
