import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSynthesize, mockTextToSpeechClient } = vi.hoisted(() => ({
  mockSynthesize: vi.fn(),
  mockTextToSpeechClient: vi.fn(),
}));

vi.mock('@google-cloud/text-to-speech', () => ({
  TextToSpeechClient: mockTextToSpeechClient.mockImplementation(() => ({
    synthesizeSpeech: mockSynthesize,
  })),
}));

vi.mock('fluent-ffmpeg', () => ({
  default: Object.assign(vi.fn(), { setFfmpegPath: vi.fn() }),
}));

vi.mock('@ffmpeg-installer/ffmpeg', () => ({ path: '/usr/bin/ffmpeg' }));

vi.mock('node:fs', async () => {
  const actual = (await vi.importActual('node:fs')) as typeof import('node:fs');
  return { ...actual, writeFileSync: vi.fn(), unlinkSync: vi.fn() };
});

vi.mock('os', () => ({ tmpdir: vi.fn().mockReturnValue('/tmp') }));

vi.mock('crypto', () => ({ randomUUID: vi.fn().mockReturnValue('mock-uuid-456') }));

import {
  concatenateAudioChunks,
  getClientOptions,
  splitTextIntoChunks,
  synthesizeChunk,
  textToSpeech,
} from './tts.js';

describe('Google credentials', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    mockTextToSpeechClient.mockClear();
  });

  it('builds TTS client options from base64 service account JSON', () => {
    const credentials = {
      client_email: 'tts@example.iam.gserviceaccount.com',
      private_key: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----\n',
      project_id: 'test-project',
    };
    vi.stubEnv(
      'GOOGLE_APPLICATION_CREDENTIALS_BASE64',
      Buffer.from(JSON.stringify(credentials), 'utf8').toString('base64'),
    );

    expect(getClientOptions()).toEqual({
      credentials,
      projectId: 'test-project',
    });
  });

  it('passes base64 service account credentials to the TTS client', async () => {
    const credentials = {
      client_email: 'tts@example.iam.gserviceaccount.com',
      private_key: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----\n',
      project_id: 'test-project',
    };
    vi.stubEnv(
      'GOOGLE_APPLICATION_CREDENTIALS_BASE64',
      Buffer.from(JSON.stringify(credentials), 'utf8').toString('base64'),
    );
    mockSynthesize.mockResolvedValue([{ audioContent: new Uint8Array(1024) }]);

    await synthesizeChunk('Test speech text');

    expect(mockTextToSpeechClient).toHaveBeenCalledWith({
      credentials,
      projectId: 'test-project',
    });
  });
});

describe('textToSpeech', () => {
  beforeEach(() => {
    vi.resetModules();
    mockSynthesize.mockResolvedValue([{ audioContent: new Uint8Array(1024) }]);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    mockSynthesize.mockClear();
  });

  it('throws when text is empty', async () => {
    await expect(textToSpeech('')).rejects.toThrow('No text to synthesize');
  });

  it('throws when text contains only whitespace', async () => {
    await expect(textToSpeech('   ')).rejects.toThrow('No text to synthesize');
  });

  it('synthesizes single chunk directly', async () => {
    const result = await textToSpeech('短文字');
    expect(result).toBeInstanceOf(Buffer);
    expect(result.length).toBeGreaterThan(0);
  });

  it('handles Chinese text with period punctuation', async () => {
    const result = await textToSpeech('這是一段很長的文字內容。這是第二句話。這是第三句話。');
    expect(result).toBeInstanceOf(Buffer);
  });

  it('handles mixed ASCII and CJK characters', async () => {
    const result = await textToSpeech('Hello 你好 World 世界 123。');
    expect(result).toBeInstanceOf(Buffer);
  });

  it('uses custom language code from env', async () => {
    vi.stubEnv('GOOGLE_TTS_LANGUAGE_CODE', 'en-US');
    vi.stubEnv('GOOGLE_TTS_VOICE_NAME', 'en-US-Wavenet-A');
    const result = await textToSpeech('Hello world');
    expect(result).toBeInstanceOf(Buffer);
  });

  it('splits text into multiple chunks when needed', async () => {
    const longText = '第一章內容。這是第二章內容。這是第三章內容。這是第四章內容。這是第五章內容。';
    const result = await textToSpeech(longText);
    expect(result).toBeInstanceOf(Buffer);
    expect(mockSynthesize).toHaveBeenCalled();
  });

  it('throws when synthesize returns empty audio content', async () => {
    mockSynthesize.mockResolvedValue([{ audioContent: null }]);
    await expect(textToSpeech('Test')).rejects.toThrow('Google TTS returned empty audio content');
  });
});

describe('splitTextIntoChunks', () => {
  it('returns empty array for empty text', () => {
    expect(splitTextIntoChunks('', 4800)).toEqual([]);
  });

  it('returns single chunk when text fits', () => {
    const chunks = splitTextIntoChunks('短文字', 4800);
    expect(chunks).toHaveLength(1);
  });

  it('splits on Chinese period punctuation', () => {
    const chunks = splitTextIntoChunks('第一句。第二句。第三句。', 4800);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks.join('')).toContain('第一句');
    expect(chunks.join('')).toContain('第二句');
  });

  it('handles single very long sentence by char splitting', () => {
    const longSentence = '很長的句子沒有標點符號。';
    const chunks = splitTextIntoChunks(longSentence.repeat(200), 4800);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('discards empty chunks', () => {
    const chunks = splitTextIntoChunks('句子一。句子二。', 4800);
    chunks.forEach((c) => expect(c.trim()).not.toBe(''));
  });
});

describe('synthesizeChunk', () => {
  beforeEach(() => {
    mockSynthesize.mockResolvedValue([{ audioContent: new Uint8Array(1024) }]);
  });

  it('calls TTS client with correct parameters', async () => {
    const result = await synthesizeChunk('Test speech text');
    expect(result).toBeInstanceOf(Buffer);
    expect(mockSynthesize).toHaveBeenCalledWith({
      input: { text: 'Test speech text' },
      voice: expect.objectContaining({ languageCode: 'cmn-TW', name: 'cmn-TW-Wavenet-A' }),
      audioConfig: { audioEncoding: 'MP3' },
    });
  });
});

describe('concatenateAudioChunks', () => {
  it('returns single chunk unchanged', async () => {
    const buf = Buffer.alloc(100);
    const result = await concatenateAudioChunks([buf]);
    expect(result).toBe(buf);
  });
});
