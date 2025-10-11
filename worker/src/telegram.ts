export interface TelegramConfig {
  botToken: string;
  chatId: string;
  threadId?: string;
}

export interface SendMessageOptions {
  text: string;
  parseMode?: 'HTML' | 'Markdown';
}

export async function sendTelegramMessage(
  config: TelegramConfig,
  options: SendMessageOptions
): Promise<void> {
  const { botToken, chatId, threadId } = config;
  const { text, parseMode = 'HTML' } = options;

  const apiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;

  const payload: any = {
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

  return {
    botToken,
    chatId,
    threadId,
  };
}
