import { describe, expect, it, vi, type Mock } from 'vitest';

interface FfmpegMock {
  setFfmpegPath: Mock;
  audioCodec: Mock;
  audioBitrate: Mock;
  format: Mock;
  outputOptions: Mock;
  output: Mock;
  on: Mock;
  run: Mock;
  mockReturnThis: () => FfmpegMock;
  [key: string]: Mock | ((...args: unknown[]) => FfmpegMock);
}

const createFfmpegMock = (): FfmpegMock => ({
  setFfmpegPath: vi.fn().mockReturnThis(),
  audioCodec: vi.fn().mockReturnThis(),
  audioBitrate: vi.fn().mockReturnThis(),
  format: vi.fn().mockReturnThis(),
  outputOptions: vi.fn().mockReturnThis(),
  output: vi.fn().mockReturnThis(),
  on: vi.fn().mockImplementation((_event: string, cb: () => void) => {
    setTimeout(cb, 20);
    return vi.mocked(createFfmpegMock());
  }),
  run: vi.fn(),
  mockReturnThis: function (this: FfmpegMock) {
    return this;
  },
});

vi.mock('fluent-ffmpeg', () => ({
  default: Object.assign(
    vi.fn().mockImplementation(() => createFfmpegMock()),
    { setFfmpegPath: vi.fn() },
  ),
}));

vi.mock('@ffmpeg-installer/ffmpeg', () => ({
  path: '/usr/bin/ffmpeg',
}));

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...actual,
    writeFileSync: vi.fn(),
    readFileSync: vi.fn().mockReturnValue(Buffer.alloc(0)),
    readdirSync: vi.fn().mockReturnValue([]),
    statSync: vi.fn().mockReturnValue({ isFile: () => true }),
    unlinkSync: vi.fn(),
    mkdirSync: vi.fn(),
    rmdirSync: vi.fn(),
  };
});

vi.mock('os', () => ({
  tmpdir: vi.fn().mockReturnValue('/tmp'),
}));

vi.mock('node:path', () => ({
  join: (...args: string[]) => args.join('/'),
  default: { join: (...args: string[]) => args.join('/') },
}));

vi.mock('crypto', () => ({
  randomUUID: vi.fn().mockReturnValue('mock-uuid-123'),
}));

describe('generateHls', { timeout: 10000 }, () => {
  it('throws when no files are generated', async () => {
    const { default: ffmpeg } = await import('fluent-ffmpeg');
    const mockFfmpeg = vi.mocked(ffmpeg);
    mockFfmpeg.mockImplementation(() => createFfmpegMock() as unknown as ReturnType<typeof ffmpeg>);

    const { generateHls } = await import('./hls.js');

    await expect(generateHls(Buffer.alloc(100))).rejects.toThrow('No HLS files were generated');
  });

  it('throws when playlist file is not generated', async () => {
    const { default: ffmpeg } = await import('fluent-ffmpeg');
    const mockFfmpeg = vi.mocked(ffmpeg);
    mockFfmpeg.mockImplementation(() => createFfmpegMock() as unknown as ReturnType<typeof ffmpeg>);

    const { readdirSync } = await import('node:fs');
    vi.mocked(readdirSync).mockReturnValue(['seg1.ts', 'seg2.ts'] as unknown as ReturnType<
      typeof readdirSync
    >);

    const { generateHls } = await import('./hls.js');

    await expect(generateHls(Buffer.alloc(100))).rejects.toThrow('Playlist file was not generated');
  });
});
