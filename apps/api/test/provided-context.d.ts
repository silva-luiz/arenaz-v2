// Pull in the `ProvidedContext` augmentations (typed `inject("DATABASE_URL")`
// and `inject("S3_*")`) without executing the globalSetup modules.
import type {} from '@arenaz/db/test-setup';
import type {} from './minio-setup.js';
