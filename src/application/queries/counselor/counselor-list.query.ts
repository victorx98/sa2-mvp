import { Injectable } from "@nestjs/common";
import {
  CounselorQueryService,
  CounselorListItem,
} from "@domains/query/services/counselor-query.service";

/**
 * Counselor List Query (Application Layer)
 * 职责：
 * 1. 编排顾问列表查询用例
 * 2. 调用 Query Domain 的 Counselor Query Service
 */
@Injectable()
export class CounselorListQuery {
  constructor(private readonly counselorQueryService: CounselorQueryService) {}

  /**
   * 查询顾问列表
   * @param text 可选的搜索关键词（搜索 email、英文名、中文名）
   * @returns 顾问列表
   */
  async execute(text?: string): Promise<CounselorListItem[]> {
    return this.counselorQueryService.findAll(text);
  }
}

