# 更新约课信息功能 - 代码修改总结

## 概述
实现顾问修改约课信息的完整功能，包括时间、课时、标题、描述等字段的更新，以及相关事件的触发和异步处理。

---

## 1. 控制层 (Controller)

### 文件：`src/api/controllers/services/regular-mentoring.controller.ts`

#### 1.1 更新请求DTO - `UpdateRegularMentoringRequestDto`

```typescript
export class UpdateRegularMentoringRequestDto {
  @ApiProperty({ description: 'Session Title', example: 'Resume Coaching', required: false })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiProperty({ description: 'Session Description', example: 'Session description', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Scheduled Start Time (ISO 8601)', example: '2025-12-03T06:00:00Z', required: false })
  @IsString()
  @IsOptional()
  scheduledAt?: string;

  @ApiProperty({ description: 'Session Duration in minutes', example: 60, required: false })
  @IsInt()
  @Min(15)
  @IsOptional()
  duration?: number; // NEW: Added duration field
}
```

#### 1.2 响应DTO - `RegularMentoringSessionResponseDto`

```typescript
export class RegularMentoringSessionResponseDto {
  id: string;
  sessionType: string;
  sessionTypeId: string;
  studentUserId: string;
  mentorUserId: string;
  createdByCounselorId: string;
  title: string;
  description?: string;
  status: string;
  scheduledAt: string;
  completedAt?: string;
  cancelledAt?: string;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
  duration?: number; // NEW: Added duration field

  // Meeting information (from meetings table)
  meetingId?: string; // Third-party platform meeting ID
  meetingProvider?: string; // 'feishu' | 'zoom'
  meetingUrl?: string; // Meeting URL (unchanged during reschedule)
  meetingNo?: string;
  scheduleStartTime?: string;
  scheduleDuration?: number;
}
```

#### 1.3 更新会话的控制器方法

```typescript
@Patch('/:id')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('counselor') // NEW: Added method-level role guard
@ApiOperation({
  summary: 'Update a regular mentoring session',
  description: 'Update session details like title, description, or scheduled time',
})
async updateSession(
  @Param('id') sessionId: string,
  @Body() dto: UpdateRegularMentoringRequestDto,
): Promise<RegularMentoringSessionResponseDto> {
  const updatedSession = await this.regularMentoringService.updateSession(
    sessionId,
    {
      title: dto.title,
      description: dto.description,
      scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
      duration: dto.duration, // NEW: Pass duration
    },
  );
  // NEW: Use mapper to ensure all fields including meeting info are properly mapped
  return RegularMentoringSessionMapper.toResponseDto(updatedSession);
}
```

---

## 2. 应用层 (Application Service)

### 文件：`src/application/commands/services/regular-mentoring.service.ts`

#### 2.1 更新DTO接口 - `UpdateRegularMentoringDto`

```typescript
export interface UpdateRegularMentoringDto {
  title?: string;
  description?: string;
  scheduledAt?: Date;
  duration?: number; // NEW: Added duration field
}
```

#### 2.2 核心逻辑 - `updateSession` 方法

关键改动点：

**Step 1: 获取旧会话数据（包含meeting信息）**
```typescript
// Fetch old session with meeting details (LEFT JOIN in query service)
const oldSession = await this.regularMentoringQueryService.getSessionById(sessionId);
if (!oldSession) {
  throw new SessionNotFoundException(sessionId);
}

const oldSessionData = oldSession as any;
const oldSessionStartTime = typeof oldSession.scheduledAt === 'string'
  ? new Date(oldSession.scheduledAt)
  : oldSession.scheduledAt;
```

**Step 2: 确定变更类型（时间/课时/元数据）**
```typescript
// Determine if time or duration changed (affects meeting and calendar update)
const oldScheduledAt = typeof oldSession.scheduledAt === 'string'
  ? oldSession.scheduledAt
  : oldSession.scheduledAt?.toISOString?.() || '';
const timeChanged = scheduledAtIso !== oldScheduledAt;
const newDuration = dto.duration || oldSessionData.duration || 60;
const durationChanged = newDuration !== (oldSessionData.duration || 60);
```

**Step 3: 事务内更新calendar和session**
```typescript
const updatedSession = await this.db.transaction(async (tx: DrizzleTransaction) => {
  if (timeChanged || durationChanged) {
    // NEW: Cancel old calendar slots (update status to 'cancelled' instead of deleting)
    await this.calendarService.updateSlots(
      sessionId,
      { status: 'cancelled' as any },
      tx,
    );

    // NEW: Create new calendar slots with new time and duration
    const mentorSlot = await this.calendarService.createSlotDirect(
      {
        userId: oldSession.mentorUserId,
        userType: UserType.MENTOR,
        startTime: scheduledAtIso,
        durationMinutes: newDuration, // Use new duration
        sessionType: CalendarSessionType.REGULAR_MENTORING,
        title: dto.title || oldSession.title,
        sessionId: sessionId,
        meetingId: oldSession.meetingId,
        metadata: { otherPartyName: 'studentName' },
      },
      tx,
    );

    // Similar for studentSlot...
  } else {
    // Only metadata changed (title or description)
    if (dto.title) {
      await this.calendarService.updateSlots(
        sessionId,
        { title: dto.title },
        tx,
      );
    }
  }

  // Update session record
  const updateResult = await this.regularMentoringService.updateSession(
    sessionId,
    {
      title: dto.title,
      description: dto.description,
      scheduledAt: dto.scheduledAt,
    },
    tx,
  );

  return updateResult;
});
```

**Step 4: 发布事件**
```typescript
// NEW: Emit event based on what changed
if (timeChanged || durationChanged) {
  // Emit event to trigger async meeting update
  this.eventEmitter.emit(REGULAR_MENTORING_SESSION_UPDATED_EVENT, {
    sessionId: sessionId,
    meetingId: oldSession.meetingId,
    oldScheduledAt: oldSession.scheduledAt,
    newScheduledAt: scheduledAtIso,
    oldDuration: oldSessionData.duration,
    newDuration: newDuration,
    newTitle: dto.title || oldSession.title,
    mentorId: oldSession.mentorUserId,
    studentId: oldSession.studentUserId,
    counselorId: oldSession.createdByCounselorId,
    meetingProvider: meetingProvider,
  } as any);
}

// NEW: Always emit SESSION_RESCHEDULED_COMPLETED for both time and metadata changes
this.eventEmitter.emit(SESSION_RESCHEDULED_COMPLETED, {
  sessionId: sessionId,
  changeType: timeChanged ? 'TIME' : 'METADATA',
  mentorId: oldSession.mentorUserId,
  studentId: oldSession.studentUserId,
  counselorId: oldSession.createdByCounselorId,
  newScheduledAt: scheduledAtIso,
  newTitle: dto.title || oldSession.title,
  meetingProvider: meetingProvider,
} as any);
```

**Step 5: 构建响应（包含meeting信息）**
```typescript
// NEW: Construct response with all updated values including meeting info
// Do not re-query DB as meetings table will be updated asynchronously
return {
  ...updatedSession,
  title: dto.title || updatedSession.title,
  description: dto.description !== undefined ? dto.description : updatedSession.description,
  scheduledAt: scheduledAtIso || updatedSession.scheduledAt,
  duration: newDuration, // Use the newly calculated duration
  // Include complete meeting object for mapper
  meeting: oldSession.meeting,
};
```

#### 2.3 学生服务权益检查（已注释）

```typescript
// TODO: Validate student service balance (commented out for now)
// const studentBalance = await this.studentServiceService.getBalance(oldSession.studentUserId);
// if (studentBalance < 1) {
//   throw new InsufficientServiceBalanceException();
// }
```

---

## 3. 事件处理层 (Event Handler)

### 文件：`src/application/commands/services/regular-mentoring-created-event.handler.ts`

#### 3.1 处理会话更新事件

```typescript
@OnEvent(REGULAR_MENTORING_SESSION_UPDATED_EVENT)
async handleSessionUpdated(event: RegularMentoringSessionUpdatedEvent) {
  // Step 1: Check if meeting is in an updatable state
  const isMeetingUpdatable = await this.isMeetingUpdatable(event.meetingId);
  if (!isMeetingUpdatable) {
    this.logger.warn(
      `Meeting is in a non-updatable state (cancelled/ended). Update skipped. meetingId=${event.meetingId}`,
    );
    return; // Skip external meeting update
  }

  // Step 2: Update external meeting platform with retry mechanism
  try {
    await this.retryWithBackoff(
      async () => {
        return await this.meetingManagerService.updateMeeting(
          event.meetingId,
          {
            topic: event.newTitle,
            startTime: event.newScheduledAt,
            duration: event.newDuration,
          },
        );
      },
      3, // Max retries
    );
  } catch (error) {
    this.logger.error(`Failed to update meeting ${event.meetingId}: ${error.message}`);
    // Continue to update DB even if external update fails
  }

  // Step 3: Update meetings table in database with new schedule info
  if (event.meetingId) {
    const startTime = new Date(event.newScheduledAt);
    const result = await this.db.execute(sql`
      UPDATE meetings 
      SET 
        topic = ${event.newTitle},
        schedule_start_time = ${startTime.toISOString()},
        schedule_duration = ${event.newDuration},
        updated_at = NOW()
      WHERE id = ${event.meetingId}
    `);
    this.logger.debug(
      `Meetings table updated: topic=${event.newTitle}, ` +
      `scheduleStartTime=${startTime.toISOString()}, ` +
      `scheduleDuration=${event.newDuration}, ` +
      `affectedRows=${(result as any).rowCount}`,
    );
  }
}
```

#### 3.2 处理重新预约完成事件

```typescript
@OnEvent(SESSION_RESCHEDULED_COMPLETED)
async handleSessionRescheduled(event: SessionRescheduledEvent) {
  this.logger.log(
    `SESSION_RESCHEDULED_COMPLETED published for session ${event.sessionId}, ` +
    `updateSuccess=false`,
  );
  // Placeholder for future notification handler implementation
}
```

#### 3.3 辅助方法

```typescript
// Check if meeting is in an updatable state (not cancelled/ended)
private async isMeetingUpdatable(meetingId: string): Promise<boolean> {
  const result = await this.db.execute(
    sql`SELECT status FROM meetings WHERE id = ${meetingId}`,
  );
  const row = (result as any).rows?.[0];
  if (!row) {
    this.logger.warn(`Meeting not found: ${meetingId}`);
    return false;
  }
  // Only allow update for 'scheduled' or 'active' status
  return row.status === 'scheduled' || row.status === 'active';
}

// Retry mechanism with exponential backoff
private async retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number,
  initialDelayMs: number = 1000,
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      const delayMs = initialDelayMs * Math.pow(2, i);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}
```

---

## 4. 域层 (Domain Service)

### 文件：`src/domains/services/sessions/regular-mentoring/services/regular-mentoring.service.ts`

#### 4.1 更新会话方法

```typescript
async updateSession(
  id: string,
  dto: UpdateRegularMentoringDto,
  tx?: DrizzleTransaction, // NEW: Added transaction parameter
): Promise<RegularMentoringSessionEntity> {
  const updateData: Partial<RegularMentoringSessionEntity> = {};
  if (dto.title) updateData.title = dto.title;
  if (dto.description) updateData.description = dto.description;
  if (dto.scheduledAt) updateData.scheduledAt = new Date(dto.scheduledAt);
  // NOTE: Status is intentionally not updated here

  await this.repository.update(id, updateData, tx);
  this.logger.log(`Updated regular mentoring session ${id}`);
  return this.repository.findOne(id);
}
```

### 文件：`src/domains/services/sessions/regular-mentoring/services/regular-mentoring-query.service.ts`

#### 4.2 查询会话（包含meeting数据）

```typescript
async getSessionById(id: string): Promise<RegularMentoringSessionEntity & { meeting?: any; duration?: number }> {
  // Query with LEFT JOIN to get meeting details including duration
  const results = await this.db
    .select({
      session: regularMentoringSessions,
      meeting: meetings,
    })
    .from(regularMentoringSessions)
    .leftJoin(meetings, eq(regularMentoringSessions.meetingId, meetings.id))
    .where(eq(regularMentoringSessions.id, id));

  if (results.length === 0) {
    throw new SessionNotFoundException(id);
  }

  const row = results[0];
  return {
    ...row.session,
    meeting: row.meeting || undefined,
    duration: row.meeting?.scheduleDuration || undefined,
  } as any;
}
```

---

## 5. 日历服务 (Calendar Service)

### 文件：`src/core/calendar/services/calendar.service.ts`

#### 5.1 更新日历槽位方法

```typescript
async updateSlots(
  sessionId: string,
  updates: Partial<{
    title: string;
    status: SlotStatus;
    metadata: ICalendarMetadata;
  }>,
  tx?: DrizzleTransaction,
): Promise<void> {
  const executor: DrizzleExecutor = tx ?? this.db;
  const updateData: any = {};
  if (updates.title !== undefined) updateData.title = updates.title;
  if (updates.status !== undefined) updateData.status = updates.status;
  if (updates.metadata !== undefined) updateData.metadata = JSON.stringify(updates.metadata);
  updateData.updated_at = new Date();

  if (Object.keys(updateData).length === 0) return;

  await executor
    .update(schema.calendarSlots)
    .set(updateData)
    .where(eq(schema.calendarSlots.sessionId, sessionId));
}
```

---

## 6. Mapper 层

### 文件：`src/domains/services/sessions/regular-mentoring/mappers/regular-mentoring-session.mapper.ts`

#### 6.1 响应DTO映射

```typescript
static toResponseDto(entity: any): any {
  if (!entity) {
    return null;
  }

  const response: any = {
    id: entity.id,
    sessionType: entity.sessionType,
    sessionTypeId: entity.sessionTypeId,
    studentUserId: entity.studentUserId,
    mentorUserId: entity.mentorUserId,
    createdByCounselorId: entity.createdByCounselorId,
    title: entity.title,
    description: entity.description,
    status: entity.status,
    scheduledAt: entity.scheduledAt,
    completedAt: entity.completedAt,
    cancelledAt: entity.cancelledAt,
    deletedAt: entity.deletedAt,
    aiSummaries: entity.aiSummaries,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    duration: entity.duration, // NEW: Session duration from request or meeting table
  };

  // Add meeting information if available (from meetings table)
  if (entity.meeting) {
    response.meetingId = entity.meeting.meetingId; // Third-party platform meeting ID
    response.meetingProvider = entity.meeting.meetingProvider;
    response.meetingUrl = entity.meeting.meetingUrl;
    response.scheduleStartTime = entity.meeting.scheduleStartTime;
    response.scheduleDuration = entity.meeting.scheduleDuration;
    response.meetingNo = entity.meeting.meetingNo;
  } else if (entity.meetingId) {
    // If meeting object not present but meetingId exists
    response.meetingId = entity.meetingId;
    response.meetingProvider = entity.meetingProvider;
    response.meetingUrl = entity.meetingUrl;
    response.scheduleStartTime = entity.scheduleStartTime;
    response.scheduleDuration = entity.scheduleDuration;
    response.meetingNo = entity.meetingNo;
  }

  return response;
}
```

---

## 7. 事件常量

### 文件：`src/shared/events/event-constants.ts`

```typescript
export const REGULAR_MENTORING_SESSION_UPDATED_EVENT = "regular_mentoring.session.updated";
export const SESSION_RESCHEDULED_COMPLETED = "session.rescheduled.completed"; // NEW: Renamed from SESSION_RESCHEDULED_NOTIFICATION
```

---

## 关键设计要点

### 1. **时间/课时变更检测**
- 同时检查 `timeChanged` 和 `durationChanged`
- 任一变更都触发日历槽位更新

### 2. **日历槽位管理**
- 旧槽位：更新status为'cancelled'（保留审计跟踪）
- 新槽位：创建新的槽位记录

### 3. **异步会议更新**
- 两阶段事件流：
  1. `REGULAR_MENTORING_SESSION_UPDATED_EVENT` - 异步更新飞书/Zoom会议
  2. `SESSION_RESCHEDULED_COMPLETED` - 发送通知
- 使用重试机制（最多3次）处理外部API调用

### 4. **数据一致性**
- 同步更新：calendar和session表
- 异步更新：meetings表（在外部会议更新后）
- 立即返回新值给前端（不重新查询）

### 5. **Meeting信息包含**
- 返回完整的meeting对象用于展示
- 会议URL在重新预约时不变
- 返回第三方平台的meetingId（不是internal UUID）

---

## Postman 测试用法

```
PATCH http://localhost:3000/api/services/regular-mentoring/{sessionId}
Content-Type: application/json
Authorization: Bearer {access_token}

{
  "title": "新的标题",
  "description": "新的描述",
  "scheduledAt": "2025-12-10T10:00:00Z",
  "duration": 90
}
```

**响应示例：**
```json
{
  "id": "b6f06c2e-e6e9-4e9f-9541-079de00a73d1",
  "sessionType": "regular_mentoring",
  "studentUserId": "9e50af7d-5f08-4516-939f-7f765ce131b8",
  "mentorUserId": "4903b94b-67cc-42a1-9b3e-91ebc51bcefc",
  "createdByCounselorId": "65d6a77c-5a21-4c67-b6bb-6ef905bf4e0f",
  "title": "新的标题",
  "description": "新的描述",
  "status": "scheduled",
  "scheduledAt": "2025-12-10T10:00:00.000Z",
  "duration": 90,
  "meetingId": "146139010",
  "meetingProvider": "feishu",
  "meetingUrl": "https://vc.feishu.cn/j/146139010",
  "meetingNo": "146139010",
  "scheduleStartTime": "2025-12-10T10:00:00.000Z",
  "scheduleDuration": 90
}
```

---

## 修改的文件清单

1. ✅ `src/api/controllers/services/regular-mentoring.controller.ts`
2. ✅ `src/application/commands/services/regular-mentoring.service.ts`
3. ✅ `src/application/commands/services/regular-mentoring-created-event.handler.ts`
4. ✅ `src/core/calendar/services/calendar.service.ts`
5. ✅ `src/domains/services/sessions/regular-mentoring/services/regular-mentoring.service.ts`
6. ✅ `src/domains/services/sessions/regular-mentoring/services/regular-mentoring-query.service.ts`
7. ✅ `src/domains/services/sessions/regular-mentoring/mappers/regular-mentoring-session.mapper.ts`
8. ✅ `src/shared/events/event-constants.ts`

