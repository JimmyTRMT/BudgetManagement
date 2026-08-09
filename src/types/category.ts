/** 'both' = catégorie utilisable aussi bien pour une recette qu'une dépense. */
export type CategoryKind = 'income' | 'expense' | 'both';

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  kind: CategoryKind;
  createdAt: string;
}
