import { describe, expect, it } from 'vitest';
import type { Transaction } from '@/types';
import { sortTransactions } from '@/lib/sort';

const makeTransaction = (overrides: Partial<Transaction>): Transaction => ({
  id: 'id',
  accountId: 'acc-1',
  categoryId: 'cat-1',
  type: 'expense',
  amount: 0,
  date: '2024-01-01',
  note: '',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

describe('sortTransactions', () => {
  it('trie par montant croissant sans muter le tableau original', () => {
    const original = [
      makeTransaction({ id: 'a', amount: 30 }),
      makeTransaction({ id: 'b', amount: 10 }),
      makeTransaction({ id: 'c', amount: 20 }),
    ];
    const originalCopy = [...original];

    const sorted = sortTransactions(original, 'amount', 'asc');

    expect(sorted.map((t) => t.id)).toEqual(['b', 'c', 'a']);
    expect(original).toEqual(originalCopy);
  });

  it('trie par date décroissante', () => {
    const transactions = [
      makeTransaction({ id: 'a', date: '2024-01-01' }),
      makeTransaction({ id: 'b', date: '2024-03-01' }),
      makeTransaction({ id: 'c', date: '2024-02-01' }),
    ];

    const sorted = sortTransactions(transactions, 'date', 'desc');

    expect(sorted.map((t) => t.id)).toEqual(['b', 'c', 'a']);
  });

  it('trie par categoryId et conserve la stabilité des égalités', () => {
    const transactions = [
      makeTransaction({ id: 'a', categoryId: 'cat-b' }),
      makeTransaction({ id: 'b', categoryId: 'cat-a' }),
      makeTransaction({ id: 'c', categoryId: 'cat-a' }),
    ];

    const sorted = sortTransactions(transactions, 'category', 'asc');

    expect(sorted.map((t) => t.id)).toEqual(['b', 'c', 'a']);
  });
});
