import { Injectable, Inject } from '@nestjs/common';
import { IPaginatedResult } from '@shared/types/paginated-result';
import { QueryClassesDto } from '../dto/class-query.dto';
import { ClassReadModel } from '../models/class-read.model';
import { IClassQueryRepository, CLASS_QUERY_REPOSITORY } from '../interfaces/class-query.repository.interface';

@Injectable()
export class GetClassesUseCase {
  constructor(
    @Inject(CLASS_QUERY_REPOSITORY)
    private readonly classQueryRepository: IClassQueryRepository,
  ) {}

  async execute(dto: QueryClassesDto): Promise<IPaginatedResult<ClassReadModel>> {
    return this.classQueryRepository.queryClasses(dto);
  }
}
