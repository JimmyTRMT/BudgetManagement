export const TRANSACTION_SORT_FIELDS = ['date', 'amount', 'category'] as const;
export type TransactionSortField = (typeof TRANSACTION_SORT_FIELDS)[number];

export const SORT_DIRECTIONS = ['asc', 'desc'] as const;
export type SortDirection = (typeof SORT_DIRECTIONS)[number];

export const TRANSACTION_TYPE_FILTERS = ['all', 'income', 'expense'] as const;
export type TransactionTypeFilter = (typeof TRANSACTION_TYPE_FILTERS)[number];
