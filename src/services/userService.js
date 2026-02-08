const { query } = require('../database/init');
const { cacheUser, getCachedUser } = require('./redis');
const { USER_STATUS } = require('../config/constants');
const logger = require('../utils/logger');

class UserService {
  async getUser(telegramId) {
    // Проверяем кэш
    const cached = await getCachedUser(telegramId);
    if (cached) return cached;

    const result = await query(
      'SELECT * FROM users WHERE telegram_id = $1',
      [telegramId]
    );

    if (result.rows.length > 0) {
      const user = result.rows[0];
      await cacheUser(telegramId, user);
      return user;
    }

    return null;
  }

  async createUser(telegramUser) {
    const result = await query(
      `INSERT INTO users (telegram_id, username, first_name, language_code)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        telegramUser.id,
        telegramUser.username,
        telegramUser.first_name,
        telegramUser.language_code || 'ru'
      ]
    );

    const user = result.rows[0];
    await cacheUser(telegramUser.id, user);

    // Создаем настройки по умолчанию
    await query(
      `INSERT INTO user_settings (user_id) VALUES ($1)`,
      [user.id]
    );

    logger.info('New user created', { userId: user.id, telegramId: telegramUser.id });
    return user;
  }

  async updateUser(userId, updates) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.entries(updates).forEach(([key, value]) => {
      fields.push(`${key} = $${paramCount}`);
      values.push(value);
      paramCount++;
    });

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(userId);

    const result = await query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    if (result.rows.length > 0) {
      const user = result.rows[0];
      await cacheUser(user.telegram_id, user);
      return user;
    }

    return null;
  }

  async updateStatus(userId, status) {
    return this.updateUser(userId, { status, last_active: new Date() });
  }

  async getUserSettings(userId) {
    const result = await query(
      'SELECT * FROM user_settings WHERE user_id = $1',
      [userId]
    );
    return result.rows[0] || null;
  }

  async updateSettings(userId, settings) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.entries(settings).forEach(([key, value]) => {
      fields.push(`${key} = $${paramCount}`);
      values.push(value);
      paramCount++;
    });

    values.push(userId);

    await query(
      `UPDATE user_settings SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $${paramCount}`,
      values
    );
  }

  async addExperience(userId, amount) {
    const result = await query(
      `UPDATE users 
       SET experience = experience + $1,
           level = FLOOR((experience + $1) / 100) + 1
       WHERE id = $2
       RETURNING *`,
      [amount, userId]
    );

    return result.rows[0];
  }

  async incrementStats(userId, field) {
    await query(
      `UPDATE users SET ${field} = ${field} + 1 WHERE id = $1`,
      [userId]
    );
  }

  async banUser(userId, reason, duration = null) {
    const banUntil = duration ? new Date(Date.now() + duration * 1000) : null;
    
    await this.updateUser(userId, {
      banned: true,
      ban_reason: reason,
      ban_until: banUntil
    });

    logger.warn('User banned', { userId, reason, duration });
  }

  async shadowBanUser(userId) {
    await this.updateUser(userId, { shadow_banned: true });
    logger.warn('User shadow banned', { userId });
  }

  async unbanUser(userId) {
    await this.updateUser(userId, {
      banned: false,
      shadow_banned: false,
      ban_reason: null,
      ban_until: null
    });
  }

  async addToBlacklist(userId, blockedUserId) {
    try {
      await query(
        `INSERT INTO blacklist (user_id, blocked_user_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [userId, blockedUserId]
      );
    } catch (error) {
      logger.error('Error adding to blacklist', { userId, blockedUserId, error });
    }
  }

  async removeFromBlacklist(userId, blockedUserId) {
    await query(
      'DELETE FROM blacklist WHERE user_id = $1 AND blocked_user_id = $2',
      [userId, blockedUserId]
    );
  }

  async getBlacklist(userId) {
    const result = await query(
      'SELECT blocked_user_id FROM blacklist WHERE user_id = $1',
      [userId]
    );
    return result.rows.map(row => row.blocked_user_id);
  }

  async addFavorite(userId, favoriteUserId) {
    try {
      await query(
        `INSERT INTO favorites (user_id, favorite_user_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [userId, favoriteUserId]
      );
    } catch (error) {
      logger.error('Error adding favorite', { userId, favoriteUserId, error });
    }
  }

  async removeFavorite(userId, favoriteUserId) {
    await query(
      'DELETE FROM favorites WHERE user_id = $1 AND favorite_user_id = $2',
      [userId, favoriteUserId]
    );
  }

  async getFavorites(userId) {
    const result = await query(
      `SELECT u.* FROM users u
       INNER JOIN favorites f ON u.id = f.favorite_user_id
       WHERE f.user_id = $1`,
      [userId]
    );
    return result.rows;
  }

  async unlockAchievement(userId, achievementCode) {
    try {
      const achievement = await query(
        'SELECT id FROM achievements WHERE code = $1',
        [achievementCode]
      );

      if (achievement.rows.length > 0) {
        await query(
          `INSERT INTO user_achievements (user_id, achievement_id)
           VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [userId, achievement.rows[0].id]
        );
        return true;
      }
    } catch (error) {
      logger.error('Error unlocking achievement', { userId, achievementCode, error });
    }
    return false;
  }

  async getUserAchievements(userId) {
    const result = await query(
      `SELECT a.* FROM achievements a
       INNER JOIN user_achievements ua ON a.id = ua.achievement_id
       WHERE ua.user_id = $1`,
      [userId]
    );
    return result.rows;
  }

  async getStats(userId) {
    const result = await query(
      `SELECT 
        total_chats,
        total_messages,
        reputation,
        level,
        experience,
        created_at
       FROM users WHERE id = $1`,
      [userId]
    );
    return result.rows[0];
  }
}

module.exports = UserService;
