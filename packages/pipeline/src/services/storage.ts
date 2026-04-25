import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getRequiredEnv, trimTrailingSlash } from '../lib/env.js';

let client: S3Client | null = null;

function getR2Client(): S3Client {
  client ??= new S3Client({
    region: 'auto',
    endpoint: getRequiredEnv('R2_ENDPOINT'),
    credentials: {
      accessKeyId: getRequiredEnv('R2_ACCESS_KEY_ID'),
      secretAccessKey: getRequiredEnv('R2_SECRET_ACCESS_KEY'),
    },
  });

  return client;
}

export async function uploadToR2(audio: Buffer, key: string): Promise<string> {
  await getR2Client().send(
    new PutObjectCommand({
      Bucket: getRequiredEnv('R2_BUCKET_NAME'),
      Key: key,
      Body: audio,
      ContentType: 'audio/mpeg',
    })
  );

  return `${trimTrailingSlash(getRequiredEnv('R2_PUBLIC_BASE_URL'))}/${key}`;
}
