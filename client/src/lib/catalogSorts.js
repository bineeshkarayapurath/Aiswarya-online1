// The catalog sort orders offered in the UI. Must stay in sync with the
// whitelist in server/src/services/catalogSort.js — the API silently falls back
// to accession ascending for anything it does not recognise, so a stale label
// here would show as "sorted" while the list quietly ignored the choice.
export const CATALOG_SORTS = [
  { value: 'accession_asc', label: 'Accession No: low to high' },
  { value: 'accession_desc', label: 'Accession No: high to low' },
  { value: 'title_asc', label: 'Title: A to Z' },
  { value: 'title_desc', label: 'Title: Z to A' },
  { value: 'author_asc', label: 'Author: A to Z' },
  { value: 'author_desc', label: 'Author: Z to A' },
  { value: 'category_asc', label: 'Category: A to Z' },
  { value: 'category_desc', label: 'Category: Z to A' },
];

export const DEFAULT_CATALOG_SORT = 'accession_asc';
