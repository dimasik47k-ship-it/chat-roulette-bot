require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const { initDatabase } = require('./database/init');
const { initRedis } = require('./services/redis');
const BotController = require('./bot/controller');
const logger = require('./utils/logger');

const app = express();
app.use(express.json());

// Инициализация бота
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {
  polling: process.env.NODE_ENV === 'development',
  webHook: process.env.NODE_ENV === 'production'
});

// Webhook для production
if (process.env.NODE_ENV === 'production') {
  const webhookPath = '/webhook';
  bot.setWebHook(`${process.env.WEBHOOK_URL}${webhookPath}`);
  
  app.post(webhookPath, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
  });
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Инициализация
async function start() {
  try {
    logger.info('🚀 Запуск бота...');
    
    // Подключение к БД
    await initDatabase();
    logger.info('✅ База данных подключена');
    
    // Подключение к Redis
    await initRedis();
    logger.info('✅ Redis подключен');
    
    // Инициализация контроллера бота
    const botController = new BotController(bot);
    await botController.init();
    logger.info('✅ Бот инициализирован');
    
    // Запуск сервера
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      logger.info(`✅ Сервер запущен на порту ${PORT}`);
    });
    
    logger.info('🎉 Бот успешно запущен!');
  } catch (error) {
    logger.error('❌ Ошибка запуска:', error);
    process.exit(1);
  }
}

// Обработка ошибок
process.on('unhandledRejection', (error) => {
  logger.error('Unhandled Rejection:', error);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Получен SIGINT, завершение работы...');
  await bot.stopPolling();
  process.exit(0);
});

start();
