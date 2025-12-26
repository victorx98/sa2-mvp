/**
 * Mentor Query Adapter
 * 导师查询适配器
 */
import { Injectable } from '@nestjs/common';
import { IPaginatedResult } from '@shared/types/paginated-result';
import { IMentorQueryRepository } from '../../interfaces/identity-query.repository.interface';
import { MentorQueryService } from '@domains/query/services/mentor-query.service';

@Injectable()
export class MentorQueryAdapter implements IMentorQueryRepository {
  constructor(
    private readonly mentorQueryService: MentorQueryService,
  ) {}

  async listMentors(params: any): Promise<IPaginatedResult<any>> {
    const mentors = await this.mentorQueryService.findAll(params?.keyword);
    return {
      data: mentors,
      total: mentors.length,
      page: params?.page || 1,
      pageSize: params?.pageSize || mentors.length,
      totalPages: 1
    };
  }

  async getMentorItem(mentorId: string): Promise<any> {
    // 使用 findAll 并过滤结果
    const mentors = await this.mentorQueryService.findAll();
    return mentors.find(mentor => mentor.id === mentorId) || null;
  }

  async getMentorProfile(mentorId: string): Promise<any> {
    // 使用 findAll 并过滤结果
    const mentors = await this.mentorQueryService.findAll();
    return mentors.find(mentor => mentor.id === mentorId) || null;
  }
}

