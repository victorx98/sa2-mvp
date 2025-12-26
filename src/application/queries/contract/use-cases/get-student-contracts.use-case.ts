/**
 * Get Student Contracts Use Case
 * 学生合同查询用例
 */
import { Inject, Injectable } from '@nestjs/common';
import { IPaginatedResult } from '@shared/types/paginated-result';
import { IContractQueryRepository, CONTRACT_QUERY_REPOSITORY } from '../interfaces/contract-query.repository.interface';
import { StudentContractReadModel } from '../models/contract-read.model';
import { GetStudentContractsDto } from '../dto/contract-query.dto';

@Injectable()
export class GetStudentContractsUseCase {
  constructor(
    @Inject(CONTRACT_QUERY_REPOSITORY)
    private readonly contractQueryRepository: IContractQueryRepository,
  ) {}

  async execute(dto: GetStudentContractsDto): Promise<IPaginatedResult<StudentContractReadModel>> {
    return this.contractQueryRepository.getStudentContracts(dto);
  }
}

