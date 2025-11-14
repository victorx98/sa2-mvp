# Webhook、Meeting Provider、Session Domain 数据通信流程图

## 整体数据流向

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Feishu开放平台                                      │
│                    (发送Webhook事件)                                        │
└────────────────────────────┬────────────────────────────────────────────────┘
                             │
                             │ HTTP POST (Raw Body + Headers)
                             │ - event_id
                             │ - event_type (meeting_started_v1/meeting_ended_v1/...)
                             │ - timestamp
                             │ - token/encrypt_key
                             │ - meeting info (meeting_id, meeting_no, topic, etc.)
                             │
                             ▼
        ┌────────────────────────────────────────────────────────┐
        │         Webhook Gateway Controller                     │
        │  POST /webhooks/feishu                                │
        │                                                       │
        │  职责:                                                │
        │  1. 接收Raw Body                                      │
        │  2. 验证Token/Signature                              │
        │  3. 解析Webhook格式                                  │
        │  4. 转发给Handler                                    │
        └────────┬─────────────────────────────────────────────┘
                 │
                 │ IFeishuWebhookRequest (完整Raw Payload)
                 │
                 ▼
        ┌────────────────────────────────────────────────────────┐
        │     Feishu Webhook Handler                            │
        │                                                       │
        │  职责:                                                │
        │  1. 接收Webhook请求                                  │
        │  2. 调用FeishuEventExtractor提取结构化数据             │
        │  3. 调用MeetingEventService存储到meeting_events      │
        │  4. 发布Domain Event                                 │
        └────────┬──────────────────────────┬──────────────────┘
                 │                          │
        ┌────────▼─────────────────┐   ┌────▼──────────────────────────┐
        │ FeishuEventExtractor     │   │ MeetingEventService           │
        │                          │   │                               │
        │ 提取结构化字段:          │   │ 职责:                         │
        │ - meetingId              │   │ 1. 防重复(event_id)           │
        │ - meetingNo              │   │ 2. 存储到meeting_events表     │
        │ - eventId                │   │ 3. 记录完整event_data(JSONB)  │
        │ - eventType              │   │ 4. 提取关键字段              │
        │ - operatorId             │   │                              │
        │ - meetingStartTime       │   │ 存储的字段:                  │
        │ - meetingEndTime         │   │ - meeting_id                 │
        │ - recordingId            │   │ - event_id (unique)          │
        │ - meetingTopic           │   │ - event_type                 │
        │ - eventData(完整原始数据) │   │ - meeting_no                 │
        │                          │   │ - meeting_start_time         │
        │ 返回:                    │   │ - meeting_end_time           │
        │ ExtractedMeetingEventData│   │ - operator_id                │
        │                          │   │ - event_data (完整JSONB)     │
        └────────┬─────────────────┘   └────┬──────────────────────────┘
                 │                          │
                 └──────────────┬───────────┘
                                │
                                │ ExtractedMeetingEventData
                                │ 包含:
                                │ - meetingNo (用于查询Session)
                                │ - eventType (判断事件类型)
                                │ - meetingStartTime
                                │ - meetingEndTime
                                │
                                ▼
        ┌─────────────────────────────────────────────────────────┐
        │        发布Domain Event                                │
        │                                                        │
        │  根据eventType发布不同事件:                            │
        │  - SESSION_MEETING_STARTED                             │
        │  - SESSION_MEETING_ENDED                               │
        │  - SESSION_RECORDING_READY                             │
        │                                                        │
        │  事件Payload (FeishuMeetingEventPayload):              │
        │  - meetingId                                           │
        │  - meetingNo                                           │
        │  - eventId                                             │
        │  - eventType                                           │
        │  - operatorId                                          │
        │  - meetingTopic                                        │
        │  - meetingStartTime                                    │
        │  - meetingEndTime                                      │
        │  - recordingId                                         │
        │  - recordingUrl                                        │
        │  - occurredAt                                          │
        │  - eventData (完整原始数据)                             │
        └────────┬────────────────────────────────────────────────┘
                 │
                 │ Domain Event (FeishuMeetingEventPayload)
                 │
                 ▼
        ┌──────────────────────────────────────────────────────┐
        │   Session Event Subscriber                          │
        │   (事件监听器)                                       │
        │                                                    │
        │  监听Session相关事件并处理:                        │
        │  @OnEvent(SESSION_MEETING_STARTED)               │
        │  @OnEvent(SESSION_MEETING_ENDED)                 │
        │  @OnEvent(SESSION_RECORDING_READY)               │
        │                                                    │
        │  处理流程:                                         │
        │  1. 根据meetingNo查询Session记录                  │
        │  2. 若找到Session,执行相应逻辑                    │
        │  3. 若未找到,记录Debug日志并返回                  │
        └────────┬─────────────────────────────────────────────┘
                 │
                 ▼
    ┌────────────────────────────────────────────────────────┐
    │  handleSessionMeetingEnded()                          │
    │  (处理会议结束事件)                                    │
    │                                                      │
    │  核心数据处理流程:                                   │
    │                                                      │
    │  1. 按meetingNo查询Session                          │
    │     └─ 输入: payload.meetingNo                      │
    │     └─ 输出: Session Entity                         │
    │                                                      │
    │  2. 从Payload提取时间信息                           │
    │     └─ meetingStartTime (from 飞书webhook)         │
    │     └─ meetingEndTime (from 飞书webhook)           │
    │     └─ occurredAt (事件触发时间)                    │
    │                                                      │
    │  3. 构建新的会议时间段                              │
    │     └─ newTimeSegment = {                           │
    │        startTime: meetingStartTime或occurredAt     │
    │        endTime: meetingEndTime                      │
    │      }                                               │
    │                                                      │
    │  4. 合并到现有meeting_time_list                     │
    │     └─ 读取: session.meetingTimeList (已有段)      │
    │     └─ 追加: 新的newTimeSegment                    │
    │     └─ 结果: updatedTimeList = [...existing,       │
    │              newTimeSegment]                        │
    │                                                      │
    │  5. 计算总服务时长                                   │
    │     └─ for each segment in updatedTimeList:        │
    │        duration += (endTime - startTime)           │
    │     └─ actualServiceDuration = 所有段的总和(分钟)   │
    │                                                      │
    │  6. 准备UpdateSessionDto                            │
    │     └─ status: COMPLETED                            │
    │     └─ meetingTimeList: updatedTimeList             │
    │     └─ actualServiceDuration: 计算结果              │
    │                                                      │
    │  7. 调用SessionService.updateSession()             │
    │     └─ 输入: sessionId, UpdateSessionDto            │
    │     └─ 处理: 构建SQL UPDATE语句                     │
    │     └─ 执行: 更新sessions表                         │
    │     └─ 返回: 更新后的Session Entity                │
    │                                                      │
    │  支持多段会议场景:                                   │
    │  ┌─ 第1次meeting_ended_v1来临 ─────────────────┐   │
    │  │  meeting_time_list: [{第1段}]                │   │
    │  │  actual_service_duration: 30分钟              │   │
    │  └───────────────────────────────────────────────┘   │
    │                                                       │
    │  ┌─ 第2次meeting_ended_v1来临(重连后) ──────┐       │
    │  │  meeting_time_list: [{第1段}, {第2段}]    │       │
    │  │  actual_service_duration: 55分钟(30+25)   │       │
    │  └──────────────────────────────────────────┘       │
    │                                                      │
    │  ┌─ 第3次meeting_ended_v1来临(再次重连) ──┐         │
    │  │  meeting_time_list: [{第1段},{第2段},     │         │
    │  │                      {第3段}]             │         │
    │  │  actual_service_duration: 80分钟(30+25+25)│        │
    │  └──────────────────────────────────────────┘       │
    └────────┬──────────────────────────────────────────────┘
             │
             │ UpdateSessionDto
             │ {
             │   status: COMPLETED,
             │   meetingTimeList: [...],
             │   actualServiceDuration: 60
             │ }
             │
             ▼
        ┌──────────────────────────────────────────────────────┐
        │   Session Service                                   │
        │   updateSession()                                   │
        │                                                    │
        │  1. 验证Session存在                                │
        │  2. 验证状态(仅CANCELLED状态禁止更新)              │
        │     (允许COMPLETED状态更新,支持多段会议)           │
        │  3. 构建UPDATE SQL:                               │
        │     SET meeting_time_list = $1,                  │
        │         actual_service_duration = $2,            │
        │         status = $3,                             │
        │         updated_at = NOW()                       │
        │     WHERE sessions.id = $5                       │
        │  4. 执行Update                                    │
        │  5. 映射回Entity                                  │
        │  6. 返回更新后的Session                           │
        └────────┬───────────────────────────────────────────┘
                 │
                 │ 数据库Session表更新完成
                 │
                 ▼
        ┌──────────────────────────────────────────────────────┐
        │  Sessions表最终状态                                 │
        │                                                    │
        │  新增/更新字段:                                    │
        │  - meeting_time_list: JSONB                       │
        │    [{                                             │
        │      "startTime": "2025-11-13T11:16:46.000Z",    │
        │      "endTime": "2025-11-13T12:16:46.000Z"       │
        │    }]                                             │
        │                                                    │
        │  - actual_service_duration: integer               │
        │    60 (分钟)                                       │
        │                                                    │
        │  - status: 'completed'                            │
        │                                                    │
        │  保留字段(用于审计):                               │
        │  - meeting_no: '302007675'(关联到webhook查询)     │
        │  - scheduled_start_time: 原计划时间               │
        │  - scheduled_duration: 原计划时长                 │
        │  - updated_at: 最后更新时间                       │
        └──────────────────────────────────────────────────────┘
```

---

## 详细的数据字段映射流程

```
┌─────────────────────────────────────────────────────────────────┐
│  飞书Webhook原始数据 (IFeishuWebhookRequest)                   │
└─────────────────────────────────────────────────────────────────┘
            │
            ├─ header {
            │   event_id: "5e3702a84e847582be8db7fb73283c09"
            │   event_type: "vc.meeting.meeting_ended_v1"
            │   create_time: "1763030364000" (毫秒)
            │   token: "kr3KzHFb9dyzfKVvn1KVHAOiSpaFY8w"
            └─ }
            │
            └─ event {
                meeting {
                  id: "6911188411934430"
                  topic: "my meeting"
                  meeting_no: "302007675" ◄─── 关键字段(用于查询Session)
                  meeting_source: 1
                  start_time: "1763032606" (Unix秒)
                  end_time: "1763032606" (Unix秒)
                }
                host_user { id, user_id, open_id }
                owner { id, user_id, open_id }
                operator { id, user_id, open_id }
                calendar_event_id: "..."
            }


                        ▼ (FeishuEventExtractor处理)


┌─────────────────────────────────────────────────────────────────┐
│  提取的结构化数据 (ExtractedMeetingEventData)                  │
└─────────────────────────────────────────────────────────────────┘
            │
            ├─ meetingId: "6911188411934430"
            ├─ meetingNo: "302007675" ◄─── 用于查询Session
            ├─ eventId: "5e3702a84e847582be8db7fb73283c09" ◄─── 防重复
            ├─ eventType: "vc.meeting.meeting_ended_v1" ◄─── 事件类型判断
            ├─ provider: "feishu"
            ├─ operatorId: "e33ggbyz"
            ├─ operatorRole: 1
            ├─ meetingTopic: "my meeting"
            ├─ meetingStartTime: Date(1763032606*1000) ◄─── Unix秒转Date
            ├─ meetingEndTime: Date(1763032606*1000)
            ├─ recordingId: null
            ├─ recordingUrl: null
            ├─ occurredAt: Date(1763030364*1000) ◄─── 事件触发时间
            └─ eventData: { 完整原始webhook数据 } ◄─── 审计日志


                        ▼ (存储到meeting_events表)


┌─────────────────────────────────────────────────────────────────┐
│  meeting_events表记录                                          │
└─────────────────────────────────────────────────────────────────┘
            │
            ├─ id: UUID
            ├─ meeting_id: "6911188411934430"
            ├─ event_id: "5e3702a84e847582be8db7fb73283c09" (UNIQUE索引)
            ├─ provider: "feishu"
            ├─ event_type: "vc.meeting.meeting_ended_v1"
            ├─ operator_id: "e33ggbyz"
            ├─ operator_role: 1
            ├─ meeting_no: "302007675" ◄─── 用于关联到Sessions
            ├─ meeting_topic: "my meeting"
            ├─ meeting_start_time: TIMESTAMPTZ
            ├─ meeting_end_time: TIMESTAMPTZ
            ├─ event_data: JSONB { 完整原始数据 }
            ├─ occurred_at: TIMESTAMPTZ
            └─ created_at: TIMESTAMPTZ


                        ▼ (发布Domain Event)


┌─────────────────────────────────────────────────────────────────┐
│  Domain Event (FeishuMeetingEventPayload)                      │
│  Event Name: services.session.meeting_ended                   │
└─────────────────────────────────────────────────────────────────┘
            │
            ├─ meetingId: "6911188411934430"
            ├─ meetingNo: "302007675" ◄─── 用于查询Session
            ├─ eventId: "5e3702a84e847582be8db7fb73283c09"
            ├─ eventType: "vc.meeting.meeting_ended_v1"
            ├─ provider: "feishu"
            ├─ operatorId: "e33ggbyz"
            ├─ operatorRole: 1
            ├─ meetingTopic: "my meeting"
            ├─ meetingStartTime: Date
            ├─ meetingEndTime: Date
            ├─ recordingId: null
            ├─ recordingUrl: null
            ├─ occurredAt: Date ◄─── 事件发生时间
            └─ eventData: { 完整原始webhook数据 }


                        ▼ (Session Subscriber处理)


┌─────────────────────────────────────────────────────────────────┐
│  按meetingNo查询Session                                        │
│  SELECT * FROM sessions WHERE meeting_no = '302007675'        │
└─────────────────────────────────────────────────────────────────┘
            │
            ▼
        ┌────────────────────────────────────────┐
        │ 查询结果: Session Entity               │
        ├────────────────────────────────────────┤
        │ id: "5abef6dc-fa2a-4e9e-bd0b-68f5e271" │
        │ meeting_no: "302007675"                │
        │ meeting_time_list: [] (首次为空)       │
        │ actual_service_duration: null          │
        │ status: "scheduled"                    │
        │ ...其他字段...                          │
        └────────────────────────────────────────┘


                        ▼ (计算新时间段)


┌─────────────────────────────────────────────────────────────────┐
│  构建时间段                                                    │
│  newTimeSegment = {                                           │
│    startTime: meetingStartTime || occurredAt                 │
│    endTime: meetingEndTime                                   │
│  }                                                            │
│  = {                                                          │
│    startTime: "2025-11-13T11:16:46.000Z"                     │
│    endTime: "2025-11-13T12:16:46.000Z"                       │
│  }                                                            │
└─────────────────────────────────────────────────────────────────┘


                        ▼ (合并时间列表)


┌─────────────────────────────────────────────────────────────────┐
│  合并meeting_time_list                                         │
│  updatedTimeList = [...session.meetingTimeList, newTimeSegment] │
│                                                                │
│  第1次:                                                        │
│  updatedTimeList = [                                          │
│    {                                                          │
│      startTime: "2025-11-13T11:16:46.000Z"                   │
│      endTime: "2025-11-13T12:16:46.000Z"                     │
│    }                                                          │
│  ]                                                            │
│                                                                │
│  第2次(重连):                                                  │
│  updatedTimeList = [                                          │
│    { startTime: "...", endTime: "..." },                     │
│    { startTime: "新时间段1开始", endTime: "新时间段1结束" }   │
│  ]                                                            │
└─────────────────────────────────────────────────────────────────┘


                        ▼ (计算总时长)


┌─────────────────────────────────────────────────────────────────┐
│  calculateTotalDuration()                                      │
│  for each segment in updatedTimeList:                         │
│    segmentDuration = (endTime - startTime) / 1000 / 60       │
│    totalDuration += segmentDuration                           │
│                                                                │
│  第1次:                                                        │
│  totalDuration = 60分钟                                        │
│                                                                │
│  第2次:                                                        │
│  totalDuration = 60 + 30 = 90分钟                             │
└─────────────────────────────────────────────────────────────────┘


                        ▼ (准备更新DTO)


┌─────────────────────────────────────────────────────────────────┐
│  UpdateSessionDto                                              │
│  {                                                             │
│    status: "completed",                                       │
│    meetingTimeList: [{...}, {...}],                          │
│    actualServiceDuration: 60                                  │
│  }                                                             │
└─────────────────────────────────────────────────────────────────┘


                        ▼ (执行数据库更新)


┌─────────────────────────────────────────────────────────────────┐
│  Sessions表更新                                                │
│  UPDATE sessions                                              │
│  SET                                                          │
│    meeting_time_list = $1,                                   │
│    actual_service_duration = $2,                             │
│    status = $3,                                              │
│    updated_at = NOW()                                        │
│  WHERE sessions.id = $5                                      │
│                                                               │
│  $1 = '[{"startTime":"2025-11-13T11:16:46.000Z",             │
│          "endTime":"2025-11-13T12:16:46.000Z"}]'            │
│  $2 = 60                                                      │
│  $3 = 'completed'                                            │
│  $5 = '5abef6dc-fa2a-4e9e-bd0b-68f5e27...'                  │
└─────────────────────────────────────────────────────────────────┘


                        ▼ (最终Sessions表状态)


┌─────────────────────────────────────────────────────────────────┐
│  Sessions表查询结果                                            │
│  {                                                             │
│    id: "5abef6dc-fa2a-4e9e-bd0b-68f5e27...",                │
│    meeting_no: "302007675",                                   │
│    meeting_time_list: [                                       │
│      {                                                        │
│        "startTime": "2025-11-13T11:16:46.000Z",             │
│        "endTime": "2025-11-13T12:16:46.000Z"                │
│      }                                                        │
│    ],                                                         │
│    actual_service_duration: 60,  ◄─── 最终时长(分钟)        │
│    status: "completed",                                       │
│    updated_at: "2025-11-13T12:32:51.389Z",                  │
│    ...其他字段...                                              │
│  }                                                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 关键数据节点总结

| 数据节点 | 来源 | 用途 | 转换方式 |
|---------|------|------|---------|
| **event_id** | 飞书webhook header | 去重(meeting_events unique约束) | 直接映射 |
| **event_type** | 飞书webhook header | 事件类型判断(发布什么Domain Event) | 直接映射 |
| **meeting_no** | 飞书webhook event.meeting | 关联Session的关键字段 | 直接映射 |
| **meetingStartTime** | 飞书webhook event.meeting.start_time | 计算时长的开始点 | Unix秒 → Date对象 |
| **meetingEndTime** | 飞书webhook event.meeting.end_time | 计算时长的结束点 | Unix秒 → Date对象 |
| **meetingTimeList** | Session现有记录 + 新时间段 | 支持多段会议 | 数组追加 |
| **actualServiceDuration** | 所有时间段求和 | 实际服务时长统计 | 毫秒 → 分钟 |
| **eventData** | 完整飞书webhook原始数据 | 审计日志(JSONB存储) | 整个payload |

---

## 多段会议场景示例

```
场景: 导师和学生中途断线并重连

时间轴:
├─ 10:00 会议开始 (meeting_started_v1事件)
│  └─ Session: status = started
│
├─ 10:30 导师断线 (leave_meeting_v1)
│  └─ 会议继续,学生还在
│
├─ 10:35 导师重连 (join_meeting_v1)
│  └─ 会议继续
│
├─ 11:00 会议结束 (meeting_ended_v1事件 ← 触发处理)
│  └─ Session Event Subscriber处理:
│     1. 查询Session记录(meeting_no=302007675)
│     2. 构建时间段: {start: 10:00, end: 11:00}
│     3. 发现已有meeting_time_list=[]
│     4. 追加新时间段: [{start: 10:00, end: 11:00}]
│     5. 计算总时长: 60分钟
│     6. 更新Session:
│        - meeting_time_list: [{start: 10:00, end: 11:00}]
│        - actual_service_duration: 60
│        - status: completed
│
└─ Session表最终状态:
   {
     meeting_no: "302007675",
     meeting_time_list: [
       { startTime: "10:00", endTime: "11:00" }
     ],
     actual_service_duration: 60,
     status: "completed"
   }


也支持更多段的场景:

time_segment_1: 10:00-10:30 (30分钟)
time_segment_2: 10:35-11:00 (25分钟) ← 重连后
time_segment_3: 11:05-11:30 (25分钟) ← 再次断线重连

最终结果:
meeting_time_list: [
  { startTime: "10:00", endTime: "10:30" },
  { startTime: "10:35", endTime: "11:00" },
  { startTime: "11:05", endTime: "11:30" }
]
actual_service_duration: 80 (分钟)
```

---

## 核心特性

✅ **幂等性**: 同一event_id只被处理一次(meeting_events unique约束)
✅ **多段支持**: 每次meeting_ended_v1都追加到meeting_time_list
✅ **准确计费**: 基于actual_service_duration进行计费
✅ **审计完整**: eventData保存完整原始webhook数据
✅ **解耦设计**: Webhook → Domain Event → Session处理三层分离

