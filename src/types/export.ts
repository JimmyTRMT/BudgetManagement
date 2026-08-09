import type { Account } from './account';
import type { AppSettings } from './settings';
import type { Category } from './category';
import type { Transaction } from './transaction';

/** Forme exacte d'un fichier JSON exporté/importé (voir src/lib/export-import.ts). */
export interface ExportedData {
  formatVersion: number;
  exportedAt: string;
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  settings: AppSettings;
}

/** Récapitulatif d'un merge d'import, affiché à l'utilisateur après import (voir src/lib/merge.ts). */
export interface MergeReport {
  accountsAdded: number;
  /**
   * Toujours 0 avec le modèle actuel : `Account` n'a pas de champ
   * `updatedAt`, donc `resolveAccountConflict` (src/lib/merge.ts) ne fait
   * jamais gagner l'entrante — un id déjà connu ne peut être compté que
   * comme conflit (`conflictsResolvedByNewest`), jamais comme "Updated". Ce
   * compteur ne redeviendra significatif que si `Account` gagne un champ
   * exploitable pour arbitrer objectivement une fraîcheur.
   */
  accountsUpdated: number;
  transactionsAdded: number;
  transactionsUpdated: number;
  categoriesAdded: number;
  /**
   * Toujours 0 avec le modèle actuel, pour la même raison que
   * `accountsUpdated` : `Category` n'a pas non plus de champ `updatedAt`
   * (voir `resolveCategoryConflict` dans src/lib/merge.ts).
   */
  categoriesUpdated: number;
  conflictsResolvedByNewest: number;
}

export interface MergeResult {
  data: ExportedData;
  report: MergeReport;
}
