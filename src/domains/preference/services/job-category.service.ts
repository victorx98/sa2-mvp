import { Injectable, ConflictException, NotFoundException, Logger } from '@nestjs/common';
import { JobCategoryRepository } from '../repositories/job-category.repository';
import type {
  JobCategoryEntity,
  CreateJobCategoryDto,
  UpdateJobCategoryDto,
  JobCategoryQueryOptions,
} from '../entities/job-category.entity';

/**
 * Job Category Service
 * 岗位类别服务(Job Category Service)
 * 职责：业务逻辑层，处理领域规则
 */
@Injectable()
export class JobCategoryService {
  private readonly logger = new Logger(JobCategoryService.name);

  constructor(
    private readonly jobCategoryRepository: JobCategoryRepository,
  ) {}

  /**
   * 创建岗位类别(Create job category)
   */
  async create(dto: CreateJobCategoryDto): Promise<JobCategoryEntity> {
    this.logger.log(`Creating job category: ${dto.id}`);

    const exists = await this.jobCategoryRepository.existsById(dto.id);
    if (exists) {
      throw new ConflictException(`Job category with ID '${dto.id}' already exists`);
    }

    return await this.jobCategoryRepository.create(dto);
  }

  /**
   * 更新岗位类别(Update job category)
   */
  async update(id: string, dto: UpdateJobCategoryDto): Promise<JobCategoryEntity> {
    this.logger.log(`Updating job category: ${id}`);

    const existing = await this.jobCategoryRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Job category with ID '${id}' not found`);
    }

    if (existing.status === 'deleted') {
      throw new ConflictException(`Cannot update deleted job category '${id}'`);
    }

    if (dto.status && !this.isValidStatusTransition(existing.status, dto.status)) {
      throw new ConflictException(
        `Invalid status transition from '${existing.status}' to '${dto.status}'`,
      );
    }

    return await this.jobCategoryRepository.update(id, dto);
  }

  /**
   * 逻辑删除岗位类别(Soft delete job category)
   */
  async delete(id: string, deletedBy: string): Promise<JobCategoryEntity> {
    this.logger.log(`Deleting job category: ${id}`);

    const existing = await this.jobCategoryRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Job category with ID '${id}' not found`);
    }

    if (existing.status === 'deleted') {
      throw new ConflictException(`Job category '${id}' is already deleted`);
    }

    return await this.jobCategoryRepository.delete(id, deletedBy);
  }

  /**
   * 根据ID查询岗位类别(Find job category by ID)
   */
  async findById(id: string): Promise<JobCategoryEntity> {
    this.logger.log(`Finding job category by id: ${id}`);

    const result = await this.jobCategoryRepository.findById(id);
    if (!result) {
      throw new NotFoundException(`Job category with ID '${id}' not found`);
    }

    return result;
  }

  /**
   * 分页查询岗位类别(Find all job categories with pagination)
   */
  async findAll(options: JobCategoryQueryOptions): Promise<{
    data: JobCategoryEntity[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    this.logger.log(`Finding job categories with options: ${JSON.stringify(options)}`);

    const page = options.page || 1;
    const pageSize = options.pageSize || 20;

    const [data, total] = await Promise.all([
      this.jobCategoryRepository.findAll(options),
      this.jobCategoryRepository.count(options),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  /**
   * 验证状态转换是否合法(Validate status transition)
   */
  private isValidStatusTransition(currentStatus: string | null, newStatus: string): boolean {
    const validTransitions: Record<string, string[]> = {
      active: ['inactive', 'deleted'],
      inactive: ['active', 'deleted'],
      deleted: [],
    };

    const current = currentStatus || 'active';
    const allowed = validTransitions[current] || [];

    return allowed.includes(newStatus);
  }
}

