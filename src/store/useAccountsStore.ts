import { create } from 'zustand';
import { getAllAccounts, saveAllAccounts } from '@/db/accounts.repository';
import type { Account } from '@/types';

/**
 * Champs fournis par l'appelant pour créer/modifier un compte. `id` et
 * `createdAt` sont exclus car générés par le store (id via
 * crypto.randomUUID(), date reçue en paramètre par l'action plutôt que lue
 * via `new Date()`, pour que les actions restent testables sans dépendre de
 * l'horloge système).
 */
export type AccountInput = Omit<Account, 'id' | 'createdAt'>;

export interface AccountsState {
  accounts: Account[];
  isLoaded: boolean;
  isSaving: boolean;
  loadFromDb: () => Promise<void>;
  persist: () => Promise<void>;
  addAccount: (input: AccountInput, now: string) => void;
  updateAccount: (id: string, changes: Partial<AccountInput>) => void;
  deleteAccount: (id: string) => void;
}

/**
 * Store Zustand des comptes. Il ne persiste jamais tout seul : `loadFromDb`
 * hydrate l'état en mémoire au démarrage et `persist` réécrit l'intégralité
 * de la collection en base — c'est à l'appelant (le futur hook de
 * sauvegarde debouncée) de décider quand invoquer `persist` après une
 * mutation.
 */
export const useAccountsStore = create<AccountsState>()((set, get) => ({
  accounts: [],
  isLoaded: false,
  isSaving: false,

  loadFromDb: async (): Promise<void> => {
    const accounts = await getAllAccounts();
    set({ accounts, isLoaded: true });
  },

  persist: async (): Promise<void> => {
    set({ isSaving: true });
    try {
      await saveAllAccounts(get().accounts);
    } finally {
      set({ isSaving: false });
    }
  },

  addAccount: (input: AccountInput, now: string): void => {
    const account: Account = { ...input, id: crypto.randomUUID(), createdAt: now };
    set((state) => ({ accounts: [...state.accounts, account] }));
  },

  updateAccount: (id: string, changes: Partial<AccountInput>): void => {
    set((state) => ({
      accounts: state.accounts.map((account) =>
        account.id === id ? { ...account, ...changes } : account,
      ),
    }));
  },

  deleteAccount: (id: string): void => {
    set((state) => ({ accounts: state.accounts.filter((account) => account.id !== id) }));
  },
}));
