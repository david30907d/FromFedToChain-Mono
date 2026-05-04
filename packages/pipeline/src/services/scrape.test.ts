import { afterEach, describe, expect, it, vi } from 'vitest';
import { scrapeArticle } from './scrape.js';

vi.mock('node:fs', async () => {
  const actual = (await vi.importActual('node:fs')) as typeof import('node:fs');
  return { ...actual };
});

describe('scrapeArticle', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('throws when response is not ok', async () => {
    vi.stubEnv('HTTP_PROXY', '');
    const mockFetch = vi
      .fn()
      .mockResolvedValue(new Response('', { status: 404, statusText: 'Not Found' }));
    vi.stubGlobal('fetch', mockFetch);

    await expect(scrapeArticle('https://example.com')).rejects.toThrow(
      'Failed to fetch article: 404 Not Found',
    );
  });

  it('returns article from successful fetch', async () => {
    const html = `
      <html>
        <head><title>Test Article</title></head>
        <body>
          <article>
            <p>This is the article content with multiple paragraphs.</p>
            <p>Another paragraph here.</p>
          </article>
        </body>
      </html>
    `;

    const mockFetch = vi
      .fn()
      .mockResolvedValue(new Response(html, { status: 200, statusText: 'OK' }));
    vi.stubGlobal('fetch', mockFetch);

    const result = await scrapeArticle('https://example.com/article');

    expect(result.title).toBe('Test Article');
    expect(result.text).toBeTruthy();
    expect(result.text.length).toBeGreaterThan(0);
  });

  it('uses document title when article has no title', async () => {
    const html = `
      <html>
        <head><title>Document Title</title></head>
        <body>
          <p>Some content</p>
        </body>
      </html>
    `;

    const mockFetch = vi
      .fn()
      .mockResolvedValue(new Response(html, { status: 200, statusText: 'OK' }));
    vi.stubGlobal('fetch', mockFetch);

    const result = await scrapeArticle('https://example.com/no-article-title');

    expect(result.title).toBe('Document Title');
  });

  it('throws when no readable text is found', async () => {
    const html = `
      <html>
        <head><title>Empty Page</title></head>
        <body></body>
      </html>
    `;

    const mockFetch = vi
      .fn()
      .mockResolvedValue(new Response(html, { status: 200, statusText: 'OK' }));
    vi.stubGlobal('fetch', mockFetch);

    await expect(scrapeArticle('https://example.com/empty')).rejects.toThrow(
      'No readable article text found',
    );
  });

  it('sets correct fetch headers', async () => {
    const html = `<html><body><p>Content</p></body></html>`;
    const mockFetch = vi.fn().mockResolvedValue(new Response(html, { status: 200 }));
    vi.stubGlobal('fetch', mockFetch);

    await scrapeArticle('https://example.com/test');

    expect(mockFetch).toHaveBeenCalledWith('https://example.com/test', {
      headers: expect.objectContaining({
        'user-agent': expect.stringContaining('AI Podcast POC'),
      }),
    });
  });
});
