// Pagination query parameters (page-based)
// 分页请求参数（基于页码）
export interface IPaginationQuery {
  page: number; // Current page number [当前页码]
  pageSize: number; // Items per page [每页条数]
}

// Legacy alias for backward compatibility
// 为向后兼容提供别名
export type PaginationQuery = IPaginationQuery;

// Sorting parameters
// 排序参数
export interface ISortQuery {
  field: string; // Field to sort by [排序字段]
  direction: "asc" | "desc"; // Sort direction [排序方向]
}

// Legacy alias for backward compatibility
// 为向后兼容提供别名
export type SortQuery = ISortQuery;

export type Pagination = IPaginationQuery;
