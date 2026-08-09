/**
 * Clés utilisées dans le store IndexedDB (via idb-keyval). Centralisées ici
 * pour qu'aucune "magic string" ne circule dans la couche src/db/.
 */
export const DB_KEYS = {
  accounts: 'accounts',
  transactions: 'transactions',
  categories: 'categories',
  settings: 'settings',
  meta: 'meta',
} as const;

/**
 * Version du schéma interne stocké en IndexedDB. À incrémenter à chaque
 * changement de forme des données persistées ; voir la stratégie de
 * migration détaillée dans src/db/client.ts.
 */
export const DB_SCHEMA_VERSION = 1;
