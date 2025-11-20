// Paginated result object
export interface IPaginatedResult<T> {
  data: T[]; // Data list
  total: number; // Total records count
  page: number; // Current page number
  pageSize: number; // Page size
  totalPages: number; // Total pages
}

// Legacy alias for backward compatibility
export type PaginatedResult<T> = IPaginatedResult<T>;
