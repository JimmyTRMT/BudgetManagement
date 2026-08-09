export type TransactionType = 'income' | 'expense';

/**
 * Une transaction. `amount` est toujours positif ; le signe réel (crédit ou
 * débit) est dérivé de `type` par les fonctions de src/lib/balance.ts, pour
 * éviter toute ambiguïté sur des montants négatifs stockés en base.
 */
export interface Transaction {
  id: string;
  accountId: string;
  categoryId: string;
  type: TransactionType;
  amount: number;
  /** Date ISO (YYYY-MM-DD), sans heure : la transaction est datée au jour. */
  date: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}
