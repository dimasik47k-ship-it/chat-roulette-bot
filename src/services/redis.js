const redis = require('redis');
const logger = require('../utils/logger');

let client;
let subscriber;
let publisher;

async function initRedis() {
  const config = {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    password: process.env.REDIS_PASSWORD || undefined,
    retry_strategy: (options) => {
      if (options.error && options.error.code === 'ECONNREFUSED') {
        return new Error('Redis server refused connection');
      }
      if (options.total_retry_time > 1000 * 60 * 60) {
        return new Error('Redis retry time exhausted');
      }
      if (options.attempt > 10) {
        return undefined;
      }
      return Math.min(options.attempt * 100, 3000);
    }
  };

  client = redis.createClient(config);
  subscriber = redis.createClient(config);
  publisher = redis.createClient(config);

  await client.connect();
  await subscriber.connect();
  await publisher.connect();

  client.on('error', (err) => logger.error('Redis Client Error', err));
  subscriber.on('error', (err) => logger.error('Redis Subscriber Error', err));
  publisher.on('error', (err) => logger.error('Redis Publisher Error', err));

  logger.info('Redis connected successfully');
}

// Очередь ожидания
async function addToQueue(userId, filters = {}) {
  const queueData = {
    userId,
    filters,
    timestamp: Date.now(),
    priority: filters.premium ? 4 : 2
  };
  
  await client.zAdd('matchmaking:queue', {
    score: queueData.priority * 1000000 + queueData.timestamp,
    value: JSON.stringify(queueData)
  });
}

async function removeFromQueue(userId) {
  const queue = await client.zRange('matchmaking:queue', 0, -1);
  for (const item of queue) {
    const data = JSON.parse(item);
    if (data.userId === userId) {
      await client.zRem('matchmaking:queue', item);
      break;
    }
  }
}

async function getQueue() {
  const queue = await client.zRange('matchmaking:queue', 0, -1);
  return queue.map(item => JSON.parse(item));
}

// Активные чаты
async function setActiveChat(userId, chatData) {
  await client.hSet('active:chats', userId.toString(), JSON.stringify(chatData));
}

async function getActiveChat(userId) {
  const data = await client.hGet('active:chats', userId.toString());
  return data ? JSON.parse(data) : null;
}

async function removeActiveChat(userId) {
  await client.hDel('active:chats', userId.toString());
}

// Кэш пользователей
async function cacheUser(userId, userData) {
  await client.setEx(`user:${userId}`, 3600, JSON.stringify(userData));
}

async function getCachedUser(userId) {
  const data = await client.get(`user:${userId}`);
  return data ? JSON.parse(data) : null;
}

// Анти-флуд
async function checkFlood(userId) {
  const key = `flood:${userId}`;
  const count = await client.incr(key);
  
  if (count === 1) {
    await client.expire(key, parseInt(process.env.FLOOD_WINDOW) || 10);
  }
  
  return count > (parseInt(process.env.FLOOD_LIMIT) || 5);
}

// Pub/Sub для сообщений
async function publishMessage(channel, message) {
  await publisher.publish(channel, JSON.stringify(message));
}

async function subscribeToChannel(channel, callback) {
  await subscriber.subscribe(channel, (message) => {
    callback(JSON.parse(message));
  });
}

module.exports = {
  initRedis,
  addToQueue,
  removeFromQueue,
  getQueue,
  setActiveChat,
  getActiveChat,
  removeActiveChat,
  cacheUser,
  getCachedUser,
  checkFlood,
  publishMessage,
  subscribeToChannel,
  getClient: () => client
};
