export * from './useAccountsStore';
export * from './useTransactionsStore';
export * from './useCategoriesStore';
export * from './useSettingsStore';

import { useAccountsStore } from './useAccountsStore';
import { useTransactionsStore } from './useTransactionsStore';
import { useCategoriesStore } from './useCategoriesStore';
import { useSettingsStore } from './useSettingsStore';

/**
 * Hydrate les quatre stores depuis IndexedDB en parallèle. Point d'entrée
 * unique appelé au démarrage de l'app (App.tsx) plutôt que de laisser
 * chaque écran déclencher son propre `loadFromDb`, pour garantir un seul
 * aller-retour IndexedDB par store et un état "chargé" cohérent avant le
 * premier rendu.
 */
export async function loadAllStores(): Promise<void> {
  await Promise.all([
    useAccountsStore.getState().loadFromDb(),
    useTransactionsStore.getState().loadFromDb(),
    useCategoriesStore.getState().loadFromDb(),
    useSettingsStore.getState().loadFromDb(),
  ]);
}
