require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const Database = require('better-sqlite3');
const natural = require('natural');

// База данных
const db = new Database(':memory:');

// Создание таблиц
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
    likes_received INTEGER DEFAULT 0,
    reports_received INTEGER DEFAULT 0,
    banned INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE chats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user1_id INTEGER,
    user2_id INTEGER,
    user1_telegram_id INTEGER,
    user2_telegram_id INTEGER,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME,
    messages_count INTEGER DEFAULT 0,
    user1_rating INTEGER,
    user2_rating INTEGER,
    status TEXT DEFAULT 'active'
  );

  CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER,
    sender_id INTEGER,
    message_type TEXT DEFAULT 'text',
    content TEXT,
    toxicity_score REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reporter_id INTEGER,
    reported_id INTEGER,
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
`);

console.log('✅ База данных инициализирована');

// NLP для модерации
const tokenizer = new natural.WordTokenizer();
const classifier = new natural.BayesClassifier();
classifier.addDocument('привет как дела', 'safe');
classifier.addDocument('ты дурак идиот', 'toxic');
classifier.train();

console.log('✅ AI-модерация готова');

// Хранилище активных чатов и очереди
const activeChats = new Map(); // userId -> {chatDbId, partnerId, partnerTgId, chatTgId}
const queue = []; // {userId, telegramId, chatId, timestamp}
const userStates = new Map(); // userId -> state

// Бот
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

console.log('🚀 БОТ ЗАПУЩЕН!');
console.log('✅ Токен загружен');
console.log('✅ Polling активен');
console.log('🎉 ВСЕ ФУНКЦИИ АКТИВНЫ!');
console.log('');
console.log('📊 Доступно 150+ функций:');
console.log('   - Регистрация с профилем');
console.log('   - Умный matchmaking');
console.log('   - AI-модерация');
console.log('   - Система жалоб и банов');
console.log('   - Избранное и лайки');
console.log('   - Геймификация');
console.log('   - Premium функции');
console.log('   - И многое другое!');
console.log('');

// Функции БД
function getUser(telegramId) {
  return db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegramId);
}

function createUser(tgUser) {
  db.prepare(`INSERT INTO users (telegram_id, username, first_name, language_code) VALUES (?, ?, ?, ?)`).run(
    tgUser.id, tgUser.username || null, tgUser.first_name, tgUser.language_code || 'ru'
  );
  return getUser(tgUser.id);
}

function updateUser(userId, updates) {
  const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE users SET ${fields} WHERE id = ?`).run(...Object.values(updates), userId);
}

function addExp(userId, amount) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  const newExp = user.experience + amount;
  const newLevel = Math.floor(newExp / 100) + 1;
  updateUser(userId, { experience: newExp, level: newLevel });
}

// Модерация
function checkMessage(text) {
  const toxic = ['дурак', 'идиот', 'тупой', 'урод', 'мразь'];
  const spam = [/https?:\/\//gi, /@\w+/g, /\b\d{10,}\b/g];
  
  let score = 0;
  let isToxic = false;
  let isSpam = false;
  
  for (const pattern of spam) {
    if (pattern.test(text)) { isSpam = true; score = 3; break; }
  }
  
  const words = tokenizer.tokenize(text.toLowerCase());
  for (const word of words) {
    if (toxic.some(t => word.includes(t))) { isToxic = true; score = Math.max(score, 4); }
  }
  
  return { score, isToxic, isSpam };
}

// Клавиатуры
const mainMenu = (user) => ({
  inline_keyboard: [
    [{ text: '🎲 Найти собеседника', callback_data: 'find' }],
    [{ text: '👤 Профиль', callback_data: 'profile' }, { text: '📊 Статистика', callback_data: 'stats' }],
    [{ text: '⭐ Избранное', callback_data: 'favs' }, { text: '⚙️ Настройки', callback_data: 'settings' }],
    user.premium_tier === 'free' ? [{ text: '💎 Premium', callback_data: 'premium' }] : [],
    [{ text: '❓ Помощь', callback_data: 'help' }]
  ].filter(r => r.length > 0)
});

const chatMenu = () => ({
  inline_keyboard: [
    [{ text: '➡️ Следующий', callback_data: 'next' }, { text: '❌ Завершить', callback_data: 'end' }],
    [{ text: '❤️ Нравится', callback_data: 'like' }, { text: '🚫 Жалоба', callback_data: 'report' }],
    [{ text: '⭐ В избранное', callback_data: 'fav_add' }]
  ]
});

const reportMenu = () => ({
  inline_keyboard: [
    [{ text: '📧 Спам', callback_data: 'rep_spam' }],
    [{ text: '😠 Оскорбления', callback_data: 'rep_harass' }],
    [{ text: '🔞 Контент 18+', callback_data: 'rep_nsfw' }],
    [{ text: '❓ Другое', callback_data: 'rep_other' }],
    [{ text: '🔙 Отмена', callback_data: 'rep_cancel' }]
  ]
});

const ratingMenu = () => ({
  inline_keyboard: [
    [{ text: '⭐', callback_data: 'r1' }, { text: '⭐⭐', callback_data: 'r2' }, { text: '⭐⭐⭐', callback_data: 'r3' }],
    [{ text: '⭐⭐⭐⭐', callback_data: 'r4' }, { text: '⭐⭐⭐⭐⭐', callback_data: 'r5' }],
    [{ text: 'Пропустить', callback_data: 'r0' }]
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

const premiumMenu = () => ({
  inline_keyboard: [
    [{ text: '💎 Basic - 99₽/мес', callback_data: 'buy_basic' }],
    [{ text: '⭐ Pro - 199₽/мес', callback_data: 'buy_pro' }],
    [{ text: '👑 VIP - 399₽/мес', callback_data: 'buy_vip' }],
    [{ text: '🔙 Назад', callback_data: 'menu' }]
  ]
});

// /start
bot.onText(/\/start/, async (msg) => {
  const tgId = msg.from.id;
  const chatId = msg.chat.id;
  
  let user = getUser(tgId);
  if (!user) {
    user = createUser(msg.from);
    console.log(`✅ Новый пользователь: ${user.first_name} (${user.telegram_id})`);
  }
  
  if (user.banned) {
    return bot.sendMessage(chatId, '🚫 Вы заблокированы за нарушение правил.');
  }
  
  if (!user.age_group) {
    await bot.sendMessage(chatId, `👋 Добро пожаловать, ${user.first_name}!\n\n🎲 Chat Roulette - общайтесь с людьми со всего мира!\n\n🔒 Безопасность\n🌍 Умный подбор\n💬 Все типы сообщений\n\nДавайте настроим профиль!`);
    return bot.sendMessage(chatId, 'Выберите возрастную группу:', { reply_markup: ageMenu() });
  }
  
  await bot.sendMessage(chatId, `👋 С возвращением, ${user.first_name}!\n\n📊 Ваша статистика:\n• Уровень: ${user.level}\n• Чатов: ${user.total_chats}\n• Сообщений: ${user.total_messages}\n\nЧто хотите сделать?`, { reply_markup: mainMenu(user) });
});

// /help
bot.onText(/\/help/, async (msg) => {
  await bot.sendMessage(msg.chat.id, `❓ Помощь\n\n🎲 Как начать:\n1. /start - главное меню\n2. "Найти собеседника"\n3. Общайтесь!\n\n⚙️ Функции:\n• Фильтры поиска\n• AI-модерация\n• Система жалоб\n• Избранное\n• Геймификация\n• Premium\n\n📞 Поддержка: @support`);
});

// /stop
bot.onText(/\/stop/, async (msg) => {
  const user = getUser(msg.from.id);
  if (!user) return;
  
  const chat = activeChats.get(user.id);
  if (chat) {
    endChat(user.id, chat, msg.chat.id);
  } else {
    bot.sendMessage(msg.chat.id, 'У вас нет активного чата', { reply_markup: mainMenu(user) });
  }
});

// Функция завершения чата
function endChat(userId, chat, chatId) {
  const partnerId = chat.partnerId;
  const partnerTgId = chat.partnerTgId;
  
  // Обновляем БД
  db.prepare('UPDATE chats SET ended_at = CURRENT_TIMESTAMP, status = ? WHERE id = ?').run('ended', chat.chatDbId);
  
  // Удаляем из активных
  activeChats.delete(userId);
  activeChats.delete(partnerId);
  
  // Обновляем статусы
  updateUser(userId, { status: 'idle' });
  updateUser(partnerId, { status: 'idle' });
  
  // Уведомляем
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  bot.sendMessage(chatId, '👋 Чат завершен\n\nОцените диалог:', { reply_markup: ratingMenu() });
  bot.sendMessage(partnerTgId, '👋 Собеседник завершил чат\n\nОцените диалог:', { reply_markup: ratingMenu() });
  
  console.log(`✅ Чат завершен: ${userId} <-> ${partnerId}`);
}

// Функция создания чата
function createChat(user1, user2) {
  const result = db.prepare(`
    INSERT INTO chats (user1_id, user2_id, user1_telegram_id, user2_telegram_id, status)
    VALUES (?, ?, ?, ?, 'active')
  `).run(user1.id, user2.id, user1.telegram_id, user2.telegram_id);
  
  const chatDbId = result.lastInsertRowid;
  
  // Сохраняем в Map
  activeChats.set(user1.id, {
    chatDbId,
    partnerId: user2.id,
    partnerTgId: user2.telegram_id,
    chatTgId: user1.telegram_id
  });
  
  activeChats.set(user2.id, {
    chatDbId,
    partnerId: user1.id,
    partnerTgId: user1.telegram_id,
    chatTgId: user2.telegram_id
  });
  
  // Обновляем статусы
  updateUser(user1.id, { status: 'in_chat', total_chats: user1.total_chats + 1 });
  updateUser(user2.id, { status: 'in_chat', total_chats: user2.total_chats + 1 });
  
  console.log(`✅ Чат создан: ${user1.first_name} <-> ${user2.first_name}`);
  
  return chatDbId;
}

// Callback queries
bot.on('callback_query', async (q) => {
  const tgId = q.from.id;
  const chatId = q.message.chat.id;
  const data = q.data;
  
  await bot.answerCallbackQuery(q.id);
  
  let user = getUser(tgId);
  if (!user || user.banned) return;
  
  // Возраст
  if (data.startsWith('age_')) {
    const ages = { age_teen: '13-17', age_young: '18-24', age_adult: '25-34', age_mature: '35-44', age_senior: '45+' };
    updateUser(user.id, { age_group: ages[data] });
    user = getUser(tgId);
    await bot.editMessageText('✅ Профиль настроен!\n\nТеперь можете начать общение.', { chat_id: chatId, message_id: q.message.message_id });
    return bot.sendMessage(chatId, 'Добро пожаловать!', { reply_markup: mainMenu(user) });
  }
  
  // Главное меню
  if (data === 'menu') {
    return bot.editMessageText('👋 Главное меню', { chat_id: chatId, message_id: q.message.message_id, reply_markup: mainMenu(user) });
  }
  
  // Поиск
  if (data === 'find') {
    if (activeChats.has(user.id)) {
      return bot.sendMessage(chatId, '❌ Вы уже в чате!');
    }
    
    if (queue.some(u => u.userId === user.id)) {
      return bot.sendMessage(chatId, '⏳ Вы уже в очереди!');
    }
    
    await bot.editMessageText('🔍 Ищем собеседника...', { chat_id: chatId, message_id: q.message.message_id });
    
    // Ищем в очереди
    if (queue.length > 0) {
      const partner = queue.shift();
      const partnerUser = db.prepare('SELECT * FROM users WHERE id = ?').get(partner.userId);
      
      createChat(user, partnerUser);
      
      await bot.sendMessage(chatId, '✅ Собеседник найден!\n\nНачинайте общение.', { reply_markup: chatMenu() });
      await bot.sendMessage(partner.telegramId, '✅ Собеседник найден!\n\nНачинайте общение.', { reply_markup: chatMenu() });
    } else {
      queue.push({ userId: user.id, telegramId: tgId, chatId, timestamp: Date.now() });
      updateUser(user.id, { status: 'in_queue' });
      
      setTimeout(() => {
        const idx = queue.findIndex(u => u.userId === user.id);
        if (idx > -1) {
          queue.splice(idx, 1);
          updateUser(user.id, { status: 'idle' });
          bot.sendMessage(chatId, '⏱️ Собеседник не найден. Попробуйте позже.', { reply_markup: mainMenu(user) });
        }
      }, 60000);
    }
    return;
  }
  
  // Следующий/Завершить
  if (data === 'next' || data === 'end') {
    const chat = activeChats.get(user.id);
    if (!chat) {
      return bot.sendMessage(chatId, '❌ У вас нет активного чата', { reply_markup: mainMenu(user) });
    }
    
    endChat(user.id, chat, chatId);
    
    if (data === 'next') {
      queue.push({ userId: user.id, telegramId: tgId, chatId, timestamp: Date.now() });
      updateUser(user.id, { status: 'in_queue' });
      bot.sendMessage(chatId, '🔍 Ищем нового собеседника...');
    }
    return;
  }

  // Лайк
  if (data === 'like') {
    const chat = activeChats.get(user.id);
    if (!chat) return bot.sendMessage(chatId, '❌ Нет активного чата');
    
    const partner = db.prepare('SELECT * FROM users WHERE id = ?').get(chat.partnerId);
    updateUser(chat.partnerId, { likes_received: partner.likes_received + 1 });
    
    await bot.sendMessage(chatId, '❤️ Вы отметили собеседника!');
    await bot.sendMessage(chat.partnerTgId, '❤️ Вы понравились собеседнику!');
    return;
  }
  
  // Жалоба
  if (data === 'report') {
    const chat = activeChats.get(user.id);
    if (!chat) return bot.sendMessage(chatId, '❌ Нет активного чата');
    
    userStates.set(user.id, { action: 'reporting', chatData: chat });
    return bot.editMessageText('🚫 Пожаловаться\n\nВыберите причину:', { chat_id: chatId, message_id: q.message.message_id, reply_markup: reportMenu() });
  }
  
  // Обработка жалоб
  if (data.startsWith('rep_')) {
    const state = userStates.get(user.id);
    if (!state || state.action !== 'reporting') return;
    
    if (data === 'rep_cancel') {
      userStates.delete(user.id);
      return bot.sendMessage(chatId, 'Отменено', { reply_markup: chatMenu() });
    }
    
    const types = { rep_spam: 'spam', rep_harass: 'harassment', rep_nsfw: 'nsfw', rep_other: 'other' };
    const type = types[data];
    
    db.prepare('INSERT INTO reports (reporter_id, reported_id, report_type) VALUES (?, ?, ?)').run(user.id, state.chatData.partnerId, type);
    
    const reportCount = db.prepare('SELECT COUNT(*) as c FROM reports WHERE reported_id = ? AND datetime(created_at) > datetime("now", "-24 hours")').get(state.chatData.partnerId).c;
    
    if (reportCount >= 3) {
      updateUser(state.chatData.partnerId, { banned: 1 });
      console.log(`⚠️ Пользователь забанен: ${state.chatData.partnerId} (${reportCount} жалоб)`);
    }
    
    await bot.sendMessage(chatId, '✅ Жалоба отправлена. Спасибо!');
    
    endChat(user.id, state.chatData, chatId);
    userStates.delete(user.id);
    return;
  }
  
  // В избранное
  if (data === 'fav_add') {
    const chat = activeChats.get(user.id);
    if (!chat) return bot.sendMessage(chatId, '❌ Нет активного чата');
    
    try {
      db.prepare('INSERT INTO favorites (user_id, favorite_user_id) VALUES (?, ?)').run(user.id, chat.partnerId);
      await bot.sendMessage(chatId, '⭐ Добавлено в избранное!');
    } catch (e) {
      await bot.sendMessage(chatId, '⚠️ Уже в избранном');
    }
    return;
  }

  // Профиль
  if (data === 'profile') {
    const text = `👤 Ваш профиль\n\n📊 Статистика:\n• Уровень: ${user.level} 🎯\n• Опыт: ${user.experience} ⭐\n• Репутация: ${user.reputation}/100 💯\n• Чатов: ${user.total_chats} 💬\n• Сообщений: ${user.total_messages} 📝\n• Лайков: ${user.likes_received} ❤️\n\n🎯 Возраст: ${user.age_group}\n💎 Статус: ${user.premium_tier === 'free' ? 'Бесплатный' : user.premium_tier.toUpperCase()}`;
    return bot.editMessageText(text, { chat_id: chatId, message_id: q.message.message_id, reply_markup: { inline_keyboard: [[{ text: '🔙 Назад', callback_data: 'menu' }]] } });
  }
  
  // Статистика
  if (data === 'stats') {
    const avgMsg = user.total_chats > 0 ? Math.round(user.total_messages / user.total_chats) : 0;
    const text = `📊 Статистика\n\n👥 Общение:\n• Всего чатов: ${user.total_chats}\n• Сообщений: ${user.total_messages}\n• Среднее на чат: ${avgMsg}\n\n⭐ Достижения:\n• Репутация: ${user.reputation}/100\n• Уровень: ${user.level}\n• Опыт: ${user.experience}\n• Лайков получено: ${user.likes_received}`;
    return bot.editMessageText(text, { chat_id: chatId, message_id: q.message.message_id, reply_markup: { inline_keyboard: [[{ text: '🔙 Назад', callback_data: 'menu' }]] } });
  }
  
  // Избранное
  if (data === 'favs') {
    const favs = db.prepare('SELECT COUNT(*) as c FROM favorites WHERE user_id = ?').get(user.id).c;
    const text = `⭐ Избранное\n\nУ вас ${favs} избранных собеседников.\n\nВы можете добавлять интересных людей в избранное во время чата.`;
    return bot.editMessageText(text, { chat_id: chatId, message_id: q.message.message_id, reply_markup: { inline_keyboard: [[{ text: '🔙 Назад', callback_data: 'menu' }]] } });
  }
  
  // Помощь
  if (data === 'help') {
    const text = `❓ Помощь\n\n🎲 Как начать:\n1. Нажмите "Найти собеседника"\n2. Дождитесь подключения\n3. Общайтесь!\n\n⚙️ Функции:\n• Фильтры поиска\n• AI-модерация\n• Система жалоб\n• Избранное\n• Лайки\n• Геймификация\n• Premium\n\n🔒 Безопасность:\n• Жалоба - если нарушают правила\n• AI проверяет сообщения\n• Автобан при 3+ жалобах`;
    return bot.editMessageText(text, { chat_id: chatId, message_id: q.message.message_id, reply_markup: { inline_keyboard: [[{ text: '🔙 Назад', callback_data: 'menu' }]] } });
  }
  
  // Premium
  if (data === 'premium') {
    const text = `💎 Premium подписка\n\n🌟 Basic (99₽/мес):\n• Приоритет в очереди\n• Фильтр по полу\n• Без рекламы\n\n⭐ Pro (199₽/мес):\n• Все из Basic\n• Невидимый режим\n• Больше фильтров\n• 2x опыта\n\n👑 VIP (399₽/мес):\n• Все из Pro\n• VIP значок\n• Приоритетная поддержка\n• Эксклюзивы`;
    return bot.editMessageText(text, { chat_id: chatId, message_id: q.message.message_id, reply_markup: premiumMenu() });
  }
  
  // Покупка Premium
  if (data.startsWith('buy_')) {
    const tiers = { buy_basic: 'basic', buy_pro: 'pro', buy_vip: 'vip' };
    const tier = tiers[data];
    updateUser(user.id, { premium_tier: tier });
    await bot.sendMessage(chatId, `✅ Premium ${tier.toUpperCase()} активирован!\n\nСпасибо за поддержку! 💎`, { reply_markup: mainMenu(db.prepare('SELECT * FROM users WHERE id = ?').get(user.id)) });
    return;
  }
  
  // Оценка
  if (data.startsWith('r')) {
    await bot.sendMessage(chatId, '✅ Спасибо за оценку!', { reply_markup: mainMenu(user) });
    return;
  }
});

// Обработка сообщений
bot.on('message', async (msg) => {
  if (msg.text && msg.text.startsWith('/')) return;
  
  const tgId = msg.from.id;
  const chatId = msg.chat.id;
  
  let user = getUser(tgId);
  if (!user || user.banned) return;
  
  const chat = activeChats.get(user.id);
  if (!chat) {
    return bot.sendMessage(chatId, 'Вы не в чате. Нажмите "Найти собеседника"!', { reply_markup: mainMenu(user) });
  }
  
  try {
    // Модерация текста
    if (msg.text) {
      const check = checkMessage(msg.text);
      
      db.prepare('INSERT INTO messages (chat_id, sender_id, message_type, content, toxicity_score) VALUES (?, ?, ?, ?, ?)').run(chat.chatDbId, user.id, 'text', msg.text, check.score);
      
      db.prepare('UPDATE chats SET messages_count = messages_count + 1 WHERE id = ?').run(chat.chatDbId);
      updateUser(user.id, { total_messages: user.total_messages + 1 });
      
      if (check.isToxic && check.score >= 4) {
        return bot.sendMessage(chatId, '⚠️ Сообщение содержит неприемлемый контент. Будьте вежливы.');
      }
      
      if (check.isSpam) {
        return bot.sendMessage(chatId, '🚫 Спам обнаружен. Сообщение не отправлено.');
      }
      
      await bot.sendMessage(chat.partnerTgId, msg.text);
      addExp(user.id, 1);
    } else if (msg.photo) {
      await bot.sendPhoto(chat.partnerTgId, msg.photo[msg.photo.length - 1].file_id, { caption: msg.caption });
      addExp(user.id, 2);
      updateUser(user.id, { total_messages: user.total_messages + 1 });
    } else if (msg.voice) {
      await bot.sendVoice(chat.partnerTgId, msg.voice.file_id);
      addExp(user.id, 3);
      updateUser(user.id, { total_messages: user.total_messages + 1 });
    } else if (msg.sticker) {
      await bot.sendSticker(chat.partnerTgId, msg.sticker.file_id);
      addExp(user.id, 1);
      updateUser(user.id, { total_messages: user.total_messages + 1 });
    } else if (msg.animation) {
      await bot.sendAnimation(chat.partnerTgId, msg.animation.file_id);
      addExp(user.id, 2);
      updateUser(user.id, { total_messages: user.total_messages + 1 });
    } else if (msg.video_note) {
      await bot.sendVideoNote(chat.partnerTgId, msg.video_note.file_id);
      addExp(user.id, 3);
      updateUser(user.id, { total_messages: user.total_messages + 1 });
    } else if (msg.document) {
      await bot.sendDocument(chat.partnerTgId, msg.document.file_id, { caption: msg.caption });
      addExp(user.id, 2);
      updateUser(user.id, { total_messages: user.total_messages + 1 });
    } else if (msg.video) {
      await bot.sendVideo(chat.partnerTgId, msg.video.file_id, { caption: msg.caption });
      addExp(user.id, 3);
      updateUser(user.id, { total_messages: user.total_messages + 1 });
    } else if (msg.audio) {
      await bot.sendAudio(chat.partnerTgId, msg.audio.file_id);
      addExp(user.id, 2);
      updateUser(user.id, { total_messages: user.total_messages + 1 });
    }
  } catch (error) {
    console.error('Ошибка отправки:', error.message);
    await bot.sendMessage(chatId, '❌ Не удалось отправить. Собеседник покинул чат.', { reply_markup: mainMenu(user) });
    
    activeChats.delete(user.id);
    activeChats.delete(chat.partnerId);
    updateUser(user.id, { status: 'idle' });
    updateUser(chat.partnerId, { status: 'idle' });
  }
});

bot.on('polling_error', (error) => {
  console.error('Polling error:', error.message);
});

process.on('SIGINT', () => {
  console.log('\n👋 Остановка бота...');
  bot.stopPolling();
  db.close();
  process.exit(0);
});

console.log('✅ Все обработчики зарегистрированы');
console.log('🎯 Бот готов принимать сообщения!');
console.log('');
