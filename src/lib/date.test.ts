import { describe, expect, it } from 'vitest';
import { formatDisplayDate, getIsoDateNDaysAgo, isDateInRange } from '@/lib/date';

describe('formatDisplayDate', () => {
  it('formate une date ISO en "dd MMM yyyy" localisé fr', () => {
    expect(formatDisplayDate('2024-03-05')).toBe('05 mars 2024');
  });
});

describe('isDateInRange', () => {
  it('retourne true quand la date est comprise dans les bornes (incluses)', () => {
    expect(isDateInRange('2024-03-05', '2024-03-01', '2024-03-31')).toBe(true);
    expect(isDateInRange('2024-03-01', '2024-03-01', '2024-03-31')).toBe(true);
  });

  it('retourne false quand la date est hors bornes, et gère les bornes nulles', () => {
    expect(isDateInRange('2024-04-01', '2024-03-01', '2024-03-31')).toBe(false);
    expect(isDateInRange('2024-04-01', null, '2024-03-31')).toBe(false);
    expect(isDateInRange('2024-04-01', '2024-03-01', null)).toBe(true);
  });
});

describe('getIsoDateNDaysAgo', () => {
  it('soustrait N jours à une date de référence explicite', () => {
    expect(getIsoDateNDaysAgo(10, '2024-03-05')).toBe('2024-02-24');
  });

  it('gère le passage de mois/année sans dépendre de la date système', () => {
    expect(getIsoDateNDaysAgo(1, '2024-01-01')).toBe('2023-12-31');
  });
});
