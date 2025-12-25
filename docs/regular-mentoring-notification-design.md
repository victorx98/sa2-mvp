# Regular Mentoring 通知系统设计文档

> 阅读时长：2分钟 | 版本：v1.0

## 1. 目录结构

```
src/
├── core/
│   ├── calendar/services/
│   │   ├── calendar.service.ts              # 已存在
│   │   ├── feishu-calendar.service.ts       # 新增 - 飞书日历管理
│   │   └── google-calendar.service.ts       # 新增 - Google日历管理
│   │
│   ├── email/services/
│   │   ├── email.service.ts                 # 已存在
│   │   └── session-email-template.service.ts # 新增 - 约课邮件模板
│   │
│   └── notification/                        # 新增目录
│       ├── notification.module.ts
│       ├── services/
│       │   ├── notification-queue.service.ts    # 通知队列管理
│       │   └── notification-scheduler.service.ts # 定时发送调度
│       └── interfaces/
│           └── notification.interface.ts
│
└── application/events/handlers/services/
    ├── regular-mentoring-event.handler.ts          # 已存在 - 会议生命周期
    └── regular-mentoring-notification.handler.ts   # 新增 - 通知编排
```

---

## 2. 业务流程

### 2.1 创建约课 (Create)

| 阶段 | 操作 | 成功 (success) | 失败 (failed) |
|------|------|----------------|---------------|
| **监听事件** | `regular_mentoring.session.meeting.operation.result` | operation=create, status=success | operation=create, status=failed |
| **日历创建** | 根据 meetingProvider | ✅ 飞书/Google日历 (顾问+导师+学生) | ✅ 飞书/Google日历 (仅顾问) |
| **即时通知** | 飞书/Google API自动发送邀请邮件 | ✅ 发送给3方 | ✅ 发送给顾问 |
| **定时提醒** | 入队 notification_queue | ✅ 提前3天/1天/3小时 (3方) | ❌ 不创建 |
| **资源释放** | - | - | ✅ 释放日历 + 释放权益 |

### 2.2 修改约课 (Update)

| 阶段 | 操作 | 成功 (success) | 失败 (failed) |
|------|------|----------------|---------------|
| **监听事件** | `regular_mentoring.session.meeting.operation.result` | operation=update, status=success | operation=update, status=failed |
| **日历更新** | 更新飞书/Google日历事件 | ✅ 更新时间/主题 | ❌ 跳过 |
| **即时通知** | 日历API自动发送更新通知 | ✅ 发送给3方 | ✅ 发送失败通知给顾问 |
| **定时提醒** | 更新 notification_queue | ✅ 更新提醒时间 | ❌ 不更新 |

### 2.3 取消约课 (Cancel)

| 阶段 | 操作 | 成功 (success) | 失败 (failed) |
|------|------|----------------|---------------|
| **监听事件** | `regular_mentoring.session.meeting.operation.result` | operation=cancel, status=success | operation=cancel, status=failed |
| **日历取消** | 取消飞书/Google日历事件 | ✅ 取消事件 | ❌ 跳过 |
| **即时通知** | 日历API自动发送取消通知 | ✅ 发送给3方 | ✅ 发送失败通知给顾问 |
| **定时提醒** | 删除 notification_queue | ✅ 删除所有待发提醒 | ❌ 不删除 |

---

## 3. 核心服务设计

### 3.1 FeishuCalendarService

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `createEvent` | `CreateCalendarEventDto` | `Promise<string>` | 创建日历事件，返回eventId |
| `addAttendees` | `eventId: string, attendees: AttendeeDto[]` | `Promise<void>` | 添加参与者（支持外部邮箱） |
| `updateEvent` | `eventId: string, updates: UpdateEventDto` | `Promise<void>` | 更新事件时间/主题 |
| `cancelEvent` | `eventId: string` | `Promise<void>` | 取消事件 |

**CreateCalendarEventDto**
```typescript
{
  summary: string;           // 主题
  startTime: Date;           // 开始时间
  endTime: Date;             // 结束时间
  description?: string;      // 描述
  meetingUrl?: string;       // 会议链接
  attendees: AttendeeDto[];  // 参与者列表
}
```

**AttendeeDto**
```typescript
{
  email: string;             // 邮箱（支持外部）
  displayName?: string;      // 显示名称
  isOptional?: boolean;      // 是否可选
}
```

### 3.2 GoogleCalendarService

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `createEvent` | `CreateCalendarEventDto` | `Promise<string>` | 创建Google日历事件（一步完成，自动添加参与者） |
| `updateEvent` | `eventId: string, updates: UpdateEventDto` | `Promise<void>` | 更新事件 |
| `cancelEvent` | `eventId: string` | `Promise<void>` | 取消事件 |

> **注意**：Google Calendar 默认支持外部邮箱，创建事件时直接传入 attendees 即可，无需单独调用 addAttendees

### 3.3 NotificationQueueService

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `scheduleReminders` | `ScheduleRemindersDto` | `Promise<void>` | 创建定时提醒（3天/1天/3小时） |
| `updateReminders` | `sessionId: string, newScheduledAt: Date` | `Promise<void>` | 更新提醒时间 |
| `cancelReminders` | `sessionId: string` | `Promise<void>` | 取消所有提醒 |
| `getPendingNotifications` | `limit?: number` | `Promise<NotificationQueue[]>` | 获取待发送通知 |
| `markAsSent` | `id: string` | `Promise<void>` | 标记为已发送 |
| `markAsFailed` | `id: string, error: string` | `Promise<void>` | 标记为失败 |

**ScheduleRemindersDto**
```typescript
{
  sessionId: string;
  scheduledAt: Date;         // 约课时间
  recipients: {
    counselorEmail: string;
    mentorEmail: string;
    studentEmail: string;
  };
  sessionInfo: {
    title: string;
    meetingUrl: string;
    duration: number;
  };
}
```

### 3.4 NotificationSchedulerService

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `processPendingNotifications` | - | `Promise<void>` | 定时任务：每分钟扫描并发送（使用 @Cron） |

**实现方式**：
```typescript
@Cron('* * * * *')  // 每分钟执行
async processPendingNotifications() {
  // 查询 status=pending 且 scheduled_time <= NOW()
  // 发送邮件并更新状态
}
```

**性能优化**：
- 添加索引：`CREATE INDEX idx_notification_pending ON notification_queue(status, scheduled_time WHERE status='pending')`
- 批量处理：每次最多处理100条
- 并发控制：使用分布式锁避免重复发送

### 3.5 RegularMentoringNotificationHandler

| 方法 | 事件 | 说明 |
|------|------|------|
| `handleMeetingOperationResult` | `regular_mentoring.session.meeting.operation.result` | 主处理器 |
| `handleCreateSuccess` | - | 创建成功：日历+提醒入队 |
| `handleCreateFailed` | - | 创建失败：释放资源+顾问通知 |
| `handleUpdateSuccess` | - | 更新成功：更新日历+提醒 |
| `handleUpdateFailed` | - | 更新失败：顾问通知 |
| `handleCancelSuccess` | - | 取消成功：取消日历+删除提醒 |
| `handleCancelFailed` | - | 取消失败：顾问通知 |

---

## 4. notification_queue 表设计优化

### 4.1 优化建议

| 字段 | 当前设计 | 优化建议 | 原因 |
|------|----------|----------|------|
| `type` | `notification_type` enum | ✅ 保留 | 支持扩展（email/feishu_bot/sms） |
| `recipient` | 单个邮箱 | ❌ 改为 `recipients` (jsonb) | 需要同时发送给3方 |
| `template` | 模板名称 | ❌ 删除 | 不需要模板，直接存内容 |
| `data` | 模板数据 | ✅ 改为 `content` (jsonb) | 存储完整邮件内容 |
| - | 不存在 | ✅ 新增 `subject` (varchar) | 邮件主题 |
| - | 不存在 | ✅ 新增 `reminder_type` (enum) | 提前3天/1天/3小时 |

### 4.2 优化后的表结构

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| `id` | uuid | 主键 | - |
| `session_id` | uuid | 约课ID | - |
| `type` | enum | 通知类型 | `email` |
| `recipients` | jsonb | 收件人列表 | `{"counselor": "c@x.com", "mentor": "m@x.com", "student": "s@x.com"}` |
| `subject` | varchar(255) | 邮件主题 | `【提醒】您的约课将在3天后开始` |
| `content` | jsonb | 邮件内容 | `{"html": "...", "text": "..."}` |
| `reminder_type` | enum | 提醒类型 | `three_days` / `one_day` / `three_hours` |
| `scheduled_time` | timestamp | 发送时间 | `2025-12-27 10:00:00` |
| `status` | enum | 状态 | `pending` / `sent` / `failed` |
| `sent_at` | timestamp | 发送时间 | - |
| `error` | varchar(500) | 错误信息 | - |
| `created_at` | timestamp | 创建时间 | - |
| `updated_at` | timestamp | 更新时间 | - |

### 4.3 reminder_type Enum

```typescript
enum ReminderType {
  THREE_DAYS = 'three_days',    // 提前3天
  ONE_DAY = 'one_day',          // 提前1天
  THREE_HOURS = 'three_hours'   // 提前3小时
}
```

---

## 5. 关键实现细节

### 5.1 日历服务外部邮箱支持

**飞书日历**：根据[飞书官方文档](https://open.feishu.cn/document/server-docs/calendar-v4/calendar-event/create)，需要两步：
1. 先调用 `POST /calendar/v4/calendars/:calendar_id/events` 创建事件
2. 再调用 `POST /calendar/v4/calendars/:calendar_id/events/:event_id/attendees` 添加外部邮箱参与者

**Google日历**：一步到位，创建事件时直接在 `attendees` 字段传入外部邮箱即可

### 5.2 资源释放逻辑（失败场景）

```typescript
// 调用顺序
await calendarService.releaseSlots(mentorSlotId, studentSlotId);
await serviceHoldService.releaseHold(studentId, sessionId);
```

### 5.3 定时提醒计算与发送

**计算提醒时间**：
```typescript
const scheduledAt = new Date('2025-12-30 14:00:00');

// 提前3天: 2025-12-27 14:00:00
const threeDaysBefore = new Date(scheduledAt.getTime() - 3 * 24 * 60 * 60 * 1000);

// 提前1天: 2025-12-29 14:00:00
const oneDayBefore = new Date(scheduledAt.getTime() - 1 * 24 * 60 * 60 * 1000);

// 提前3小时: 2025-12-30 11:00:00
const threeHoursBefore = new Date(scheduledAt.getTime() - 3 * 60 * 60 * 1000);
```

**定时任务实现**：
```typescript
@Injectable()
export class NotificationSchedulerService {
  @Cron('* * * * *')  // 每分钟执行一次
  async processPendingNotifications() {
    const notifications = await this.notificationQueueService.getPendingNotifications(100);
    
    for (const notification of notifications) {
      try {
        await this.emailService.send({
          to: Object.values(notification.recipients),
          subject: notification.subject,
          html: notification.content.html
        });
        await this.notificationQueueService.markAsSent(notification.id);
      } catch (error) {
        await this.notificationQueueService.markAsFailed(notification.id, error.message);
      }
    }
  }
}
```

---

## 6. 实现优先级

| 优先级 | 模块 | 说明 |
|--------|------|------|
| P0 | `notification_queue` 表优化 | 修改schema |
| P0 | `NotificationQueueService` | 队列管理基础服务 |
| P0 | `RegularMentoringNotificationHandler` | 事件处理核心逻辑 |
| P1 | `FeishuCalendarService` | 飞书日历集成 |
| P1 | `GoogleCalendarService` | Google日历集成 |
| P2 | `NotificationSchedulerService` | 定时发送（可后续优化） |

---

**文档结束** | 如有疑问请联系开发团队

