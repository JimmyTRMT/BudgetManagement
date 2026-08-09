import { beforeEach, describe, expect, it, vi } from 'vitest';
import { del, get, set, setMany } from 'idb-keyval';
import { DB_KEYS, DB_SCHEMA_VERSION } from '@/constants/db-keys';
import {
  getRaw,
  initializeDatabase,
  isStorageAvailable,
  runMigrationsUpTo,
  setRaw,
  type MetaRecord,
  type RawStoreShape,
  type RawStoresData,
} from '@/db/client';

/**
 * jsdom n'implémente pas IndexedDB nativement et le projet n'a pas de
 * dépendance 'fake-indexeddb' : on mocke idb-keyval par un store en mémoire,
 * suffisant pour tester la logique de client.ts en isolation. `setMany` est
 * mocké au même titre que `get`/`set`/`del` car les migrations qui écrivent
 * réellement des données passent par lui (voir `writeMigrationStep` dans
 * client.ts).
 *
 * `createStoreMocks` factorise cette logique pour qu'elle soit appelable à
 * la fois depuis la factory `vi.mock` (une fois, pour le mock initial) et
 * depuis `beforeEach` (à chaque test, pour repartir d'un store vierge) :
 * c'est une function declaration plutôt qu'une const/arrow function pour
 * être hissée nativement par JS avec son corps complet, et donc utilisable
 * sans piège d'ordre depuis `vi.hoisted` ci-dessous.
 */
interface StoreMocks {
  store: Map<string, unknown>;
  get: (key: IDBValidKey) => Promise<unknown>;
  set: (key: IDBValidKey, value: unknown) => Promise<void>;
  del: (key: IDBValidKey) => Promise<void>;
  setMany: (entries: Array<[IDBValidKey, unknown]>) => Promise<void>;
}

function createStoreMocks(): StoreMocks {
  const store = new Map<string, unknown>();
  return {
    store,
    get: (key: IDBValidKey): Promise<unknown> => Promise.resolve(store.get(String(key))),
    set: (key: IDBValidKey, value: unknown): Promise<void> => {
      store.set(String(key), value);
      return Promise.resolve();
    },
    del: (key: IDBValidKey): Promise<void> => {
      store.delete(String(key));
      return Promise.resolve();
    },
    setMany: (entries: Array<[IDBValidKey, unknown]>): Promise<void> => {
      for (const [key, value] of entries) {
        store.set(String(key), value);
      }
      return Promise.resolve();
    },
  };
}

/**
 * Conteneur muté (jamais réassigné lui-même) sur lequel se referme la
 * factory `vi.mock` ci-dessous. `vi.mock` est hissé par Vitest tout en haut
 * du fichier, avant même les imports : toute variable qu'il referme dessus
 * doit donc déjà exister à cet instant, d'où `vi.hoisted` plutôt qu'un
 * simple `const`/`let` au niveau module (qui lèverait une erreur de TDZ à
 * l'exécution). `beforeEach` réassigne `mocks.current` — jamais `mocks`
 * lui-même — pour repartir d'un store vierge à chaque test, tout en gardant
 * les mêmes instances `vi.fn()` (voir plus bas pourquoi c'est important).
 */
const mocks = vi.hoisted(() => {
  return { current: createStoreMocks() };
});

vi.mock('idb-keyval', () => ({
  get: vi.fn((key: IDBValidKey) => mocks.current.get(key)),
  set: vi.fn((key: IDBValidKey, value: unknown) => mocks.current.set(key, value)),
  del: vi.fn((key: IDBValidKey) => mocks.current.del(key)),
  setMany: vi.fn((entries: Array<[IDBValidKey, unknown]>) => mocks.current.setMany(entries)),
}));

beforeEach(() => {
  mocks.current = createStoreMocks(); // nouveau store vierge par test

  // mockReset() (et non mockClear()) : efface aussi les mockImplementation
  // posées par un test précédent, pas seulement l'historique d'appels — sans
  // ça, un mockImplementation() (non "Once") laissé par un test empoisonne
  // silencieusement tous les tests suivants du fichier. Mais mockReset()
  // efface AUSSI l'implémentation de base posée par la factory `vi.mock`
  // ci-dessus : on la réinjecte donc explicitement ici à chaque test, en la
  // faisant pointer vers le `mocks.current` fraîchement recréé au-dessus.
  vi.mocked(get)
    .mockReset()
    .mockImplementation((key) => mocks.current.get(key));
  vi.mocked(set)
    .mockReset()
    .mockImplementation((key, value) => mocks.current.set(key, value));
  vi.mocked(del)
    .mockReset()
    .mockImplementation((key) => mocks.current.del(key));
  vi.mocked(setMany)
    .mockReset()
    .mockImplementation((entries) => mocks.current.setMany(entries));
});

describe('isStorageAvailable', () => {
  it('retourne true quand le round-trip set/get/del réussit', async () => {
    await expect(isStorageAvailable()).resolves.toBe(true);
  });

  it('retourne false, sans lever, quand idb-keyval échoue (ex. Safari navigation privée)', async () => {
    vi.mocked(set).mockImplementationOnce(() => {
      throw new Error('IndexedDB indisponible');
    });

    await expect(isStorageAvailable()).resolves.toBe(false);
  });
});

describe('initializeDatabase', () => {
  it('sur une base fraîche (aucun meta), initialise schemaVersion sans erreur', async () => {
    await expect(initializeDatabase()).resolves.toEqual({
      available: true,
      migrationError: false,
    });

    const meta = await getRaw<MetaRecord | undefined>(DB_KEYS.meta, undefined);
    expect(meta).toEqual({ schemaVersion: DB_SCHEMA_VERSION });
  });

  it("retourne available: false sans toucher aux migrations si le stockage n'est pas disponible", async () => {
    vi.mocked(set).mockImplementationOnce(() => {
      throw new Error('IndexedDB indisponible');
    });

    await expect(initializeDatabase()).resolves.toEqual({
      available: false,
      migrationError: false,
    });

    const meta = await getRaw<MetaRecord | undefined>(DB_KEYS.meta, undefined);
    expect(meta).toBeUndefined();
  });

  it("ne laisse jamais s'échapper une exception survenue après la sonde de disponibilité (ex. quota dépassé pendant l'écriture du meta)", async () => {
    // Le 1er appel à `set` est la sonde d'isStorageAvailable (doit réussir,
    // d'où le passthrough vers le store en mémoire) ; tous les appels
    // suivants (l'écriture réelle du meta par runMigrationsUpTo) échouent.
    vi.mocked(set)
      .mockImplementationOnce((key, value) => mocks.current.set(key, value))
      .mockImplementation(() => {
        throw new Error('Quota IndexedDB dépassé');
      });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(initializeDatabase()).resolves.toEqual({
      available: true,
      migrationError: true,
    });
    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
  });
});

describe('runMigrationsUpTo — détection installation neuve vs utilisateur legacy sans meta', () => {
  it('base réellement vide et sans meta : grave directement la version cible, sans appeler de migration', async () => {
    const migrate = vi.fn((data: RawStoresData): RawStoresData => data);

    await runMigrationsUpTo(2, { 1: migrate });

    expect(migrate).not.toHaveBeenCalled();
    await expect(getRaw<MetaRecord | undefined>(DB_KEYS.meta, undefined)).resolves.toEqual({
      schemaVersion: 2,
    });
  });

  it('utilisateur legacy sans meta MAIS avec des données existantes : applique la migration au lieu de la sauter', async () => {
    // Simule des données écrites par une version de l'app antérieure au
    // système de meta : les 4 stores contiennent déjà des données, mais
    // aucune clé "meta" n'a jamais été écrite.
    mocks.current.store.set(DB_KEYS.accounts, [{ id: 'a1', name: 'Compte historique' }]);

    const migrate = vi.fn(
      (data: RawStoresData): RawStoresData => ({
        ...data,
        accounts: data.accounts.map((account) => ({ ...account, migrated: true })),
      }),
    );

    await runMigrationsUpTo(2, { 1: migrate });

    expect(migrate).toHaveBeenCalledTimes(1);
    const accounts = await getRaw<RawStoreShape[]>(DB_KEYS.accounts, []);
    expect(accounts).toEqual([{ id: 'a1', name: 'Compte historique', migrated: true }]);
    await expect(getRaw<MetaRecord | undefined>(DB_KEYS.meta, undefined)).resolves.toEqual({
      schemaVersion: 2,
    });
  });

  it('meta présent mais corrompu (schemaVersion non numérique) : repart prudemment de la version historique plutôt que de lui faire confiance', async () => {
    mocks.current.store.set(DB_KEYS.accounts, [{ id: 'a1' }]);
    mocks.current.store.set(DB_KEYS.meta, { schemaVersion: 'oops' });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const migrate = vi.fn((data: RawStoresData): RawStoresData => data);

    await runMigrationsUpTo(2, { 1: migrate });

    expect(warnSpy).toHaveBeenCalled();
    expect(migrate).toHaveBeenCalledTimes(1);
    await expect(getRaw<MetaRecord | undefined>(DB_KEYS.meta, undefined)).resolves.toEqual({
      schemaVersion: 2,
    });

    warnSpy.mockRestore();
  });

  it('journalise un avertissement et avance quand même quand une migration manque dans la registry', async () => {
    await setRaw<MetaRecord>(DB_KEYS.meta, { schemaVersion: 1 });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Cible la version 3 en ne fournissant que la migration 1 -> 2 : la
    // migration 2 -> 3 est manquante.
    await runMigrationsUpTo(3, { 1: (data) => data });

    expect(warnSpy).toHaveBeenCalled();
    await expect(getRaw<MetaRecord | undefined>(DB_KEYS.meta, undefined)).resolves.toEqual({
      schemaVersion: 3,
    });

    warnSpy.mockRestore();
  });

  it('utilisateur déjà à jour (meta valide == version cible) : ne relance aucune migration', async () => {
    await setRaw<MetaRecord>(DB_KEYS.meta, { schemaVersion: 2 });
    const migrate = vi.fn((data: RawStoresData): RawStoresData => data);

    await runMigrationsUpTo(2, { 1: migrate });

    expect(migrate).not.toHaveBeenCalled();
  });

  it(
    'utilisateur legacy sans meta, avec des données existantes, et targetVersion déjà égal à ' +
      "LEGACY_SCHEMA_VERSION (le cas réel avec DB_SCHEMA_VERSION = 1 aujourd'hui) : persiste " +
      'quand même meta au lieu de le laisser absent indéfiniment (0 itération de boucle)',
    async () => {
      mocks.current.store.set(DB_KEYS.accounts, [{ id: 'a1', name: 'Compte historique' }]);

      // Reproduit l'appel réel d'initializeDatabase() : targetVersion = 1 et
      // aucune migration définie, comme DB_SCHEMA_VERSION/MIGRATIONS en
      // production aujourd'hui.
      await runMigrationsUpTo(1, {});

      await expect(getRaw<MetaRecord | undefined>(DB_KEYS.meta, undefined)).resolves.toEqual({
        schemaVersion: 1,
      });
    },
  );

  it(
    'meta corrompu et targetVersion déjà égal à LEGACY_SCHEMA_VERSION : répare quand même meta ' +
      'au lieu de le laisser corrompu indéfiniment (0 itération de boucle)',
    async () => {
      mocks.current.store.set(DB_KEYS.accounts, [{ id: 'a1' }]);
      mocks.current.store.set(DB_KEYS.meta, { schemaVersion: 'oops' });
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await runMigrationsUpTo(1, {});

      expect(warnSpy).toHaveBeenCalled();
      await expect(getRaw<MetaRecord | undefined>(DB_KEYS.meta, undefined)).resolves.toEqual({
        schemaVersion: 1,
      });

      warnSpy.mockRestore();
    },
  );
});
