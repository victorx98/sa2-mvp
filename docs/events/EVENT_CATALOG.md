# Event Catalog

> Auto-generated on 2025-12-20T06:30:29.323Z  
> Total Events: 35 | Orphans: 0 | Deprecated: 0

## Quick Stats

| Metric | Count |
|--------|-------|
| Total Events | 35 |
| Active Events | 35 |
| Orphan Events (no consumers) | 0 |
| Deprecated Events | 0 |

---

## Events by Producer

### FinancialModule

- `financial.appeal.approved` (v1.0)
- `financial.appeal.created` (v1.0)
- `financial.appeal.rejected` (v1.0)
- `financial.settlement.confirmed` (v1.0)

### MeetingModule

- `meeting.lifecycle.completed` (v4.1)
- `meeting.recording.ready` (v4.1)

### PlacementModule

- `placement.application.status_changed` (v1.0)
- `placement.application.status_rolled_back` (v1.0)
- `placement.application.submitted` (v1.0)

### ServicesModule

- `ai_career.session.cancelled` (v2.0)
- `ai_career.session.created` (v2.0)
- `ai_career.session.meeting.operation.result` (v2.0)
- `ai_career.session.updated` (v2.0)
- `class_session.session.cancelled` (v1.0)
- `class_session.session.created` (v1.0)
- `class_session.session.meeting.operation.result` (v1.0)
- `class_session.session.updated` (v1.0)
- `class.student.added` (v1.0)
- `class.student.removed` (v1.0)
- `comm_session.session.cancelled` (v2.0)
- `comm_session.session.created` (v2.0)
- `comm_session.session.meeting.operation.result` (v2.0)
- `comm_session.session.updated` (v2.0)
- `gap_analysis.session.cancelled` (v2.0)
- `gap_analysis.session.created` (v2.0)
- `gap_analysis.session.meeting.operation.result` (v2.0)
- `gap_analysis.session.updated` (v2.0)
- `regular_mentoring.session.cancelled` (v2.0)
- `regular_mentoring.session.created` (v2.0)
- `regular_mentoring.session.meeting.operation.result` (v2.0)
- `regular_mentoring.session.updated` (v2.0)
- `resume.bill.cancelled` (v1.0)
- `resume.billed` (v1.0)
- `services.session.completed` (v1.0)
- `session.booked` (v1.0)


---

## Events by Consumer

### CalendarModule

- `meeting.lifecycle.completed` (v4.1)

### ContractModule

- `class.student.added` (v1.0)
- `class.student.removed` (v1.0)
- `placement.application.status_changed` (v1.0)
- `placement.application.status_rolled_back` (v1.0)
- `resume.bill.cancelled` (v1.0)
- `resume.billed` (v1.0)
- `services.session.completed` (v1.0)

### FinancialModule

- `financial.appeal.approved` (v1.0)
- `financial.settlement.confirmed` (v1.0)
- `placement.application.status_changed` (v1.0)
- `placement.application.status_rolled_back` (v1.0)
- `services.session.completed` (v1.0)

### ServicesModule

- `ai_career.session.cancelled` (v2.0)
- `ai_career.session.created` (v2.0)
- `ai_career.session.updated` (v2.0)
- `class_session.session.cancelled` (v1.0)
- `class_session.session.created` (v1.0)
- `class_session.session.updated` (v1.0)
- `comm_session.session.cancelled` (v2.0)
- `comm_session.session.created` (v2.0)
- `comm_session.session.updated` (v2.0)
- `gap_analysis.session.cancelled` (v2.0)
- `gap_analysis.session.created` (v2.0)
- `gap_analysis.session.updated` (v2.0)
- `meeting.lifecycle.completed` (v4.1)
- `placement.application.submitted` (v1.0)
- `regular_mentoring.session.cancelled` (v2.0)
- `regular_mentoring.session.created` (v2.0)
- `regular_mentoring.session.updated` (v2.0)

### TelemetryModule

- `ai_career.session.meeting.operation.result` (v2.0)
- `class_session.session.meeting.operation.result` (v1.0)
- `comm_session.session.meeting.operation.result` (v2.0)
- `financial.appeal.created` (v1.0)
- `financial.appeal.rejected` (v1.0)
- `gap_analysis.session.meeting.operation.result` (v2.0)
- `meeting.recording.ready` (v4.1)
- `regular_mentoring.session.meeting.operation.result` (v2.0)
- `session.booked` (v1.0)


---

## Dependency Matrix

| Event | Version | Producers | Consumers | Status |
|-------|---------|-----------|-----------|--------|
| `ai_career.session.cancelled` | 2.0 | ServicesModule | ServicesModule | Active |
| `ai_career.session.created` | 2.0 | ServicesModule | ServicesModule | Active |
| `ai_career.session.meeting.operation.result` | 2.0 | ServicesModule | TelemetryModule | Active |
| `ai_career.session.updated` | 2.0 | ServicesModule | ServicesModule | Active |
| `class_session.session.cancelled` | 1.0 | ServicesModule | ServicesModule | Active |
| `class_session.session.created` | 1.0 | ServicesModule | ServicesModule | Active |
| `class_session.session.meeting.operation.result` | 1.0 | ServicesModule | TelemetryModule | Active |
| `class_session.session.updated` | 1.0 | ServicesModule | ServicesModule | Active |
| `class.student.added` | 1.0 | ServicesModule | ContractModule | Active |
| `class.student.removed` | 1.0 | ServicesModule | ContractModule | Active |
| `comm_session.session.cancelled` | 2.0 | ServicesModule | ServicesModule | Active |
| `comm_session.session.created` | 2.0 | ServicesModule | ServicesModule | Active |
| `comm_session.session.meeting.operation.result` | 2.0 | ServicesModule | TelemetryModule | Active |
| `comm_session.session.updated` | 2.0 | ServicesModule | ServicesModule | Active |
| `financial.appeal.approved` | 1.0 | FinancialModule | FinancialModule | Active |
| `financial.appeal.created` | 1.0 | FinancialModule | TelemetryModule | Active |
| `financial.appeal.rejected` | 1.0 | FinancialModule | TelemetryModule | Active |
| `financial.settlement.confirmed` | 1.0 | FinancialModule | FinancialModule | Active |
| `gap_analysis.session.cancelled` | 2.0 | ServicesModule | ServicesModule | Active |
| `gap_analysis.session.created` | 2.0 | ServicesModule | ServicesModule | Active |
| `gap_analysis.session.meeting.operation.result` | 2.0 | ServicesModule | TelemetryModule | Active |
| `gap_analysis.session.updated` | 2.0 | ServicesModule | ServicesModule | Active |
| `meeting.lifecycle.completed` | 4.1 | MeetingModule | CalendarModule, ServicesModule | Active |
| `meeting.recording.ready` | 4.1 | MeetingModule | TelemetryModule | Active |
| `placement.application.status_changed` | 1.0 | PlacementModule | FinancialModule, ContractModule | Active |
| `placement.application.status_rolled_back` | 1.0 | PlacementModule | FinancialModule, ContractModule | Active |
| `placement.application.submitted` | 1.0 | PlacementModule | ServicesModule | Active |
| `regular_mentoring.session.cancelled` | 2.0 | ServicesModule | ServicesModule | Active |
| `regular_mentoring.session.created` | 2.0 | ServicesModule | ServicesModule | Active |
| `regular_mentoring.session.meeting.operation.result` | 2.0 | ServicesModule | TelemetryModule | Active |
| `regular_mentoring.session.updated` | 2.0 | ServicesModule | ServicesModule | Active |
| `resume.bill.cancelled` | 1.0 | ServicesModule | ContractModule | Active |
| `resume.billed` | 1.0 | ServicesModule | ContractModule | Active |
| `services.session.completed` | 1.0 | ServicesModule | FinancialModule, ContractModule | Active |
| `session.booked` | 1.0 | ServicesModule | TelemetryModule | Active |

---

## Warnings & Issues

_No warnings_
