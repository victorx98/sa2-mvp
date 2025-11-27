import { Injectable } from "@nestjs/common";
import {
  SchoolQueryService,
  SchoolListItem,
} from "@domains/query/services/school-query.service";

/**
 * School List Query (Application Layer)
 * 职责：
 * 1. 编排学校列表查询用例
 * 2. 调用 Query Domain 的 School Query Service
 * 3. 返回业务数据（与角色无关）
 */
@Injectable()
export class SchoolListQuery {
  constructor(
    private readonly schoolQueryService: SchoolQueryService,
  ) {}

  /**
   * 搜索学校列表
   * 支持按中英文名称搜索
   */
  async search(search?: string): Promise<SchoolListItem[]> {
    return this.schoolQueryService.search(search);
  }

  /**
   * 根据ID查询学校
   */
  async findById(id: string): Promise<SchoolListItem | null> {
    return this.schoolQueryService.findById(id);
  }
}

