import { getRaw, setRaw } from '@/db/client';
import { DB_KEYS } from '@/constants/db-keys';
import { DEFAULT_ACCENT_COLOR } from '@/constants/colors';
import type { AppSettings } from '@/types';

/** Réglages par défaut renvoyés tant que l'utilisateur n'a rien persisté. */
const DEFAULT_SETTINGS: AppSettings = {
  accentColor: DEFAULT_ACCENT_COLOR,
};

/** Lit les réglages de l'app ; valeurs par défaut si rien n'a encore été persisté. */
export async function getSettings(): Promise<AppSettings> {
  return getRaw<AppSettings>(DB_KEYS.settings, DEFAULT_SETTINGS);
}

/** Remplace intégralement les réglages persistés. */
export async function saveSettings(settings: AppSettings): Promise<void> {
  await setRaw(DB_KEYS.settings, settings);
}
