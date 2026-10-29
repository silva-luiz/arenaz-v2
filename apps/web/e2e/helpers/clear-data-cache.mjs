// The public pages cache API responses in Next's data cache for 60 s, and that
// cache lives in `.next/cache`, which survives rebuilds. A rerun of the suite
// right after a previous one would then search a stale listing that lacks the
// venue it just seeded. Dropping it before the build keeps every run starting
// from a cold cache.
import { rmSync } from 'node:fs';
import { URL, fileURLToPath } from 'node:url';

rmSync(
  fileURLToPath(new URL('../../.next/cache/fetch-cache', import.meta.url)),
  {
    recursive: true,
    force: true,
  },
);
