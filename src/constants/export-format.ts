/**
 * Version du format des fichiers JSON exportés/importés. Volontairement
 * indépendante de DB_SCHEMA_VERSION (src/constants/db-keys.ts) : un export
 * peut rester lisible même après une migration interne de la base tant que
 * ce format-ci n'a pas changé.
 */
export const EXPORT_FORMAT_VERSION = 1;
