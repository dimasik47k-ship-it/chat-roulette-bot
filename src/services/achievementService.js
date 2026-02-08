const { ACHIEVEMENTS } = require('../config/constants');
const UserService = require('./userService');
const { query } = require('../database/init');
const logger = require('../utils/logger');

class AchievementService {
  constructor() {
    this.userService = new UserService();
  }

  async checkAchievements(userId) {
    const stats = await this.userService.getStats(userId);
    const unlocked = [];

    // Проверяем достижения по количеству чатов
    if (stats.total_chats === 1) {
      if (await this.userService.unlockAchievement(userId, ACHIEVEMENTS.FIRST_CHAT)) {
        unlocked.push(ACHIEVEMENTS.FIRST_CHAT);
      }
    } else if (stats.total_chats === 10) {
      if (await this.userService.unlockAchievement(userId, ACHIEVEMENTS.CHAT_10)) {
        unlocked.push(ACHIEVEMENTS.CHAT_10);
      }
    } else if (stats.total_chats === 50) {
      if (await this.userService.unlockAchievement(userId, ACHIEVEMENTS.CHAT_50)) {
        unlocked.push(ACHIEVEMENTS.CHAT_50);
      }
    } else if (stats.total_chats === 100) {
      if (await this.userService.unlockAchievement(userId, ACHIEVEMENTS.CHAT_100)) {
        unlocked.push(ACHIEVEMENTS.CHAT_100);
      }
    } else if (stats.total_chats === 500) {
      if (await this.userService.unlockAchievement(userId, ACHIEVEMENTS.CHAT_500)) {
        unlocked.push(ACHIEVEMENTS.CHAT_500);
      }
    }

    // Проверяем репутацию
    if (stats.reputation >= 90) {
      if (await this.userService.unlockAchievement(userId, ACHIEVEMENTS.FRIENDLY)) {
        unlocked.push(ACHIEVEMENTS.FRIENDLY);
      }
    }

    // Проверяем время суток
    const hour = new Date().getHours();
    if (hour >= 2 && hour <= 4) {
      if (await this.userService.unlockAchievement(userId, ACHIEVEMENTS.NIGHT_OWL)) {
        unlocked.push(ACHIEVEMENTS.NIGHT_OWL);
      }
    } else if (hour >= 5 && hour <= 7) {
      if (await this.userService.unlockAchievement(userId, ACHIEVEMENTS.EARLY_BIRD)) {
        unlocked.push(ACHIEVEMENTS.EARLY_BIRD);
      }
    }

    return unlocked;
  }

  async notifyAchievement(bot, userId, achievementCode) {
    const result = await query(
      'SELECT * FROM achievements WHERE code = $1',
      [achievementCode]
    );

    if (result.rows.length > 0) {
      const achievement = result.rows[0];
      await bot.sendMessage(
        userId,
        `🏆 Достижение разблокировано!\n\n${achievement.icon} ${achievement.name}\n${achievement.description}`
      );
    }
  }
}

module.exports = AchievementService;
