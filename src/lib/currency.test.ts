import { describe, expect, it } from 'vitest';
import { formatCurrency } from '@/lib/currency';

// Intl peut insérer des espaces insécables (normales ou fines) selon l'ICU
// du runtime ; on les normalise en espace simple pour des assertions stables.
const normalizeSpaces = (value: string): string => value.replace(/\s/g, ' ');

describe('formatCurrency', () => {
  it('formate un montant positif en euros au format fr-FR', () => {
    expect(normalizeSpaces(formatCurrency(1234.5))).toBe('1 234,50 €');
  });

  it('formate un montant négatif avec le signe moins natif de Intl', () => {
    expect(normalizeSpaces(formatCurrency(-42))).toBe('-42,00 €');
  });

  it('préfixe les montants positifs par "+" quand showSign est activé, sans affecter les négatifs', () => {
    expect(normalizeSpaces(formatCurrency(50, { showSign: true }))).toBe('+50,00 €');
    expect(normalizeSpaces(formatCurrency(-50, { showSign: true }))).toBe('-50,00 €');
  });
});
