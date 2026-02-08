require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

// Простое хранилище в памяти
const users = new Map();
const queue = [];
const activeChats = new Map();

// Инициализация бота
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

console.log('🚀 Бот запущен!');
console.log('✅ Токен загружен');
console.log('✅ Polling активен');
console.log('🎉 Готов к работе!');

// Главное меню
function mainMenu() {
  return {
    inline_keyboard: [
      [{ text: '🎲 Найти собеседника', callback_data: 'find_chat' }],
      [{ text: '❓ Помощь', callback_data: 'help' }]
    ]
  };
}

// Меню чата
function chatMenu() {
  return {
    inline_keyboard: [
      [
        { text: '➡️ Следующий', callback_data: 'next_chat' },
        { text: '❌ Завершить', callback_data: 'end_chat' }
      ]
    ]
  };
}

// Команда /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (!users.has(userId)) {
    users.set(userId, {
      id: userId,
      username: msg.from.username,
      firstName: msg.from.first_name,
      chats: 0
    });
  }
  
  await bot.sendMessage(
    chatId,
    `👋 Добро пожаловать в Chat Roulette!

Здесь вы можете общаться с случайными людьми.

🎲 Нажмите "Найти собеседника" чтобы начать!`,
    { reply_markup: mainMenu() }
  );
});

// Команда /help
bot.onText(/\/help/, async (msg) => {
  await bot.sendMessage(
    msg.chat.id,
    `❓ Помощь

🎲 Как начать:
1. Нажмите "Найти собеседника"
2. Дождитесь подключения
3. Общайтесь!

Команды:
/start - Главное меню
/help - Эта справка
/stop - Завершить текущий чат`
  );
});

// Команда /stop
bot.onText(/\/stop/, async (msg) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  
  if (activeChats.has(userId)) {
    const partnerId = activeChats.get(userId);
    activeChats.delete(userId);
    activeChats.delete(partnerId);
    
    await bot.sendMessage(chatId, '👋 Чат завершен', { reply_markup: mainMenu() });
    await bot.sendMessage(partnerId, '👋 Собеседник завершил чат', { reply_markup: mainMenu() });
  } else {
    await bot.sendMessage(chatId, 'У вас нет активного чата', { reply_markup: mainMenu() });
  }
});

// Обработка кнопок
bot.on('callback_query', async (query) => {
  const userId = query.from.id;
  const chatId = query.message.chat.id;
  
  await bot.answerCallbackQuery(query.id);
  
  if (query.data === 'find_chat') {
    // Проверяем, не в чате ли уже
    if (activeChats.has(userId)) {
      await bot.sendMessage(chatId, '❌ Вы уже в чате!');
      return;
    }
    
    // Проверяем, не в очереди ли
    if (queue.includes(userId)) {
      await bot.sendMessage(chatId, '⏳ Вы уже в очереди!');
      return;
    }
    
    // Ищем собеседника в очереди
    if (queue.length > 0) {
      const partnerId = queue.shift();
      
      // Создаем чат
      activeChats.set(userId, partnerId);
      activeChats.set(partnerId, userId);
      
      // Увеличиваем счетчик чатов
      const user = users.get(userId);
      const partner = users.get(partnerId);
      if (user) user.chats++;
      if (partner) partner.chats++;
      
      // Уведомляем обоих
      await bot.sendMessage(
        chatId,
        '✅ Собеседник найден! Начинайте общение.',
        { reply_markup: chatMenu() }
      );
      
      await bot.sendMessage(
        partnerId,
        '✅ Собеседник найден! Начинайте общение.',
        { reply_markup: chatMenu() }
      );
    } else {
      // Добавляем в очередь
      queue.push(userId);
      await bot.sendMessage(chatId, '🔍 Ищем собеседника... Пожалуйста, подождите.');
      
      // Таймаут 60 секунд
      setTimeout(() => {
        const index = queue.indexOf(userId);
        if (index > -1) {
          queue.splice(index, 1);
          bot.sendMessage(
            chatId,
            '⏱️ Не удалось найти собеседника. Попробуйте позже.',
            { reply_markup: mainMenu() }
          );
        }
      }, 60000);
    }
  } else if (query.data === 'next_chat' || query.data === 'end_chat') {
    if (activeChats.has(userId)) {
      const partnerId = activeChats.get(userId);
      activeChats.delete(userId);
      activeChats.delete(partnerId);
      
      await bot.sendMessage(chatId, '👋 Чат завершен', { reply_markup: mainMenu() });
      await bot.sendMessage(partnerId, '👋 Собеседник завершил чат', { reply_markup: mainMenu() });
      
      // Если "Следующий" - сразу ищем нового
      if (query.data === 'next_chat') {
        queue.push(userId);
        await bot.sendMessage(chatId, '🔍 Ищем нового собеседника...');
      }
    } else {
      await bot.sendMessage(chatId, '❌ У вас нет активного чата', { reply_markup: mainMenu() });
    }
  } else if (query.data === 'help') {
    await bot.sendMessage(
      chatId,
      `❓ Помощь

🎲 Как начать:
1. Нажмите "Найти собеседника"
2. Дождитесь подключения
3. Общайтесь!

Команды:
/start - Главное меню
/help - Эта справка
/stop - Завершить текущий чат`,
      { reply_markup: mainMenu() }
    );
  }
});

// Обработка сообщений
bot.on('message', async (msg) => {
  // Игнорируем команды
  if (msg.text && msg.text.startsWith('/')) return;
  
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  
  // Проверяем, в чате ли пользователь
  if (!activeChats.has(userId)) {
    await bot.sendMessage(
      chatId,
      'Вы не в чате. Нажмите "Найти собеседника"!',
      { reply_markup: mainMenu() }
    );
    return;
  }
  
  const partnerId = activeChats.get(userId);
  
  try {
    // Пересылаем сообщение партнеру
    if (msg.text) {
      await bot.sendMessage(partnerId, msg.text);
    } else if (msg.photo) {
      await bot.sendPhoto(partnerId, msg.photo[msg.photo.length - 1].file_id, {
        caption: msg.caption
      });
    } else if (msg.voice) {
      await bot.sendVoice(partnerId, msg.voice.file_id);
    } else if (msg.sticker) {
      await bot.sendSticker(partnerId, msg.sticker.file_id);
    } else if (msg.animation) {
      await bot.sendAnimation(partnerId, msg.animation.file_id);
    } else if (msg.video_note) {
      await bot.sendVideoNote(partnerId, msg.video_note.file_id);
    }
  } catch (error) {
    await bot.sendMessage(
      chatId,
      '❌ Не удалось отправить сообщение. Собеседник, возможно, покинул чат.',
      { reply_markup: mainMenu() }
    );
    
    // Завершаем чат
    activeChats.delete(userId);
    activeChats.delete(partnerId);
  }
});

// Обработка ошибок
bot.on('polling_error', (error) => {
  console.error('Polling error:', error.message);
});

process.on('SIGINT', () => {
  console.log('\n👋 Остановка бота...');
  bot.stopPolling();
  process.exit(0);
});
