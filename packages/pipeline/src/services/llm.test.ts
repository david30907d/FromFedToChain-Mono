import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildUserMessage, generateScriptWithLLM } from './llm.js';

vi.mock('node:fs', async () => {
  const actual = (await vi.importActual('node:fs')) as typeof import('node:fs');
  return {
    ...actual,
    readFileSync: vi.fn((path: string) => {
      if (typeof path === 'string' && path.includes('script-system-prompt')) {
        return '你是一個 Podcast 講稿生成助手。請根據標題和內容生成簡短的講稿。';
      }
      return actual.readFileSync(path);
    }),
  };
});

vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: vi.fn(),
        },
      },
    })),
  };
});

describe('buildUserMessage', () => {
  it('formats title in 標題： prefix', () => {
    const result = buildUserMessage('Test Title', 'Some content');
    expect(result).toContain('標題：Test Title');
  });

  it('formats text in 內容： prefix', () => {
    const result = buildUserMessage('Test Title', 'Some content');
    expect(result).toContain('內容：\nSome content');
  });

  it('combines title and text with newlines', () => {
    const result = buildUserMessage('Title', 'Content');
    expect(result).toBe('標題：Title\n\n內容：\nContent');
  });
});

describe('generateScriptWithLLM', () => {
  beforeEach(() => {
    vi.stubEnv('OPENROUTER_API_KEY', 'test-api-key');
    vi.stubEnv('OPENROUTER_BASE_URL', 'https://test.openrouter.ai/api/v1');
    vi.stubEnv('LLM_MODEL', 'test/model');
    vi.stubEnv('LLM_THINKING_MODEL', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('throws error when OPENROUTER_API_KEY is not set', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', '');
    await expect(generateScriptWithLLM('Title', 'Text')).rejects.toThrow(
      'OPENROUTER_API_KEY not set'
    );
  });

  it('returns script from mocked OpenRouter API response', async () => {
    const OpenAI = await import('openai');
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: '這是生成的講稿內容。' } }],
      provider: 'Cloudflare',
      model: 'mistralai/mistral-7b-instruct-v0.1',
    });

    vi.mocked(OpenAI.default).mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    }) as any);

    const result = await generateScriptWithLLM('測試標題', '測試內容');

    expect(result.script).toBe('這是生成的講稿內容。');
    expect(result.provider).toBe('Cloudflare');
    expect(result.model).toBe('mistralai/mistral-7b-instruct-v0.1');
    expect(result.thinkingModel).toBeNull();
  });

  it('uses thinking model when configured', async () => {
    vi.stubEnv('LLM_THINKING_MODEL', 'anthropic/claude-3-opus');

    const OpenAI = await import('openai');
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: 'Script with thinking' } }],
      provider: 'Cloudflare',
      model: 'test/model',
    });

    const mockInstance = {
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    };

    vi.mocked(OpenAI.default).mockImplementation(() => mockInstance as any);

    await generateScriptWithLLM('Title', 'Text');

    expect(mockCreate).toHaveBeenCalled();
    const callArgs = mockCreate.mock.calls[0][0] as any;
    expect(callArgs.extra_body).toBeDefined();
    expect(callArgs.extra_body.thinking).toEqual({
      type: 'optimized',
      model: 'anthropic/claude-3-opus',
    });
  });

  it('returns empty script when API returns no content', async () => {
    const OpenAI = await import('openai');
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: null } }],
      provider: 'Cloudflare',
      model: 'test/model',
    });

    const mockInstance = {
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    };

    vi.mocked(OpenAI.default).mockImplementation(() => mockInstance as any);

    const result = await generateScriptWithLLM('Title', 'Text');

    expect(result.script).toBe('');
  });

  it('returns unknown provider when API returns null provider', async () => {
    const OpenAI = await import('openai');
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: 'Script' } }],
      provider: null,
      model: 'test/model',
    });

    const mockInstance = {
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    };

    vi.mocked(OpenAI.default).mockImplementation(() => mockInstance as any);

    const result = await generateScriptWithLLM('Title', 'Text');

    expect(result.provider).toBe('unknown');
  });

  it('falls back to env model when API returns null model', async () => {
    vi.stubEnv('LLM_MODEL', 'fallback/model');

    const OpenAI = await import('openai');
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: 'Script' } }],
      provider: 'Cloudflare',
      model: null,
    });

    const mockInstance = {
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    };

    vi.mocked(OpenAI.default).mockImplementation(() => mockInstance as any);

    const result = await generateScriptWithLLM('Title', 'Text');

    expect(result.model).toBe('fallback/model');
  });
});