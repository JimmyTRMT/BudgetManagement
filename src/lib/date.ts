import { format, parseISO, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';

/**
 * Affiche une date ISO (YYYY-MM-DD) au format "05 mars 2024".
 *
 * Utilise `parseISO` plutôt que `new Date(isoDate)` : pour une chaîne sans
 * heure, `new Date()` l'interprète en UTC minuit puis l'affiche dans le
 * fuseau local, ce qui peut faire glisser le jour affiché selon le fuseau de
 * l'utilisateur. `parseISO` interprète la date comme minuit local, ce qui
 * évite ce décalage.
 */
export function formatDisplayDate(isoDate: string): string {
  return format(parseISO(isoDate), 'dd MMM yyyy', { locale: fr });
}

/**
 * Indique si `isoDate` est comprise entre `start` et `end` (bornes
 * incluses). `start`/`end` à `null` signifie une borne ouverte, ce qui
 * correspond à un filtre de dates optionnel dans l'UI.
 */
export function isDateInRange(
  isoDate: string,
  start: string | null,
  end: string | null,
): boolean {
  const date = parseISO(isoDate);
  if (start && date < parseISO(start)) {
    return false;
  }
  if (end && date > parseISO(end)) {
    return false;
  }
  return true;
}

/**
 * Retourne la date ISO `days` jours avant `from`. `from` est un paramètre
 * explicite (jamais `new Date()` en interne) pour que la fonction reste pure
 * et testable de façon déterministe.
 */
export function getIsoDateNDaysAgo(days: number, from: string): string {
  return format(subDays(parseISO(from), days), 'yyyy-MM-dd');
}
