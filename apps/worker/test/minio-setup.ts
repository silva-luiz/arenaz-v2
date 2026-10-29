import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CreateBucketCommand, S3Client } from '@aws-sdk/client-s3';
import {
  GenericContainer,
  Wait,
  type StartedTestContainer,
} from 'testcontainers';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  interface ProvidedContext {
    S3_ENDPOINT: string;
    S3_BUCKET: string;
    S3_ACCESS_KEY_ID: string;
    S3_SECRET_ACCESS_KEY: string;
  }
}

const COMPOSE_FILE = fileURLToPath(
  new URL('../../../infra/docker-compose.yml', import.meta.url),
);

/** Same pinned image as local dev (and the API tests): see the compose file. */
function minioImage(): string {
  const match = /^\s*image:\s*(alpine\/minio:\S+)\s*$/m.exec(
    readFileSync(COMPOSE_FILE, 'utf8'),
  );
  if (!match?.[1]) {
    throw new Error(`Imagem do MinIO não encontrada em ${COMPOSE_FILE}`);
  }
  return match[1];
}

const BUCKET = 'arenaz-photos';
const ACCESS_KEY = 'minioadmin';
const SECRET_KEY = 'minioadmin';

let container: StartedTestContainer | undefined;

/** Vitest globalSetup: throwaway MinIO with the photo bucket. */
export default async function setup(project: TestProject): Promise<void> {
  try {
    container = await new GenericContainer(minioImage())
      .withEnvironment({
        MINIO_ROOT_USER: ACCESS_KEY,
        MINIO_ROOT_PASSWORD: SECRET_KEY,
      })
      // /tmp is writable by the image's unprivileged user (/data is not).
      .withCommand(['server', '/tmp/data'])
      .withExposedPorts(9000)
      .withWaitStrategy(
        Wait.forHttp('/minio/health/live', 9000).forStatusCode(200),
      )
      .start();
    const endpoint = `http://${container.getHost()}:${String(container.getMappedPort(9000))}`;

    const client = new S3Client({
      endpoint,
      region: 'us-east-1',
      forcePathStyle: true,
      credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
    });
    try {
      await client.send(new CreateBucketCommand({ Bucket: BUCKET }));
    } finally {
      client.destroy();
    }

    project.provide('S3_ENDPOINT', endpoint);
    project.provide('S3_BUCKET', BUCKET);
    project.provide('S3_ACCESS_KEY_ID', ACCESS_KEY);
    project.provide('S3_SECRET_ACCESS_KEY', SECRET_KEY);
  } catch (error) {
    // Vitest 5 hides the cause of globalSetup errors; print it first.
    const reason = error instanceof Error ? error.message : String(error);
    process.stderr.write(
      `Falha no globalSetup do MinIO de testes: ${reason}\n`,
    );
    await teardown();
    throw error;
  }
}

export async function teardown(): Promise<void> {
  await container?.stop();
  container = undefined;
}
