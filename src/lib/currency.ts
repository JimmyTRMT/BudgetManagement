/**
 * Formate un montant en euros selon la locale fr-FR (ex. "1 234,50 €").
 *
 * Intl.NumberFormat ne préfixe jamais les nombres positifs par un signe :
 * `showSign` ajoute explicitement ce "+" pour les affichages où le signe
 * porte une information (ex. un mouvement de solde), sans l'imposer partout.
 */
export function formatCurrency(
  amountInEuros: number,
  options?: { showSign?: boolean },
): string {
  const formatted = new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amountInEuros);

  if (options?.showSign && amountInEuros > 0) {
    return `+${formatted}`;
  }

  return formatted;
}
