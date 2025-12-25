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
    return this.mentorQueryService.listMentors(params);
  }

  async getMentorProfile(mentorId: string): Promise<any> {
    return this.mentorQueryService.getMentorItem(mentorId);
  }
}

