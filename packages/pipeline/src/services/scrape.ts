import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import type { Article } from '../types.js';

export async function scrapeArticle(url: string): Promise<Article> {
  const response = await fetch(url, {
    headers: {
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'user-agent':
        'Mozilla/5.0 (compatible; AI Podcast POC/0.1; +https://localhost)',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch article: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const dom = new JSDOM(html, { url });

  try {
    const article = new Readability(dom.window.document).parse();
    const title = article?.title?.trim() || dom.window.document.title?.trim() || 'Untitled';
    const text = article?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

    if (!text) {
      throw new Error('No readable article text found');
    }

    return { title, text };
  } finally {
    dom.window.close();
  }
}
