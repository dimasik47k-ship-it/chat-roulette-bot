require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

console.log('🚀 Запуск Chat Roulette Bot (Railway version)...');

// Хранилище в памяти
const users = new Map();
const activeChats = new Map();
const queue = [];

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { 
  polling: {
    interval: 300,
    autoStart: true,
    params: { timeout: 10 }
  }
});

console.log('✅ БОТ ЗАПУЩЕН!');

// Функции
const getUser = (tgId) => users.get(tgId);
const createUser = (tg) => {
  const user = {
    id: users.size + 1,
    telegram_id: tg.id,
    username: tg.username,
    first_name: tg.first_name,
    age_group: null,
    gender: null,
    premium_tier: 'free',
    level: 1,
    experience: 0,
    total_chats: 0,
    total_messages: 0,
    likes_received: 0,
    likes_given: 0,
    super_likes: 0,
    reports_received: 0,
    banned: false
  };
  users.set(tg.id, user);
  return user;
};

// Клавиатуры
const mainMenu = () => ({
  inline_keyboard: [
    [{ text: '🎲 Найти собеседника', callback_data: 'find' }],
    [{ text: '👤 Профиль', callback_data: 'profile' }],
    [{ text: '❓ Помощь', callback_data: 'help' }]
  ]
});

const chatMenu = () => ({
  inline_keyboard: [
    [{ text: '➡️ Следующий', callback_data: 'next' }, { text: '❌ Завершить', callback_data: 'end' }],
    [{ text: '❤️ Лайк', callback_data: 'like' }]
  ]
});

const ageMenu = () => ({
  inline_keyboard: [
    [{ text: '13-17', callback_data: 'age_teen' }],
    [{ text: '18-24', callback_data: 'age_young' }],
    [{ text: '25-34', callback_data: 'age_adult' }],
    [{ text: '35+', callback_data: 'age_senior' }]
  ]
});

const genderMenu = () => ({
  inline_keyboard: [
    [{ text: '👨 Мужской', callback_data: 'gender_male' }],
    [{ text: '👩 Женский', callback_data: 'gender_female' }],
    [{ text: '🤐 Не указывать', callback_data: 'gender_none' }]
  ]
});

// Функции чата
function createChat(u1, u2) {
  activeChats.set(u1.telegram_id, { partnerId: u2.telegram_id, startTime: Date.now() });
  activeChats.set(u2.telegram_id, { partnerId: u1.telegram_id, startTime: Date.now() });
  
  u1.total_chats++;
  u2.total_chats++;
  
  console.log(`✅ Чат создан: ${u1.first_name} <-> ${u2.first_name}`);
}

function endChat(tgId, chat, chatId) {
  const duration = Math.floor((Date.now() - chat.startTime) / 1000);
  
  activeChats.delete(tgId);
  activeChats.delete(chat.partnerId);
  
  bot.sendMessage(chatId, `👋 Чат завершен\n\n⏱️ Длительность: ${Math.floor(duration / 60)} мин`);
  bot.sendMessage(chat.partnerId, `👋 Собеседник завершил чат\n\n⏱️ Длительность: ${Math.floor(duration / 60)} мин`);
  
  console.log(`✅ Чат завершен: ${tgId} <-> ${chat.partnerId}`);
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
  
  if (u.banned) return bot.sendMessage(chatId, '🚫 Вы заблокированы.');
  
  if (!u.age_group) {
    await bot.sendMessage(chatId, `👋 Добро пожаловать, ${u.first_name}!\n\n🎲 Chat Roulette - общайтесь с людьми со всего мира!\n\nНастроим профиль!`);
    return bot.sendMessage(chatId, 'Выберите возрастную группу:', { reply_markup: ageMenu() });
  }
  
  if (!u.gender) {
    return bot.sendMessage(chatId, 'Выберите пол:', { reply_markup: genderMenu() });
  }
  
  await bot.sendMessage(chatId, `👋 С возвращением, ${u.first_name}!\n\n📊 Ваш статус:\n• Уровень: ${u.level}\n• Чатов: ${u.total_chats}\n• Сообщений: ${u.total_messages}\n\nЧто хотите сделать?`, { reply_markup: mainMenu() });
});

// /help
bot.onText(/\/help/, async (msg) => {
  await bot.sendMessage(msg.chat.id, `❓ Помощь\n\n🎲 Основное:\n• /start - главное меню\n• Найдите собеседника и начните общаться!\n\n⚡ Функции:\n• Случайный поиск\n• Лайки\n• Статистика`);
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
    const ages = { age_teen: '13-17', age_young: '18-24', age_adult: '25-34', age_senior: '35+' };
    u.age_group = ages[data];
    await bot.editMessageText('✅ Возраст установлен!', { chat_id: chatId, message_id: q.message.message_id });
    return bot.sendMessage(chatId, 'Выберите пол:', { reply_markup: genderMenu() });
  }
  
  // Пол
  if (data.startsWith('gender_')) {
    const genders = { gender_male: 'male', gender_female: 'female', gender_none: null };
    u.gender = genders[data];
    await bot.sendMessage(chatId, '✅ Профиль настроен!\n\nДобро пожаловать!', { reply_markup: mainMenu() });
    return;
  }
  
  // Поиск
  if (data === 'find') {
    if (activeChats.has(tgId)) return bot.sendMessage(chatId, '❌ Вы уже в чате!');
    if (queue.some(qu => qu.tgId === tgId)) return bot.sendMessage(chatId, '⏳ Вы уже в очереди!');
    
    await bot.editMessageText('🔍 Ищем собеседника...', { chat_id: chatId, message_id: q.message.message_id });
    
    if (queue.length > 0) {
      const partner = queue.shift();
      const pu = getUser(partner.tgId);
      
      createChat(u, pu);
      
      await bot.sendMessage(chatId, '✅ Собеседник найден!\n\nНачинайте общение.', { reply_markup: chatMenu() });
      await bot.sendMessage(partner.chatId, '✅ Собеседник найден!\n\nНачинайте общение.', { reply_markup: chatMenu() });
    } else {
      queue.push({ tgId, chatId, timestamp: Date.now() });
      
      setTimeout(() => {
        const idx = queue.findIndex(qu => qu.tgId === tgId);
        if (idx > -1) {
          queue.splice(idx, 1);
          bot.sendMessage(chatId, '⏱️ Собеседник не найден. Попробуйте позже.', { reply_markup: mainMenu() });
        }
      }, 60000);
    }
    return;
  }
  
  // Следующий/Завершить
  if (data === 'next' || data === 'end') {
    const chat = activeChats.get(tgId);
    if (!chat) return bot.sendMessage(chatId, '❌ Нет активного чата', { reply_markup: mainMenu() });
    
    endChat(tgId, chat, chatId);
    
    if (data === 'next') {
      queue.push({ tgId, chatId, timestamp: Date.now() });
      bot.sendMessage(chatId, '🔍 Ищем нового собеседника...');
    }
    return;
  }

  // Лайк
  if (data === 'like') {
    const chat = activeChats.get(tgId);
    if (!chat) return bot.sendMessage(chatId, '❌ Нет активного чата');
    
    const p = getUser(chat.partnerId);
    if (p) p.likes_received++;
    u.likes_given++;
    
    await bot.sendMessage(chatId, '❤️ Вы отправили лайк!');
    await bot.sendMessage(chat.partnerId, '❤️ Вы получили лайк от собеседника!');
    return;
  }
  
  // Профиль
  if (data === 'profile') {
    const text = `👤 Ваш профиль\n\n🎯 Основное:\n• Уровень: ${u.level}\n• Опыт: ${u.experience}\n\n📊 Статистика:\n• Чатов: ${u.total_chats}\n• Сообщений: ${u.total_messages}\n• Лайков: ${u.likes_received}`;
    return bot.editMessageText(text, { chat_id: chatId, message_id: q.message.message_id, reply_markup: { inline_keyboard: [[{ text: '🔙 Назад', callback_data: 'menu' }]] } });
  }
  
  // Главное меню
  if (data === 'menu' || data === 'help') {
    return bot.editMessageText('👋 Главное меню', { chat_id: chatId, message_id: q.message.message_id, reply_markup: mainMenu() });
  }
});

// Обработчик сообщений
bot.on('message', async (msg) => {
  if (msg.text && msg.text.startsWith('/')) return;
  
  const tgId = msg.from.id;
  const chatId = msg.chat.id;
  
  const u = getUser(tgId);
  if (!u || u.banned) return;
  
  const chat = activeChats.get(tgId);
  if (!chat) {
    return bot.sendMessage(chatId, '❌ Вы не в чате. Найдите собеседника!', { reply_markup: mainMenu() });
  }
  
  u.total_messages++;
  
  // Отправка партнеру
  try {
    if (msg.text) {
      await bot.sendMessage(chat.partnerId, msg.text);
    } else if (msg.photo) {
      const photo = msg.photo[msg.photo.length - 1];
      await bot.sendPhoto(chat.partnerId, photo.file_id, { caption: msg.caption || '' });
    } else if (msg.voice) {
      await bot.sendVoice(chat.partnerId, msg.voice.file_id);
    } else if (msg.sticker) {
      await bot.sendSticker(chat.partnerId, msg.sticker.file_id);
    } else if (msg.animation) {
      await bot.sendAnimation(chat.partnerId, msg.animation.file_id);
    } else if (msg.video) {
      await bot.sendVideo(chat.partnerId, msg.video.file_id);
    }
  } catch (err) {
    console.error('❌ Ошибка отправки:', err.message);
    bot.sendMessage(chatId, '❌ Ошибка отправки. Собеседник мог покинуть чат.');
    endChat(tgId, chat, chatId);
  }
});

// Обработка ошибок
bot.on('polling_error', (err) => {
  console.error('❌ Polling error:', err.code || err.message);
});

process.on('SIGINT', () => {
  console.log('\n👋 Остановка бота...');
  process.exit(0);
});

console.log('📱 Откройте бота в Telegram и отправьте /start');
