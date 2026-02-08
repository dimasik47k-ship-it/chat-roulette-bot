const { USER_STATUS, MESSAGE_TYPES } = require('../../config/constants');
const keyboards = require('../keyboards');

class MessageHandler {
  constructor(controller) {
    this.controller = controller;
    this.bot = controller.bot;
    this.chatService = controller.chatService;
    this.moderationService = controller.moderationService;
    this.userService = controller.userService;
  }

  async handle(msg, user) {
    const chatId = msg.chat.id;

    // Проверяем, находится ли пользователь в чате
    const activeChat = await this.chatService.getActiveChat(user.id);
    
    if (!activeChat) {
      // Пользователь не в чате - показываем меню
      await this.bot.sendMessage(
        chatId,
        'Вы не в чате. Начните поиск собеседника!',
        { reply_markup: keyboards.mainMenu(user) }
      );
      return;
    }

    // Обрабатываем сообщение в зависимости от типа
    if (msg.text) {
      await this.handleTextMessage(msg, user, activeChat);
    } else if (msg.photo) {
      await this.handlePhotoMessage(msg, user, activeChat);
    } else if (msg.voice) {
      await this.handleVoiceMessage(msg, user, activeChat);
    } else if (msg.sticker) {
      await this.handleStickerMessage(msg, user, activeChat);
    } else if (msg.animation) {
      await this.handleGifMessage(msg, user, activeChat);
    } else if (msg.video_note) {
      await this.handleVideoNoteMessage(msg, user, activeChat);
    }
  }

  async handleTextMessage(msg, user, activeChat) {
    const text = msg.text;

    // Модерация сообщения
    const moderation = await this.moderationService.analyzeMessage(text, user.language_code);

    // Сохраняем в БД
    await this.chatService.saveMessage(
      activeChat.chatId,
      user.id,
      MESSAGE_TYPES.TEXT,
      text,
      null,
      moderation.toxicity
    );

    // Если сообщение токсичное - предупреждаем
    if (moderation.isToxic) {
      await this.bot.sendMessage(
        msg.chat.id,
        '⚠️ Ваше сообщение содержит неприемлемый контент. Пожалуйста, будьте вежливы.'
      );
      
      // Не отправляем токсичное сообщение
      if (moderation.toxicity >= 3) {
        return;
      }
    }

    // Если спам - блокируем
    if (moderation.isSpam) {
      await this.bot.sendMessage(
        msg.chat.id,
        '🚫 Обнаружен спам. Сообщение не отправлено.'
      );
      return;
    }

    // Отправляем партнеру
    try {
      await this.bot.sendMessage(activeChat.partnerId, text);
      
      // Добавляем опыт
      await this.userService.addExperience(user.id, 1);
    } catch (error) {
      await this.bot.sendMessage(
        msg.chat.id,
        '❌ Не удалось отправить сообщение. Собеседник, возможно, покинул чат.'
      );
    }
  }

  async handlePhotoMessage(msg, user, activeChat) {
    const photo = msg.photo[msg.photo.length - 1]; // Берем самое большое фото
    const caption = msg.caption || '';

    // Модерация подписи
    if (caption) {
      const moderation = await this.moderationService.analyzeMessage(caption, user.language_code);
      if (moderation.isSpam || moderation.toxicity >= 3) {
        await this.bot.sendMessage(msg.chat.id, '🚫 Сообщение заблокировано модерацией');
        return;
      }
    }

    // Сохраняем в БД
    await this.chatService.saveMessage(
      activeChat.chatId,
      user.id,
      MESSAGE_TYPES.PHOTO,
      caption,
      photo.file_id
    );

    // Отправляем партнеру
    try {
      await this.bot.sendPhoto(activeChat.partnerId, photo.file_id, { caption });
      await this.userService.addExperience(user.id, 2);
    } catch (error) {
      await this.bot.sendMessage(msg.chat.id, '❌ Не удалось отправить фото');
    }
  }

  async handleVoiceMessage(msg, user, activeChat) {
    const voice = msg.voice;

    await this.chatService.saveMessage(
      activeChat.chatId,
      user.id,
      MESSAGE_TYPES.VOICE,
      null,
      voice.file_id
    );

    try {
      await this.bot.sendVoice(activeChat.partnerId, voice.file_id);
      await this.userService.addExperience(user.id, 3);
    } catch (error) {
      await this.bot.sendMessage(msg.chat.id, '❌ Не удалось отправить голосовое');
    }
  }

  async handleStickerMessage(msg, user, activeChat) {
    const sticker = msg.sticker;

    await this.chatService.saveMessage(
      activeChat.chatId,
      user.id,
      MESSAGE_TYPES.STICKER,
      null,
      sticker.file_id
    );

    try {
      await this.bot.sendSticker(activeChat.partnerId, sticker.file_id);
      await this.userService.addExperience(user.id, 1);
    } catch (error) {
      await this.bot.sendMessage(msg.chat.id, '❌ Не удалось отправить стикер');
    }
  }

  async handleGifMessage(msg, user, activeChat) {
    const gif = msg.animation;

    await this.chatService.saveMessage(
      activeChat.chatId,
      user.id,
      MESSAGE_TYPES.GIF,
      null,
      gif.file_id
    );

    try {
      await this.bot.sendAnimation(activeChat.partnerId, gif.file_id);
      await this.userService.addExperience(user.id, 2);
    } catch (error) {
      await this.bot.sendMessage(msg.chat.id, '❌ Не удалось отправить GIF');
    }
  }

  async handleVideoNoteMessage(msg, user, activeChat) {
    const videoNote = msg.video_note;

    await this.chatService.saveMessage(
      activeChat.chatId,
      user.id,
      MESSAGE_TYPES.VIDEO_NOTE,
      null,
      videoNote.file_id
    );

    try {
      await this.bot.sendVideoNote(activeChat.partnerId, videoNote.file_id);
      await this.userService.addExperience(user.id, 3);
    } catch (error) {
      await this.bot.sendMessage(msg.chat.id, '❌ Не удалось отправить видео');
    }
  }
}

module.exports = MessageHandler;
