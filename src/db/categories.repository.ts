import { getRaw, setRaw } from '@/db/client';
import { DB_KEYS } from '@/constants/db-keys';
import type { Category } from '@/types';

/** Lit la collection complète des catégories ; tableau vide si rien n'a encore été persisté. */
export async function getAllCategories(): Promise<Category[]> {
  return getRaw<Category[]>(DB_KEYS.categories, []);
}

/**
 * Remplace la collection complète des catégories. Pas de mise à jour
 * partielle : conformément au design de persistance de l'app, c'est le store
 * Zustand qui détient l'état en mémoire et déclenche une sauvegarde
 * debouncée de tout le tableau (voir le contexte du store côté appelant).
 */
export async function saveAllCategories(categories: Category[]): Promise<void> {
  await setRaw(DB_KEYS.categories, categories);
}
