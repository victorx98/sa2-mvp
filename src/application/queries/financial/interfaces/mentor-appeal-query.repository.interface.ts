/**
 * Mentor Appeal Query Repository Interface
 * 导师申诉查询仓储接口
 */
import { IPaginatedResult } from '@shared/types/paginated-result';
import { MentorAppealReadModel } from '../models/mentor-appeal-read.model';
import { ListMentorAppealsDto } from '../dto/list-mentor-appeals.dto';

/**
 * DI Token for Mentor Appeal Query Repository
 */
export const MENTOR_APPEAL_QUERY_REPOSITORY = Symbol('MENTOR_APPEAL_QUERY_REPOSITORY');

/**
 * Mentor Appeal Query Repository Interface
 */
export interface IMentorAppealQueryRepository {
  /**
   * List mentor appeals with filters, pagination and sorting
   * 
   * @param dto - Query input
   * @returns Paginated mentor appeal results
   */
  listMentorAppeals(dto: ListMentorAppealsDto): Promise<IPaginatedResult<MentorAppealReadModel>>;
}

