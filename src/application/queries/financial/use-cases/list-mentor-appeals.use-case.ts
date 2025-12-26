/**
 * List Mentor Appeals Use Case
 * 导师申诉列表查询用例
 */
import { Inject, Injectable } from '@nestjs/common';
import { IPaginatedResult } from '@shared/types/paginated-result';
import { IMentorAppealQueryRepository, MENTOR_APPEAL_QUERY_REPOSITORY } from '../interfaces/mentor-appeal-query.repository.interface';
import { MentorAppealReadModel } from '../models/mentor-appeal-read.model';
import { ListMentorAppealsDto } from '../dto/list-mentor-appeals.dto';

@Injectable()
export class ListMentorAppealsUseCase {
  constructor(
    @Inject(MENTOR_APPEAL_QUERY_REPOSITORY)
    private readonly mentorAppealQueryRepository: IMentorAppealQueryRepository,
  ) {}

  async execute(dto: ListMentorAppealsDto): Promise<IPaginatedResult<MentorAppealReadModel>> {
    return this.mentorAppealQueryRepository.listMentorAppeals(dto);
  }
}

