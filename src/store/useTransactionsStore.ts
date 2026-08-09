import { create } from 'zustand';
import { getAllTransactions, saveAllTransactions } from '@/db/transactions.repository';
import { filterTransactions } from '@/lib/filter';
import type { TransactionFilters } from '@/lib/filter';
import { sortTransactions } from '@/lib/sort';
import type { SortDirection, TransactionSortField } from '@/constants/sort-filter';
import type { Transaction } from '@/types';

/** Données nécessaires à la création d'une transaction : tout sauf `id`, générée par le store. */
export type NewTransactionInput = Omit<Transaction, 'id'>;

/**
 * Modifications applicables à une transaction existante. `updatedAt` doit
 * être inclus par l'appelant s'il souhaite le faire évoluer : le store ne
 * génère jamais de date en interne (`new Date()`), pour rester déterministe
 * et testable sans mock d'horloge.
 */
export type TransactionUpdateInput = Partial<Omit<Transaction, 'id'>>;

export interface TransactionsState {
  /** Collection complète des transactions, telle que persistée en IndexedDB. */
  transactions: Transaction[];
  /** `true` une fois `loadFromDb` terminé : distingue "pas encore chargé" de "chargé et vide". */
  isLoaded: boolean;
  /** `true` pendant qu'une sauvegarde vers IndexedDB est en cours. */
  isSaving: boolean;

  /** Champ de tri courant, appliqué par `getVisibleTransactions`. */
  sortField: TransactionSortField;
  /** Direction de tri courante, appliquée par `getVisibleTransactions`. */
  sortDirection: SortDirection;
  /** Filtres courants, appliqués par `getVisibleTransactions` avant le tri. */
  filters: TransactionFilters;

  /** Recharge `transactions` depuis IndexedDB et bascule `isLoaded` à `true`. */
  loadFromDb: () => Promise<void>;
  /** Réécrit la collection complète en IndexedDB à partir de l'état en mémoire courant. */
  persist: () => Promise<void>;

  /**
   * Ajoute une transaction (id générée via `crypto.randomUUID()`) et
   * déclenche une sauvegarde en arrière-plan ; retourne l'id généré pour
   * permettre à l'appelant d'enchaîner (ex. navigation vers le détail).
   */
  addTransaction: (transaction: NewTransactionInput) => string;
  /** Fusionne `changes` dans la transaction `id` et déclenche une sauvegarde en arrière-plan. */
  updateTransaction: (id: string, changes: TransactionUpdateInput) => void;
  /** Retire la transaction `id` et déclenche une sauvegarde en arrière-plan. */
  deleteTransaction: (id: string) => void;

  setSortField: (field: TransactionSortField) => void;
  setSortDirection: (direction: SortDirection) => void;
  /** Fusionne partiellement `patch` dans les filtres courants (jamais un remplacement complet). */
  setFilters: (patch: Partial<TransactionFilters>) => void;

  /** Transactions filtrées puis triées selon l'état courant : source unique pour l'affichage liste. */
  getVisibleTransactions: () => Transaction[];
}

/**
 * Sélecteur pur factorisant `filterTransactions` + `sortTransactions`.
 * Exporté séparément pour rester testable en isolation (sans Zustand ni
 * IndexedDB) ; `getVisibleTransactions` du store n'en est qu'un appel avec
 * l'état courant.
 */
export function selectVisibleTransactions(
  state: Pick<TransactionsState, 'transactions' | 'filters' | 'sortField' | 'sortDirection'>,
): Transaction[] {
  const filtered = filterTransactions(state.transactions, state.filters);
  return sortTransactions(filtered, state.sortField, state.sortDirection);
}

/**
 * Store Zustand des transactions : état en mémoire + persistance IndexedDB
 * (via transactions.repository) + état de tri/filtre pour l'écran liste.
 */
export const useTransactionsStore = create<TransactionsState>()((set, get) => ({
  transactions: [],
  isLoaded: false,
  isSaving: false,

  sortField: 'date',
  sortDirection: 'desc',
  filters: {},

  loadFromDb: async () => {
    const transactions = await getAllTransactions();
    set({ transactions, isLoaded: true });
  },

  persist: async () => {
    set({ isSaving: true });
    try {
      await saveAllTransactions(get().transactions);
    } finally {
      set({ isSaving: false });
    }
  },

  addTransaction: (transaction) => {
    const id = crypto.randomUUID();
    set((state) => ({ transactions: [...state.transactions, { ...transaction, id }] }));
    void get().persist();
    return id;
  },

  updateTransaction: (id, changes) => {
    set((state) => ({
      transactions: state.transactions.map((transaction) =>
        transaction.id === id ? { ...transaction, ...changes } : transaction,
      ),
    }));
    void get().persist();
  },

  deleteTransaction: (id) => {
    set((state) => ({
      transactions: state.transactions.filter((transaction) => transaction.id !== id),
    }));
    void get().persist();
  },

  setSortField: (field) => set({ sortField: field }),
  setSortDirection: (direction) => set({ sortDirection: direction }),
  setFilters: (patch) => set((state) => ({ filters: { ...state.filters, ...patch } })),

  getVisibleTransactions: () => selectVisibleTransactions(get()),
}));
