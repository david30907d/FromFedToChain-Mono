import { timingSafeEqual } from 'node:crypto';
import { getTelegramBotToken } from '../lib/env.js';

export type TelegramChatId = number | string;

export async function sendMessage(chatId: TelegramChatId, text: string): Promise<void> {
  const token = getTelegramBotToken();
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
    }),
  });

  if (!response.ok) {
    throw new Error(`Telegram sendMessage failed: ${response.status}`);
  }
}

export function verifySecret(headerValue: string | undefined, expected: string): boolean {
  if (!headerValue) {
    return false;
  }

  const actualBuffer = Buffer.from(headerValue);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

export function extractUrlFromMessage(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s<>()]+/i);
  if (!match) {
    return null;
  }

  return match[0].replace(/[.,!?，。！？]+$/, '');
}

export function isAllowedUser(userId: unknown, allowlist: ReadonlySet<string>): boolean {
  if (typeof userId !== 'number' && typeof userId !== 'string') {
    return false;
  }

  return allowlist.has(String(userId));
}
