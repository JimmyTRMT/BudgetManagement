import { create } from 'zustand';
import { getSettings, saveSettings } from '@/db/settings.repository';
import { DEFAULT_ACCENT_COLOR } from '@/constants/colors';
import type { AppSettings } from '@/types';

export interface SettingsState {
  settings: AppSettings;
  isLoaded: boolean;
  isSaving: boolean;
  loadFromDb: () => Promise<void>;
  persist: () => Promise<void>;
  setAccentColor: (color: string) => void;
}

/**
 * Store Zustand des réglages. `settings` démarre avec DEFAULT_ACCENT_COLOR
 * (plutôt qu'un état vide/undefined) pour que l'UI ait toujours une valeur
 * exploitable avant que `loadFromDb` n'ait fini d'hydrater l'état depuis
 * IndexedDB. Il ne persiste jamais tout seul : c'est à l'appelant (le futur
 * hook de sauvegarde debouncée) de décider quand invoquer `persist` après
 * une mutation.
 */
export const useSettingsStore = create<SettingsState>()((set, get) => ({
  settings: { accentColor: DEFAULT_ACCENT_COLOR },
  isLoaded: false,
  isSaving: false,

  loadFromDb: async (): Promise<void> => {
    const settings = await getSettings();
    set({ settings, isLoaded: true });
  },

  persist: async (): Promise<void> => {
    set({ isSaving: true });
    try {
      await saveSettings(get().settings);
    } finally {
      set({ isSaving: false });
    }
  },

  setAccentColor: (color: string): void => {
    set((state) => ({ settings: { ...state.settings, accentColor: color } }));
  },
}));
