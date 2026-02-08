# 📡 API Документация

## Внутренние API

### UserService

#### getUser(telegramId)
Получить пользователя по Telegram ID
```javascript
const user = await userService.getUser(123456789);
```

#### createUser(telegramUser)
Создать нового пользователя
```javascript
const user = await userService.createUser({
  id: 123456789,
  username: 'john_doe',
  first_name: 'John',
  language_code: 'en'
});
```

#### updateUser(userId, updates)
Обновить данные пользователя
```javascript
await userService.updateUser(1, {
  bio: 'Hello world',
  interests: ['music', 'sports']
});
```

#### banUser(userId, reason, duration)
Забанить пользователя
```javascript
await userService.banUser(1, 'Spam', 86400); // 24 часа
```

### MatchmakingService

#### addToQueue(userId, filters)
Добавить пользователя в очередь
```javascript
await matchmakingService.addToQueue(1, {
  match_language: 'ru',
  match_age_groups: ['18-24', '25-34'],
  match_interests: ['music', 'movies']
});
```

#### checkCompatibility(user1, user2)
Проверить совместимость пользователей
```javascript
const result = await matchmakingService.checkCompatibility(user1Data, user2Data);
// { match: true, score: 125 }
```

### ChatService

#### createChat(userId1, userId2)
Создать чат между пользователями
```javascript
const chat = await chatService.createChat(1, 2);
```

#### endChat(chatId, endedBy)
Завершить чат
```javascript
await chatService.endChat(123, 1);
```

#### saveMessage(chatId, senderId, messageType, content, fileId, toxicityScore)
Сохранить сообщение
```javascript
await chatService.saveMessage(123, 1, 'text', 'Hello!', null, 0);
```

#### rateChat(chatId, userId, rating)
Оценить чат
```javascript
await chatService.rateChat(123, 1, 5);
```

### ModerationService

#### analyzeMessage(text, language)
Анализ сообщения на токсичность
```javascript
const result = await moderationService.analyzeMessage('Hello world', 'en');
// {
//   toxicity: 0,
//   isSpam: false,
//   isToxic: false,
//   flags: []
// }
```

#### createReport(reporterId, reportedId, chatId, reportType, description)
Создать жалобу
```javascript
await moderationService.createReport(1, 2, 123, 'spam', 'User is spamming');
```

## Redis API

### Очереди

#### addToQueue(userId, filters)
```javascript
await addToQueue(1, { match_language: 'ru' });
```

#### getQueue()
```javascript
const queue = await getQueue();
```

### Активные чаты

#### setActiveChat(userId, chatData)
```javascript
await setActiveChat(1, {
  chatId: 123,
  partnerId: 2,
  startedAt: new Date()
});
```

#### getActiveChat(userId)
```javascript
const chat = await getActiveChat(1);
```

### Кэш

#### cacheUser(userId, userData)
```javascript
await cacheUser(123456789, user);
```

#### getCachedUser(userId)
```javascript
const user = await getCachedUser(123456789);
```

## Webhook API

### POST /webhook
Получение обновлений от Telegram

Request:
```json
{
  "update_id": 123456789,
  "message": {
    "message_id": 1,
    "from": {
      "id": 123456789,
      "first_name": "John"
    },
    "chat": {
      "id": 123456789,
      "type": "private"
    },
    "text": "/start"
  }
}
```

Response:
```json
{
  "ok": true
}
```

### GET /health
Проверка здоровья сервиса

Response:
```json
{
  "status": "ok",
  "timestamp": 1234567890
}
```

## События (Pub/Sub)

### chat:{chatId}
Сообщения в чате
```javascript
await publishMessage('chat:123', {
  senderId: 1,
  receiverId: 2,
  message: 'Hello!',
  timestamp: Date.now()
});
```

### match:found
Найден матч
```javascript
await publishMessage('match:found', {
  user1Id: 1,
  user2Id: 2,
  chatId: 123
});
```

## Константы

### USER_STATUS
- `idle` - свободен
- `in_queue` - в очереди
- `in_chat` - в чате
- `banned` - забанен
- `shadow_banned` - теневой бан

### AGE_GROUPS
- `13-17` - подростки
- `18-24` - молодые
- `25-34` - взрослые
- `35-44` - зрелые
- `45+` - старшие

### REPORT_TYPES
- `spam` - спам
- `harassment` - оскорбления
- `inappropriate` - неприемлемый контент
- `underage` - несовершеннолетний
- `scam` - мошенничество
- `other` - другое

### MESSAGE_TYPES
- `text` - текст
- `photo` - фото
- `voice` - голос
- `sticker` - стикер
- `gif` - GIF
- `video_note` - видео-сообщение

## Ошибки

### Коды ошибок
- `400` - Неверный запрос
- `401` - Не авторизован
- `403` - Доступ запрещен
- `404` - Не найдено
- `429` - Слишком много запросов
- `500` - Внутренняя ошибка сервера

### Формат ошибки
```json
{
  "error": {
    "code": 400,
    "message": "Invalid request",
    "details": "User ID is required"
  }
}
```
