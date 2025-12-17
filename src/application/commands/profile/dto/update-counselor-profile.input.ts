/**
 * Application Layer - Update Counselor Profile Use Case Input
 * 职责：定义更新咨询师档案用例的输入参数（业务语义，不依赖 HTTP/API）
 * 
 * 设计原则：
 * ✅ 业务语义清晰
 * ✅ 不包含 HTTP 特定字段（如 @ApiProperty）
 * ✅ 可被多种接口协议复用（HTTP, GraphQL, RPC, Message Queue）
 */
export interface UpdateCounselorProfileInput {
  status?: string;
}

