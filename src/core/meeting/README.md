# Core Meeting Module

## Overview

Core module for meeting resource management following DDD principles. Handles meeting lifecycle, event sourcing, and state management for video conferencing platforms (Feishu, Zoom).

## Architecture

```
src/core/meeting/
├── providers/           # Meeting platform adapters (Feishu, Zoom)
├── entities/           # Domain entities
├── repositories/       # Data access layer
├── services/           # Business logic services
├── dto/               # Data transfer objects
├── events/            # Domain events
├── tasks/             # Background tasks
└── exceptions/        # Custom exceptions
```

## Key Components

### 1. Meeting Manager Service

Handles application-layer commands:

```typescript
import { MeetingManagerService } from '@core/meeting';

// Create meeting
const meeting = await meetingManager.createMeeting({
  topic: 'Weekly Review',
  startTime: '2025-11-20T10:00:00Z',
  duration: 60,
  provider: MeetingProviderType.FEISHU,
  hostUserId: 'ou_xxxxx',
  autoRecord: true,
});

// Update meeting
await meetingManager.updateMeeting(meeting.id, {
  topic: 'Updated Topic',
  duration: 90,
});

// Cancel meeting
await meetingManager.cancelMeeting(meeting.id);
```

### 2. Meeting Event Service

Processes webhook events:

```typescript
import { MeetingEventService } from '@core/meeting';

// Record event from webhook
await eventService.recordEvent({
  meetingNo: '123456789',
  meetingId: 'vc_xxxxx',
  eventId: 'event_xxxxx',
  eventType: 'vc.meeting.meeting_started_v1',
  provider: 'feishu',
  eventData: rawPayload,
  occurredAt: new Date(),
});
```

### 3. Meeting Lifecycle Events

Listen to domain events:

```typescript
import { OnEvent } from '@nestjs/event-emitter';
import { MeetingLifecycleCompletedEvent } from '@core/meeting';

@OnEvent('meeting.lifecycle.completed')
async handleMeetingCompleted(event: MeetingLifecycleCompletedEvent) {
  const { meetingId, actualDuration, recordingUrl } = event;
  // Update downstream domain (e.g., mentoring_sessions)
  await this.sessionService.updateFromMeeting(meetingId, {
    actualDuration,
    recordingUrl,
  });
}
```

## Database Schema

### meetings Table

Core aggregate root for meeting resources:

- `id` - UUID primary key (referenced by downstream domains)
- `meeting_no` - Meeting number (Feishu 9-digit, can be reused)
- `meeting_provider` - 'feishu' | 'zoom'
- `status` - 'scheduled' | 'active' | 'ended' | 'expired'
- `actual_duration` - Physical duration in seconds
- `meeting_time_list` - JSONB array of time segments

### meeting_events Table

Event sourcing table for all webhook events.

## State Machine

```
scheduled → active → ended
    ↓
  expired (if not started)
```

## Deduplication Strategy

- 7-day window check for `meeting_no` reuse
- Event deduplication via `event_id` (webhook header)

## Delayed Completion Detection

1. Webhook receives `meeting.ended` event
2. Schedule delayed check (30 minutes)
3. After delay, check for new `join` events
4. If no new joins → finalize meeting
5. If new joins detected → reschedule check

## Usage Example

```typescript
// 1. Create meeting via Application Service
const meeting = await meetingManager.createMeeting(dto);

// 2. User joins meeting → Webhook arrives
await eventService.recordEvent(webhookPayload);

// 3. System transitions meeting to 'active'

// 4. User leaves → Webhook arrives
await eventService.recordEvent(webhookPayload);

// 5. Delayed task checks completion (30 min later)

// 6. System finalizes meeting → Publishes MeetingLifecycleCompletedEvent

// 7. Downstream domains update their business records
```

## Integration Points

### Webhook Module

```typescript
// In webhook handler
import { MeetingEventService } from '@core/meeting';

@Injectable()
export class FeishuWebhookHandler {
  constructor(private readonly meetingEventService: MeetingEventService) {}

  async handleMeetingEvent(payload: any) {
    const eventData = this.extractEventData(payload);
    await this.meetingEventService.recordEvent(eventData);
  }
}
```

### Domain Modules (Mentoring, Interview, etc.)

```typescript
// In mentoring domain
import { MeetingLifecycleCompletedEvent } from '@core/meeting';

@Injectable()
export class MentoringEventHandler {
  @OnEvent('meeting.lifecycle.completed')
  async handleMeetingCompleted(event: MeetingLifecycleCompletedEvent) {
    // Query mentoring_sessions by meeting_id (FK)
    const session = await this.sessionRepo.findByMeetingId(event.meetingId);
    
    if (session) {
      await this.sessionRepo.update(session.id, {
        status: 'completed',
        actualDuration: event.actualDuration,
        recordingUrl: event.recordingUrl,
      });
    }
  }
}
```

## Configuration

Required environment variables:

```env
# Feishu credentials
FEISHU_APP_ID=cli_xxxxx
FEISHU_APP_SECRET=xxxxx

# Default provider
DEFAULT_MEETING_PROVIDER=feishu
```

## Notes

- All queries by `meeting_no` MUST include time window constraint (7 days)
- Use `meetingId` (UUID) for downstream FK relationships
- Provider layer is pluggable (easy to add new platforms)
- Event sourcing enables audit trail and replay capability

