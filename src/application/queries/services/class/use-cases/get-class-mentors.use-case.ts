import { Injectable, Inject } from '@nestjs/common';
import { GetClassMembersDto } from '../dto/class-query.dto';
import { ClassMemberReadModel } from '../models/class-read.model';
import { IClassQueryRepository, CLASS_QUERY_REPOSITORY } from '../interfaces/class-query.repository.interface';

@Injectable()
export class GetClassMentorsUseCase {
  constructor(
    @Inject(CLASS_QUERY_REPOSITORY)
    private readonly classQueryRepository: IClassQueryRepository,
  ) {}

  async execute(dto: GetClassMembersDto): Promise<ClassMemberReadModel[]> {
    return this.classQueryRepository.getClassMentorsWithNames(dto);
  }
}
