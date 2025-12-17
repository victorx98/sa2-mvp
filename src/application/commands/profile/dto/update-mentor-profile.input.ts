/**
 * Application Layer - Update Mentor Profile Use Case Input
 * 职责：定义更新导师档案用例的输入参数（业务语义，不依赖 HTTP/API）
 * 
 * 设计原则：
 * ✅ 业务语义清晰
 * ✅ 不包含 HTTP 特定字段（如 @ApiProperty）
 * ✅ 可被多种接口协议复用（HTTP, GraphQL, RPC, Message Queue）
 */
import { Gender, Country } from "@shared/types/identity-enums";

export interface UpdateMentorProfileInput {
  // User 基础信息
  nameEn?: string;
  nameZh?: string;
  gender?: Gender;
  country?: Country;

  // Mentor Profile 信息
  status?: string;
  type?: string | null;
  company?: string | null;
  companyTitle?: string | null;
  briefIntro?: string | null;
  highSchool?: string | null;
  location?: string | null;
  level?: string | null;
  rating?: number | null;
  underCollege?: string | null;
  underMajor?: string | null;
  graduateCollege?: string | null;
  graduateMajor?: string | null;
}

