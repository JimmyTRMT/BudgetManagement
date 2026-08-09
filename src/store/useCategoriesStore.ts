import { create } from 'zustand';
import { getAllCategories, saveAllCategories } from '@/db/categories.repository';
import type { Category } from '@/types';

/**
 * Champs fournis par l'appelant pour créer/modifier une catégorie. `id` et
 * `createdAt` sont exclus car générés par le store (id via
 * crypto.randomUUID(), date reçue en paramètre par l'action plutôt que lue
 * via `new Date()`, pour que les actions restent testables sans dépendre de
 * l'horloge système).
 */
export type CategoryInput = Omit<Category, 'id' | 'createdAt'>;

export interface CategoriesState {
  categories: Category[];
  isLoaded: boolean;
  isSaving: boolean;
  loadFromDb: () => Promise<void>;
  persist: () => Promise<void>;
  addCategory: (input: CategoryInput, now: string) => void;
  updateCategory: (id: string, changes: Partial<CategoryInput>) => void;
  deleteCategory: (id: string) => void;
}

/**
 * Store Zustand des catégories. Il ne persiste jamais tout seul :
 * `loadFromDb` hydrate l'état en mémoire au démarrage et `persist` réécrit
 * l'intégralité de la collection en base — c'est à l'appelant (le futur
 * hook de sauvegarde debouncée) de décider quand invoquer `persist` après
 * une mutation.
 */
export const useCategoriesStore = create<CategoriesState>()((set, get) => ({
  categories: [],
  isLoaded: false,
  isSaving: false,

  loadFromDb: async (): Promise<void> => {
    const categories = await getAllCategories();
    set({ categories, isLoaded: true });
  },

  persist: async (): Promise<void> => {
    set({ isSaving: true });
    try {
      await saveAllCategories(get().categories);
    } finally {
      set({ isSaving: false });
    }
  },

  addCategory: (input: CategoryInput, now: string): void => {
    const category: Category = { ...input, id: crypto.randomUUID(), createdAt: now };
    set((state) => ({ categories: [...state.categories, category] }));
  },

  updateCategory: (id: string, changes: Partial<CategoryInput>): void => {
    set((state) => ({
      categories: state.categories.map((category) =>
        category.id === id ? { ...category, ...changes } : category,
      ),
    }));
  },

  deleteCategory: (id: string): void => {
    set((state) => ({
      categories: state.categories.filter((category) => category.id !== id),
    }));
  },
}));
