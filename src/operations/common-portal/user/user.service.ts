import { Injectable } from "@nestjs/common";
import { UserQueryService } from "@application/queries/user-query.service";
import { UserResponseDto } from "./dto/user-response.dto";
import { User } from "@domains/identity/user/user.interface";

/**
 * BFF Layer - User Service
 * 职责：
 * 1. 调用 Application Layer 的查询服务
 * 2. 将业务实体转换为前端特定格式
 * 3. 添加前端需要的展示字段（如状态文本、颜色等）
 *
 * 设计原则：
 * ✅ 只注入 Application Layer 的 Service
 * ❌ 不直接注入 Domain Service
 * ✅ 返回前端特定格式（Response DTO）
 */
@Injectable()
export class UserBffService {
  constructor(
    // ✅ 只注入 Application Layer
    private readonly userQueryService: UserQueryService,
  ) {}

  /**
   * 获取当前用户信息
   */
  async getCurrentUser(userId: string): Promise<UserResponseDto> {
    // 1. 调用 Application Layer 获取业务数据
    const user = await this.userQueryService.getUserById(userId);

    // 2. 转换为前端特定格式
    return this.transformUserToResponse(user);
  }

  /**
   * 根据ID获取用户信息
   */
  async getUserById(userId: string): Promise<UserResponseDto> {
    // 1. 调用 Application Layer 获取业务数据
    const user = await this.userQueryService.getUserById(userId);

    // 2. 转换为前端特定格式
    return this.transformUserToResponse(user);
  }

  // ===== 私有方法：数据转换 =====

  /**
   * 将业务实体转换为前端响应格式
   */
  private transformUserToResponse(user: User): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      cnNickname: user.cnNickname,
      status: user.status,
      // 前端特定字段
      statusText: this.getStatusText(user.status),
      statusColor: this.getStatusColor(user.status),
      displayName: this.getDisplayName(user),
      avatar: this.getAvatarUrl(user),
      actions: this.getAvailableActions(user),
    };
  }

  /**
   * 获取状态显示文本
   */
  private getStatusText(status: string): string {
    const statusMap: Record<string, string> = {
      active: "活跃",
      inactive: "未激活",
      suspended: "已暂停",
      deleted: "已删除",
    };
    return statusMap[status] || status;
  }

  /**
   * 获取状态颜色标记
   */
  private getStatusColor(status: string): string {
    const colorMap: Record<string, string> = {
      active: "green",
      inactive: "gray",
      suspended: "orange",
      deleted: "red",
    };
    return colorMap[status] || "gray";
  }

  /**
   * 获取显示名称（优先显示中文昵称）
   */
  private getDisplayName(user: User): string {
    return user.cnNickname || user.nickname || user.email.split("@")[0];
  }

  /**
   * 获取头像URL（如果没有则返回默认头像）
   */
  private getAvatarUrl(user: User): string {
    // 这里可以从user对象中获取avatarUrl字段
    // 如果没有，返回默认头像
    return "/assets/default-avatar.png";
  }

  /**
   * 获取可用操作
   */
  private getAvailableActions(user: User): Array<{
    label: string;
    action: string;
    icon?: string;
  }> {
    const actions = [];

    if (user.status === "active") {
      actions.push({
        label: "编辑资料",
        action: "edit_profile",
        icon: "edit",
      });
      actions.push({
        label: "修改密码",
        action: "change_password",
        icon: "lock",
      });
    }

    return actions;
  }
}
