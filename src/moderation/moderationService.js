const axios = require('axios');
const natural = require('natural');
const { TOXICITY_LEVELS, REPORT_TYPES } = require('../config/constants');
const { query } = require('../database/init');
const logger = require('../utils/logger');

class ModerationService {
  constructor() {
    this.tokenizer = new natural.WordTokenizer();
    this.classifier = new natural.BayesClassifier();
    this.initClassifier();
    
    // Списки токсичных слов (базовые примеры)
    this.toxicWords = {
      ru: ['дурак', 'идиот', 'тупой', 'урод', 'мразь'],
      en: ['stupid', 'idiot', 'dumb', 'hate', 'kill']
    };
    
    this.spamPatterns = [
      /https?:\/\//gi,
      /@\w+/g,
      /\b\d{10,}\b/g, // телефоны
      /telegram\.me/gi,
      /t\.me/gi
    ];
  }

  initClassifier() {
    // Обучение классификатора (базовые примеры)
    this.classifier.addDocument('привет как дела', 'safe');
    this.classifier.addDocument('отлично спасибо', 'safe');
    this.classifier.addDocument('ты дурак идиот', 'toxic');
    this.classifier.addDocument('купи подписку переходи по ссылке', 'spam');
    this.classifier.train();
  }

  async analyzeMessage(text, language = 'ru') {
    const results = {
      toxicity: 0,
      isSpam: false,
      isToxic: false,
      flags: []
    };

    // 1. Проверка на спам
    results.isSpam = this.detectSpam(text);
    if (results.isSpam) {
      results.flags.push('spam');
      results.toxicity = TOXICITY_LEVELS.MEDIUM;
    }

    // 2. Проверка токсичных слов
    const toxicScore = this.detectToxicWords(text, language);
    if (toxicScore > 0) {
      results.isToxic = true;
      results.flags.push('toxic_words');
      results.toxicity = Math.max(results.toxicity, toxicScore);
    }

    // 3. ML классификация
    const classification = this.classifier.classify(text.toLowerCase());
    if (classification === 'toxic') {
      results.isToxic = true;
      results.flags.push('ml_toxic');
      results.toxicity = Math.max(results.toxicity, TOXICITY_LEVELS.MEDIUM);
    } else if (classification === 'spam') {
      results.isSpam = true;
      results.flags.push('ml_spam');
    }

    // 4. Попытка использовать внешний API (если доступен)
    if (process.env.HUGGINGFACE_API_KEY) {
      try {
        const apiScore = await this.analyzeWithHuggingFace(text);
        if (apiScore > 0.7) {
          results.isToxic = true;
          results.flags.push('api_toxic');
          results.toxicity = TOXICITY_LEVELS.HIGH;
        }
      } catch (error) {
        logger.debug('HuggingFace API unavailable', { error: error.message });
      }
    }

    return results;
  }

  detectSpam(text) {
    // Проверка на спам-паттерны
    for (const pattern of this.spamPatterns) {
      if (pattern.test(text)) {
        return true;
      }
    }

    // Проверка на повторяющиеся символы
    if (/(.)\1{5,}/.test(text)) {
      return true;
    }

    // Проверка на капс
    const capsRatio = (text.match(/[A-ZА-Я]/g) || []).length / text.length;
    if (capsRatio > 0.7 && text.length > 10) {
      return true;
    }

    return false;
  }

  detectToxicWords(text, language) {
    const words = this.tokenizer.tokenize(text.toLowerCase());
    const toxicList = this.toxicWords[language] || this.toxicWords.en;
    
    let toxicCount = 0;
    for (const word of words) {
      if (toxicList.some(toxic => word.includes(toxic))) {
        toxicCount++;
      }
    }

    if (toxicCount === 0) return 0;
    if (toxicCount === 1) return TOXICITY_LEVELS.LOW;
    if (toxicCount === 2) return TOXICITY_LEVELS.MEDIUM;
    return TOXICITY_LEVELS.HIGH;
  }

  async analyzeWithHuggingFace(text) {
    try {
      const response = await axios.post(
        'https://api-inference.huggingface.co/models/unitary/toxic-bert',
        { inputs: text },
        {
          headers: {
            'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`
          },
          timeout: 5000
        }
      );

      if (response.data && response.data[0]) {
        const toxicLabel = response.data[0].find(item => item.label === 'toxic');
        return toxicLabel ? toxicLabel.score : 0;
      }
    } catch (error) {
      logger.debug('HuggingFace API error', { error: error.message });
    }
    return 0;
  }

  async createReport(reporterId, reportedId, chatId, reportType, description = null) {
    try {
      await query(
        `INSERT INTO reports (reporter_id, reported_id, chat_id, report_type, description)
         VALUES ($1, $2, $3, $4, $5)`,
        [reporterId, reportedId, chatId, reportType, description]
      );

      // Проверяем количество жалоб на пользователя
      const result = await query(
        `SELECT COUNT(*) as count FROM reports 
         WHERE reported_id = $1 AND created_at > NOW() - INTERVAL '24 hours'`,
        [reportedId]
      );

      const reportCount = parseInt(result.rows[0].count);
      
      // Автоматический бан при превышении лимита
      if (reportCount >= 3) {
        await this.autoModerate(reportedId, reportCount);
      }

      logger.info('Report created', { reporterId, reportedId, reportType, reportCount });
      return true;
    } catch (error) {
      logger.error('Error creating report', { error: error.message });
      return false;
    }
  }

  async autoModerate(userId, reportCount) {
    const UserService = require('../services/userService');
    const userService = new UserService();

    if (reportCount >= 5) {
      // Перманентный бан
      await userService.banUser(userId, 'Множественные жалобы (авто-бан)');
      logger.warn('User auto-banned', { userId, reportCount });
    } else if (reportCount >= 3) {
      // Временный бан на 24 часа
      await userService.banUser(userId, 'Множественные жалобы (временный бан)', 86400);
      logger.warn('User temp-banned', { userId, reportCount });
    }
  }

  async getReports(status = 'pending', limit = 50) {
    const result = await query(
      `SELECT r.*, 
        u1.username as reporter_username,
        u2.username as reported_username
       FROM reports r
       LEFT JOIN users u1 ON r.reporter_id = u1.id
       LEFT JOIN users u2 ON r.reported_id = u2.id
       WHERE r.status = $1
       ORDER BY r.created_at DESC
       LIMIT $2`,
      [status, limit]
    );
    return result.rows;
  }

  async reviewReport(reportId, reviewerId, action) {
    await query(
      `UPDATE reports 
       SET status = 'reviewed',
           reviewed_by = $1,
           reviewed_at = CURRENT_TIMESTAMP,
           action_taken = $2
       WHERE id = $3`,
      [reviewerId, action, reportId]
    );
  }

  // Проверка возраста (поведенческий анализ)
  async checkAgeCompliance(userId) {
    // Анализ паттернов поведения
    const result = await query(
      `SELECT 
        COUNT(*) as total_messages,
        AVG(LENGTH(content)) as avg_message_length,
        COUNT(CASE WHEN toxicity_score > 2 THEN 1 END) as toxic_messages
       FROM messages
       WHERE sender_id = $1`,
      [userId]
    );

    const stats = result.rows[0];
    
    // Простая эвристика (можно улучшить)
    const suspicionScore = 0;
    
    // Короткие сообщения могут указывать на молодого пользователя
    if (stats.avg_message_length < 20) {
      return { suspicious: true, reason: 'short_messages' };
    }

    return { suspicious: false };
  }
}

module.exports = ModerationService;
