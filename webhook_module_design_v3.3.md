# Webhook Module 设计文档 v3.3

**文档版本**: v3.3  
**更新日期**: 2025-11-12  
**范围**: Webhook Module 模块专项文档  
**阅读时间**: 5分钟

---

## 📂 1. 目录结构

```
webhook/
├── controllers/
│   └── webhook-gateway.controller.ts     # HTTP入口
├── services/
│   └── webhook-verification.service.ts   # 签名验证
├── handlers/
│   ├── feishu-webhook.handler.ts         # 飞书事件处理
│   ├── zoom-webhook.handler.ts           # Zoom事件处理
│   └── webhook-handler.registry.ts       # Handler注册表
├── extractors/
│   ├── feishu-event-extractor.ts         # 飞书事件字段提取
│   └── zoom-event-extractor.ts           # Zoom事件字段提取
└── dto/
    └── webhook-event.dto.ts              # Webhook事件DTO
```

---

## 🌐 2. WebhookGatewayController

**文件**: `src/core/webhook/controllers/webhook-gateway.controller.ts`

**职责**: 接收第三方平台webhook请求，统一入口

| 路由 | 方法 | 参数 | 返回值 | 说明 |
|-----|-----|-----|-------|------|
| `/webhooks/feishu` | POST | Request | { success: boolean } | 接收飞书webhook |
| `/webhooks/zoom` | POST | Request | { success: boolean } | 接收Zoom webhook |

**处理流程**:

| 步骤 | 操作 | 说明 |
|-----|------|------|
| 1 | 接收HTTP请求 | 获取原始body和headers |
| 2 | 调用验证服务 | WebhookVerificationService.verify() |
| 3 | 验证失败 | 返回401 Unauthorized |
| 4 | 验证成功 | 路由到对应的Handler |
| 5 | 返回响应 | 返回200（快速响应，不等业务处理完） |

---

## 🔐 3. WebhookVerificationService

**文件**: `src/core/webhook/services/webhook-verification.service.ts`

**职责**: 验证webhook签名和token，确保请求来自官方平台

### 3.1 飞书签名验证

| 方法 | 参数 | 返回值 | 说明 |
|-----|-----|-------|------|
| `verifyFeishuSignature(request)` | Request | boolean | 验证飞书webhook签名 |

**验证逻辑**:

| 步骤 | 操作 | 说明 |
|-----|------|------|
| 1 | 获取时间戳 | request.headers['X-Lark-Request-Timestamp'] |
| 2 | 获取签名 | request.headers['X-Lark-Signature'] |
| 3 | 计算签名 | SHA256(timestamp + nonce + encrypt_key + body) |
| 4 | 对比签名 | 计算签名 === 接收签名 |
| 5 | 验证时间戳 | 防重放攻击（5分钟内有效） |

### 3.2 Zoom签名验证

| 方法 | 参数 | 返回值 | 说明 |
|-----|-----|-------|------|
| `verifyZoomSignature(request)` | Request | boolean | 验证Zoom webhook签名 |

**验证逻辑**:

| 步骤 | 操作 | 说明 |
|-----|------|------|
| 1 | 获取签名 | request.headers['x-zm-signature'] |
| 2 | 获取时间戳 | request.headers['x-zm-request-timestamp'] |
| 3 | 计算HMAC | HMAC-SHA256(secret_token, timestamp + body) |
| 4 | 对比签名 | Base64(HMAC) === 接收签名 |

---

## 📨 4. FeishuWebhookHandler

**文件**: `src/core/webhook/handlers/feishu-webhook.handler.ts`

**职责**: 处理飞书webhook事件，提取字段，存储，发布事件

| 方法 | 参数 | 返回值 | 说明 |
|-----|-----|-------|------|
| `handle(rawEvent)` | 飞书原始event | Promise<void> | 主入口，路由到具体handler |
| `handleMeetingStarted(event)` | 提取后的event | Promise<void> | 处理会议开始事件 |
| `handleMeetingEnded(event)` | 提取后的event | Promise<void> | 处理会议结束事件 |
| `handleJoinMeeting(event)` | 提取后的event | Promise<void> | 处理参会者加入事件 |
| `handleLeaveMeeting(event)` | 提取后的event | Promise<void> | 处理参会者离开事件 |
| `handleRecordingReady(event)` | 提取后的event | Promise<void> | 处理录制就绪事件 |
| `handleRecordingStarted(event)` | 提取后的event | Promise<void> | 处理录制开始事件 |
| `handleRecordingEnded(event)` | 提取后的event | Promise<void> | 处理录制结束事件 |
| `handleShareStarted(event)` | 提取后的event | Promise<void> | 处理屏幕共享开始事件 |
| `handleShareEnded(event)` | 提取后的event | Promise<void> | 处理屏幕共享结束事件 |

**处理流程（以会议开始为例）**:

| 步骤 | 操作 | 组件 |
|-----|------|------|
| 1 | 提取通用字段 | FeishuEventExtractor.extract() |
| 2 | 去重检查 | MeetingEventService.findByEventId() |
| 3 | 存储event | MeetingEventService.recordEvent() |
| 4 | 发布领域事件 | EventBus.publish(MeetingEventCreated) |

---

## 🔧 5. FeishuEventExtractor

**文件**: `src/core/webhook/extractors/feishu-event-extractor.ts`

**职责**: 从飞书原始webhook数据中提取结构化字段

| 方法 | 参数 | 返回值 | 说明 |
|-----|-----|-------|------|
| `extract(rawEvent)` | 飞书原始event | ExtractedMeetingEventData | 提取所有通用字段 |
| `extractMeetingId(data)` | event.meeting | string | 提取meeting_id |
| `extractMeetingNo(data)` | event.meeting | string \| null | 提取meeting_no（飞书9位数字） |
| `extractEventId(header)` | event.header | string | 提取event_id（唯一标识） |
| `extractEventType(header)` | event.header | string | 提取event_type |
| `extractOperatorId(operator)` | event.operator | string \| null | 提取operator_id（优先user_id，后open_id） |
| `extractOperatorRole(operator)` | event.operator | number \| null | 提取operator_role（1=主持人, 2=参与者） |
| `extractOccurredAt(header)` | event.header.create_time | DateTime | 提取事件发生时间（毫秒转秒） |

**提取字段映射表**:

| 飞书原始路径 | 目标字段 | 数据转换 |
|-----------|---------|---------|
| `event.meeting.id` | meetingId | 直接取值 |
| `event.meeting.meeting_no` | meetingNo | 直接取值 |
| `header.event_id` | eventId | 直接取值 |
| `header.event_type` | eventType | 直接取值 |
| `event.operator.id.user_id` | operatorId | 优先user_id，后open_id |
| `event.operator.user_role` | operatorRole | 直接取值 |
| `event.meeting.topic` | meetingTopic | 直接取值 |
| `event.meeting.start_time` | meetingStartTime | Unix秒→DateTime |
| `event.meeting.end_time` | meetingEndTime | Unix秒→DateTime |
| `header.create_time` | occurredAt | 毫秒→秒，Unix→DateTime |

---

## 📨 6. ZoomWebhookHandler

**文件**: `src/core/webhook/handlers/zoom-webhook.handler.ts`

**职责**: 处理Zoom webhook事件

| 方法 | 参数 | 返回值 | 说明 |
|-----|-----|-------|------|
| `handle(rawEvent)` | Zoom原始event | Promise<void> | 主入口，路由到具体handler |
| `handleMeetingStarted(event)` | 提取后的event | Promise<void> | 处理会议开始事件 |
| `handleMeetingEnded(event)` | 提取后的event | Promise<void> | 处理会议结束事件 |
| `handleParticipantJoined(event)` | 提取后的event | Promise<void> | 处理参会者加入事件 |
| `handleParticipantLeft(event)` | 提取后的event | Promise<void> | 处理参会者离开事件 |

---

## 🔧 7. ZoomEventExtractor

**文件**: `src/core/webhook/extractors/zoom-event-extractor.ts`

**职责**: 从Zoom原始webhook数据中提取结构化字段

| 方法 | 参数 | 返回值 | 说明 |
|-----|-----|-------|------|
| `extract(rawEvent)` | Zoom原始event | ExtractedMeetingEventData | 提取所有通用字段 |
| `extractMeetingId(payload)` | event.payload.object | string | 提取meeting_id |
| `extractEventId(event)` | event.event_ts + meeting_id | string | 生成唯一event_id |
| `extractEventType(event)` | event.event | string | 提取event_type |

**提取字段映射表**:

| Zoom原始路径 | 目标字段 | 数据转换 |
|------------|---------|---------|
| `payload.object.id` | meetingId | 直接取值 |
| `event_ts + meeting_id` | eventId | 组合生成 |
| `event` | eventType | 直接取值 |
| `payload.object.host_id` | operatorId | 直接取值 |
| `payload.object.topic` | meetingTopic | 直接取值 |
| `payload.object.start_time` | meetingStartTime | ISO 8601→DateTime |
| `event_ts` | occurredAt | Unix秒→DateTime |

---

## 📋 8. 支持的飞书事件类型

| Event Type | 事件名称 | 说明 | 关键数据 |
|-----------|---------|------|---------|
| `vc.meeting.meeting_started_v1` | 会议开始 | 会议正式开始 | meeting_id, occurred_at |
| `vc.meeting.meeting_ended_v1` | 会议结束 | 会议正式结束 | meeting_id, occurred_at |
| `vc.meeting.join_meeting_v1` | 参会者加入 | 用户进入会议 | meeting_id, operator_id, occurred_at |
| `vc.meeting.leave_meeting_v1` | 参会者离开 | 用户离开会议 | meeting_id, operator_id, occurred_at |
| `vc.meeting.recording_started_v1` | 录制开始 | 开始录制 | meeting_id, operator_id, occurred_at |
| `vc.meeting.recording_ended_v1` | 录制结束 | 结束录制 | meeting_id, occurred_at |
| `vc.meeting.recording_ready_v1` | 录制就绪 | 录制文件可下载 | meeting_id, recording_id, recording_url |
| `vc.meeting.share_started_v1` | 屏幕共享开始 | 开始屏幕共享 | meeting_id, operator_id, occurred_at |
| `vc.meeting.share_ended_v1` | 屏幕共享结束 | 结束屏幕共享 | meeting_id, operator_id, occurred_at |

---

## 📋 9. 支持的Zoom事件类型

| Event Type | 事件名称 | 说明 | 关键数据 |
|-----------|---------|------|---------|
| `meeting.started` | 会议开始 | 会议正式开始 | meeting_id, start_time |
| `meeting.ended` | 会议结束 | 会议正式结束 | meeting_id, end_time |
| `meeting.participant_joined` | 参会者加入 | 用户进入会议 | meeting_id, participant_user_id |
| `meeting.participant_left` | 参会者离开 | 用户离开会议 | meeting_id, participant_user_id |
| `recording.completed` | 录制完成 | 录制文件可用 | meeting_id, recording_files |

---

## 🔄 10. 完整处理流程

```
飞书/Zoom平台
    ↓ (发送HTTP POST请求)
WebhookGatewayController
    ↓ (接收请求)
WebhookVerificationService.verify()
    ↓ (验证签名)
    成功 → 继续
    失败 → 返回401
    ↓
路由到对应Handler
    FeishuWebhookHandler / ZoomWebhookHandler
    ↓
FeishuEventExtractor.extract()
    提取通用字段:
    - meeting_id, meeting_no
    - event_id (唯一标识)
    - event_type
    - operator_id, operator_role
    - meeting_topic
    - occurred_at
    ↓
MeetingEventService.recordEvent()
    ↓
    1. findByEventId() 去重检查
    2. 如果已存在 → 直接返回（幂等性）
    3. 如果不存在 → create() 保存到meeting_event表
    ↓
EventBus.publish(MeetingEventCreated)
    ↓
    ├→ Session Domain（订阅者）
    │  - 根据meeting_no查询session
    │  - 找到 → 处理业务逻辑
    │  - 找不到 → 忽略
    │
    ├→ Comm Session Domain（订阅者）
    │  - 根据meeting_no查询comm_session
    │  - 找到 → 处理业务逻辑
    │  - 找不到 → 忽略
    │
    └→ Class Session Domain（订阅者）
       - 根据meeting_no查询class_session
       - 找到 → 处理业务逻辑
       - 找不到 → 忽略
    ↓
返回200 OK（快速响应）
```

---

## 🎯 11. MeetingEventCreated 领域事件

**文件**: `src/core/meeting-providers/dto/meeting-event-created.event.ts`

**说明**: Webhook Module发布的领域事件，供各Domain订阅

| 字段 | 类型 | 说明 |
|-----|-----|------|
| `meetingId` | string | 会议ID |
| `meetingNo` | string | 飞书会议号（关键字段，用于各Domain查询） |
| `eventId` | string | 事件ID |
| `eventType` | string | 事件类型 |
| `provider` | string | 'feishu' \| 'zoom' |
| `operatorId` | string \| null | 操作者ID |
| `operatorRole` | number \| null | 操作者角色 |
| `meetingTopic` | string \| null | 会议主题 |
| `occurredAt` | DateTime | 事件发生时间 |
| `eventData` | object | 完整原始数据（供特殊场景使用） |

---

## 🔗 12. 与其他模块的关系

| 模块 | 交互方式 | 说明 |
|-----|--------|------|
| **Meeting Providers Module** | 调用 | 调用MeetingEventService存储event |
| **Session Domain** | 发布事件 | 发布MeetingEventCreated供订阅 |
| **Comm Session Domain** | 发布事件 | 发布MeetingEventCreated供订阅 |
| **Class Session Domain** | 发布事件 | 发布MeetingEventCreated供订阅 |

---

## ⚙️ 13. 配置管理

| 配置项 | 说明 | 用途 |
|-------|------|------|
| `FEISHU_WEBHOOK_SECRET` | 飞书webhook密钥 | 签名验证 |
| `FEISHU_VERIFICATION_TOKEN` | 飞书验证token | Token验证 |
| `ZOOM_WEBHOOK_SECRET` | Zoom webhook密钥 | 签名验证 |
| `WEBHOOK_TIMESTAMP_TOLERANCE` | 时间戳容差（秒） | 防重放攻击（默认300秒） |

---

## 🎯 14. 错误处理

| 错误类型 | HTTP状态码 | 处理方式 |
|---------|-----------|---------|
| 签名验证失败 | 401 | 返回错误，飞书/Zoom不会重试 |
| Token验证失败 | 401 | 返回错误，飞书/Zoom不会重试 |
| 时间戳过期 | 401 | 返回错误，防重放攻击 |
| 事件已处理（重复） | 200 | 返回成功（幂等性） |
| 存储失败 | 500 | 返回错误，飞书/Zoom会重试 |
| 发布事件失败 | 200 | 记录日志，返回成功（异步补偿） |

---

## 📊 15. 性能考虑

| 优化项 | 方案 | 说明 |
|-------|------|------|
| **快速响应** | 先存储，后发布，立即返回200 | Webhook要求5秒内响应 |
| **幂等性** | event_id去重 | 防止重复处理 |
| **异步处理** | 事件发布不阻塞响应 | 业务逻辑异步执行 |
| **批量处理** | 事件发布并发到多个订阅者 | 提高处理效率 |

---

**文档结束 | 版本 v3.3**

