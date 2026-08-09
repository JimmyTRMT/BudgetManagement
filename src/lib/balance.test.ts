import { describe, expect, it } from 'vitest';
import { computeAccountBalance, computeBalanceHistory, computeTotalBalance } from '@/lib/balance';
import type { Account, Transaction } from '@/types';

function createAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: 'acc-1',
    name: 'Compte courant',
    type: 'checking',
    initialBalance: 100,
    color: '#2563eb',
    icon: 'wallet',
    createdAt: '2026-01-01T00:00:00.000Z',
    archivedAt: null,
    ...overrides,
  };
}

function createTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'txn-1',
    accountId: 'acc-1',
    categoryId: 'cat-1',
    type: 'expense',
    amount: 10,
    date: '2026-01-01',
    note: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('computeAccountBalance', () => {
  it('renvoie le solde initial quand le compte est sans transaction', () => {
    const account = createAccount({ initialBalance: 250 });

    expect(computeAccountBalance(account, [])).toBe(250);
  });

  it('ajoute les income et soustrait les expense du compte', () => {
    const account = createAccount({ id: 'acc-1', initialBalance: 100 });
    const transactions: Transaction[] = [
      createTransaction({ id: 'txn-1', accountId: 'acc-1', type: 'income', amount: 50 }),
      createTransaction({ id: 'txn-2', accountId: 'acc-1', type: 'expense', amount: 30 }),
      createTransaction({ id: 'txn-3', accountId: 'acc-1', type: 'income', amount: 20 }),
    ];

    // 100 + 50 - 30 + 20 = 140
    expect(computeAccountBalance(account, transactions)).toBe(140);
  });

  it('ignore les transactions appartenant à un autre compte', () => {
    const account = createAccount({ id: 'acc-1', initialBalance: 100 });
    const transactions: Transaction[] = [
      createTransaction({ id: 'txn-1', accountId: 'acc-1', type: 'income', amount: 50 }),
      createTransaction({ id: 'txn-2', accountId: 'acc-2', type: 'income', amount: 1000 }),
    ];

    expect(computeAccountBalance(account, transactions)).toBe(150);
  });
});

describe('computeTotalBalance', () => {
  it('somme le solde de tous les comptes', () => {
    const accounts: Account[] = [
      createAccount({ id: 'acc-1', initialBalance: 100 }),
      createAccount({ id: 'acc-2', initialBalance: 500 }),
      createAccount({ id: 'acc-3', initialBalance: 0 }),
    ];
    const transactions: Transaction[] = [
      createTransaction({ id: 'txn-1', accountId: 'acc-1', type: 'expense', amount: 40 }),
      createTransaction({ id: 'txn-2', accountId: 'acc-2', type: 'income', amount: 60 }),
      createTransaction({ id: 'txn-3', accountId: 'acc-3', type: 'income', amount: 25 }),
    ];

    // (100 - 40) + (500 + 60) + (0 + 25) = 60 + 560 + 25 = 645
    expect(computeTotalBalance(accounts, transactions)).toBe(645);
  });

  it('renvoie 0 sans aucun compte', () => {
    expect(computeTotalBalance([], [])).toBe(0);
  });
});

describe('computeBalanceHistory', () => {
  it('reflète le solde à chaque jour, avant/après une transaction connue', () => {
    const accounts: Account[] = [createAccount({ id: 'acc-1', initialBalance: 100 })];
    const transactions: Transaction[] = [
      createTransaction({
        id: 'txn-1',
        accountId: 'acc-1',
        type: 'expense',
        amount: 30,
        date: '2026-01-03',
      }),
    ];

    const history = computeBalanceHistory(accounts, transactions, 5, '2026-01-05');

    expect(history).toEqual([
      { date: '2026-01-01', balance: 100 },
      { date: '2026-01-02', balance: 100 },
      { date: '2026-01-03', balance: 70 },
      { date: '2026-01-04', balance: 70 },
      { date: '2026-01-05', balance: 70 },
    ]);
  });

  it('trie du plus ancien au plus récent et cumule plusieurs transactions/comptes', () => {
    const accounts: Account[] = [
      createAccount({ id: 'acc-1', initialBalance: 100 }),
      createAccount({ id: 'acc-2', initialBalance: 200 }),
    ];
    const transactions: Transaction[] = [
      createTransaction({
        id: 'txn-1',
        accountId: 'acc-1',
        type: 'income',
        amount: 50,
        date: '2026-01-02',
      }),
      createTransaction({
        id: 'txn-2',
        accountId: 'acc-2',
        type: 'expense',
        amount: 20,
        date: '2026-01-03',
      }),
    ];

    const history = computeBalanceHistory(accounts, transactions, 3, '2026-01-03');

    expect(history.map((point) => point.date)).toEqual([
      '2026-01-01',
      '2026-01-02',
      '2026-01-03',
    ]);
    expect(history).toEqual([
      { date: '2026-01-01', balance: 300 },
      { date: '2026-01-02', balance: 350 },
      { date: '2026-01-03', balance: 330 },
    ]);
  });

  it('renvoie un tableau vide quand days est 0', () => {
    const accounts: Account[] = [createAccount()];

    expect(computeBalanceHistory(accounts, [], 0, '2026-01-05')).toEqual([]);
  });
});
