import { getRaw, setRaw } from '@/db/client';
import { DB_KEYS } from '@/constants/db-keys';
import type { Transaction } from '@/types';

/** Lit la collection complète des transactions ; tableau vide si rien n'a encore été persisté. */
export async function getAllTransactions(): Promise<Transaction[]> {
  return getRaw<Transaction[]>(DB_KEYS.transactions, []);
}

/**
 * Remplace la collection complète des transactions. Pas de mise à jour
 * partielle : conformément au design de persistance de l'app, c'est le store
 * Zustand qui détient l'état en mémoire et déclenche une sauvegarde
 * debouncée de tout le tableau (voir le contexte du store côté appelant).
 */
export async function saveAllTransactions(transactions: Transaction[]): Promise<void> {
  await setRaw(DB_KEYS.transactions, transactions);
}
