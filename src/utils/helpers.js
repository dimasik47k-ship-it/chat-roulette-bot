// Вспомогательные функции

function formatDuration(seconds) {
  if (seconds < 60) {
    return `${seconds} сек`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes} мин`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours} ч ${minutes} мин`;
  }
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function formatDateTime(date) {
  return new Date(date).toLocaleString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

function calculateLevel(experience) {
  return Math.floor(experience / 100) + 1;
}

function experienceForNextLevel(currentLevel) {
  return currentLevel * 100;
}

function getProgressBar(current, max, length = 10) {
  const filled = Math.floor((current / max) * length);
  const empty = length - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

module.exports = {
  formatDuration,
  formatDate,
  formatDateTime,
  getRandomElement,
  shuffleArray,
  truncateText,
  escapeHtml,
  sleep,
  isValidUrl,
  calculateLevel,
  experienceForNextLevel,
  getProgressBar
};
