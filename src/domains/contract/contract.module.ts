import { Module } from "@nestjs/common";
import { ContractService } from "./contract.service";

/**
 * Contract Module (临时实现)
 * 提供合同管理服务
 */
@Module({
  providers: [ContractService],
  exports: [ContractService],
})
export class ContractModule {}
