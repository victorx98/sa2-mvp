/**
 * Application Layer - Register Use Case Input
 * 职责：定义注册用例的输入参数（业务语义，不依赖 HTTP/API）
 * 
 * 设计原则：
 * ✅ 业务语义清晰
 * ✅ 不包含 HTTP 特定字段（如 @ApiProperty）
 * ✅ 可被多种接口协议复用（HTTP, GraphQL, RPC, Message Queue）
 */
import { Gender, Country } from "@shared/types/identity-enums";

export interface RegisterInput {
  email: string;
  password: string;
  nameEn: string;
  nameZh: string;
  gender?: Gender;
  country?: Country;
  role: string;
}

