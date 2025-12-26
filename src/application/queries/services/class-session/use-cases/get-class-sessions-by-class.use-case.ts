import { Injectable, Inject } from '@nestjs/common';
import { IClassSessionQueryRepository, CLASS_SESSION_QUERY_REPOSITORY, ClassSessionQueryDto } from '../interfaces/class-session-query.repository.interface';
import { ClassSessionReadModel } from '../interfaces/class-session-query.repository.interface';

@Injectable()
export class GetClassSessionsByClassUseCase {
  constructor(
    @Inject(CLASS_SESSION_QUERY_REPOSITORY)
    private readonly classSessionQueryRepository: IClassSessionQueryRepository,
  ) {}

  async execute(classId: string, filters?: ClassSessionQueryDto): Promise<ClassSessionReadModel[]> {
    return this.classSessionQueryRepository.getSessionsByClass(classId, filters);
  }
}
