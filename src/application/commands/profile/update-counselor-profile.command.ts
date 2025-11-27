import { Injectable, Logger } from "@nestjs/common";
import { CounselorProfileService } from "@domains/identity/counselor/counselor-profile.service";
import { UpdateCounselorProfileDto } from "@api/dto/request/update-counselor-profile.dto";

/**
 * Application Layer - Update Counselor Profile Command
 * 职责：
 * 1. 编排更新咨询师档案用例
 * 2. 调用 Domain 层服务
 * 3. 返回业务数据
 */
@Injectable()
export class UpdateCounselorProfileCommand {
  private readonly logger = new Logger(UpdateCounselorProfileCommand.name);

  constructor(
    private readonly counselorProfileService: CounselorProfileService,
  ) {}

  async execute(
    userId: string,
    dto: UpdateCounselorProfileDto,
  ): Promise<void> {
    this.logger.log(`Updating counselor profile for user: ${userId}`);

    await this.counselorProfileService.update(
      userId,
      {
        status: dto.status,
      },
      userId, // updatedBy
    );
  }
}

