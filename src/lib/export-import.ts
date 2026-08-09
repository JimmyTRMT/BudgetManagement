import { EXPORT_FORMAT_VERSION } from '@/constants/export-format';
import type { Account, AppSettings, Category, ExportedData, Transaction } from '@/types';

/**
 * Assemble le payload d'export. `exportedAt` est fourni par l'appelant (ISO
 * string) plutôt que généré ici via `new Date()`, pour que la fonction reste
 * pure et déterministe en test.
 */
export function buildExportPayload(
  accounts: Account[],
  transactions: Transaction[],
  categories: Category[],
  settings: AppSettings,
  exportedAt: string,
): ExportedData {
  return {
    formatVersion: EXPORT_FORMAT_VERSION,
    exportedAt,
    accounts,
    transactions,
    categories,
    settings,
  };
}

/** Sérialise un export en JSON lisible (indenté), destiné à être écrit dans un fichier téléchargé. */
export function serializeExport(data: ExportedData): string {
  return JSON.stringify(data, null, 2);
}

export type ParsedImport = { ok: true; data: ExportedData } | { ok: false; error: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Vérifie la forme d'un ExportedData à la volée (garde de type), sans faire
 * confiance à `typeof value === 'object'` seul : un tableau ou `null` passent
 * ce test-là, d'où les `Array.isArray` / `isPlainObject` dédiés ci-dessous.
 * Ne valide que le niveau racine (types des tableaux/objet, pas le contenu de
 * chaque Account/Transaction/Category) : suffisant pour rejeter un fichier
 * manifestement étranger au format d'export sans dupliquer le typage métier.
 */
function isExportedDataShape(value: unknown): value is ExportedData {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    typeof value.formatVersion === 'number' &&
    typeof value.exportedAt === 'string' &&
    Array.isArray(value.accounts) &&
    Array.isArray(value.transactions) &&
    Array.isArray(value.categories) &&
    isPlainObject(value.settings)
  );
}

/**
 * Parse un fichier JSON importé par l'utilisateur. Ne lève jamais : toute
 * erreur (JSON invalide, champs manquants/mal formés, version de format trop
 * récente) est renvoyée dans un `ParsedImport` que l'appelant peut afficher
 * tel quel à l'utilisateur.
 */
export function parseImportedJson(raw: string): ParsedImport {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Le contenu du fichier n'est pas un JSON valide." };
  }

  if (!isExportedDataShape(parsed)) {
    return {
      ok: false,
      error:
        'Fichier invalide : les champs accounts, transactions, categories, settings et ' +
        'formatVersion sont requis, dans le bon format.',
    };
  }

  if (parsed.formatVersion > EXPORT_FORMAT_VERSION) {
    return {
      ok: false,
      error: "Ce fichier a été exporté par une version plus récente de l'app.",
    };
  }

  return { ok: true, data: parsed };
}
