import { format, parseISO, subDays } from 'date-fns';
import type { Account, Transaction } from '@/types';

/**
 * Solde d'un compte : initialBalance + somme signée de ses transactions
 * (income en +, expense en -, voir Transaction.amount qui est toujours positif).
 * Aucun filtre par date ici : c'est le solde actuel complet, pas un solde
 * "à une date donnée" (voir computeBalanceHistory pour ce cas).
 */
export function computeAccountBalance(
  account: Account,
  transactions: readonly Transaction[],
): number {
  const signedTotal = transactions.reduce((sum, transaction) => {
    if (transaction.accountId !== account.id) {
      return sum;
    }
    return transaction.type === 'income' ? sum + transaction.amount : sum - transaction.amount;
  }, 0);

  return account.initialBalance + signedTotal;
}

/**
 * Solde total, tous comptes confondus. Réutilise computeAccountBalance pour
 * ne pas dupliquer la règle de signe income/expense.
 */
export function computeTotalBalance(
  accounts: readonly Account[],
  transactions: readonly Transaction[],
): number {
  return accounts.reduce((sum, account) => sum + computeAccountBalance(account, transactions), 0);
}

/** Un point de la série temporelle produite par computeBalanceHistory. */
export interface BalanceHistoryPoint {
  /** Date ISO 'YYYY-MM-DD'. */
  date: string;
  balance: number;
}

/**
 * Historique du solde total sur les `days` derniers jours se terminant à
 * `endDate` (borne incluse), trié du plus ancien au plus récent.
 *
 * `endDate` est un paramètre explicite (jamais new Date()/Date.now()) pour
 * que la fonction reste pure et testable de façon déterministe. Pour chaque
 * jour, le solde est recalculé à partir de zéro sur les transactions dont la
 * date est <= ce jour : c'est plus simple et plus sûr qu'un cumul incrémental
 * qui supposerait des transactions déjà triées par date.
 */
export function computeBalanceHistory(
  accounts: readonly Account[],
  transactions: readonly Transaction[],
  days: number,
  endDate: string,
): BalanceHistoryPoint[] {
  const end = parseISO(endDate);
  const history: BalanceHistoryPoint[] = [];

  for (let offsetFromEnd = days - 1; offsetFromEnd >= 0; offsetFromEnd -= 1) {
    const day = format(subDays(end, offsetFromEnd), 'yyyy-MM-dd');
    // Comparaison lexicographique valide car les dates sont au format ISO 'YYYY-MM-DD'.
    const transactionsUpToDay = transactions.filter((transaction) => transaction.date <= day);

    history.push({ date: day, balance: computeTotalBalance(accounts, transactionsUpToDay) });
  }

  return history;
}
