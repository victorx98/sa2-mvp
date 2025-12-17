/**
 * Shared Auth Types
 * 职责：定义认证相关的共享类型（纯 TypeScript interface，无任何框架依赖）
 * 
 * 设计原则：
 * ✅ 纯 TypeScript interface，不包含任何装饰器
 * ✅ 不依赖 class-validator、@nestjs/swagger 等框架
 * ✅ 可被多种接口协议复用（HTTP, GraphQL, gRPC, Message Queue）
 * ✅ API DTO 和 Application Command 都基于此类型
 */
import { Gender, Country } from "@shared/types/identity-enums";

// ============================================================================
// Input Types (输入类型)
// ============================================================================

/**
 * 用户注册输入
 */
export interface RegisterInput {
  email: string;
  password: string;
  nameEn: string;
  nameZh: string;
  gender?: Gender;
  country?: Country;
  role: string;
}

/**
 * 用户登录输入
 */
export interface LoginInput {
  email: string;
  password: string;
}

// ============================================================================
// Output Types (输出类型)
// ============================================================================

/**
 * 用户档案输出
 */
export interface UserProfile {
  id: string;
  email: string;
  nameEn?: string;
  nameZh?: string;
  status?: string;
  roles: string[];
}

/**
 * 认证结果输出
 */
export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
  user: UserProfile;
}

