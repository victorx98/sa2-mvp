# Meeting Provider Module 设计文档 v3.3

**文档版本**: v3.3  
**更新日期**: 2025-11-12  
**范围**: Meeting Provider 模块专项文档  
**阅读时间**: 5分钟

---

## 📂 1. 目录结构

```
meeting-providers/
├── interfaces/
│   └── meeting-provider.interface.ts     # IMeetingProvider接口
├── factory/
│   └── meeting-provider.factory.ts       # 工厂类
├── feishu/
│   ├── feishu-meeting.adapter.ts         # 飞书适配器
│   └── feishu-meeting.client.ts          # 飞书API客户端
├── zoom/
│   ├── zoom-meeting.adapter.ts           # Zoom适配器
│   └── zoom-meeting.client.ts            # Zoom API客户端
├── services/
│   └── meeting-event.service.ts          # Meeting Event存储服务
├── repositories/
│   └── meeting-event.repository.ts       # Meeting Event数据访问
└── dto/
    ├── create-meeting.dto.ts             # 创建会议DTO
    ├── meeting-info.dto.ts               # 会议信息DTO
    └── meeting-event-created.event.ts    # 领域事件
```

---

## 🏗️ 2. IMeetingProvider 接口

**文件**: `src/core/meeting-providers/interfaces/meeting-provider.interface.ts`

| 方法 | 参数 | 返回值 | 说明 |
|-----|-----|-------|------|
| `createMeeting(input)` | CreateMeetingInput | MeetingInfo | 创建会议，返回meeting_id、meeting_url等 |
| `updateMeeting(meetingId, input)` | meetingId: string, UpdateMeetingInput | boolean | 更新会议时间或设置 |
| `cancelMeeting(meetingId)` | meetingId: string | boolean | 取消会议 |
| `getMeetingInfo(meetingId)` | meetingId: string | MeetingInfo | 获取会议详情 |

---

## 📝 3. CreateMeetingInput DTO

**文件**: `src/core/meeting-providers/dto/create-meeting.dto.ts`

| 字段 | 类型 | 必填 | 说明 | 示例值 | 飞书字段映射 | Zoom字段映射 |
|-----|-----|-----|------|-------|------------|------------|
| `topic` | String | 是 | 会议主题 | "系统设计面试辅导" | topic | topic |
| `start_time` | DateTime | 是 | 开始时间 | "2025-11-10T14:00:00Z" | start_time | start_time |
| `duration` | Integer | 是 | 时长（分钟） | 60 | end_time（计算得出） | duration |
| `host_user_id` | String | 否 | 主持人的平台用户ID | "ou_xxx" | owner_id | host_id |
| `auto_record` | Boolean | 否 | 是否自动录制 | true | auto_record_type | auto_recording |
| `enable_waiting_room` | Boolean | 否 | 是否启用等候室 | false | （不支持） | waiting_room |
| `participant_join_early` | Boolean | 否 | 参会者是否可提前进入 | true | allow_attendees_start | join_before_host |

---

## 📤 4. MeetingInfo 返回值

**文件**: `src/core/meeting-providers/dto/meeting-info.dto.ts`

| 字段 | 类型 | 说明 | 飞书示例 | Zoom示例 |
|-----|-----|------|---------|---------|
| `provider` | String | 会议平台 | "feishu" | "zoom" |
| `meeting_no` | String \| null | 会议号（飞书9位数字，Zoom为空） | "123456789" | null |
| `meeting_url` | String | 会议链接 | "https://vc.feishu.cn/j/123456789" | "https://zoom.us/j/..." |
| `meeting_password` | String \| null | 会议密码 | null（飞书无密码） | "abc123" |
| `host_join_url` | String \| null | 主持人专用链接 | null | "https://zoom.us/s/..." |
| `start_time` | DateTime | 开始时间 | "2025-11-10T14:00:00Z" | "2025-11-10T14:00:00Z" |
| `duration` | Integer | 时长（分钟） | 60 | 60 |

---

## 🔧 5. FeishuMeetingAdapter

**文件**: `src/core/meeting-providers/feishu/feishu-meeting.adapter.ts`

| 方法 | 参数 | 返回值 | 说明 |
|-----|-----|-------|------|
| `createMeeting(input)` | CreateMeetingInput | MeetingInfo | 调用飞书API创建会议 |
| `updateMeeting(meetingId, input)` | meetingId, input | boolean | 调用飞书API更新会议 |
| `cancelMeeting(meetingId)` | meetingId | boolean | 调用飞书API删除会议 |
| `getMeetingInfo(meetingId)` | meetingId | MeetingInfo | 调用飞书API获取会议信息 |

**实现要点**:
- 调用 `FeishuMeetingClient` 与飞书API交互
- 将 CreateMeetingInput 转换为飞书API格式
- 将飞书API响应转换为 MeetingInfo
- 错误处理和重试机制

---

## 🔧 6. ZoomMeetingAdapter

**文件**: `src/core/meeting-providers/zoom/zoom-meeting.adapter.ts`

| 方法 | 参数 | 返回值 | 说明 |
|-----|-----|-------|------|
| `createMeeting(input)` | CreateMeetingInput | MeetingInfo | 调用Zoom API创建会议 |
| `updateMeeting(meetingId, input)` | meetingId, input | boolean | 调用Zoom API更新会议 |
| `cancelMeeting(meetingId)` | meetingId | boolean | 调用Zoom API删除会议 |
| `getMeetingInfo(meetingId)` | meetingId | MeetingInfo | 调用Zoom API获取会议信息 |

**实现要点**:
- 调用 `ZoomMeetingClient` 与Zoom API交互
- 将 CreateMeetingInput 转换为Zoom API格式
- 将Zoom API响应转换为 MeetingInfo
- OAuth 2.0 认证处理

---

## 📱 7. FeishuMeetingClient

**文件**: `src/core/meeting-providers/feishu/feishu-meeting.client.ts`

| 方法 | 参数 | 返回值 | 说明 |
|-----|-----|-------|------|
| `post(endpoint, payload)` | endpoint: string, payload: object | object | 发送POST请求到飞书API |
| `get(endpoint, params)` | endpoint: string, params: object | object | 发送GET请求到飞书API |
| `delete(endpoint)` | endpoint: string | boolean | 发送DELETE请求到飞书API |

**认证方式**:
- 使用 `tenant_access_token` 认证
- Token从环境变量或缓存读取
- 自动刷新过期token

---

## 📱 8. ZoomMeetingClient

**文件**: `src/core/meeting-providers/zoom/zoom-meeting.client.ts`

| 方法 | 参数 | 返回值 | 说明 |
|-----|-----|-------|------|
| `post(endpoint, payload)` | endpoint: string, payload: object | object | 发送POST请求到Zoom API |
| `get(endpoint, params)` | endpoint: string, params: object | object | 发送GET请求到Zoom API |
| `delete(endpoint)` | endpoint: string | boolean | 发送DELETE请求到Zoom API |
| `patch(endpoint, payload)` | endpoint: string, payload: object | object | 发送PATCH请求到Zoom API |

**认证方式**:
- 使用 OAuth 2.0 授权
- JWT token 或 access_token 认证
- Token自动刷新机制

---

## 📊 9. MeetingEventService

**文件**: `src/core/meeting-providers/services/meeting-event.service.ts`

**职责**: 提供meeting_event表的存储服务，供Webhook Module调用

| 方法 | 参数 | 返回值 | 说明 |
|-----|-----|-------|------|
| `recordEvent(extractedData)` | ExtractedMeetingEventData | MeetingEvent | 记录会议事件（含去重检查） |
| `findByEventId(eventId)` | eventId: string | MeetingEvent \| null | 根据event_id查询（去重用） |
| `findByMeetingNo(meetingNo)` | meetingNo: string | MeetingEvent[] | 根据meeting_no查询所有事件 |

**ExtractedMeetingEventData 结构**:

| 字段 | 类型 | 说明 |
|-----|-----|------|
| `meetingId` | string | 飞书/Zoom会议ID |
| `meetingNo` | string | 飞书会议号 |
| `eventId` | string | 事件ID（唯一） |
| `provider` | string | 'feishu' \| 'zoom' |
| `eventType` | string | 事件类型 |
| `operatorId` | string \| null | 操作者ID |
| `operatorRole` | number \| null | 操作者角色 |
| `meetingTopic` | string \| null | 会议主题 |
| `meetingStartTime` | DateTime \| null | 会议开始时间 |
| `meetingEndTime` | DateTime \| null | 会议结束时间 |
| `eventData` | object | 完整原始数据 |
| `occurredAt` | DateTime | 事件发生时间 |

---

## 💾 10. MeetingEventRepository

**文件**: `src/core/meeting-providers/repositories/meeting-event.repository.ts`

**职责**: meeting_event表的CRUD操作（无业务逻辑）

| 方法 | 参数 | 返回值 | 说明 |
|-----|-----|-------|------|
| `create(data)` | InsertMeetingEvent | MeetingEvent | 创建meeting_event记录 |
| `findByEventId(eventId)` | eventId: string | MeetingEvent \| null | 根据event_id查询 |
| `findBySessionId(sessionId)` | sessionId: UUID | MeetingEvent[] | 查询session的所有事件 |
| `findByMeetingNo(meetingNo)` | meetingNo: string | MeetingEvent[] | 根据meeting_no查询 |
| `findJoinLeaveEvents(sessionId)` | sessionId: UUID | MeetingEvent[] | 查询join/leave事件（时长计算用） |

---

## 🏭 11. MeetingProviderFactory

**文件**: `src/core/meeting-providers/factory/meeting-provider.factory.ts`

| 方法 | 参数 | 返回值 | 说明 |
|-----|-----|-------|------|
| `getProvider(providerType)` | providerType: 'feishu' \| 'zoom' | IMeetingProvider | 根据类型返回对应实例 |
| `getDefaultProvider()` | - | IMeetingProvider | 返回默认Provider（从配置读取） |
| `registerProvider(type, provider)` | type: string, provider: IMeetingProvider | void | 注册自定义Provider（可选） |

**使用示例**:
```typescript
const factory = new MeetingProviderFactory();

// 获取特定平台的provider
const feishuProvider = factory.getProvider('feishu');
const zoomProvider = factory.getProvider('zoom');

// 获取默认provider
const defaultProvider = factory.getDefaultProvider();

// 创建会议
const meetingInfo = await defaultProvider.createMeeting({
  topic: "系统设计面试",
  start_time: new Date(),
  duration: 60
});
```

---

## 🔄 10. 工作流程

### 创建会议流程

```
BFF Layer: SessionController.createSession()
  ↓
1. 检查日历冲突
   CalendarService.isSlotAvailable()
  ↓
2. 获取Provider实例
   MeetingProviderFactory.getProvider(meeting_provider)
  ↓
3. 创建会议
   provider.createMeeting(CreateMeetingInput)
   ├─ FeishuMeetingAdapter.createMeeting()
   │  └─ FeishuMeetingClient.post('/v1/vc/meetings', payload)
   └─ ZoomMeetingAdapter.createMeeting()
      └─ ZoomMeetingClient.post('/v2/users/me/meetings', payload)
  ↓
4. 获取返回的MeetingInfo
   {
     provider: "feishu",
     meeting_id: "6892847362938471942",
     meeting_no: "123456789",
     meeting_url: "https://vc.feishu.cn/j/123456789",
     start_time: DateTime,
     duration: 60
   }
  ↓
5. 创建session并设置会议信息
   SessionService.createSession({
     ...baseData,
     meeting_provider: "feishu",
     meeting_id: "6892847362938471942",
     meeting_url: "https://vc.feishu.cn/j/123456789",
     ...
   })
```

---

## 🔗 11. 与其他模块的关系

| 模块 | 交互方式 | 说明 |
|-----|--------|------|
| **Session Domain** | 被调用 | BFF层通过Factory获取provider，创建会议后传递MeetingInfo给SessionService |
| **Webhook Module** | 配合 | 飞书/Zoom webhook会携带meeting_id，用于查找对应的session |
| **Meeting Event** | 参考 | Webhook中的meeting_id来源于创建会议时返回的MeetingInfo |
| **Calendar Module** | 前置 | 创建会议前需检查日历冲突 |

---

## 💾 12. 配置管理

| 配置项 | 说明 | 默认值 |
|-------|------|-------|
| `DEFAULT_MEETING_PROVIDER` | 默认会议平台 | "feishu" |
| `FEISHU_APP_ID` | 飞书App ID | 环境变量 |
| `FEISHU_APP_SECRET` | 飞书App Secret | 环境变量 |
| `ZOOM_CLIENT_ID` | Zoom Client ID | 环境变量 |
| `ZOOM_CLIENT_SECRET` | Zoom Client Secret | 环境变量 |
| `FEISHU_API_BASE_URL` | 飞书API基础URL | https://open.feishu.cn |
| `ZOOM_API_BASE_URL` | Zoom API基础URL | https://api.zoom.us |

---

## 🎯 13. 错误处理

| 错误类型 | 原因 | 处理方案 |
|---------|------|--------|
| `InvalidProviderError` | Provider类型不支持 | 返回400，提示支持的类型 |
| `MeetingCreateFailedError` | 创建会议失败 | 返回500，记录错误日志 |
| `AuthenticationError` | API认证失败 | 返回401，检查credentials |
| `InvalidInputError` | 输入参数不合法 | 返回400，提示具体错误 |
| `RateLimitError` | API限流 | 返回429，提示重试 |

---

## 🔐 14. 安全性考虑

| 方面 | 措施 | 说明 |
|-----|------|------|
| **凭证管理** | 环境变量 | 敏感信息不硬编码 |
| **Token刷新** | 自动机制 | 过期自动更新，无需手动处理 |
| **请求签名** | HTTPS | 所有API请求使用加密传输 |
| **访问控制** | 权限验证 | 仅允许授权用户创建会议 |

---

## 📊 15. 性能优化

| 优化项 | 方案 | 效果 |
|-------|------|------|
| **连接池** | HTTP Client池 | 减少连接建立开销 |
| **缓存** | Token缓存 | 避免频繁刷新token |
| **超时设置** | 请求超时 | 快速失败，释放资源 |
| **异步调用** | 异步Promise | 不阻塞主线程 |

---

## 📌 15. 关于 Meeting Event 的说明

**Meeting Event 的定位**：
- `meeting_event` 表属于 **Webhook Module** 范畴，用于记录飞书/Zoom webhook发送的事件
- `meeting_provider` 模块负责与第三方会议平台的**交互**（创建、更新、取消）
- `meeting_event` 模块负责接收第三方平台的**回调事件**（会议开始、结束、录制等）

---

### 15.1 两者的关联流程

```
MeetingProvider.createMeeting()
    ↓
返回 MeetingInfo {
  meeting_id: "6911188411934433028",
  meeting_no: "235812466",
  meeting_url: "https://vc.feishu.cn/j/235812466",
  start_time: DateTime,
  duration: 60
}
    ↓
Session Domain 保存到 session 表 {
  meeting_id: "6911188411934433028",
  meeting_url: "https://vc.feishu.cn/j/235812466",
  scheduled_start_time: DateTime,
  ...
}
    ↓
Webhook 到达（飞书/Zoom）
    ↓
Meeting Event 创建记录 {
  meeting_id: "6911188411934433028",  ← 用于关联
  event_id: "5e3702a84e847582...",   ← 唯一事件ID
  event_type: "vc.meeting.join_meeting_v1",
  operator_id: "e33ggbyz",
  occurred_at: DateTime,
  event_data: { /* 完整webhook原始数据 */ }
}
```

---

### 15.2 MeetingInfo 与 Meeting Event 的字段映射

| MeetingInfo 字段 | Meeting Event 字段 | 来源 | 说明 |
|-----------------|------------------|------|------|
| `meeting_id` | `meeting_id` | 创建会议返回 | 用于webhook回调查询 |
| `meeting_no` | `meeting_no` | 创建会议返回 | 飞书会议号（仅飞书） |
| `provider` | `provider` | 创建会议的provider类型 | 'feishu' \| 'zoom' |
| `start_time` | `meeting_start_time` | Webhook event.meeting.start_time | 会议开始时间 |
| `duration` | `meeting_end_time` | Webhook event.meeting.end_time | 会议结束时间 |
| - | `event_type` | Webhook header.event_type | 事件类型 |
| - | `operator_id` | Webhook event.operator.id | 事件操作者 |
| - | `occurred_at` | Webhook header.create_time | 事件发生时间 |
| - | `event_data` | 完整webhook | 原始数据备份 |

---

### 15.3 Meeting Event 表概览

**完整字段列表**（详细设计见 session_domain_design_v3.3.md 8.2）:

| 字段 | 类型 | 说明 |
|-----|-----|------|
| `id` | UUID | 主键 |
| `session_id` | UUID | 关联session（通过meeting_id查询得到） |
| `meeting_id` | VARCHAR | 飞书/Zoom会议ID（关键字段） |
| `event_id` | VARCHAR | 事件ID（UNIQUE，去重） |
| `provider` | VARCHAR | 'feishu' \| 'zoom' |
| `event_type` | VARCHAR | vc.meeting.join_meeting_v1 等 |
| `operator_id` | VARCHAR | 操作者ID |
| `operator_role` | INTEGER | 1=主持人, 2=参与者 |
| `meeting_no` | VARCHAR | 飞书会议号 |
| `meeting_topic` | VARCHAR | 会议主题 |
| `meeting_start_time` | TIMESTAMP | 会议开始时间 |
| `meeting_end_time` | TIMESTAMP | 会议结束时间 |
| `event_data` | JSONB | 原始webhook数据 |
| `occurred_at` | TIMESTAMP | 事件发生时间 |
| `created_at` | TIMESTAMP | 记录创建时间 |

---

### 15.4 数据流示例（Join Meeting）

**飞书Webhook原始数据**:
```json
{
  "header": {
    "event_id": "5e3702a84e847582be8db7fb73283c02",
    "event_type": "vc.meeting.join_meeting_v1",
    "create_time": "1608725989000"
  },
  "event": {
    "meeting": {
      "id": "6911188411934433028",
      "meeting_no": "235812466",
      "topic": "my meeting",
      "start_time": "1608883322",
      "end_time": "1608883899"
    },
    "operator": {
      "id": {"user_id": "e33ggbyz", "open_id": "ou_84aad35d084aa403a838cf73ee18467"},
      "user_role": 1
    }
  }
}
```

**提取到 Meeting Event 表**:

| 字段 | 提取值 | 说明 |
|-----|-------|------|
| `meeting_id` | 6911188411934433028 | 从 event.meeting.id |
| `event_id` | 5e3702a84e847582be8db7fb73283c02 | 从 header.event_id |
| `event_type` | vc.meeting.join_meeting_v1 | 从 header.event_type |
| `operator_id` | e33ggbyz | 从 event.operator.id.user_id |
| `operator_role` | 1 | 从 event.operator.user_role（1=主持人） |
| `meeting_no` | 235812466 | 从 event.meeting.meeting_no |
| `meeting_topic` | my meeting | 从 event.meeting.topic |
| `occurred_at` | 2021-01-01 12:33:09 | 从 header.create_time（毫秒转秒） |

---

### 15.5 核心查询关联

**根据会议ID查找session的所有事件**:
```sql
SELECT me.* 
FROM meeting_event me
WHERE me.meeting_id = $1  -- 由MeetingProvider.createMeeting()返回
ORDER BY me.occurred_at;
```

**时长计算关键查询**:
```sql
SELECT operator_id, event_type, occurred_at
FROM meeting_event
WHERE session_id = $1 
  AND event_type IN ('vc.meeting.join_meeting_v1', 'vc.meeting.leave_meeting_v1')
ORDER BY occurred_at;
```

**去重检查**:
```sql
SELECT * FROM meeting_event 
WHERE event_id = $1  -- UNIQUE约束保护
LIMIT 1;
```

---

**详细的 meeting_event 设计请参考**: `session_domain_design_v3.3.md` 第8.2节

---

**文档结束 | 版本 v3.3**

