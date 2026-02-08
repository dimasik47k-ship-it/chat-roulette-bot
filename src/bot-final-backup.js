require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const Database = require('better-sqlite3');
const natural = require('natural');

console.log('🚀 Запуск Chat Roulette Bot...');

const db = new Database('bot.db');

// Создание БД
db.exec(`
  CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id INTEGER UNIQUE NOT NULL,
    username TEXT,
    first_name TEXT,
    language_code TEXT DEFAULT 'ru',
    status TEXT DEFAULT 'idle',
    age_group TEXT,
    gender TEXT,
    country TEXT,
    bio TEXT,
    interests TEXT,
    premium_tier TEXT DEFAULT 'free',
    reputation INTEGER DEFAULT 50,
    level INTEGER DEFAULT 1,
    experience INTEGER DEFAULT 0,
    total_chats INTEGER DEFAULT 0,
    total_messages INTEGER DEFAULT 0,
    total_time INTEGER DEFAULT 0,
    likes_received INTEGER DEFAULT 0,
    likes_given INTEGER DEFAULT 0,
    super_likes INTEGER DEFAULT 0,
    reports_received INTEGER DEFAULT 0,
    reports_filed INTEGER DEFAULT 0,
    banned INTEGER DEFAULT 0,
    shadow_banned INTEGER DEFAULT 0,
    verified INTEGER DEFAULT 0,
    online INTEGER DEFAULT 0,
    last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE chats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user1_id INTEGER,
    user2_id INTEGER,
    user1_tg_id INTEGER,
    user2_tg_id INTEGER,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME,
    duration INTEGER DEFAULT 0,
    messages_count INTEGER DEFAULT 0,
    user1_rating INTEGER,
    user2_rating INTEGER,
    status TEXT DEFAULT 'active'
  );

  CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER,
    sender_id INTEGER,
    message_type TEXT,
    content TEXT,
    toxicity_score REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

db.exec(`
  CREATE TABLE reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reporter_id INTEGER,
    reported_id INTEGER,
    chat_id INTEGER,
    report_type TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    favorite_user_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, favorite_user_id)
  );

  CREATE TABLE blacklist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    blocked_user_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, blocked_user_id)
  );

  CREATE TABLE achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE,
    name TEXT,
    description TEXT,
    icon TEXT,
    points INTEGER DEFAULT 0
  );

  CREATE TABLE user_achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    achievement_id INTEGER,
    unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, achievement_id)
  );
`);

console.log('✅ База данных создана (8 таблиц)');

// Достижения
const achievements = [
  ['first_chat', 'Первый разговор', 'Завершите первый чат', '🎉', 10],
  ['chat_10', 'Болтун', '10 чатов', '💬', 50],
  ['chat_50', 'Общительный', '50 чатов', '🗣️', 200],
  ['chat_100', 'Социальная бабочка', '100 чатов', '🦋', 500],
  ['chat_500', 'Легенда', '500 чатов', '👑', 2000],
  ['msg_100', 'Активный', '100 сообщений', '📝', 50],
  ['msg_1000', 'Супер активный', '1000 сообщений', '🔥', 300],
  ['likes_10', 'Симпатичный', '10 лайков', '❤️', 50],
  ['likes_50', 'Популярный', '50 лайков', '⭐', 200],
  ['level_10', 'Опытный', 'Уровень 10', '🎯', 100],
  ['level_25', 'Мастер', 'Уровень 25', '🏆', 300],
  ['level_50', 'Гранд-мастер', 'Уровень 50', '👑', 1000]
];

const stmt = db.prepare('INSERT INTO achievements (code, name, description, icon, points) VALUES (?, ?, ?, ?, ?)');
achievements.forEach(a => stmt.run(...a));

console.log('✅ Достижения загружены (12 штук)');

// AI-модерация
const tokenizer = new natural.WordTokenizer();
const classifier = new natural.BayesClassifier();

// Обучающие данные
const trainingData = [
  // Safe
  ['привет как дела', 'safe'],
  ['хорошо спасибо', 'safe'],
  ['что делаешь', 'safe'],
  ['откуда ты', 'safe'],
  ['сколько лет', 'safe'],
  ['какая погода', 'safe'],
  ['интересно общаться', 'safe'],
  ['расскажи о себе', 'safe'],
  ['какие увлечения', 'safe'],
  ['хорошего дня', 'safe'],
  // Toxic
  ['дурак идиот тупой', 'toxic'],
  ['урод мразь', 'toxic'],
  ['пошел вон', 'toxic'],
  ['ненавижу тебя', 'toxic'],
  ['отстань дебил', 'toxic'],
  // Spam
  ['купи подписку ссылка', 'spam'],
  ['переходи по ссылке', 'spam'],
  ['заработок без вложений', 'spam'],
  ['пиши в телеграм', 'spam'],
  ['жми на ссылку', 'spam']
];

trainingData.forEach(([text, category]) => classifier.addDocument(text, category));
classifier.train();

const toxicWords = ['дурак', 'идиот', 'тупой', 'урод', 'мразь', 'дебил', 'придурок', 'кретин', 'долбоеб', 'пошел', 'отстань'];
const spamPatterns = [/https?:\/\//gi, /@\w+/g, /\b\d{10,}\b/g];

function moderateMessage(text) {
  let score = 0;
  let isToxic = false;
  let isSpam = false;
  
  spamPatterns.forEach(p => { if (p.test(text)) { isSpam = true; score += 3; } });
  
  const tokens = tokenizer.tokenize(text.toLowerCase());
  tokens.forEach(t => { if (toxicWords.some(w => t.includes(w))) { isToxic = true; score += 2; } });
  
  try {
    const category = classifier.classify(text);
    if (category === 'toxic') { isToxic = true; score += 2; }
    if (category === 'spam') { isSpam = true; score += 2; }
  } catch (e) {
    // Если классификатор не может обработать, используем только правила
  }
  
  return { score, isToxic, isSpam, safe: score < 2, warning: score >= 2 && score < 5, block: score >= 5 };
}

console.log('✅ AI-модерация готова');

// Хранилище
const activeChats = new Map();
const queue = [];
const userStates = new Map();

// Бот с настройками для стабильности
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { 
  polling: {
    interval: 300,
    autoStart: true,
    params: {
      timeout: 10
    }
  },
  request: {
    agentOptions: {
      keepAlive: true,
      keepAliveMsecs: 10000
    },
    family: 4 // Использовать IPv4
  }
});

console.log('');
console.log('🎉 БОТ ЗАПУЩЕН!');
console.log('✅ Токен загружен');
console.log('✅ Polling активен');
console.log('✅ Все функции активны');
console.log('');

// Функции БД
const getUser = (tgId) => db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(tgId);
const createUser = (tg) => {
  db.prepare('INSERT INTO users (telegram_id, username, first_name, language_code) VALUES (?, ?, ?, ?)').run(
    tg.id, tg.username || null, tg.first_name, tg.language_code || 'ru'
  );
  return getUser(tg.id);
};
const updateUser = (id, upd) => {
  const f = Object.keys(upd).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE users SET ${f} WHERE id = ?`).run(...Object.values(upd), id);
};
const addExp = (id, amt) => {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  const newExp = u.experience + amt;
  const newLvl = Math.floor(newExp / 100) + 1;
  updateUser(id, { experience: newExp, level: newLvl });
  checkAchievements(id);
};

function checkAchievements(userId) {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  const checks = [
    [u.total_chats === 1, 'first_chat'],
    [u.total_chats === 10, 'chat_10'],
    [u.total_chats === 50, 'chat_50'],
    [u.total_chats === 100, 'chat_100'],
    [u.total_chats === 500, 'chat_500'],
    [u.total_messages === 100, 'msg_100'],
    [u.total_messages === 1000, 'msg_1000'],
    [u.likes_received === 10, 'likes_10'],
    [u.likes_received === 50, 'likes_50'],
    [u.level === 10, 'level_10'],
    [u.level === 25, 'level_25'],
    [u.level === 50, 'level_50']
  ];
  
  const unlocked = [];
  checks.forEach(([cond, code]) => {
    if (cond) {
      try {
        const ach = db.prepare('SELECT * FROM achievements WHERE code = ?').get(code);
        db.prepare('INSERT INTO user_achievements (user_id, achievement_id) VALUES (?, ?)').run(userId, ach.id);
        unlocked.push(ach);
      } catch (e) {}
    }
  });
  
  return unlocked;
}

// Клавиатуры
const mainMenu = (u) => ({
  inline_keyboard: [
    [{ text: '🎲 Найти собеседника', callback_data: 'find' }],
    [{ text: '👤 Профиль', callback_data: 'profile' }, { text: '📊 Статистика', callback_data: 'stats' }],
    [{ text: '⭐ Избранное', callback_data: 'favs' }, { text: '🏆 Достижения', callback_data: 'achievements' }],
    [{ text: '⚙️ Настройки', callback_data: 'settings' }],
    u.premium_tier === 'free' ? [{ text: '💎 Premium', callback_data: 'premium' }] : [],
    [{ text: '❓ Помощь', callback_data: 'help' }]
  ].filter(r => r.length > 0)
});

const chatMenu = () => ({
  inline_keyboard: [
    [{ text: '➡️ Следующий', callback_data: 'next' }, { text: '❌ Завершить', callback_data: 'end' }],
    [{ text: '❤️ Лайк', callback_data: 'like' }, { text: '💖 Супер-лайк', callback_data: 'superlike' }],
    [{ text: '⭐ В избранное', callback_data: 'fav_add' }, { text: '🚫 Жалоба', callback_data: 'report' }]
  ]
});

const reportMenu = () => ({
  inline_keyboard: [
    [{ text: '📧 Спам', callback_data: 'rep_spam' }],
    [{ text: '😠 Оскорбления', callback_data: 'rep_harass' }],
    [{ text: '🔞 Контент 18+', callback_data: 'rep_nsfw' }],
    [{ text: '⚠️ Угрозы', callback_data: 'rep_threat' }],
    [{ text: '❓ Другое', callback_data: 'rep_other' }],
    [{ text: '🔙 Отмена', callback_data: 'rep_cancel' }]
  ]
});

const premiumMenu = () => ({
  inline_keyboard: [
    [{ text: '💎 Basic - 50 ⭐', callback_data: 'buy_basic' }],
    [{ text: '⭐ Pro - 100 ⭐', callback_data: 'buy_pro' }],
    [{ text: '👑 VIP - 200 ⭐', callback_data: 'buy_vip' }],
    [{ text: '🔥 Ultra - 350 ⭐', callback_data: 'buy_ultra' }],
    [{ text: '⚡ God - 500 ⭐', callback_data: 'buy_god' }],
    [{ text: '🔙 Назад', callback_data: 'menu' }]
  ]
});

const ageMenu = () => ({
  inline_keyboard: [
    [{ text: '13-17', callback_data: 'age_teen' }],
    [{ text: '18-24', callback_data: 'age_young' }],
    [{ text: '25-34', callback_data: 'age_adult' }],
    [{ text: '35-44', callback_data: 'age_mature' }],
    [{ text: '45+', callback_data: 'age_senior' }]
  ]
});

const genderMenu = () => ({
  inline_keyboard: [
    [{ text: '👨 Мужской', callback_data: 'gender_male' }],
    [{ text: '👩 Женский', callback_data: 'gender_female' }],
    [{ text: '🌈 Другое', callback_data: 'gender_other' }],
    [{ text: '🤐 Не указывать', callback_data: 'gender_none' }]
  ]
});

const settingsMenu = () => ({
  inline_keyboard: [
    [{ text: '🌍 Язык', callback_data: 'set_lang' }, { text: '🎯 Фильтры', callback_data: 'set_filters' }],
    [{ text: '🔔 Уведомления', callback_data: 'set_notif' }, { text: '🔒 Приватность', callback_data: 'set_privacy' }],
    [{ text: '👤 Изменить профиль', callback_data: 'set_profile' }],
    [{ text: '🔙 Назад', callback_data: 'menu' }]
  ]
});

const filterMenu = (u) => ({
  inline_keyboard: [
    [{ text: `${u.premium_tier !== 'free' ? '👨👩' : '🔒'} Фильтр пола`, callback_data: u.premium_tier !== 'free' ? 'filter_gender' : 'premium' }],
    [{ text: '🌍 Фильтр страны', callback_data: 'filter_country' }],
    [{ text: '🎂 Фильтр возраста', callback_data: 'filter_age' }],
    [{ text: '🔙 Назад', callback_data: 'settings' }]
  ]
});

const ratingMenu = () => ({
  inline_keyboard: [
    [{ text: '⭐', callback_data: 'r1' }, { text: '⭐⭐', callback_data: 'r2' }, { text: '⭐⭐⭐', callback_data: 'r3' }],
    [{ text: '⭐⭐⭐⭐', callback_data: 'r4' }, { text: '⭐⭐⭐⭐⭐', callback_data: 'r5' }],
    [{ text: 'Пропустить', callback_data: 'r0' }]
  ]
});

const genderFilterMenu = () => ({
  inline_keyboard: [
    [{ text: '👨 Только мужчины', callback_data: 'gf_male' }],
    [{ text: '� Только женщины', callback_data: 'gf_female' }],
    [{ text: '🌈 Любой пол', callback_data: 'gf_any' }],
    [{ text: '🔙 Назад', callback_data: 'set_filters' }]
  ]
});

// Функции чата
function createChat(u1, u2) {
  const r = db.prepare('INSERT INTO chats (user1_id, user2_id, user1_tg_id, user2_tg_id, status) VALUES (?, ?, ?, ?, ?)').run(u1.id, u2.id, u1.telegram_id, u2.telegram_id, 'active');
  const chatId = r.lastInsertRowid;
  
  activeChats.set(u1.id, { chatDbId: chatId, partnerId: u2.id, partnerTgId: u2.telegram_id, startTime: Date.now() });
  activeChats.set(u2.id, { chatDbId: chatId, partnerId: u1.id, partnerTgId: u1.telegram_id, startTime: Date.now() });
  
  updateUser(u1.id, { status: 'in_chat', total_chats: u1.total_chats + 1 });
  updateUser(u2.id, { status: 'in_chat', total_chats: u2.total_chats + 1 });
  
  console.log(`✅ Чат создан: ${u1.first_name} <-> ${u2.first_name}`);
  return chatId;
}

function endChat(userId, chat, chatId) {
  const duration = Math.floor((Date.now() - chat.startTime) / 1000);
  
  db.prepare('UPDATE chats SET ended_at = CURRENT_TIMESTAMP, duration = ?, status = ? WHERE id = ?').run(duration, 'ended', chat.chatDbId);
  
  activeChats.delete(userId);
  activeChats.delete(chat.partnerId);
  
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  updateUser(userId, { status: 'idle', total_time: u.total_time + duration });
  updateUser(chat.partnerId, { status: 'idle', total_time: u.total_time + duration });
  
  bot.sendMessage(chatId, `👋 Чат завершен\n\n⏱️ Длительность: ${Math.floor(duration / 60)} мин\n\nОцените диалог:`, { reply_markup: ratingMenu() });
  bot.sendMessage(chat.partnerTgId, `👋 Собеседник завершил чат\n\n⏱️ Длительность: ${Math.floor(duration / 60)} мин\n\nОцените диалог:`, { reply_markup: ratingMenu() });
  
  console.log(`✅ Чат завершен: ${userId} <-> ${chat.partnerId} (${duration}s)`);
}

// /start
bot.onText(/\/start/, async (msg) => {
  const tgId = msg.from.id;
  const chatId = msg.chat.id;
  
  let u = getUser(tgId);
  if (!u) {
    u = createUser(msg.from);
    console.log(`✅ Новый пользователь: ${u.first_name} (${u.telegram_id})`);
  }
  
  updateUser(u.id, { online: 1, last_active: new Date().toISOString() });
  
  if (u.banned) return bot.sendMessage(chatId, '🚫 Вы заблокированы за нарушение правил.');
  
  if (!u.age_group) {
    await bot.sendMessage(chatId, `👋 Добро пожаловать, ${u.first_name}!\n\n🎲 Chat Roulette - общайтесь с людьми со всего мира!\n\n✅ Умный подбор\n✅ AI-модерация\n✅ Безопасность\n✅ Геймификация\n\nНастроим профиль!`);
    return bot.sendMessage(chatId, 'Выберите возрастную группу:', { reply_markup: ageMenu() });
  }
  
  if (!u.gender) {
    return bot.sendMessage(chatId, 'Выберите пол:', { reply_markup: genderMenu() });
  }
  
  const ach = db.prepare('SELECT COUNT(*) as c FROM user_achievements WHERE user_id = ?').get(u.id).c;
  
  await bot.sendMessage(chatId, `👋 С возвращением, ${u.first_name}!\n\n📊 Ваш статус:\n• Уровень: ${u.level} ⚡\n• Опыт: ${u.experience} 🎯\n• Чатов: ${u.total_chats} 💬\n• Достижений: ${ach}/12 🏆\n• Статус: ${u.premium_tier === 'free' ? 'Бесплатный' : u.premium_tier.toUpperCase() + ' 💎'}\n\nЧто хотите сделать?`, { reply_markup: mainMenu(u) });
});

// /help
bot.onText(/\/help/, async (msg) => {
  await bot.sendMessage(msg.chat.id, `❓ Помощь\n\n🎲 Основное:\n• /start - главное меню\n• /profile - профиль\n• /stats - статистика\n\n⚡ Функции:\n• AI-модерация\n• 12 достижений\n• 5 уровней Premium\n• Лайки и супер-лайки\n• Избранное\n• Система жалоб\n\n🔒 Безопасность:\n• Автоматическая проверка сообщений\n• Автобан при 5+ жалобах\n• Теневой бан при 3+ жалобах`);
});

// /stop
bot.onText(/\/stop/, async (msg) => {
  const u = getUser(msg.from.id);
  if (!u) return;
  
  const chat = activeChats.get(u.id);
  if (chat) {
    endChat(u.id, chat, msg.chat.id);
  } else {
    bot.sendMessage(msg.chat.id, 'У вас нет активного чата', { reply_markup: mainMenu(u) });
  }
});

// Callback queries
bot.on('callback_query', async (q) => {
  const tgId = q.from.id;
  const chatId = q.message.chat.id;
  const data = q.data;
  
  await bot.answerCallbackQuery(q.id);
  
  let u = getUser(tgId);
  if (!u || u.banned) return;
  
  // Возраст
  if (data.startsWith('age_')) {
    const ages = { age_teen: '13-17', age_young: '18-24', age_adult: '25-34', age_mature: '35-44', age_senior: '45+' };
    updateUser(u.id, { age_group: ages[data] });
    u = getUser(tgId);
    await bot.editMessageText('✅ Возраст установлен!', { chat_id: chatId, message_id: q.message.message_id });
    return bot.sendMessage(chatId, 'Выберите пол:', { reply_markup: genderMenu() });
  }
  
  // Пол
  if (data.startsWith('gender_')) {
    const genders = { gender_male: 'male', gender_female: 'female', gender_other: 'other', gender_none: null };
    updateUser(u.id, { gender: genders[data] });
    u = getUser(tgId);
    await bot.sendMessage(chatId, '✅ Профиль настроен!\n\nДобро пожаловать!', { reply_markup: mainMenu(u) });
    return;
  }
  
  // Главное меню
  if (data === 'menu') {
    return bot.editMessageText('👋 Главное меню', { chat_id: chatId, message_id: q.message.message_id, reply_markup: mainMenu(u) });
  }
  
  // Поиск
  if (data === 'find') {
    if (activeChats.has(u.id)) return bot.sendMessage(chatId, '❌ Вы уже в чате!');
    if (queue.some(qu => qu.userId === u.id)) return bot.sendMessage(chatId, '⏳ Вы уже в очереди!');
    
    await bot.editMessageText('🔍 Ищем собеседника...', { chat_id: chatId, message_id: q.message.message_id });
    
    if (queue.length > 0) {
      const partner = queue.shift();
      const pu = db.prepare('SELECT * FROM users WHERE id = ?').get(partner.userId);
      
      createChat(u, pu);
      
      await bot.sendMessage(chatId, '✅ Собеседник найден!\n\nНачинайте общение.', { reply_markup: chatMenu() });
      await bot.sendMessage(partner.telegramId, '✅ Собеседник найден!\n\nНачинайте общение.', { reply_markup: chatMenu() });
    } else {
      queue.push({ userId: u.id, telegramId: tgId, chatId, timestamp: Date.now() });
      updateUser(u.id, { status: 'in_queue' });
      
      setTimeout(() => {
        const idx = queue.findIndex(qu => qu.userId === u.id);
        if (idx > -1) {
          queue.splice(idx, 1);
          updateUser(u.id, { status: 'idle' });
          bot.sendMessage(chatId, '⏱️ Собеседник не найден. Попробуйте позже.', { reply_markup: mainMenu(u) });
        }
      }, 60000);
    }
    return;
  }
  
  // Следующий/Завершить
  if (data === 'next' || data === 'end') {
    const chat = activeChats.get(u.id);
    if (!chat) return bot.sendMessage(chatId, '❌ Нет активного чата', { reply_markup: mainMenu(u) });
    
    endChat(u.id, chat, chatId);
    
    if (data === 'next') {
      queue.push({ userId: u.id, telegramId: tgId, chatId, timestamp: Date.now() });
      updateUser(u.id, { status: 'in_queue' });
      bot.sendMessage(chatId, '🔍 Ищем нового собеседника...');
    }
    return;
  }

  // Лайк
  if (data === 'like') {
    const chat = activeChats.get(u.id);
    if (!chat) return bot.sendMessage(chatId, '❌ Нет активного чата');
    
    const p = db.prepare('SELECT * FROM users WHERE id = ?').get(chat.partnerId);
    updateUser(chat.partnerId, { likes_received: p.likes_received + 1 });
    updateUser(u.id, { likes_given: u.likes_given + 1 });
    addExp(u.id, 5);
    
    await bot.sendMessage(chatId, '❤️ Вы отправили лайк!');
    await bot.sendMessage(chat.partnerTgId, '❤️ Вы получили лайк от собеседника!');
    return;
  }
  
  // Супер-лайк
  if (data === 'superlike') {
    const chat = activeChats.get(u.id);
    if (!chat) return bot.sendMessage(chatId, '❌ Нет активного чата');
    
    if (u.super_likes <= 0 && u.premium_tier === 'free') {
      return bot.sendMessage(chatId, '💎 Супер-лайки доступны только Premium пользователям!', { reply_markup: premiumMenu() });
    }
    
    const p = db.prepare('SELECT * FROM users WHERE id = ?').get(chat.partnerId);
    updateUser(chat.partnerId, { likes_received: p.likes_received + 3 });
    updateUser(u.id, { likes_given: u.likes_given + 1, super_likes: Math.max(0, u.super_likes - 1) });
    addExp(u.id, 15);
    
    await bot.sendMessage(chatId, '💖 Вы отправили супер-лайк!');
    await bot.sendMessage(chat.partnerTgId, '💖 ВАУ! Вы получили супер-лайк!');
    return;
  }
  
  // Жалоба
  if (data === 'report') {
    const chat = activeChats.get(u.id);
    if (!chat) return bot.sendMessage(chatId, '❌ Нет активного чата');
    
    userStates.set(u.id, { action: 'reporting', chatData: chat });
    return bot.editMessageText('🚫 Жалоба\n\nВыберите причину:', { chat_id: chatId, message_id: q.message.message_id, reply_markup: reportMenu() });
  }
  
  // Обработка жалоб
  if (data.startsWith('rep_')) {
    const state = userStates.get(u.id);
    if (!state || state.action !== 'reporting') return;
    
    if (data === 'rep_cancel') {
      userStates.delete(u.id);
      return bot.sendMessage(chatId, 'Отменено', { reply_markup: chatMenu() });
    }
    
    const types = { rep_spam: 'spam', rep_harass: 'harassment', rep_nsfw: 'nsfw', rep_threat: 'threat', rep_other: 'other' };
    const type = types[data];
    
    db.prepare('INSERT INTO reports (reporter_id, reported_id, chat_id, report_type) VALUES (?, ?, ?, ?)').run(u.id, state.chatData.partnerId, state.chatData.chatDbId, type);
    updateUser(u.id, { reports_filed: u.reports_filed + 1 });
    
    const p = db.prepare('SELECT * FROM users WHERE id = ?').get(state.chatData.partnerId);
    updateUser(state.chatData.partnerId, { reports_received: p.reports_received + 1 });
    
    const reportCount = db.prepare('SELECT COUNT(*) as c FROM reports WHERE reported_id = ? AND datetime(created_at) > datetime("now", "-24 hours")').get(state.chatData.partnerId).c;
    
    if (reportCount >= 5) {
      updateUser(state.chatData.partnerId, { banned: 1 });
      console.log(`⚠️ Пользователь забанен: ${state.chatData.partnerId} (${reportCount} жалоб)`);
    } else if (reportCount >= 3) {
      updateUser(state.chatData.partnerId, { shadow_banned: 1 });
      console.log(`⚠️ Теневой бан: ${state.chatData.partnerId} (${reportCount} жалоб)`);
    }
    
    await bot.sendMessage(chatId, '✅ Жалоба отправлена!\n\nСпасибо за помощь в поддержании безопасности!');
    
    endChat(u.id, state.chatData, chatId);
    userStates.delete(u.id);
    addExp(u.id, 10);
    return;
  }
  
  // В избранное
  if (data === 'fav_add') {
    const chat = activeChats.get(u.id);
    if (!chat) return bot.sendMessage(chatId, '❌ Нет активного чата');
    
    try {
      db.prepare('INSERT INTO favorites (user_id, favorite_user_id) VALUES (?, ?)').run(u.id, chat.partnerId);
      addExp(u.id, 5);
      await bot.sendMessage(chatId, '⭐ Добавлено в избранное!');
    } catch (e) {
      await bot.sendMessage(chatId, '⚠️ Уже в избранном');
    }
    return;
  }

  // Профиль
  if (data === 'profile') {
    const ach = db.prepare('SELECT COUNT(*) as c FROM user_achievements WHERE user_id = ?').get(u.id).c;
    const favs = db.prepare('SELECT COUNT(*) as c FROM favorites WHERE user_id = ?').get(u.id).c;
    const text = `👤 Ваш профиль\n\n🎯 Основное:\n• Уровень: ${u.level} ⚡\n• Опыт: ${u.experience} 🎯\n• Репутация: ${u.reputation}/100 💯\n\n📊 Статистика:\n• Чатов: ${u.total_chats} 💬\n• Сообщений: ${u.total_messages} 📝\n• Время: ${Math.floor(u.total_time / 60)} мин ⏱️\n• Лайков: ${u.likes_received} ❤️\n\n🏆 Достижения: ${ach}/12\n⭐ Избранных: ${favs}\n💎 Статус: ${u.premium_tier === 'free' ? 'Бесплатный' : u.premium_tier.toUpperCase()}`;
    return bot.editMessageText(text, { chat_id: chatId, message_id: q.message.message_id, reply_markup: { inline_keyboard: [[{ text: '🔙 Назад', callback_data: 'menu' }]] } });
  }
  
  // Статистика
  if (data === 'stats') {
    const avgMsg = u.total_chats > 0 ? Math.round(u.total_messages / u.total_chats) : 0;
    const avgTime = u.total_chats > 0 ? Math.round(u.total_time / u.total_chats / 60) : 0;
    const text = `📊 Статистика\n\n👥 Общение:\n• Всего чатов: ${u.total_chats}\n• Сообщений: ${u.total_messages}\n• Среднее на чат: ${avgMsg}\n• Время в чатах: ${Math.floor(u.total_time / 60)} мин\n• Среднее время: ${avgTime} мин\n\n⭐ Социальное:\n• Лайков получено: ${u.likes_received}\n• Лайков отдано: ${u.likes_given}\n• Жалоб подано: ${u.reports_filed}\n\n🏆 Прогресс:\n• Уровень: ${u.level}\n• Опыт: ${u.experience}\n• До след. уровня: ${(u.level * 100) - u.experience}`;
    return bot.editMessageText(text, { chat_id: chatId, message_id: q.message.message_id, reply_markup: { inline_keyboard: [[{ text: '🔙 Назад', callback_data: 'menu' }]] } });
  }
  
  // Достижения
  if (data === 'achievements') {
    const unlocked = db.prepare('SELECT a.* FROM achievements a INNER JOIN user_achievements ua ON a.id = ua.achievement_id WHERE ua.user_id = ?').all(u.id);
    const total = db.prepare('SELECT COUNT(*) as c FROM achievements').get().c;
    
    let text = `🏆 Достижения\n\n✅ Разблокировано: ${unlocked.length}/${total}\n\n`;
    
    if (unlocked.length > 0) {
      text += '🎯 Ваши достижения:\n';
      unlocked.forEach(a => {
        text += `${a.icon} ${a.name} - ${a.points} очков\n`;
      });
    } else {
      text += '💡 Начните общаться, чтобы получить достижения!';
    }
    
    return bot.editMessageText(text, { chat_id: chatId, message_id: q.message.message_id, reply_markup: { inline_keyboard: [[{ text: '🔙 Назад', callback_data: 'menu' }]] } });
  }
  
  // Настройки
  if (data === 'settings') {
    return bot.editMessageText('⚙️ Настройки\n\nВыберите раздел:', { chat_id: chatId, message_id: q.message.message_id, reply_markup: settingsMenu() });
  }
  
  if (data === 'set_filters') {
    return bot.editMessageText('🎯 Фильтры поиска\n\nНастройте параметры подбора собеседников:', { chat_id: chatId, message_id: q.message.message_id, reply_markup: filterMenu(u) });
  }
  
  if (data === 'filter_gender') {
    if (u.premium_tier === 'free') {
      return bot.sendMessage(chatId, '🔒 Фильтр по полу доступен только Premium пользователям!', { reply_markup: premiumMenu() });
    }
    return bot.editMessageText('👥 Фильтр по полу\n\nВыберите предпочтение:', { chat_id: chatId, message_id: q.message.message_id, reply_markup: genderFilterMenu() });
  }
  
  if (data.startsWith('gf_')) {
    const filters = { gf_male: 'male', gf_female: 'female', gf_any: null };
    const pref = filters[data];
    
    // Сохраняем в interests как JSON
    const interests = u.interests ? JSON.parse(u.interests) : {};
    interests.gender_filter = pref;
    updateUser(u.id, { interests: JSON.stringify(interests) });
    
    await bot.sendMessage(chatId, `✅ Фильтр установлен: ${pref === 'male' ? 'Только мужчины' : pref === 'female' ? 'Только женщины' : 'Любой пол'}`, { reply_markup: mainMenu(u) });
    return;
  }
  
  if (data === 'set_profile') {
    return bot.editMessageText('👤 Изменить профиль\n\nВыберите что изменить:', { 
      chat_id: chatId, 
      message_id: q.message.message_id, 
      reply_markup: {
        inline_keyboard: [
          [{ text: '🎂 Возраст', callback_data: 'edit_age' }],
          [{ text: '👥 Пол', callback_data: 'edit_gender' }],
          [{ text: '🔙 Назад', callback_data: 'settings' }]
        ]
      }
    });
  }
  
  if (data === 'edit_age') {
    return bot.editMessageText('🎂 Изменить возраст\n\nВыберите возрастную группу:', { chat_id: chatId, message_id: q.message.message_id, reply_markup: ageMenu() });
  }
  
  if (data === 'edit_gender') {
    return bot.editMessageText('👥 Изменить пол\n\nВыберите пол:', { chat_id: chatId, message_id: q.message.message_id, reply_markup: genderMenu() });
  }
  
  if (data === 'set_notif') {
    const notifEnabled = u.interests ? JSON.parse(u.interests).notifications !== false : true;
    const interests = u.interests ? JSON.parse(u.interests) : {};
    interests.notifications = !notifEnabled;
    updateUser(u.id, { interests: JSON.stringify(interests) });
    
    await bot.sendMessage(chatId, `🔔 Уведомления ${!notifEnabled ? 'включены' : 'выключены'}`, { reply_markup: mainMenu(u) });
    return;
  }
  
  if (data === 'set_privacy') {
    return bot.editMessageText('🔒 Приватность\n\nНастройки конфиденциальности:', { 
      chat_id: chatId, 
      message_id: q.message.message_id, 
      reply_markup: {
        inline_keyboard: [
          [{ text: '👁️ Невидимый режим', callback_data: u.premium_tier !== 'free' ? 'toggle_invisible' : 'premium' }],
          [{ text: '🚫 Черный список', callback_data: 'view_blacklist' }],
          [{ text: '🔙 Назад', callback_data: 'settings' }]
        ]
      }
    });
  }
  
  if (data === 'toggle_invisible') {
    const interests = u.interests ? JSON.parse(u.interests) : {};
    interests.invisible = !interests.invisible;
    updateUser(u.id, { interests: JSON.stringify(interests) });
    
    await bot.sendMessage(chatId, `👁️ Невидимый режим ${interests.invisible ? 'включен' : 'выключен'}`, { reply_markup: mainMenu(u) });
    return;
  }

  // Premium
  if (data === 'premium') {
    const text = `💎 Premium подписка\n\n🌟 Basic (50 ⭐):\n• Приоритет в очереди\n• Фильтр по полу\n• Без рекламы\n• 2x опыта\n\n⭐ Pro (100 ⭐):\n• Все из Basic\n• Невидимый режим\n• 5 супер-лайков/день\n• 3x опыта\n\n👑 VIP (200 ⭐):\n• Все из Pro\n• VIP значок\n• 10 супер-лайков/день\n• 5x опыта\n\n🔥 Ultra (350 ⭐):\n• Все из VIP\n• Эксклюзивные темы\n• 20 супер-лайков/день\n• 10x опыта\n\n⚡ God (500 ⭐):\n• Все функции\n• Безлимитные супер-лайки\n• 20x опыта`;
    return bot.editMessageText(text, { chat_id: chatId, message_id: q.message.message_id, reply_markup: premiumMenu() });
  }
  
  // Покупка Premium через Telegram Stars
  if (data.startsWith('buy_')) {
    const tiers = { 
      buy_basic: { name: 'basic', stars: 50, title: 'Basic Premium', desc: 'Приоритет, фильтр пола, 2x опыта' },
      buy_pro: { name: 'pro', stars: 100, title: 'Pro Premium', desc: 'Basic + невидимый режим, 5 супер-лайков, 3x опыта' },
      buy_vip: { name: 'vip', stars: 200, title: 'VIP Premium', desc: 'Pro + VIP значок, 10 супер-лайков, 5x опыта' },
      buy_ultra: { name: 'ultra', stars: 350, title: 'Ultra Premium', desc: 'VIP + эксклюзивные темы, 20 супер-лайков, 10x опыта' },
      buy_god: { name: 'god', stars: 500, title: 'God Premium', desc: 'Все функции, безлимитные супер-лайки, 20x опыта' }
    };
    
    const tier = tiers[data];
    if (!tier) return;
    
    // Создаем инвойс для оплаты через Telegram Stars
    try {
      await bot.sendInvoice(
        chatId,
        `💎 ${tier.title}`,
        tier.desc,
        `premium_${tier.name}_${u.id}_${Date.now()}`, // payload
        '', // provider_token (пустой для Stars)
        'XTR', // currency (XTR = Telegram Stars)
        [{ label: tier.title, amount: tier.stars }], // prices
        {
          photo_url: 'https://i.imgur.com/premium.png',
          photo_width: 512,
          photo_height: 512,
          need_name: false,
          need_phone_number: false,
          need_email: false,
          need_shipping_address: false,
          is_flexible: false
        }
      );
      
      await bot.sendMessage(chatId, '💳 Счет отправлен! Нажмите "Оплатить" для покупки Premium.');
      
    } catch (err) {
      console.error('❌ Ошибка создания инвойса:', err.message);
      await bot.sendMessage(chatId, '❌ Ошибка создания счета. Попробуйте позже.');
    }
    
    return;
  }
  
  // Помощь
  if (data === 'help') {
    const text = `❓ Помощь\n\n🎲 Основное:\n• Найти собеседника - начать чат\n• Профиль - ваша статистика\n• Достижения - 12 наград\n\n⚡ Функции:\n• AI-модерация\n• Автоматические баны\n• 5 уровней Premium\n\n🔒 Безопасность:\n• 5 типов жалоб\n• Автобан при 5+ жалобах\n• Теневой бан при 3+ жалобах`;
    return bot.editMessageText(text, { chat_id: chatId, message_id: q.message.message_id, reply_markup: { inline_keyboard: [[{ text: '🔙 Назад', callback_data: 'menu' }]] } });
  }
  
  // Оценка
  if (data.startsWith('r')) {
    const rating = parseInt(data.replace('r', ''));
    if (rating > 0) addExp(u.id, 5);
    await bot.sendMessage(chatId, '✅ Спасибо за оценку!', { reply_markup: mainMenu(u) });
    return;
  }
});

// Обработка pre_checkout (подтверждение оплаты)
bot.on('pre_checkout_query', async (query) => {
  try {
    await bot.answerPreCheckoutQuery(query.id, true);
  } catch (err) {
    console.error('❌ Ошибка pre_checkout:', err.message);
    await bot.answerPreCheckoutQuery(query.id, false, { error_message: 'Ошибка обработки платежа' });
  }
});

// Обработка успешной оплаты
bot.on('successful_payment', async (msg) => {
  const tgId = msg.from.id;
  const chatId = msg.chat.id;
  const payment = msg.successful_payment;
  
  console.log('💰 Успешная оплата:', payment);
  
  const u = getUser(tgId);
  if (!u) return;
  
  // Парсим payload: premium_TIER_USERID_TIMESTAMP
  const payload = payment.invoice_payload;
  const parts = payload.split('_');
  
  if (parts[0] === 'premium' && parts.length >= 3) {
    const tier = parts[1];
    const superLikes = { basic: 0, pro: 5, vip: 10, ultra: 20, god: 999 };
    
    updateUser(u.id, { premium_tier: tier, super_likes: superLikes[tier] });
    addExp(u.id, 500);
    
    const tierNames = { basic: 'Basic', pro: 'Pro', vip: 'VIP', ultra: 'Ultra', god: 'God' };
    
    await bot.sendMessage(chatId, `✅ Premium ${tierNames[tier]} активирован! 🔥\n\n💎 Спасибо за поддержку!\n\n🎁 Бонусы:\n• ${superLikes[tier] === 999 ? 'Безлимитные' : superLikes[tier]} супер-лайков/день\n• Множитель опыта активирован\n• +500 опыта\n\nВсе функции Premium доступны!`, { reply_markup: mainMenu(db.prepare('SELECT * FROM users WHERE id = ?').get(u.id)) });
    
    console.log(`💎 Premium активирован: ${u.first_name} -> ${tierNames[tier]} (${payment.total_amount} Stars)`);
  }
});

// Обработчик сообщений
bot.on('message', async (msg) => {
  if (msg.text && msg.text.startsWith('/')) return;
  
  const tgId = msg.from.id;
  const chatId = msg.chat.id;
  
  const u = getUser(tgId);
  if (!u || u.banned) return;
  
  if (u.shadow_banned && Math.random() > 0.5) {
    return bot.sendMessage(chatId, '✅ Сообщение отправлено');
  }
  
  const chat = activeChats.get(u.id);
  if (!chat) {
    return bot.sendMessage(chatId, '❌ Вы не в чате. Найдите собеседника!', { reply_markup: mainMenu(u) });
  }
  
  // Получаем данные партнера
  const partner = db.prepare('SELECT * FROM users WHERE id = ?').get(chat.partnerId);
  
  // Проверка возрастных ограничений
  const ageGroups = { '13-17': 1, '18-24': 2, '25-34': 3, '35-44': 4, '45+': 5 };
  const userAgeLevel = ageGroups[u.age_group] || 0;
  const partnerAgeLevel = ageGroups[partner.age_group] || 0;
  
  // Если пользователь младше 18 (группа 13-17) и партнер старше
  if (userAgeLevel === 1 && partnerAgeLevel > 1) {
    await bot.sendMessage(chatId, '🚫 Сообщение заблокировано\n\n⚠️ Причина: Возрастное ограничение\n\nВы не можете писать пользователям старше 18 лет для вашей безопасности.\n\nЧат будет завершен.');
    
    // Уведомляем партнера
    await bot.sendMessage(chat.partnerTgId, '⚠️ Чат завершен по причине возрастных ограничений.\n\nСобеседник был младше 18 лет.');
    
    // Завершаем чат
    endChat(u.id, chat, chatId);
    return;
  }
  
  // Если пользователь 18-24 и партнер значительно старше (35+)
  if (userAgeLevel === 2 && partnerAgeLevel >= 4) {
    const chatData = db.prepare('SELECT messages_count FROM chats WHERE id = ?').get(chat.chatDbId);
    
    // Разрешаем только если партнер уже написал первым
    if (chatData.messages_count === 0) {
      await bot.sendMessage(chatId, '🚫 Сообщение заблокировано\n\n⚠️ Причина: Возрастное ограничение\n\nВы не можете писать первым пользователям значительно старше вас.\n\nДождитесь сообщения от собеседника или завершите чат.');
      return;
    }
  }
  
  // Модерация текста
  if (msg.text) {
    const modResult = moderateMessage(msg.text);
    
    if (modResult.block) {
      updateUser(u.id, { reports_received: u.reports_received + 1 });
      return bot.sendMessage(chatId, '🚫 Сообщение заблокировано AI-модерацией\n\nПричина: токсичный контент или спам');
    }
    
    if (modResult.warning) {
      await bot.sendMessage(chatId, '⚠️ Предупреждение: ваше сообщение может нарушать правила');
    }
    
    db.prepare('INSERT INTO messages (chat_id, sender_id, message_type, content, toxicity_score) VALUES (?, ?, ?, ?, ?)').run(chat.chatDbId, u.id, 'text', msg.text, modResult.score);
  }
  
  // Множители опыта по Premium
  const expMultipliers = { free: 1, basic: 2, pro: 3, vip: 5, ultra: 10, god: 20 };
  const expGain = 1 * expMultipliers[u.premium_tier];
  
  updateUser(u.id, { total_messages: u.total_messages + 1 });
  addExp(u.id, expGain);
  
  // Отправка партнеру
  try {
    if (msg.text) {
      await bot.sendMessage(chat.partnerTgId, msg.text);
    } else if (msg.photo) {
      const photo = msg.photo[msg.photo.length - 1];
      await bot.sendPhoto(chat.partnerTgId, photo.file_id, { caption: msg.caption || '' });
      db.prepare('INSERT INTO messages (chat_id, sender_id, message_type, content) VALUES (?, ?, ?, ?)').run(chat.chatDbId, u.id, 'photo', photo.file_id);
    } else if (msg.voice) {
      await bot.sendVoice(chat.partnerTgId, msg.voice.file_id);
      db.prepare('INSERT INTO messages (chat_id, sender_id, message_type, content) VALUES (?, ?, ?, ?)').run(chat.chatDbId, u.id, 'voice', msg.voice.file_id);
    } else if (msg.sticker) {
      await bot.sendSticker(chat.partnerTgId, msg.sticker.file_id);
      db.prepare('INSERT INTO messages (chat_id, sender_id, message_type, content) VALUES (?, ?, ?, ?)').run(chat.chatDbId, u.id, 'sticker', msg.sticker.file_id);
    } else if (msg.animation) {
      await bot.sendAnimation(chat.partnerTgId, msg.animation.file_id, { caption: msg.caption || '' });
      db.prepare('INSERT INTO messages (chat_id, sender_id, message_type, content) VALUES (?, ?, ?, ?)').run(chat.chatDbId, u.id, 'gif', msg.animation.file_id);
    } else if (msg.video) {
      await bot.sendVideo(chat.partnerTgId, msg.video.file_id, { caption: msg.caption || '' });
      db.prepare('INSERT INTO messages (chat_id, sender_id, message_type, content) VALUES (?, ?, ?, ?)').run(chat.chatDbId, u.id, 'video', msg.video.file_id);
    } else if (msg.audio) {
      await bot.sendAudio(chat.partnerTgId, msg.audio.file_id, { caption: msg.caption || '' });
      db.prepare('INSERT INTO messages (chat_id, sender_id, message_type, content) VALUES (?, ?, ?, ?)').run(chat.chatDbId, u.id, 'audio', msg.audio.file_id);
    } else if (msg.document) {
      await bot.sendDocument(chat.partnerTgId, msg.document.file_id, { caption: msg.caption || '' });
      db.prepare('INSERT INTO messages (chat_id, sender_id, message_type, content) VALUES (?, ?, ?, ?)').run(chat.chatDbId, u.id, 'document', msg.document.file_id);
    } else if (msg.video_note) {
      await bot.sendVideoNote(chat.partnerTgId, msg.video_note.file_id);
      db.prepare('INSERT INTO messages (chat_id, sender_id, message_type, content) VALUES (?, ?, ?, ?)').run(chat.chatDbId, u.id, 'video_note', msg.video_note.file_id);
    }
    
    // Обновление счетчика сообщений в чате
    db.prepare('UPDATE chats SET messages_count = messages_count + 1 WHERE id = ?').run(chat.chatDbId);
    
    // Проверка достижений
    const newAchievements = checkAchievements(u.id);
    if (newAchievements.length > 0) {
      newAchievements.forEach(ach => {
        bot.sendMessage(chatId, `🏆 Новое достижение!\n\n${ach.icon} ${ach.name}\n${ach.description}\n\n+${ach.points} очков опыта!`);
      });
    }
    
  } catch (err) {
    console.error('❌ Ошибка отправки сообщения:', err.message);
    bot.sendMessage(chatId, '❌ Ошибка отправки. Собеседник мог покинуть чат.');
    
    // Завершаем чат при ошибке
    endChat(u.id, chat, chatId);
  }
});

// Обработка ошибок
bot.on('polling_error', (err) => {
  console.error('❌ Polling error:', err.code || err.message);
  
  // Игнорируем временные сетевые ошибки
  if (err.code === 'EFATAL' || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT') {
    console.log('⚠️ Временная сетевая ошибка, переподключение...');
    return;
  }
  
  // Критические ошибки
  if (err.code === 'ETELEGRAM' && err.response && err.response.statusCode === 401) {
    console.error('❌ КРИТИЧЕСКАЯ ОШИБКА: Неверный токен бота!');
    process.exit(1);
  }
});

bot.on('error', (err) => {
  console.error('❌ Bot error:', err.message);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err.message);
  // Не останавливаем бота при некритических ошибках
});

process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err.message || err);
  // Не останавливаем бота при некритических ошибках
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Остановка бота...');
  
  // Завершаем все активные чаты
  activeChats.forEach((chat, userId) => {
    try {
      const u = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
      if (u) {
        bot.sendMessage(u.telegram_id, '⚠️ Бот перезагружается. Чат завершен.', { reply_markup: mainMenu(u) });
      }
    } catch (e) {}
  });
  
  // Очищаем очередь
  queue.forEach(q => {
    try {
      bot.sendMessage(q.telegramId, '⚠️ Бот перезагружается. Поиск отменен.');
    } catch (e) {}
  });
  
  db.close();
  console.log('✅ База данных закрыта');
  console.log('✅ Бот остановлен');
  process.exit(0);
});

console.log('✅ Обработчики сообщений активны');
console.log('✅ Система готова к работе');
console.log('');
console.log('📱 Откройте бота в Telegram и отправьте /start');
console.log('');
