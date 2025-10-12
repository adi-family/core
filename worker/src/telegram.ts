export interface TelegramConfig {
  botToken: string;
  chatId: string;
  threadId?: string;
}

export interface SendMessageOptions {
  text: string;
  parseMode?: 'HTML' | 'Markdown';
}

interface TelegramPayload {
  chat_id: string;
  text: string;
  parse_mode: string;
  message_thread_id?: number;
}

export async function sendTelegramMessage(
  config: TelegramConfig,
  options: SendMessageOptions
): Promise<void> {
  // Design by Contract: Validate preconditions at boundary
  if (!config.botToken || config.botToken.trim() === '') {
    throw new Error('Telegram botToken is required and cannot be empty');
  }
  if (!config.botToken.includes(':')) {
    throw new Error('Telegram botToken appears invalid (expected format: <bot_id>:<token>)');
  }
  if (!config.chatId || config.chatId.trim() === '') {
    throw new Error('Telegram chatId is required and cannot be empty');
  }
  if (!/^-?\d+$/.test(config.chatId)) {
    throw new Error('Telegram chatId must be numeric (e.g., 123456789 or -123456789 for groups)');
  }
  if (!options.text || options.text.trim() === '') {
    throw new Error('Message text is required and cannot be empty');
  }

  const { botToken, chatId, threadId } = config;
  const { text, parseMode = 'HTML' } = options;

  const apiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;

  const payload: TelegramPayload = {
    chat_id: chatId,
    text: text,
    parse_mode: parseMode,
  };

  if (threadId) {
    payload.message_thread_id = parseInt(threadId, 10);
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to send Telegram message: ${error}`);
  }
}

export function getTelegramConfigFromEnv(): TelegramConfig {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const threadId = process.env.TELEGRAM_THREAD_ID;

  if (!botToken || !chatId) {
    throw new Error('TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be set in environment');
  }

  // Validate bot token format (should contain :)
  if (!botToken.includes(':')) {
    throw new Error('TELEGRAM_BOT_TOKEN appears invalid (expected format: <bot_id>:<token>)');
  }

  // Validate chat ID format (should be numeric or start with -)
  if (!/^-?\d+$/.test(chatId)) {
    throw new Error('TELEGRAM_CHAT_ID must be numeric (e.g., 123456789 or -123456789 for groups)');
  }

  return {
    botToken,
    chatId,
    threadId,
  };
}
