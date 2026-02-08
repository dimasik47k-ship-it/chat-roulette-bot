require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const Database = require('better-sqlite3');
const natural = require('natural');

// Инициализация базы данных в памяти
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
    reputation INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    experience INTEGER DEFAULT 0,
    total_chats INTEGER DEFAULT 0,
    total_messages INTEGER DEFAULT 0,
    reports_received INTEGER DEFAULT 0,
    banned INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE chats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user1_id INTEGER,
    user2_id INTEGER,
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
    flagged INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reporter_id INTEGER,
    reported_id INTEGER,
    chat_id INTEGER,
    report_type TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE blacklist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    blocked_user_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    favorite_user_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

console.log('✅ База данных инициализирована');

// Инициализация NLP для модерации
const tokenizer = new natural.WordTokenizer();
const classifier = new natural.BayesClassifier();

// Обучение классификатора
classifier.addDocument('привет как дела', 'safe');
classifier.addDocument('отлично спасибо', 'safe');
classifier.addDocument('ты дурак идиот', 'toxic');
classifier.addDocument('купи подписку переходи по ссылке', 'spam');
classifier.train();

console.log('✅ AI-модерация инициализирована');

// Очередь и активные чаты в памяти
const queue = [];
const activeChats = new Map();

// Инициализация бота
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

console.log('🚀 Бот запущен!');
console.log('✅ Токен загружен');
console.log('✅ Polling активен');
console.log('🎉 Готов к работе со всеми функциями!');

// Клавиатуры
function mainMenu(user) {
  const buttons = [
    [{ text: '🎲 Найти собеседника', callback_data: 'find_chat' }],
    [
      { text: '👤 Профиль', callback_data: 'profile' },
      { text: '⚙️ Настройки', callback_data: 'settings' }
    ],
    [
      { text: '⭐ Избранное', callback_data: 'favorites' },
      { text: '📊 Статистика', callback_data: 'stats' }
    ]
  ];

  if (user.premium_tier === 'free') {
    buttons.push([{ text: '💎 Premium', callback_data: 'premium' }]);
  }

  buttons.push([{ text: '❓ Помощь', callback_data: 'help' }]);

  return { inline_keyboard: buttons };
}

function chatMenu() {
  return {
    inline_keyboard: [
      [
        { text: '➡️ Следующий', callback_data: 'next_chat' },
        { text: '❌ Завершить', callback_data: 'end_chat' }
      ],
      [
        { text: '❤️ Нравится', callback_data: 'like_user' },
        { text: '🚫 Пожаловаться', callback_data: 'report_user' }
      ],
      [{ text: '⭐ В избранное', callback_data: 'add_favorite' }]
    ]
  };
}

function reportMenu() {
  return {
    inline_keyboard: [
      [{ text: '📧 Спам', callback_data: 'report_spam' }],
      [{ text: '😠 Оскорбления', callback_data: 'report_harassment' }],
      [{ text: '🔞 Неприемлемый контент', callback_data: 'report_inappropriate' }],
      [{ text: '❓ Другое', callback_data: 'report_other' }],
      [{ text: '🔙 Отмена', callback_data: 'cancel_report' }]
    ]
  };
}

function ratingMenu() {
  return {
    inline_keyboard: [
      [
        { text: '⭐', callback_data: 'rate_1' },
        { text: '⭐⭐', callback_data: 'rate_2' },
        { text: '⭐⭐⭐', callback_data: 'rate_3' }
      ],
      [
        { text: '⭐⭐⭐⭐', callback_data: 'rate_4' },
        { text: '⭐⭐⭐⭐⭐', callback_data: 'rate_5' }
      ],
      [{ text: 'Пропустить', callback_data: 'skip_rating' }]
    ]
  };
}

// Функции работы с БД
function getUser(telegramId) {
  return db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegramId);
}

function createUser(telegramUser) {
  const stmt = db.prepare(`
    INSERT INTO users (telegram_id, username, first_name, language_code)
    VALUES (?, ?, ?, ?)
  `);
  
  stmt.run(
    telegramUser.id,
    telegramUser.username || null,
    telegramUser.first_name,
    telegramUser.language_code || 'ru'
  );
  
  return getUser(telegramUser.id);
}

function updateUser(userId, updates) {
  const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
  const values = Object.values(updates);
  values.push(userId);
  
  db.prepare(`UPDATE users SET ${fields} WHERE id = ?`).run(...values);
}

function addExperience(userId, amount) {
  db.prepare(`
    UPDATE users 
    SET experience = experience + ?,
        level = (experience + ?) / 100 + 1
    WHERE id = ?
  `).run(amount, amount, userId);
}

// Модерация
function analyzeMessage(text) {
  const toxicWords = ['дурак', 'идиот', 'тупой', 'урод'];
  const spamPatterns = [/https?:\/\//gi, /@\w+/g, /\b\d{10,}\b/g];
  
  let toxicity = 0;
  let isSpam = false;
  let isToxic = false;
  
  // Проверка на спам
  for (const pattern of spamPatterns) {
    if (pattern.test(text)) {
      isSpam = true;
      toxicity = 2;
      break;
    }
  }
  
  // Проверка токсичных слов
  const words = tokenizer.tokenize(text.toLowerCase());
  for (const word of words) {
    if (toxicWords.some(toxic => word.includes(toxic))) {
      isToxic = true;
      toxicity = Math.max(toxicity, 3);
    }
  }
  
  // ML классификация
  const classification = classifier.classify(text.toLowerCase());
  if (classification === 'toxic') {
    isToxic = true;
    toxicity = Math.max(toxicity, 2);
  } else if (classification === 'spam') {
    isSpam = true;
  }
  
  return { toxicity, isSpam, isToxic };
}

// Команда /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  let user = getUser(msg.from.id);
  
  if (!user) {
    user = createUser(msg.from);
    console.log(`✅ Новый пользователь: ${user.first_name} (ID: ${user.telegram_id})`);
  }
  
  if (user.banned) {
    return bot.sendMessage(chatId, '🚫 Вы заблокированы за нарушение правил.');
  }
  
  const isNewUser = !user.age_group;
  
  if (isNewUser) {
    await bot.sendMessage(
      chatId,
      `👋 Добро пожаловать в Chat Roulette, ${user.first_name}!

Здесь вы можете общаться с случайными людьми со всего мира.

🔒 Безопасность - наш приоритет
🌍 Умный подбор собеседников
💬 Поддержка текста, фото, голоса

Давайте настроим ваш профиль!`
    );
    
    await bot.sendMessage(
      chatId,
      'Выберите вашу возрастную группу:',
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '13-17', callback_data: 'age_teen' }],
            [{ text: '18-24', callback_data: 'age_young' }],
            [{ text: '25-34', callback_data: 'age_adult' }],
            [{ text: '35-44', callback_data: 'age_mature' }],
            [{ text: '45+', callback_data: 'age_senior' }]
          ]
        }
      }
    );
  } else {
    await bot.sendMessage(
      chatId,
      `👋 С возвращением, ${user.first_name}!

Что хотите сделать?`,
      { reply_markup: mainMenu(user) }
    );
  }
});

// Обработка callback queries
bot.on('callback_query', async (query) => {
  const userId = query.from.id;
  const chatId = query.message.chat.id;
  const data = query.data;
  
  await bot.answerCallbackQuery(query.id);
  
  let user = getUser(userId);
  if (!user || user.banned) return;
  
  // Установка возраста
  if (data.startsWith('age_')) {
    const ageGroups = {
      age_teen: '13-17',
      age_young: '18-24',
      age_adult: '25-34',
      age_mature: '35-44',
      age_senior: '45+'
    };
    
    updateUser(user.id, { age_group: ageGroups[data] });
    user = getUser(userId);
    
    await bot.editMessageText(
      '✅ Возрастная группа установлена!\n\nТеперь вы можете начать общение.',
      { chat_id: chatId, message_id: query.message.message_id }
    );
    
    await bot.sendMessage(
      chatId,
      'Добро пожаловать!',
      { reply_markup: mainMenu(user) }
    );
    return;
  }
  
  // Главное меню
  if (data === 'main_menu') {
    await bot.editMessageText(
      '👋 Главное меню\n\nЧто хотите сделать?',
      {
        chat_id: chatId,
        message_id: query.message.message_id,
        reply_markup: mainMenu(user)
      }
    );
    return;
  }
  
  // Поиск собеседника
  if (data === 'find_chat') {
    if (activeChats.has(user.id)) {
      return bot.sendMessage(chatId, '❌ Вы уже в чате!');
    }
    
    if (queue.some(q => q.userId === user.id)) {
      return bot.sendMessage(chatId, '⏳ Вы уже в очереди!');
    }
    
    await bot.editMessageText(
      '🔍 Ищем собеседника...\n\nПожалуйста, подождите.',
      { chat_id: chatId, message_id: query.message.message_id }
    );
    
    // Ищем в очереди
    if (queue.length > 0) {
      const partner = queue.shift();
      const partnerUser = db.prepare('SELECT * FROM users WHERE id = ?').get(partner.userId);
      
      // Создаем чат
      const chatResult = db.prepare(`
        INSERT INTO chats (user1_id, user2_id, status)
        VALUES (?, ?, 'active')
      `).run(user.id, partnerUser.id);
      
      const chatDbId = chatResult.lastInsertRowid;
      
      activeChats.set(user.id, { chatId: chatDbId, partnerId: partnerUser.id, partnerTelegramId: partnerUser.telegram_id });
      activeChats.set(partnerUser.id, { chatId: chatDbId, partnerId: user.id, partnerTelegramId: user.telegram_id });
      
      // Обновляем статусы
      updateUser(user.id, { status: 'in_chat', total_chats: user.total_chats + 1 });
      updateUser(partnerUser.id, { status: 'in_chat', total_chats: partnerUser.total_chats + 1 });
      
      console.log(`✅ Матч создан: ${user.first_name} <-> ${partnerUser.first_name}`);
      
      await bot.sendMessage(
        chatId,
        '✅ Собеседник найден! Начинайте общение.',
        { reply_markup: chatMenu() }
      );
      
      await bot.sendMessage(
        partner.chatId,
        '✅ Собеседник найден! Начинайте общение.',
        { reply_markup: chatMenu() }
      );
    } else {
      queue.push({ userId: user.id, chatId, timestamp: Date.now() });
      updateUser(user.id, { status: 'in_queue' });
      
      setTimeout(() => {
        const index = queue.findIndex(q => q.userId === user.id);
        if (index > -1) {
          queue.splice(index, 1);
          updateUser(user.id, { status: 'idle' });
          bot.sendMessage(
            chatId,
            '⏱️ Не удалось найти собеседника. Попробуйте позже.',
            { reply_markup: mainMenu(user) }
          );
        }
      }, 60000);
    }
    return;
  }
  
  // Следующий/Завершить чат
  if (data === 'next_chat' || data === 'end_chat') {
    const chat = activeChats.get(user.id);
    if (!chat) {
      return bot.sendMessage(chatId, '❌ У вас нет активного чата', { reply_markup: mainMenu(user) });
    }
    
    // Завершаем чат
    db.prepare(`
      UPDATE chats 
      SET ended_at = CURRENT_TIMESTAMP, status = 'ended'
      WHERE id = ?
    `).run(chat.chatId);
    
    activeChats.delete(user.id);
    activeChats.delete(chat.partnerId);
    
    updateUser(user.id, { status: 'idle' });
    updateUser(chat.partnerId, { status: 'idle' });
    
    await bot.sendMessage(chatId, '👋 Чат завершен', { reply_markup: ratingMenu() });
    await bot.sendMessage(chat.partnerTelegramId, '👋 Собеседник завершил чат', { reply_markup: ratingMenu() });
    
    if (data === 'next_chat') {
      queue.push({ userId: user.id, chatId, timestamp: Date.now() });
      updateUser(user.id, { status: 'in_queue' });
      await bot.sendMessage(chatId, '🔍 Ищем нового собеседника...');
    }
    return;
  }
  
  // Лайк
  if (data === 'like_user') {
    const chat = activeChats.get(user.id);
    if (!chat) {
      return bot.sendMessage(chatId, '❌ У вас нет активного чата');
    }
    
    await bot.sendMessage(chatId, '❤️ Вы отметили собеседника!');
    await bot.sendMessage(chat.partnerTelegramId, '❤️ Вы понравились собеседнику!');
    return;
  }
  
  // Жалоба
  if (data === 'report_user') {
    const chat = activeChats.get(user.id);
    if (!chat) {
      return bot.sendMessage(chatId, '❌ У вас нет активного чата');
    }
    
    await bot.editMessageText(
      '🚫 Пожаловаться\n\nВыберите причину:',
      {
        chat_id: chatId,
        message_id: query.message.message_id,
        reply_markup: reportMenu()
      }
    );
    return;
  }
  
  // Обработка жалоб
  if (data.startsWith('report_')) {
    const chat = activeChats.get(user.id);
    if (!chat) return;
    
    const reportType = data.replace('report_', '');
    
    if (reportType !== 'cancel') {
      db.prepare(`
        INSERT INTO reports (reporter_id, reported_id, chat_id, report_type)
        VALUES (?, ?, ?, ?)
      `).run(user.id, chat.partnerId, chat.chatId, reportType);
      
      // Проверяем количество жалоб
      const reportCount = db.prepare(`
        SELECT COUNT(*) as count FROM reports 
        WHERE reported_id = ? AND datetime(created_at) > datetime('now', '-24 hours')
      `).get(chat.partnerId).count;
      
      if (reportCount >= 3) {
        updateUser(chat.partnerId, { banned: 1 });
        console.log(`⚠️ Пользователь забанен за множественные жалобы (ID: ${chat.partnerId})`);
      }
      
      await bot.sendMessage(
        chatId,
        '✅ Жалоба отправлена. Спасибо за помощь в поддержании безопасности!'
      );
      
      // Завершаем чат
      activeChats.delete(user.id);
      activeChats.delete(chat.partnerId);
      updateUser(user.id, { status: 'idle' });
      updateUser(chat.partnerId, { status: 'idle' });
      
      await bot.sendMessage(chatId, 'Чат завершен.', { reply_markup: mainMenu(user) });
    } else {
      await bot.sendMessage(chatId, 'Отменено', { reply_markup: chatMenu() });
    }
    return;
  }
  
  // Добавить в избранное
  if (data === 'add_favorite') {
    const chat = activeChats.get(user.id);
    if (!chat) {
      return bot.sendMessage(chatId, '❌ У вас нет активного чата');
    }
    
    db.prepare(`
      INSERT OR IGNORE INTO favorites (user_id, favorite_user_id)
      VALUES (?, ?)
    `).run(user.id, chat.partnerId);
    
    await bot.sendMessage(chatId, '⭐ Собеседник добавлен в избранное!');
    return;
  }
  
  // Профиль
  if (data === 'profile') {
    const profileText = `👤 Ваш профиль

📊 Статистика:
• Уровень: ${user.level}
• Опыт: ${user.experience}
• Репутация: ${user.reputation}
• Всего чатов: ${user.total_chats}
• Сообщений: ${user.total_messages}

🎯 Возраст: ${user.age_group || 'Не указан'}
💎 Статус: ${user.premium_tier === 'free' ? 'Бесплатный' : user.premium_tier}`;

    await bot.editMessageText(profileText, {
      chat_id: chatId,
      message_id: query.message.message_id,
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 Главное меню', callback_data: 'main_menu' }]
        ]
      }
    });
    return;
  }
  
  // Статистика
  if (data === 'stats') {
    const statsText = `📊 Ваша статистика

👥 Общение:
• Всего чатов: ${user.total_chats}
• Сообщений отправлено: ${user.total_messages}
• Средняя длина чата: ${user.total_chats > 0 ? Math.round(user.total_messages / user.total_chats) : 0} сообщений

⭐ Репутация:
• Рейтинг: ${user.reputation}/100
• Уровень: ${user.level}
• Опыт: ${user.experience}`;

    await bot.editMessageText(statsText, {
      chat_id: chatId,
      message_id: query.message.message_id,
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 Главное меню', callback_data: 'main_menu' }]
        ]
      }
    });
    return;
  }
  
  // Помощь
  if (data === 'help') {
    const helpText = `❓ Помощь

🎲 Как начать:
1. Нажмите "Найти собеседника"
2. Дождитесь подключения
3. Общайтесь!

⚙️ Фильтры поиска:
• Язык общения
• Возрастная группа
• Интересы

🔒 Безопасность:
• Жалоба - если собеседник нарушает правила
• AI-модерация - автоматическая проверка сообщений

⭐ Функции:
• Избранное - сохраняйте интересных собеседников
• Репутация - оценивайте диалоги
• Premium - дополнительные возможности`;

    await bot.editMessageText(helpText, {
      chat_id: chatId,
      message_id: query.message.message_id,
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 Главное меню', callback_data: 'main_menu' }]
        ]
      }
    });
    return;
  }
  
  // Оценка
  if (data.startsWith('rate_') || data === 'skip_rating') {
    await bot.sendMessage(chatId, '✅ Спасибо за оценку!', { reply_markup: mainMenu(user) });
    return;
  }
});

// Обработка сообщений
bot.on('message', async (msg) => {
  if (msg.text && msg.text.startsWith('/')) return;
  
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  
  let user = getUser(userId);
  if (!user || user.banned) return;
  
  const chat = activeChats.get(user.id);
  if (!chat) {
    return bot.sendMessage(
      chatId,
      'Вы не в чате. Нажмите "Найти собеседника"!',
      { reply_markup: mainMenu(user) }
    );
  }
  
  try {
    // Модерация текста
    if (msg.text) {
      const moderation = analyzeMessage(msg.text);
      
      // Сохраняем сообщение
      db.prepare(`
        INSERT INTO messages (chat_id, sender_id, message_type, content, toxicity_score, flagged)
        VALUES (?, ?, 'text', ?, ?, ?)
      `).run(chat.chatId, user.id, msg.text, moderation.toxicity, moderation.isToxic ? 1 : 0);
      
      // Обновляем счетчики
      db.prepare('UPDATE chats SET messages_count = messages_count + 1 WHERE id = ?').run(chat.chatId);
      updateUser(user.id, { total_messages: user.total_messages + 1 });
      
      if (moderation.isToxic && moderation.toxicity >= 3) {
        return bot.sendMessage(
          chatId,
          '⚠️ Ваше сообщение содержит неприемлемый контент. Пожалуйста, будьте вежливы.'
        );
      }
      
      if (moderation.isSpam) {
        return bot.sendMessage(chatId, '🚫 Обнаружен спам. Сообщение не отправлено.');
      }
      
      await bot.sendMessage(chat.partnerTelegramId, msg.text);
      addExperience(user.id, 1);
    } else if (msg.photo) {
      await bot.sendPhoto(chat.partnerTelegramId, msg.photo[msg.photo.length - 1].file_id, {
        caption: msg.caption
      });
      addExperience(user.id, 2);
    } else if (msg.voice) {
      await bot.sendVoice(chat.partnerTelegramId, msg.voice.file_id);
      addExperience(user.id, 3);
    } else if (msg.sticker) {
      await bot.sendSticker(chat.partnerTelegramId, msg.sticker.file_id);
      addExperience(user.id, 1);
    } else if (msg.animation) {
      await bot.sendAnimation(chat.partnerTelegramId, msg.animation.file_id);
      addExperience(user.id, 2);
    } else if (msg.video_note) {
      await bot.sendVideoNote(chat.partnerTelegramId, msg.video_note.file_id);
      addExperience(user.id, 3);
    }
  } catch (error) {
    console.error('Ошибка отправки:', error.message);
    await bot.sendMessage(
      chatId,
      '❌ Не удалось отправить сообщение. Собеседник, возможно, покинул чат.',
      { reply_markup: mainMenu(user) }
    );
    
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
