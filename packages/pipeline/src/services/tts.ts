import { TextToSpeechClient } from '@google-cloud/text-to-speech';

let client: TextToSpeechClient | null = null;

function getClient(): TextToSpeechClient {
  client ??= new TextToSpeechClient();
  return client;
}

export async function textToSpeech(text: string): Promise<Buffer> {
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
