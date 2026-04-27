import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getRequiredEnv, trimTrailingSlash } from "../lib/env.js";
import type { HlsFile } from "./hls.js";

let client: S3Client | null = null;

function getR2Client(): S3Client {
  client ??= new S3Client({
    region: "auto",
    endpoint: getRequiredEnv("R2_ENDPOINT"),
    credentials: {
      accessKeyId: getRequiredEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: getRequiredEnv("R2_SECRET_ACCESS_KEY"),
    },
    forcePathStyle: true,
  });

  return client;
}

export async function uploadHlsToR2(files: HlsFile[], episodeId: string): Promise<string> {
  const prefix = `episodes/${episodeId}`;
  const base = trimTrailingSlash(getRequiredEnv("R2_PUBLIC_BASE_URL"));

  await Promise.all(
    files.map(({ name, data, contentType }) =>
      getR2Client().send(
        new PutObjectCommand({
          Bucket: getRequiredEnv("R2_BUCKET_NAME"),
          Key: `${prefix}/${name}`,
          Body: data,
          ContentType: contentType,
        }),
      ),
    ),
  );

  return `${base}/${prefix}/playlist.m3u8`;
}
