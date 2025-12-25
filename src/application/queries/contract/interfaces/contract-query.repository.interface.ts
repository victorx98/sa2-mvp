/**
 * Contract Query Repository Interface
 * 合同查询仓储接口
 */
import { IPaginatedResult } from '@shared/types/paginated-result';
import { StudentContractReadModel, ServiceConsumptionReadModel } from '../models/contract-read.model';
import { GetStudentContractsDto, GetServiceConsumptionDto } from '../dto/contract-query.dto';

/**
 * DI Token for Contract Query Repository
 */
export const CONTRACT_QUERY_REPOSITORY = Symbol('CONTRACT_QUERY_REPOSITORY');

/**
 * Contract Query Repository Interface
 */
export interface IContractQueryRepository {
  /**
   * Get student contracts with pagination
   * 
   * @param dto - Query input
   * @returns Paginated contract results
   */
  getStudentContracts(dto: GetStudentContractsDto): Promise<IPaginatedResult<StudentContractReadModel>>;

  /**
   * Get service type consumption records
   * 
   * @param dto - Query input
   * @returns Paginated consumption records
   */
  getServiceTypeConsumptionRecords(dto: GetServiceConsumptionDto): Promise<IPaginatedResult<ServiceConsumptionReadModel>>;
}

