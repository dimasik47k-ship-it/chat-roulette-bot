const { query } = require('../database/init');
const { setActiveChat, getActiveChat, removeActiveChat, publishMessage } = require('./redis');
const { USER_STATUS, MESSAGE_TYPES } = require('../config/constants');
const logger = require('../utils/logger');

class ChatService {
  async createChat(userId1, userId2) {
    try {
      // Создаем запись в БД
      const result = await query(
        `INSERT INTO chats (user1_id, user2_id, status)
         VALUES ($1, $2, 'active')
         RETURNING *`,
        [userId1, userId2]
      );

      const chat = result.rows[0];

      // Сохраняем в Redis
      await setActiveChat(userId1, {
        chatId: chat.id,
        partnerId: userId2,
        startedAt: chat.started_at
      });

      await setActiveChat(userId2, {
        chatId: chat.id,
        partnerId: userId1,
        startedAt: chat.started_at
      });

      // Обновляем статусы пользователей
      await Promise.all([
        query('UPDATE users SET status = $1 WHERE id = $2', [USER_STATUS.IN_CHAT, userId1]),
        query('UPDATE users SET status = $1 WHERE id = $2', [USER_STATUS.IN_CHAT, userId2])
      ]);

      logger.info('Chat created', { chatId: chat.id, userId1, userId2 });
      return chat;
    } catch (error) {
      logger.error('Error creating chat', { userId1, userId2, error: error.message });
      throw error;
    }
  }

  async endChat(chatId, endedBy) {
    try {
      const duration = await query(
        `UPDATE chats 
         SET ended_at = CURRENT_TIMESTAMP,
             duration = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - started_at)),
             ended_by = $1,
             status = 'ended'
         WHERE id = $2
         RETURNING user1_id, user2_id, duration`,
        [endedBy, chatId]
      );

      if (duration.rows.length === 0) return null;

      const { user1_id, user2_id } = duration.rows[0];

      // Удаляем из Redis
      await Promise.all([
        removeActiveChat(user1_id),
        removeActiveChat(user2_id)
      ]);

      // Обновляем статусы
      await Promise.all([
        query('UPDATE users SET status = $1, total_chats = total_chats + 1 WHERE id = $2', 
          [USER_STATUS.IDLE, user1_id]),
        query('UPDATE users SET status = $1, total_chats = total_chats + 1 WHERE id = $2', 
          [USER_STATUS.IDLE, user2_id])
      ]);

      logger.info('Chat ended', { chatId, endedBy, duration: duration.rows[0].duration });
      return duration.rows[0];
    } catch (error) {
      logger.error('Error ending chat', { chatId, error: error.message });
      throw error;
    }
  }

  async saveMessage(chatId, senderId, messageType, content, fileId = null, toxicityScore = 0) {
    try {
      await query(
        `INSERT INTO messages (chat_id, sender_id, message_type, content, file_id, toxicity_score, flagged)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [chatId, senderId, messageType, content, fileId, toxicityScore, toxicityScore > 2]
      );

      // Обновляем счетчик сообщений
      await query(
        'UPDATE chats SET messages_count = messages_count + 1 WHERE id = $1',
        [chatId]
      );

      await query(
        'UPDATE users SET total_messages = total_messages + 1 WHERE id = $1',
        [senderId]
      );
    } catch (error) {
      logger.error('Error saving message', { chatId, senderId, error: error.message });
    }
  }

  async rateChat(chatId, userId, rating) {
    try {
      // Определяем, какой пользователь оценивает
      const chat = await query('SELECT user1_id, user2_id FROM chats WHERE id = $1', [chatId]);
      
      if (chat.rows.length === 0) return false;

      const { user1_id, user2_id } = chat.rows[0];
      const isUser1 = user1_id === userId;
      const partnerId = isUser1 ? user2_id : user1_id;
      const ratingField = isUser1 ? 'user1_rating' : 'user2_rating';

      // Сохраняем оценку
      await query(
        `UPDATE chats SET ${ratingField} = $1 WHERE id = $2`,
        [rating, chatId]
      );

      // Обновляем репутацию партнера
      await query(
        `UPDATE users 
         SET reputation = (
           SELECT AVG(CASE 
             WHEN user1_id = $1 THEN user2_rating 
             WHEN user2_id = $1 THEN user1_rating 
           END)
           FROM chats 
           WHERE (user1_id = $1 OR user2_id = $1) 
             AND (user1_rating IS NOT NULL OR user2_rating IS NOT NULL)
         )
         WHERE id = $1`,
        [partnerId]
      );

      logger.info('Chat rated', { chatId, userId, rating });
      return true;
    } catch (error) {
      logger.error('Error rating chat', { chatId, userId, error: error.message });
      return false;
    }
  }

  async getChatHistory(userId, limit = 20) {
    const result = await query(
      `SELECT c.*, 
        CASE 
          WHEN c.user1_id = $1 THEN u2.username 
          ELSE u1.username 
        END as partner_username,
        CASE 
          WHEN c.user1_id = $1 THEN c.user2_rating 
          ELSE c.user1_rating 
        END as my_rating,
        CASE 
          WHEN c.user1_id = $1 THEN c.user1_rating 
          ELSE c.user2_rating 
        END as partner_rating
       FROM chats c
       LEFT JOIN users u1 ON c.user1_id = u1.id
       LEFT JOIN users u2 ON c.user2_id = u2.id
       WHERE (c.user1_id = $1 OR c.user2_id = $1)
         AND c.status = 'ended'
       ORDER BY c.started_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows;
  }

  async getActiveChat(userId) {
    return await getActiveChat(userId);
  }

  async sendMessageToPartner(senderId, message) {
    const chat = await getActiveChat(senderId);
    if (!chat) return false;

    // Публикуем сообщение через Redis Pub/Sub
    await publishMessage(`chat:${chat.chatId}`, {
      senderId,
      receiverId: chat.partnerId,
      message,
      timestamp: Date.now()
    });

    return true;
  }
}

module.exports = ChatService;
