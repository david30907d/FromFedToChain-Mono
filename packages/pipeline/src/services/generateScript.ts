import type { Article } from '../types.js';

const MAX_SCRIPT_CHARS = 4200;

export async function generateScript(article: Article): Promise<string> {
  const excerpt = article.text.slice(0, 3000);
  const script = [
    '歡迎收聽 AI Podcast。',
    `今天我們要快速整理這篇文章：「${article.title}」。`,
    '以下是重點摘要。',
    excerpt,
    '以上就是這集內容，我們下次見。',
  ].join('\n\n');

  return script.slice(0, MAX_SCRIPT_CHARS);
}
