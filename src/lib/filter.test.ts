import { describe, expect, it } from 'vitest';
import type { Transaction } from '@/types';
import { filterTransactions } from '@/lib/filter';

const makeTransaction = (overrides: Partial<Transaction>): Transaction => ({
  id: 'id',
  accountId: 'acc-1',
  categoryId: 'cat-1',
  type: 'expense',
  amount: 10,
  date: '2024-01-15',
  note: '',
  createdAt: '2024-01-15T00:00:00.000Z',
  updatedAt: '2024-01-15T00:00:00.000Z',
  ...overrides,
});

describe('filterTransactions', () => {
  it('combine accountId et type en ET logique', () => {
    const transactions = [
      makeTransaction({ id: 'a', accountId: 'acc-1', type: 'income' }),
      makeTransaction({ id: 'b', accountId: 'acc-1', type: 'expense' }),
      makeTransaction({ id: 'c', accountId: 'acc-2', type: 'income' }),
    ];

    const result = filterTransactions(transactions, { accountId: 'acc-1', type: 'income' });

    expect(result.map((t) => t.id)).toEqual(['a']);
  });

  it('filtre sur une plage de dates inclusive', () => {
    const transactions = [
      makeTransaction({ id: 'a', date: '2024-01-01' }),
      makeTransaction({ id: 'b', date: '2024-01-15' }),
      makeTransaction({ id: 'c', date: '2024-02-01' }),
    ];

    const result = filterTransactions(transactions, {
      startDate: '2024-01-10',
      endDate: '2024-01-31',
    });

    expect(result.map((t) => t.id)).toEqual(['b']);
  });

  it('recherche sur note en ignorant casse et accents', () => {
    const transactions = [
      makeTransaction({ id: 'a', note: 'Café avec Élodie' }),
      makeTransaction({ id: 'b', note: 'Courses' }),
    ];

    const result = filterTransactions(transactions, { searchText: 'cafe' });

    expect(result.map((t) => t.id)).toEqual(['a']);
  });
});
