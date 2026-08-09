import { describe, expect, it } from 'vitest';
import { mergeImportedData } from '@/lib/merge';
import type { Account, Category, ExportedData, Transaction } from '@/types';

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

function createCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: 'cat-1',
    name: 'Courses',
    color: '#16a34a',
    icon: 'shopping-cart',
    kind: 'expense',
    createdAt: '2026-01-01T00:00:00.000Z',
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

function createExportedData(overrides: Partial<ExportedData> = {}): ExportedData {
  return {
    formatVersion: 1,
    exportedAt: '2026-01-01T00:00:00.000Z',
    accounts: [],
    transactions: [],
    categories: [],
    settings: { accentColor: '#2563eb' },
    ...overrides,
  };
}

const emptyReport = {
  accountsAdded: 0,
  accountsUpdated: 0,
  transactionsAdded: 0,
  transactionsUpdated: 0,
  categoriesAdded: 0,
  categoriesUpdated: 0,
  conflictsResolvedByNewest: 0,
};

describe('mergeImportedData', () => {
  it('ajoute les entités dont l’id est absent de current, sans conflit', () => {
    const current = createExportedData({
      accounts: [createAccount({ id: 'acc-1' })],
      categories: [createCategory({ id: 'cat-1' })],
      transactions: [createTransaction({ id: 'txn-1' })],
    });
    const incoming = createExportedData({
      accounts: [createAccount({ id: 'acc-1' }), createAccount({ id: 'acc-2', name: 'Livret' })],
      categories: [
        createCategory({ id: 'cat-1' }),
        createCategory({ id: 'cat-2', name: 'Loisirs' }),
      ],
      transactions: [
        createTransaction({ id: 'txn-1' }),
        createTransaction({ id: 'txn-2', amount: 42 }),
      ],
    });

    const result = mergeImportedData(current, incoming);

    expect(result.report).toEqual({
      ...emptyReport,
      accountsAdded: 1,
      categoriesAdded: 1,
      transactionsAdded: 1,
    });
    expect(result.data.accounts.map((a) => a.id)).toEqual(['acc-1', 'acc-2']);
    expect(result.data.categories.map((c) => c.id)).toEqual(['cat-1', 'cat-2']);
    expect(result.data.transactions.map((t) => t.id)).toEqual(['txn-1', 'txn-2']);
  });

  it('formatVersion vient de current, exportedAt est le plus récent des deux (ISO)', () => {
    const current = createExportedData({
      formatVersion: 3,
      exportedAt: '2026-03-01T00:00:00.000Z',
    });
    const olderIncoming = createExportedData({
      formatVersion: 99,
      exportedAt: '2026-01-01T00:00:00.000Z',
    });
    const newerIncoming = createExportedData({
      formatVersion: 99,
      exportedAt: '2026-06-01T00:00:00.000Z',
    });

    expect(mergeImportedData(current, olderIncoming).data.formatVersion).toBe(3);
    expect(mergeImportedData(current, olderIncoming).data.exportedAt).toBe(
      '2026-03-01T00:00:00.000Z',
    );
    expect(mergeImportedData(current, newerIncoming).data.exportedAt).toBe(
      '2026-06-01T00:00:00.000Z',
    );
  });

  it('conserve toujours les settings de current, jamais ceux de l’import', () => {
    const current = createExportedData({ settings: { accentColor: '#111111' } });
    const incoming = createExportedData({ settings: { accentColor: '#ffffff' } });

    const result = mergeImportedData(current, incoming);

    expect(result.data.settings).toEqual({ accentColor: '#111111' });
  });

  describe('conflits sur les transactions (updatedAt fait foi)', () => {
    it('la version entrante gagne quand elle est plus récente', () => {
      const current = createExportedData({
        transactions: [
          createTransaction({
            id: 'txn-1',
            amount: 10,
            updatedAt: '2026-01-01T00:00:00.000Z',
          }),
        ],
      });
      const incoming = createExportedData({
        transactions: [
          createTransaction({
            id: 'txn-1',
            amount: 999,
            updatedAt: '2026-02-01T00:00:00.000Z',
          }),
        ],
      });

      const result = mergeImportedData(current, incoming);

      expect(result.data.transactions).toEqual([
        expect.objectContaining({ id: 'txn-1', amount: 999 }),
      ]);
      expect(result.report).toEqual({
        ...emptyReport,
        transactionsUpdated: 1,
        conflictsResolvedByNewest: 1,
      });
    });

    it('la version locale plus récente est conservée, jamais écrasée', () => {
      const current = createExportedData({
        transactions: [
          createTransaction({
            id: 'txn-1',
            amount: 10,
            updatedAt: '2026-05-01T00:00:00.000Z',
          }),
        ],
      });
      const incoming = createExportedData({
        transactions: [
          createTransaction({
            id: 'txn-1',
            amount: 999,
            updatedAt: '2026-01-01T00:00:00.000Z',
          }),
        ],
      });

      const result = mergeImportedData(current, incoming);

      // Le local (plus récent) doit gagner : amount reste 10, jamais 999.
      expect(result.data.transactions).toEqual([
        expect.objectContaining({ id: 'txn-1', amount: 10 }),
      ]);
      expect(result.report).toEqual({
        ...emptyReport,
        transactionsUpdated: 0,
        conflictsResolvedByNewest: 1,
      });
    });
  });

  describe('conflits sur accounts/categories (pas de updatedAt dans le type)', () => {
    it('conserve current par défaut et compte le conflit si le contenu diffère', () => {
      const current = createExportedData({
        accounts: [createAccount({ id: 'acc-1', name: 'Compte courant' })],
      });
      const incoming = createExportedData({
        accounts: [createAccount({ id: 'acc-1', name: 'Nom importé' })],
      });

      const result = mergeImportedData(current, incoming);

      expect(result.data.accounts).toEqual([
        expect.objectContaining({ id: 'acc-1', name: 'Compte courant' }),
      ]);
      expect(result.report).toEqual({
        ...emptyReport,
        accountsUpdated: 0,
        conflictsResolvedByNewest: 1,
      });
    });

    it('ne compte pas de conflit si le contenu est strictement identique', () => {
      const current = createExportedData({
        categories: [createCategory({ id: 'cat-1' })],
      });
      const incoming = createExportedData({
        categories: [createCategory({ id: 'cat-1' })],
      });

      const result = mergeImportedData(current, incoming);

      expect(result.report).toEqual(emptyReport);
    });
  });

  it('import ne contenant aucune nouveauté : compteurs à 0, aucun conflit (contenu strictement identique)', () => {
    const current = createExportedData({
      accounts: [createAccount({ id: 'acc-1' })],
      categories: [createCategory({ id: 'cat-1' })],
      transactions: [createTransaction({ id: 'txn-1' })],
    });
    // Import strictement identique à current : aucun id nouveau des deux côtés.
    const incoming = createExportedData({
      accounts: [createAccount({ id: 'acc-1' })],
      categories: [createCategory({ id: 'cat-1' })],
      transactions: [createTransaction({ id: 'txn-1' })],
    });

    const result = mergeImportedData(current, incoming);

    // Réimporter un export identique (même byte-à-byte pour la transaction,
    // updatedAt inclus) ne doit remonter strictement aucun conflit : le
    // rapport doit refléter fidèlement qu'aucune divergence n'a eu lieu.
    expect(result.report).toEqual(emptyReport);
  });

  describe('ids dupliqués côté incoming (export malformé)', () => {
    it('résout chaque occurrence contre le vrai current d’origine, sans compter added/conflits en double', () => {
      const current = createExportedData({
        transactions: [
          createTransaction({
            id: 'txn-1',
            amount: 10,
            updatedAt: '2026-01-01T00:00:00.000Z',
          }),
        ],
      });
      const incoming = createExportedData({
        transactions: [
          // Deux occurrences du même id, toutes deux plus récentes que current :
          // sans protection, la deuxième serait résolue contre le winner de la
          // première (déjà mise à jour) plutôt que contre le vrai current.
          createTransaction({
            id: 'txn-1',
            amount: 500,
            updatedAt: '2026-02-01T00:00:00.000Z',
          }),
          createTransaction({
            id: 'txn-1',
            amount: 999,
            updatedAt: '2026-03-01T00:00:00.000Z',
          }),
        ],
      });

      const result = mergeImportedData(current, incoming);

      // Seule la dernière occurrence doit déterminer le contenu final...
      expect(result.data.transactions).toEqual([
        expect.objectContaining({ id: 'txn-1', amount: 999 }),
      ]);
      // ...et les compteurs ne doivent pas être doublés par la duplication.
      expect(result.report).toEqual({
        ...emptyReport,
        transactionsUpdated: 1,
        conflictsResolvedByNewest: 1,
      });
    });

    it('un id incoming dupliqué absent de current n’est compté qu’une seule fois comme ajout', () => {
      const current = createExportedData({ transactions: [] });
      const incoming = createExportedData({
        transactions: [
          createTransaction({ id: 'txn-new', amount: 10 }),
          createTransaction({ id: 'txn-new', amount: 20 }),
        ],
      });

      const result = mergeImportedData(current, incoming);

      expect(result.data.transactions).toEqual([
        expect.objectContaining({ id: 'txn-new', amount: 20 }),
      ]);
      expect(result.report).toEqual({
        ...emptyReport,
        transactionsAdded: 1,
      });
    });
  });
});
