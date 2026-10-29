import 'server-only';
import { unstable_rethrow } from 'next/navigation';
import { getSession } from '@/lib/session';

/**
 * The signed-in user for the site header, or `null`.
 *
 * Pages that work without a user (the public pages, sign-in) must not go down
 * with a failed lookup: fall back to the signed-out header and log it.
 */
export async function currentUser() {
  try {
    return await getSession();
  } catch (error) {
    // Next signals "this route is dynamic" by throwing; let that through.
    unstable_rethrow(error);
    console.error('Não foi possível ler a sessão no cabeçalho', error);
    return null;
  }
}
