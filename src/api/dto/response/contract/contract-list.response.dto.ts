import { ApiProperty } from '@nestjs/swagger';
import { StudentContractResponseDto } from './contract.response.dto';

/**
 * Paginated contract list response DTO [分页合同列表响应DTO]
 */
export class ContractListResponseDto {
  @ApiProperty({
    description: 'Contract list data [合同列表数据]',
    type: [StudentContractResponseDto],
    isArray: true,
  })
  data!: StudentContractResponseDto[];

  @ApiProperty({
    description: 'Total number of records [总记录数]',
    example: 150,
  })
  total!: number;

  @ApiProperty({
    description: 'Current page number [当前页码]',
    example: 1,
  })
  page!: number;

  @ApiProperty({
    description: 'Number of items per page [每页条数]',
    example: 20,
  })
  pageSize!: number;

  @ApiProperty({
    description: 'Total number of pages [总页数]',
    example: 8,
  })
  totalPages!: number;
}
