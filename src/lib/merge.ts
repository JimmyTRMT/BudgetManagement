import type {
  Account,
  Category,
  ExportedData,
  MergeReport,
  MergeResult,
  Transaction,
} from '@/types';

/**
 * Issue de la résolution d'un conflit d'id entre une entité `current` et
 * son homologue `incoming`.
 */
interface ConflictResolution<T> {
  winner: T;
  /** true si `incoming` a été choisi comme gagnant (compte comme "Updated" dans le rapport). */
  incomingWon: boolean;
  /** true si ce conflit doit être compté dans `conflictsResolvedByNewest`. */
  isConflict: boolean;
}

interface EntityMergeOutcome<T> {
  merged: T[];
  added: number;
  updated: number;
  conflicts: number;
}

/**
 * Fusionne deux listes d'entités identifiées par `id` : un id absent de
 * `currentItems` est ajouté tel quel, un id présent des deux côtés passe
 * toujours par `resolveConflict` (jamais d'écrasement implicite) qui décide
 * du gagnant et si le cas doit être compté comme conflit.
 *
 * `currentById` (snapshot immuable de `currentItems`) sert de référence pour
 * `resolveConflict` à chaque occurrence d'un id, y compris si `incomingItems`
 * contient plusieurs entrées portant le même id (export malformé/dupliqué) :
 * sans cette référence figée, une deuxième occurrence serait résolue contre
 * le gagnant de la première au lieu du vrai `current` d'origine. `resolutionById`
 * ne retient que la dernière résolution par id, pour que les compteurs
 * (added/updated/conflicts) restent alignés 1-pour-1 avec le contenu final de
 * `merged` au lieu de compter en double une entrée dupliquée.
 */
function mergeEntities<T extends { id: string }>(
  currentItems: readonly T[],
  incomingItems: readonly T[],
  resolveConflict: (current: T, incoming: T) => ConflictResolution<T>,
): EntityMergeOutcome<T> {
  const currentById = new Map<string, T>(currentItems.map((item) => [item.id, item]));
  const mergedById = new Map<string, T>(currentById);
  const resolutionById = new Map<string, ConflictResolution<T> | 'added'>();

  for (const incomingItem of incomingItems) {
    const originalCurrentItem = currentById.get(incomingItem.id);

    if (!originalCurrentItem) {
      mergedById.set(incomingItem.id, incomingItem);
      resolutionById.set(incomingItem.id, 'added');
      continue;
    }

    const resolution = resolveConflict(originalCurrentItem, incomingItem);
    mergedById.set(incomingItem.id, resolution.winner);
    resolutionById.set(incomingItem.id, resolution);
  }

  let added = 0;
  let updated = 0;
  let conflicts = 0;

  for (const resolution of resolutionById.values()) {
    if (resolution === 'added') {
      added += 1;
      continue;
    }
    if (resolution.isConflict) {
      conflicts += 1;
    }
    if (resolution.incomingWon) {
      updated += 1;
    }
  }

  return { merged: Array.from(mergedById.values()), added, updated, conflicts };
}

function transactionsContentEqual(a: Transaction, b: Transaction): boolean {
  return (
    a.accountId === b.accountId &&
    a.categoryId === b.categoryId &&
    a.type === b.type &&
    a.amount === b.amount &&
    a.date === b.date &&
    a.note === b.note &&
    a.createdAt === b.createdAt &&
    a.updatedAt === b.updatedAt
  );
}

/**
 * Pour une Transaction, `updatedAt` (ISO) fait foi : la version la plus
 * récente gagne. Un id présent des deux côtés n'est compté comme conflit que
 * si le contenu diffère réellement (même logique que resolveAccountConflict /
 * resolveCategoryConflict) : réimporter deux fois le même export, ou une
 * transaction strictement inchangée (même `updatedAt` inclus), ne doit pas
 * remonter de faux conflit dans le rapport. Seule une victoire de l'entrante
 * compte comme "Updated". En cas d'égalité stricte de `updatedAt`, `current`
 * est conservée (pas de changement inutile).
 */
function resolveTransactionConflict(
  current: Transaction,
  incoming: Transaction,
): ConflictResolution<Transaction> {
  const incomingIsNewer = incoming.updatedAt > current.updatedAt;

  return {
    winner: incomingIsNewer ? incoming : current,
    incomingWon: incomingIsNewer,
    isConflict: !transactionsContentEqual(current, incoming),
  };
}

function accountsContentEqual(a: Account, b: Account): boolean {
  return (
    a.name === b.name &&
    a.type === b.type &&
    a.initialBalance === b.initialBalance &&
    a.color === b.color &&
    a.icon === b.icon &&
    a.createdAt === b.createdAt &&
    a.archivedAt === b.archivedAt
  );
}

/**
 * Account n'a pas de champ `updatedAt` dans le type actuel : impossible de
 * savoir objectivement quelle version est la plus récente. Plutôt que
 * d'inventer une heuristique (ou un champ absent du type), on conserve
 * toujours `current` par défaut — ne jamais écraser une donnée locale sans
 * preuve de fraîcheur. Le conflit n'est compté que si le contenu diffère
 * réellement (deux exports identiques du même compte ne sont pas un conflit).
 */
function resolveAccountConflict(current: Account, incoming: Account): ConflictResolution<Account> {
  return {
    winner: current,
    incomingWon: false,
    isConflict: !accountsContentEqual(current, incoming),
  };
}

function categoriesContentEqual(a: Category, b: Category): boolean {
  return (
    a.name === b.name &&
    a.color === b.color &&
    a.icon === b.icon &&
    a.kind === b.kind &&
    a.createdAt === b.createdAt
  );
}

/** Même raisonnement que resolveAccountConflict : Category n'a pas non plus de `updatedAt`. */
function resolveCategoryConflict(
  current: Category,
  incoming: Category,
): ConflictResolution<Category> {
  return {
    winner: current,
    incomingWon: false,
    isConflict: !categoriesContentEqual(current, incoming),
  };
}

/**
 * Fusionne un export JSON précédent (`current`, déjà en base) avec un export
 * importé (`incoming`), sans jamais écraser une donnée locale plus récente
 * par une donnée importée plus ancienne :
 * - accounts / categories / transactions sont fusionnés par id (voir
 *   resolveTransactionConflict / resolveAccountConflict / resolveCategoryConflict
 *   pour la règle de résolution propre à chaque entité) ;
 * - `settings` est TOUJOURS celui de `current` : ce sont des préférences
 *   d'affichage propres à l'appareil, pas une donnée à synchroniser entre
 *   appareils, donc un import ne doit jamais les modifier ;
 * - `formatVersion` du résultat est celui de `current` (le format cible reste
 *   celui déjà utilisé localement) ;
 * - `exportedAt` du résultat est le plus récent des deux, comparé comme des
 *   chaînes ISO 8601 (comparaison lexicographique valide sur ce format, sans
 *   passer par Date pour garder la fonction pure et déterministe).
 *
 * Fonction pure : aucune donnée n'est mutée, aucun accès I/O ou horloge.
 */
export function mergeImportedData(current: ExportedData, incoming: ExportedData): MergeResult {
  const accountsResult = mergeEntities(
    current.accounts,
    incoming.accounts,
    resolveAccountConflict,
  );
  const categoriesResult = mergeEntities(
    current.categories,
    incoming.categories,
    resolveCategoryConflict,
  );
  const transactionsResult = mergeEntities(
    current.transactions,
    incoming.transactions,
    resolveTransactionConflict,
  );

  const report: MergeReport = {
    accountsAdded: accountsResult.added,
    accountsUpdated: accountsResult.updated,
    transactionsAdded: transactionsResult.added,
    transactionsUpdated: transactionsResult.updated,
    categoriesAdded: categoriesResult.added,
    categoriesUpdated: categoriesResult.updated,
    conflictsResolvedByNewest:
      accountsResult.conflicts + categoriesResult.conflicts + transactionsResult.conflicts,
  };

  const mostRecentExportedAt =
    current.exportedAt >= incoming.exportedAt ? current.exportedAt : incoming.exportedAt;

  const data: ExportedData = {
    formatVersion: current.formatVersion,
    exportedAt: mostRecentExportedAt,
    accounts: accountsResult.merged,
    transactions: transactionsResult.merged,
    categories: categoriesResult.merged,
    settings: current.settings,
  };

  return { data, report };
}
