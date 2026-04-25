import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import ffmpeg from 'fluent-ffmpeg';
import { path as ffmpegPath } from '@ffmpeg-installer/ffmpeg';
import { randomUUID } from 'crypto';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { tmpdir } from 'os';

ffmpeg.setFfmpegPath(ffmpegPath);

let client: TextToSpeechClient | null = null;

function getClient(): TextToSpeechClient {
  client ??= new TextToSpeechClient();
  return client;
}

const MAX_BYTES = 4800;

function getByteLength(str: string): number {
  return Buffer.byteLength(str, 'utf8');
}

function splitTextIntoChunks(text: string, maxBytes: number): string[] {
  const chunks: string[] = [];
  const sentences = text.split(/(?<=[。！？])/);
  let currentChunk = '';

  for (const sentence of sentences) {
    const testChunk = currentChunk + sentence;
    if (getByteLength(testChunk) <= maxBytes) {
      currentChunk = testChunk;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      if (getByteLength(sentence) > maxBytes) {
        let chars = '';
        for (const char of sentence) {
          const testChar = chars + char;
          if (getByteLength(testChar) > maxBytes) {
            chunks.push(chars.trim());
            chars = char;
          } else {
            chars = testChar;
          }
        }
        currentChunk = chars;
      } else {
        currentChunk = sentence;
      }
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

async function synthesizeChunk(text: string): Promise<Buffer> {
  const languageCode = process.env.GOOGLE_TTS_LANGUAGE_CODE || 'cmn-TW';
  const name = process.env.GOOGLE_TTS_VOICE_NAME || 'cmn-TW-Wavenet-A';

  const [response] = await getClient().synthesizeSpeech({
    input: { text },
    voice: { languageCode, name },
    audioConfig: { audioEncoding: 'MP3' },
  });

  if (!response.audioContent) {
    throw new Error('Google TTS returned empty audio content');
  }

  return Buffer.from(response.audioContent as Uint8Array);
}

async function concatenateAudioChunks(chunks: Buffer[]): Promise<Buffer> {
  if (chunks.length === 1) {
    return chunks[0];
  }

  const tempDir = tmpdir();
  const inputFiles: string[] = [];
  const outputFile = `${tempDir}/tts_${randomUUID()}.mp3`;

  try {
    for (let i = 0; i < chunks.length; i++) {
      const inputFile = `${tempDir}/chunk_${randomUUID()}.mp3`;
      writeFileSync(inputFile, chunks[i]);
      inputFiles.push(inputFile);
    }

    await new Promise<void>((resolve, reject) => {
      let command = ffmpeg();
      inputFiles.forEach(file => command = command.input(file));
      const filterExpr = 'concat=n=' + inputFiles.length + ':v=0:a=1';
      command
        .complexFilter(filterExpr)
        .on('end', () => resolve())
        .on('error', (err: Error) => reject(err))
        .save(outputFile);
    });

    const { readFileSync } = await import('fs');
    const result = readFileSync(outputFile);
    return result;
  } finally {
    for (const file of inputFiles) {
      try { unlinkSync(file); } catch { /* ignore */ }
    }
    try { unlinkSync(outputFile); } catch { /* ignore */ }
  }
}

export async function textToSpeech(text: string): Promise<Buffer> {
  const chunks = splitTextIntoChunks(text, MAX_BYTES);

  if (chunks.length === 0) {
    throw new Error('No text to synthesize');
  }

  if (chunks.length === 1) {
    return synthesizeChunk(chunks[0]);
  }

  const audioBuffers = await Promise.all(chunks.map(chunk => synthesizeChunk(chunk)));
  return concatenateAudioChunks(audioBuffers);
}