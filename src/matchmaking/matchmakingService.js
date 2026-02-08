const { getQueue, addToQueue, removeFromQueue } = require('../services/redis');
const { query } = require('../database/init');
const logger = require('../utils/logger');

class MatchmakingService {
  constructor() {
    this.matchingInterval = null;
  }

  start() {
    // Запускаем процесс подбора каждые 2 секунды
    this.matchingInterval = setInterval(() => {
      this.processQueue();
    }, 2000);
    logger.info('Matchmaking service started');
  }

  stop() {
    if (this.matchingInterval) {
      clearInterval(this.matchingInterval);
      this.matchingInterval = null;
    }
  }

  async addToQueue(userId, filters = {}) {
    await addToQueue(userId, filters);
    logger.info('User added to queue', { userId, filters });
  }

  async removeFromQueue(userId) {
    await removeFromQueue(userId);
    logger.info('User removed from queue', { userId });
  }

  async processQueue() {
    try {
      const queue = await getQueue();
      
      if (queue.length < 2) return;

      // Сортируем по приоритету и времени
      queue.sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        return a.timestamp - b.timestamp;
      });

      const matched = new Set();

      for (let i = 0; i < queue.length; i++) {
        if (matched.has(queue[i].userId)) continue;

        for (let j = i + 1; j < queue.length; j++) {
          if (matched.has(queue[j].userId)) continue;

          const user1 = queue[i];
          const user2 = queue[j];

          // Проверяем совместимость
          const compatibility = await this.checkCompatibility(user1, user2);
          
          if (compatibility.match) {
            // Создаем матч
            await this.createMatch(user1.userId, user2.userId, compatibility.score);
            matched.add(user1.userId);
            matched.add(user2.userId);
            
            logger.info('Match created', {
              user1: user1.userId,
              user2: user2.userId,
              score: compatibility.score
            });
            
            break;
          }
        }
      }
    } catch (error) {
      logger.error('Queue processing error', { error: error.message });
    }
  }

  async checkCompatibility(user1Data, user2Data) {
    // Получаем полные данные пользователей
    const [user1Result, user2Result] = await Promise.all([
      query('SELECT * FROM users WHERE id = $1', [user1Data.userId]),
      query('SELECT * FROM users WHERE id = $1', [user2Data.userId])
    ]);

    const user1 = user1Result.rows[0];
    const user2 = user2Result.rows[0];

    if (!user1 || !user2) {
      return { match: false, score: 0 };
    }

    // Проверяем черный список
    const blacklistCheck = await query(
      `SELECT 1 FROM blacklist 
       WHERE (user_id = $1 AND blocked_user_id = $2)
          OR (user_id = $2 AND blocked_user_id = $1)`,
      [user1.id, user2.id]
    );

    if (blacklistCheck.rows.length > 0) {
      return { match: false, score: 0 };
    }

    // Проверяем, не общались ли недавно
    if (user1Data.filters.match_only_new || user2Data.filters.match_only_new) {
      const recentChat = await query(
        `SELECT 1 FROM chats 
         WHERE ((user1_id = $1 AND user2_id = $2) OR (user1_id = $2 AND user2_id = $1))
         AND started_at > NOW() - INTERVAL '24 hours'`,
        [user1.id, user2.id]
      );

      if (recentChat.rows.length > 0) {
        return { match: false, score: 0 };
      }
    }

    let score = 100; // Базовый счет

    // Фильтр по языку
    if (user1Data.filters.match_language && user2Data.filters.match_language) {
      if (user1Data.filters.match_language !== user2Data.filters.match_language) {
        return { match: false, score: 0 };
      }
      score += 20;
    } else if (user1.language_code === user2.language_code) {
      score += 10;
    }

    // Фильтр по возрасту
    if (user1Data.filters.match_age_groups && user2Data.filters.match_age_groups) {
      const ageMatch = user1Data.filters.match_age_groups.some(age =>
        user2Data.filters.match_age_groups.includes(age)
      );
      if (!ageMatch) {
        return { match: false, score: 0 };
      }
      score += 15;
    }

    // Фильтр по стране
    if (user1Data.filters.match_countries && user2Data.filters.match_countries) {
      const countryMatch = user1Data.filters.match_countries.some(country =>
        user2Data.filters.match_countries.includes(country)
      );
      if (countryMatch) {
        score += 10;
      }
    } else if (user1.country === user2.country) {
      score += 5;
    }

    // Совпадение интересов
    if (user1.interests && user2.interests) {
      const commonInterests = user1.interests.filter(interest =>
        user2.interests.includes(interest)
      );
      score += commonInterests.length * 5;
    }

    // Бонус за репутацию
    const avgReputation = (user1.reputation + user2.reputation) / 2;
    if (avgReputation > 50) {
      score += 10;
    }

    // Премиум пользователи получают приоритет
    if (user1.premium_tier !== 'free' || user2.premium_tier !== 'free') {
      score += 15;
    }

    return { match: score >= 100, score };
  }

  async createMatch(userId1, userId2) {
    // Удаляем из очереди
    await Promise.all([
      removeFromQueue(userId1),
      removeFromQueue(userId2)
    ]);

    // Создаем чат
    const ChatService = require('../services/chatService');
    const chatService = new ChatService();
    
    return await chatService.createChat(userId1, userId2);
  }

  async findFromFavorites(userId) {
    // Ищем онлайн пользователей из избранного
    const result = await query(
      `SELECT u.* FROM users u
       INNER JOIN favorites f ON u.id = f.favorite_user_id
       WHERE f.user_id = $1
         AND u.status = 'idle'
         AND u.last_active > NOW() - INTERVAL '5 minutes'
       ORDER BY u.last_active DESC
       LIMIT 10`,
      [userId]
    );

    return result.rows;
  }
}

module.exports = MatchmakingService;
