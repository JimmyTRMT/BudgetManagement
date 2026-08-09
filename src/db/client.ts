import { del, get, set, setMany } from 'idb-keyval';
import { DB_KEYS, DB_SCHEMA_VERSION } from '@/constants/db-keys';

const STORAGE_PROBE_KEY = '__storage_probe__';

/**
 * Vérifie qu'IndexedDB est réellement utilisable dans l'environnement courant.
 * Certains navigateurs (Safari en navigation privée notamment) exposent l'API
 * IndexedDB tout en la faisant échouer à l'exécution : on ne fait donc
 * confiance qu'à un aller-retour set/get/del réel sur une clé de test, et on
 * avale systématiquement toute exception pour ne jamais faire planter
 * l'appelant (ex. l'écran de démarrage de l'app).
 */
export async function isStorageAvailable(): Promise<boolean> {
  try {
    await set(STORAGE_PROBE_KEY, true);
    const value = await get<boolean>(STORAGE_PROBE_KEY);
    await del(STORAGE_PROBE_KEY);
    return value === true;
  } catch {
    return false;
  }
}

/**
 * Fine enveloppe typée autour de `get` d'idb-keyval, avec une valeur de
 * repli explicite. Fait confiance au paramètre de type `T` fourni par
 * l'appelant sans aucune vérification runtime (idb-keyval stocke et relit
 * un `any` sous le capot) : c'est un choix délibéré pour l'usage courant —
 * une donnée que l'app a elle-même écrite avec ce type via `setRaw`. Pour
 * toute lecture dont la provenance ou la forme n'est pas garantie (donnée
 * "brute" potentiellement écrite par une version antérieure du schéma, ou
 * corrompue), appeler avec `T = unknown` et valider explicitement le
 * résultat plutôt que de faire confiance au générique — voir
 * `readAllRawData` et `isValidMetaRecord` plus bas, qui appliquent ce
 * principe aux données traversées par les migrations.
 */
export async function getRaw<T>(key: string, fallback: T): Promise<T> {
  const value = await get<T>(key);
  return value === undefined ? fallback : value;
}

/** Fine enveloppe typée autour de `set` d'idb-keyval. */
export async function setRaw<T>(key: string, value: T): Promise<void> {
  await set(key, value);
}

/** Enregistrement stocké sous DB_KEYS.meta, qui trace la version de schéma appliquée aux données. */
export interface MetaRecord {
  schemaVersion: number;
}

/**
 * Forme "brute" d'un enregistrement individuel lu depuis IndexedDB, avant
 * toute migration. Elle peut ne pas correspondre aux interfaces TS actuelles
 * (Account, Transaction, ...) puisqu'elle peut avoir été écrite par une
 * version antérieure du schéma.
 */
export type RawStoreShape = Record<string, unknown>;

/**
 * Forme agrégée normalisée des 4 stores de données, telle que produite par
 * `readAllRawData` et consommée par les fonctions de MIGRATIONS. Contrairement
 * à `RawStoreShape` (qui reste volontairement un `Record<string, unknown>`
 * puisque la forme interne d'un enregistrement dépend de la version), le
 * niveau racine de cette forme agrégée a un contrat fixe et vérifié à
 * l'exécution (voir `readAllRawData`) : une fonction de migration peut donc
 * lire `data.transactions` comme un vrai `RawStoreShape[]` sans avoir besoin
 * d'un cast `as`.
 */
export interface RawStoresData {
  accounts: RawStoreShape[];
  transactions: RawStoreShape[];
  categories: RawStoreShape[];
  settings: RawStoreShape;
}

/**
 * Registry des migrations, indexée par la version de schéma *de départ* :
 * MIGRATIONS[n] fait passer les données de la version n à la version n + 1.
 * Vide tant qu'aucune migration n'est nécessaire (DB_SCHEMA_VERSION = 1).
 *
 * Exemple concret dans 6 mois, pour ajouter un champ à Transaction :
 * 1. Incrémenter DB_SCHEMA_VERSION dans src/constants/db-keys.ts (1 -> 2).
 * 2. Déclarer la migration correspondante ici :
 *
 *    MIGRATIONS[1] = (data) => ({
 *      ...data,
 *      transactions: data.transactions.map((t) => ({
 *        ...t,
 *        nouveauChamp: valeurParDefaut,
 *      })),
 *    });
 *
 *    `data.transactions` est déjà typé `RawStoreShape[]` grâce à
 *    `RawStoresData` : aucun cast `as` n'est nécessaire ni à ajouter.
 *
 * `runMigrationsUpTo` appliquera automatiquement cette fonction, au prochain
 * démarrage, à tout utilisateur dont le `meta.schemaVersion` stocké est
 * encore 1 — mais AUSSI à tout utilisateur "legacy" qui n'a jamais écrit de
 * clé `meta` du tout alors qu'il a déjà des données (utilisateur venu d'une
 * version de l'app antérieure à l'introduction de ce système) : ce cas est
 * détecté via `hasAnyExistingData` et traité comme s'il était à
 * LEGACY_SCHEMA_VERSION (1), précisément pour qu'il ne soit jamais confondu
 * avec une installation neuve et ne saute jamais cette migration. Aucune
 * perte de données pour les autres clés (accounts, categories, settings) qui
 * transitent inchangées par le spread `...data`.
 */
const MIGRATIONS: Record<number, (data: RawStoresData) => RawStoresData> = {};

/**
 * Version de schéma implicite des données écrites par des versions de l'app
 * antérieures à l'introduction de ce système de migration : ces
 * installations n'ont jamais écrit de clé `meta`, alors que leurs 4 stores
 * peuvent déjà contenir des données réelles. Contrairement à
 * DB_SCHEMA_VERSION (qui progresse à chaque migration), cette constante est
 * figée pour toujours : elle documente simplement "la forme des données
 * avant que ce suivi de version n'existe", qui coïncide avec la version 1
 * puisqu'aucun changement de forme n'a eu lieu avant l'introduction du
 * système lui-même.
 */
const LEGACY_SCHEMA_VERSION = 1;

/** Garde de type : un objet simple (ni `null`, ni tableau). */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Garde de type pour un enregistrement `meta` lu depuis IndexedDB : ne fait
 * jamais confiance au type générique de `getRaw` seul (voir sa JSDoc). Un
 * `schemaVersion` manquant, non numérique ou non fini (NaN/Infinity) est
 * rejeté plutôt que silencieusement accepté dans la comparaison numérique de
 * `runMigrationsUpTo`.
 */
function isValidMetaRecord(value: unknown): value is MetaRecord {
  return (
    isPlainObject(value) &&
    typeof value.schemaVersion === 'number' &&
    Number.isFinite(value.schemaVersion)
  );
}

/**
 * Garde de type : un tableau (les éléments ne sont pas inspectés
 * individuellement, voir `normalizeRawArray`).
 */
function isRawStoreArray(value: unknown): value is RawStoreShape[] {
  return Array.isArray(value);
}

/**
 * Valide qu'une valeur lue depuis IndexedDB est bien un tableau exploitable
 * par les migrations ; toute autre forme (donnée corrompue, écriture
 * partielle antérieure, format inattendu) est journalisée et ignorée plutôt
 * que propagée telle quelle dans la chaîne de migration.
 */
function normalizeRawArray(value: unknown, key: string): RawStoreShape[] {
  if (!isRawStoreArray(value)) {
    console.warn(
      `[db] Valeur inattendue pour la clé "${key}" (tableau attendu) : donnée ignorée.`,
      value,
    );
    return [];
  }
  return value;
}

/**
 * Équivalent de `normalizeRawArray` pour un store en forme d'objet
 * (`settings`) : rejette toute valeur qui n'est pas un objet simple plutôt
 * que de la faire transiter telle quelle.
 */
function normalizeRawRecord(value: unknown, key: string): RawStoreShape {
  if (!isPlainObject(value)) {
    console.warn(
      `[db] Valeur inattendue pour la clé "${key}" (objet attendu) : donnée ignorée.`,
      value,
    );
    return {};
  }
  return value;
}

/**
 * Lit l'état actuel des 4 stores de données sous la forme agrégée attendue
 * par les fonctions de MIGRATIONS (voir la registry ci-dessus). Chaque store
 * est lu en `unknown` puis explicitement validé (`normalizeRawArray` /
 * `normalizeRawRecord`) plutôt que d'être casté implicitement via le
 * générique de `getRaw` : une valeur corrompue ou d'une forme inattendue est
 * journalisée et remplacée par une valeur vide, jamais propagée telle quelle.
 */
async function readAllRawData(): Promise<RawStoresData> {
  const [accounts, transactions, categories, settings] = await Promise.all([
    getRaw<unknown>(DB_KEYS.accounts, []),
    getRaw<unknown>(DB_KEYS.transactions, []),
    getRaw<unknown>(DB_KEYS.categories, []),
    getRaw<unknown>(DB_KEYS.settings, {}),
  ]);

  return {
    accounts: normalizeRawArray(accounts, DB_KEYS.accounts),
    transactions: normalizeRawArray(transactions, DB_KEYS.transactions),
    categories: normalizeRawArray(categories, DB_KEYS.categories),
    settings: normalizeRawRecord(settings, DB_KEYS.settings),
  };
}

/**
 * Détecte si l'un des 4 stores contient déjà des données, pour distinguer
 * une installation réellement neuve (rien à migrer) d'un utilisateur
 * "legacy" dont les données existent mais qui n'a jamais écrit de clé
 * `meta` — voir `runMigrationsUpTo` ci-dessous.
 */
function hasAnyExistingData(data: RawStoresData): boolean {
  return (
    data.accounts.length > 0 ||
    data.transactions.length > 0 ||
    data.categories.length > 0 ||
    Object.keys(data.settings).length > 0
  );
}

/**
 * Ré-écrit atomiquement les 4 stores de données migrés ET le nouveau
 * `meta.schemaVersion` en une seule transaction IndexedDB (`setMany`
 * d'idb-keyval écrit toutes ses entrées dans une unique transaction), plutôt
 * que par des `set()` indépendants : soit l'étape de migration est
 * intégralement persistée (données + version), soit rien ne l'est. Un crash
 * en cours de route ne peut donc jamais laisser les données dans la nouvelle
 * forme alors que `meta.schemaVersion` pointe encore vers l'ancienne (ou
 * l'inverse), et le prochain démarrage reprend exactement où il s'est
 * arrêté au lieu de rejouer une migration déjà appliquée.
 */
async function writeMigrationStep(data: RawStoresData, newSchemaVersion: number): Promise<void> {
  const meta: MetaRecord = { schemaVersion: newSchemaVersion };

  await setMany([
    [DB_KEYS.accounts, data.accounts],
    [DB_KEYS.transactions, data.transactions],
    [DB_KEYS.categories, data.categories],
    [DB_KEYS.settings, data.settings],
    [DB_KEYS.meta, meta],
  ]);
}

/**
 * Fait progresser les données persistées jusqu'à `targetVersion`, en
 * appliquant séquentiellement chaque migration manquante de `migrations`.
 * Exportée (plutôt que privée) et paramétrée par `targetVersion`/`migrations`
 * — au lieu de lire directement les constantes `DB_SCHEMA_VERSION` et
 * `MIGRATIONS` du module — pour rester testable indépendamment de leur
 * valeur figée en production (`MIGRATIONS` est vide tant qu'aucune vraie
 * migration n'existe) : les tests peuvent exercer la boucle avec leurs
 * propres version cible et migrations. `initializeDatabase` l'appelle avec
 * les constantes réelles du module.
 *
 * L'absence de clé `meta` est ambiguë à elle seule : il peut s'agir d'une
 * installation neuve (aucune donnée dans les 4 stores) OU d'un utilisateur
 * venu d'une version de l'app antérieure à l'introduction de ce système de
 * migration, dont les données existent déjà mais dans la forme implicite
 * LEGACY_SCHEMA_VERSION. On tranche en inspectant réellement le contenu des
 * stores (`hasAnyExistingData`) plutôt qu'en supposant "pas de meta = rien à
 * migrer" : seule une base réellement vide est gravée directement à
 * `targetVersion` sans passer par la boucle ; toute base non vide sans meta
 * repart de LEGACY_SCHEMA_VERSION et traverse la boucle comme n'importe quel
 * utilisateur existant. Un `meta` présent mais dont la forme ne passe pas
 * `isValidMetaRecord` (schemaVersion absent, non numérique ou non fini) est
 * traité avec la même prudence : on ne fait jamais confiance à une version
 * qu'on ne peut pas vérifier, on repart de LEGACY_SCHEMA_VERSION. Dans les deux
 * cas, LEGACY_SCHEMA_VERSION est persisté dans `meta` immédiatement, avant même
 * la boucle : sans cela, un `targetVersion` déjà égal à LEGACY_SCHEMA_VERSION
 * (ex. DB_SCHEMA_VERSION = 1 aujourd'hui) ferait exécuter la boucle zéro fois
 * et laisserait `meta` absent (ou corrompu) pour toujours, obligeant l'app à
 * rejouer cette même détection — et, pour le cas corrompu, le même
 * `console.warn` — à chaque démarrage sans jamais converger.
 *
 * Chaque étape de la boucle persiste sa progression immédiatement — via
 * `writeMigrationStep` (données migrées + nouveau `meta.schemaVersion` en une
 * seule transaction atomique) quand une migration est définie, ou via un
 * simple `setRaw` du meta seul sinon — plutôt qu'une seule fois à la toute
 * fin : un crash en cours de route laisse donc `meta.schemaVersion` refléter
 * exactement la dernière étape réellement appliquée, et le prochain
 * démarrage reprend à partir de là plutôt que de rejouer une migration déjà
 * effectuée sur des données déjà migrées.
 *
 * Si une version de la plage n'a pas de migration définie dans `migrations`,
 * on ne plante jamais et on ne perd aucune donnée : on journalise un
 * avertissement et on avance quand même le compteur de version (no-op pour
 * cette étape), quitte à ce que les données restent dans une forme
 * intermédiaire tant que la migration correspondante n'est pas écrite.
 */
export async function runMigrationsUpTo(
  targetVersion: number,
  migrations: Record<number, (data: RawStoresData) => RawStoresData>,
): Promise<void> {
  const rawMeta = await getRaw<unknown>(DB_KEYS.meta, undefined);
  let currentVersion: number;

  if (rawMeta === undefined) {
    const existingData = await readAllRawData();

    if (!hasAnyExistingData(existingData)) {
      await setRaw<MetaRecord>(DB_KEYS.meta, { schemaVersion: targetVersion });
      return;
    }

    currentVersion = LEGACY_SCHEMA_VERSION;
    // Persisté immédiatement : si `targetVersion` est déjà égal à
    // LEGACY_SCHEMA_VERSION (ex. DB_SCHEMA_VERSION = 1 aujourd'hui), la boucle
    // ci-dessous ne s'exécute aucune fois et n'écrirait donc jamais `meta` —
    // cet utilisateur legacy resterait sans clé `meta` pour toujours, et
    // repayerait un `readAllRawData()` complet à chaque démarrage. Si la
    // boucle s'exécute ensuite, `writeMigrationStep` réécrira `meta` avec la
    // version migrée : cet appel n'est jamais qu'un filet de sécurité pour le
    // cas 0 itération, jamais une source d'incohérence.
    await setRaw<MetaRecord>(DB_KEYS.meta, { schemaVersion: currentVersion });
  } else if (isValidMetaRecord(rawMeta)) {
    currentVersion = rawMeta.schemaVersion;
  } else {
    console.warn(
      `[db] Enregistrement "${DB_KEYS.meta}" invalide ou corrompu : les migrations repartent, ` +
        `par précaution, de la version ${LEGACY_SCHEMA_VERSION}.`,
      rawMeta,
    );
    currentVersion = LEGACY_SCHEMA_VERSION;
    // Même filet de sécurité que ci-dessus : sans cette écriture immédiate,
    // un `meta` corrompu avec `targetVersion` déjà égal à LEGACY_SCHEMA_VERSION
    // ne serait JAMAIS réparé (0 itération de la boucle) et redéclencherait ce
    // même avertissement à chaque démarrage, indéfiniment.
    await setRaw<MetaRecord>(DB_KEYS.meta, { schemaVersion: currentVersion });
  }

  while (currentVersion < targetVersion) {
    const migrate = migrations[currentVersion];
    const nextVersion = currentVersion + 1;

    if (migrate === undefined) {
      console.warn(
        `[db] Aucune migration définie pour passer les données de la version ${currentVersion} ` +
          `à ${nextVersion} : elles sont conservées telles quelles.`,
      );
      await setRaw<MetaRecord>(DB_KEYS.meta, { schemaVersion: nextVersion });
    } else {
      const currentData = await readAllRawData();
      const migratedData = migrate(currentData);
      await writeMigrationStep(migratedData, nextVersion);
    }

    currentVersion = nextVersion;
  }
}

/** Résultat renvoyé par `initializeDatabase`, consommé par l'écran de démarrage de l'app. */
export interface InitializeDatabaseResult {
  /** Résultat de la sonde IndexedDB (voir `isStorageAvailable`). */
  available: boolean;
  /**
   * `true` si les migrations ont été tentées mais qu'une exception a été
   * levée en cours de route (ex. quota IndexedDB dépassé pendant une
   * écriture) : les données peuvent être restées dans un état intermédiaire,
   * mais cette exception n'est jamais laissée remonter hors de
   * `initializeDatabase` — cohérent avec `isStorageAvailable`, qui adopte la
   * même politique de ne jamais faire planter l'écran de démarrage.
   */
  migrationError: boolean;
}

/**
 * Point d'entrée appelé au démarrage de l'app (typiquement consommé par un
 * écran/ErrorBoundary de démarrage à une étape ultérieure). Ne touche jamais
 * aux migrations si le stockage n'est pas disponible, pour éviter de générer
 * des erreurs secondaires sur un environnement déjà dégradé. Ne laisse
 * jamais une exception survenue *pendant* les migrations (après que la
 * sonde de disponibilité a réussi, ex. quota dépassé en cours d'écriture)
 * s'échapper : elle est capturée et reportée via `migrationError` plutôt que
 * de remonter, non catchée, jusqu'à l'appelant.
 */
export async function initializeDatabase(): Promise<InitializeDatabaseResult> {
  const available = await isStorageAvailable();

  if (!available) {
    return { available: false, migrationError: false };
  }

  try {
    await runMigrationsUpTo(DB_SCHEMA_VERSION, MIGRATIONS);
    return { available: true, migrationError: false };
  } catch (error) {
    console.error('[db] Les migrations ont échoué au démarrage :', error);
    return { available: true, migrationError: true };
  }
}
