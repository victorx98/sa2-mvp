import { Injectable } from "@nestjs/common";
import {
  MajorQueryService,
  MajorListItem,
} from "@domains/query/services/major-query.service";

/**
 * Major List Query (Application Layer)
 * 职责：
 * 1. 编排专业列表查询用例
 * 2. 调用 Query Domain 的 Major Query Service
 * 3. 返回业务数据（与角色无关）
 */
@Injectable()
export class MajorListQuery {
  constructor(
    private readonly majorQueryService: MajorQueryService,
  ) {}

  /**
   * 搜索专业列表
   * 支持按中英文名称搜索
   */
  async search(search?: string): Promise<MajorListItem[]> {
    return this.majorQueryService.search(search);
  }

  /**
   * 根据ID查询专业
   */
  async findById(id: string): Promise<MajorListItem | null> {
    return this.majorQueryService.findById(id);
  }
}

