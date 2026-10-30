// The public pages cache API responses in Next's data cache for 60 s, and that
// cache lives in `.next/cache`, which survives rebuilds. A rerun of the suite
// right after a previous one would then serve stale listings. Dropping it
// before the build keeps every run starting from a cold cache.
import { rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
rmSync(join(here, '..', '..', '.next', 'cache', 'fetch-cache'), {
  recursive: true,
  force: true,
});
