/**
 * Application Layer - Update Student Profile Use Case Input
 * 职责：定义更新学生档案用例的输入参数（业务语义，不依赖 HTTP/API）
 * 
 * 设计原则：
 * ✅ 业务语义清晰
 * ✅ 不包含 HTTP 特定字段（如 @ApiProperty）
 * ✅ 可被多种接口协议复用（HTTP, GraphQL, RPC, Message Queue）
 */
import { Gender, Country } from "@shared/types/identity-enums";

export interface UpdateStudentProfileInput {
  // User 基础信息
  nameEn?: string;
  nameZh?: string;
  gender?: Gender;
  country?: Country;

  // Student Profile 信息
  status?: string;
  highSchool?: string | null;
  underCollege?: string | null;
  underMajor?: string | null;
  graduateCollege?: string | null;
  graduateMajor?: string | null;
  aiResumeSummary?: string | null;
  customerImportance?: string | null;
  underGraduationDate?: string | null;
  graduateGraduationDate?: string | null;
  grades?: string | null;
}

