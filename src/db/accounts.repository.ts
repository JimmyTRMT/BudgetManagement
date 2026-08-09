import { getRaw, setRaw } from '@/db/client';
import { DB_KEYS } from '@/constants/db-keys';
import type { Account } from '@/types';

/** Lit la collection complète des comptes ; tableau vide si rien n'a encore été persisté. */
export async function getAllAccounts(): Promise<Account[]> {
  return getRaw<Account[]>(DB_KEYS.accounts, []);
}

/**
 * Remplace la collection complète des comptes. Pas de mise à jour partielle :
 * conformément au design de persistance de l'app, c'est le store Zustand qui
 * détient l'état en mémoire et déclenche une sauvegarde debouncée de tout le
 * tableau (voir le contexte du store côté appelant).
 */
export async function saveAllAccounts(accounts: Account[]): Promise<void> {
  await setRaw(DB_KEYS.accounts, accounts);
}
