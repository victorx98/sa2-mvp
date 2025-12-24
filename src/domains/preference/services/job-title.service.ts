import { Injectable, ConflictException, NotFoundException, Logger } from '@nestjs/common';
import { JobTitleRepository } from '../repositories/job-title.repository';
import type {
  JobTitleEntity,
  CreateJobTitleDto,
  UpdateJobTitleDto,
  JobTitleQueryOptions,
} from '../entities/job-title.entity';

/**
 * Job Title Service
 * 岗位名称服务(Job Title Service)
 * 职责：业务逻辑层，处理领域规则
 */
@Injectable()
export class JobTitleService {
  private readonly logger = new Logger(JobTitleService.name);

  constructor(
    private readonly jobTitleRepository: JobTitleRepository,
  ) {}

  /**
   * 创建岗位名称(Create job title)
   */
  async create(dto: CreateJobTitleDto): Promise<JobTitleEntity> {
    this.logger.log(`Creating job title: ${dto.id}`);

    const exists = await this.jobTitleRepository.existsById(dto.id);
    if (exists) {
      throw new ConflictException(`Job title with ID '${dto.id}' already exists`);
    }

    return await this.jobTitleRepository.create(dto);
  }

  /**
   * 更新岗位名称(Update job title)
   */
  async update(id: string, dto: UpdateJobTitleDto): Promise<JobTitleEntity> {
    this.logger.log(`Updating job title: ${id}`);

    const existing = await this.jobTitleRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Job title with ID '${id}' not found`);
    }

    if (existing.status === 'deleted') {
      throw new ConflictException(`Cannot update deleted job title '${id}'`);
    }

    if (dto.status && !this.isValidStatusTransition(existing.status, dto.status)) {
      throw new ConflictException(
        `Invalid status transition from '${existing.status}' to '${dto.status}'`,
      );
    }

    return await this.jobTitleRepository.update(id, dto);
  }

  /**
   * 逻辑删除岗位名称(Soft delete job title)
   */
  async delete(id: string, deletedBy: string): Promise<JobTitleEntity> {
    this.logger.log(`Deleting job title: ${id}`);

    const existing = await this.jobTitleRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Job title with ID '${id}' not found`);
    }

    if (existing.status === 'deleted') {
      throw new ConflictException(`Job title '${id}' is already deleted`);
    }

    return await this.jobTitleRepository.delete(id, deletedBy);
  }

  /**
   * 根据ID查询岗位名称(Find job title by ID)
   */
  async findById(id: string): Promise<JobTitleEntity> {
    this.logger.log(`Finding job title by id: ${id}`);

    const result = await this.jobTitleRepository.findById(id);
    if (!result) {
      throw new NotFoundException(`Job title with ID '${id}' not found`);
    }

    return result;
  }

  /**
   * 分页查询岗位名称(Find all job titles with pagination)
   */
  async findAll(options: JobTitleQueryOptions): Promise<{
    data: JobTitleEntity[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    this.logger.log(`Finding job titles with options: ${JSON.stringify(options)}`);

    const page = options.page || 1;
    const pageSize = options.pageSize || 20;

    const [data, total] = await Promise.all([
      this.jobTitleRepository.findAll(options),
      this.jobTitleRepository.count(options),
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

