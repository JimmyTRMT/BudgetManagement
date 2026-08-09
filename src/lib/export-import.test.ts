import { describe, expect, it } from 'vitest';
import { EXPORT_FORMAT_VERSION } from '@/constants/export-format';
import { buildExportPayload, parseImportedJson, serializeExport } from '@/lib/export-import';
import type { Account, AppSettings, Category, Transaction } from '@/types';

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

function createSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    accentColor: '#2563eb',
    ...overrides,
  };
}

describe('buildExportPayload', () => {
  it("assemble le payload avec formatVersion courant et l'exportedAt fourni, sans en générer un lui-même", () => {
    const accounts = [createAccount()];
    const transactions = [createTransaction()];
    const categories = [createCategory()];
    const settings = createSettings();

    const payload = buildExportPayload(
      accounts,
      transactions,
      categories,
      settings,
      '2026-08-09T12:00:00.000Z',
    );

    expect(payload).toEqual({
      formatVersion: EXPORT_FORMAT_VERSION,
      exportedAt: '2026-08-09T12:00:00.000Z',
      accounts,
      transactions,
      categories,
      settings,
    });
  });
});

describe('serializeExport', () => {
  it('produit un JSON indenté, ré-analysable en une donnée équivalente', () => {
    const payload = buildExportPayload(
      [createAccount()],
      [createTransaction()],
      [createCategory()],
      createSettings(),
      '2026-08-09T12:00:00.000Z',
    );

    const serialized = serializeExport(payload);

    expect(serialized).toContain('\n');
    expect(JSON.parse(serialized)).toEqual(payload);
  });
});

describe('parseImportedJson', () => {
  it('round-trip : un export sérialisé se reparse identique et valide', () => {
    const payload = buildExportPayload(
      [createAccount({ id: 'acc-42' })],
      [createTransaction({ id: 'txn-42', accountId: 'acc-42' })],
      [createCategory({ id: 'cat-42' })],
      createSettings({ accentColor: '#e11d48' }),
      '2026-08-09T12:00:00.000Z',
    );

    const result = parseImportedJson(serializeExport(payload));

    expect(result).toEqual({ ok: true, data: payload });
  });

  it("échoue proprement sur un texte qui n'est pas du JSON", () => {
    const result = parseImportedJson('ceci ne ressemble à rien {{{');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/JSON/i);
    }
  });

  it('échoue quand des champs requis sont absents', () => {
    const result = parseImportedJson(JSON.stringify({ accounts: [] }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/invalide/i);
    }
  });

  it('échoue quand accounts/transactions/categories ne sont pas de vrais tableaux', () => {
    const invalid = {
      formatVersion: EXPORT_FORMAT_VERSION,
      exportedAt: '2026-08-09T12:00:00.000Z',
      accounts: {},
      transactions: [],
      categories: [],
      settings: createSettings(),
    };

    const result = parseImportedJson(JSON.stringify(invalid));

    expect(result.ok).toBe(false);
  });

  it("échoue quand settings n'est pas un objet réel (ex. un tableau)", () => {
    const invalid = {
      formatVersion: EXPORT_FORMAT_VERSION,
      exportedAt: '2026-08-09T12:00:00.000Z',
      accounts: [],
      transactions: [],
      categories: [],
      settings: [],
    };

    const result = parseImportedJson(JSON.stringify(invalid));

    expect(result.ok).toBe(false);
  });

  it('échoue quand settings est null (typeof null === "object" ne doit pas suffire)', () => {
    const invalid = {
      formatVersion: EXPORT_FORMAT_VERSION,
      exportedAt: '2026-08-09T12:00:00.000Z',
      accounts: [],
      transactions: [],
      categories: [],
      settings: null,
    };

    const result = parseImportedJson(JSON.stringify(invalid));

    expect(result.ok).toBe(false);
  });

  it("échoue avec un message dédié quand formatVersion dépasse la version supportée", () => {
    const payload = buildExportPayload([], [], [], createSettings(), '2026-08-09T12:00:00.000Z');
    const fromTheFuture = { ...payload, formatVersion: EXPORT_FORMAT_VERSION + 1 };

    const result = parseImportedJson(JSON.stringify(fromTheFuture));

    expect(result).toEqual({
      ok: false,
      error: "Ce fichier a été exporté par une version plus récente de l'app.",
    });
  });

  it('accepte un formatVersion égal à la version supportée', () => {
    const payload = buildExportPayload([], [], [], createSettings(), '2026-08-09T12:00:00.000Z');

    const result = parseImportedJson(JSON.stringify(payload));

    expect(result).toEqual({ ok: true, data: payload });
  });
});
