export type AccountType = 'checking' | 'savings' | 'cash' | 'other';

/**
 * Un compte bancaire (ou assimilé) suivi dans l'app. `initialBalance` est le
 * solde paramétré par l'utilisateur au moment de la création du compte ; le
 * solde affiché ailleurs (dashboard, etc.) se déduit toujours de
 * initialBalance + somme des transactions (voir src/lib/balance.ts).
 */
export interface Account {
  id: string;
  name: string;
  type: AccountType;
  initialBalance: number;
  color: string;
  icon: string;
  createdAt: string;
  /** Date ISO d'archivage, ou null si le compte est actif. */
  archivedAt: string | null;
}
