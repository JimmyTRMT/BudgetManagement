import type { Transaction } from '@/types';
import type { TransactionTypeFilter } from '@/constants/sort-filter';
import { isDateInRange } from '@/lib/date';

/**
 * Filtres combinables en ET logique par `filterTransactions`. Chaque champ
 * omis (ou `undefined`) est ignoré ; `type: 'all'` équivaut aussi à aucun
 * filtre de type.
 */
export interface TransactionFilters {
  accountId?: string;
  categoryId?: string;
  type?: TransactionTypeFilter;
  startDate?: string | null;
  endDate?: string | null;
  searchText?: string;
}

/**
 * Normalise une chaîne pour une recherche insensible à la casse et aux
 * accents (ex. "Café" et "cafe" doivent matcher).
 */
function normalizeForSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Filtre les transactions en combinant tous les critères fournis (ET
 * logique). Retourne un nouveau tableau, l'entrée n'est jamais mutée.
 */
export function filterTransactions(
  transactions: readonly Transaction[],
  filters: TransactionFilters,
): Transaction[] {
  const normalizedSearch = filters.searchText ? normalizeForSearch(filters.searchText) : null;

  return transactions.filter((transaction) => {
    if (filters.accountId && transaction.accountId !== filters.accountId) {
      return false;
    }
    if (filters.categoryId && transaction.categoryId !== filters.categoryId) {
      return false;
    }
    if (filters.type && filters.type !== 'all' && transaction.type !== filters.type) {
      return false;
    }
    if (!isDateInRange(transaction.date, filters.startDate ?? null, filters.endDate ?? null)) {
      return false;
    }
    if (normalizedSearch && !normalizeForSearch(transaction.note).includes(normalizedSearch)) {
      return false;
    }
    return true;
  });
}
