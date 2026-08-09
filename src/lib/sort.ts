import type { Transaction } from '@/types';
import type { SortDirection, TransactionSortField } from '@/constants/sort-filter';

function compareByField(a: Transaction, b: Transaction, field: TransactionSortField): number {
  switch (field) {
    case 'date':
      return a.date.localeCompare(b.date);
    case 'amount':
      return a.amount - b.amount;
    case 'category':
      return a.categoryId.localeCompare(b.categoryId);
    default:
      return 0;
  }
}

/**
 * Trie les transactions selon `field`/`direction` en retournant un nouveau
 * tableau : l'entrée (souvent le state d'un store) n'est jamais mutée. Le tri
 * repose sur Array.prototype.sort, stable depuis ES2019, donc les égalités
 * conservent leur ordre d'origine.
 */
export function sortTransactions(
  transactions: readonly Transaction[],
  field: TransactionSortField,
  direction: SortDirection,
): Transaction[] {
  const factor = direction === 'asc' ? 1 : -1;
  return [...transactions].sort((a, b) => compareByField(a, b, field) * factor);
}
