/**
 * Session Completed Event
 * 
 * Published when a session is completed (used to notify Calendar module)
 */
export class SessionCompletedEvent {
  constructor(
    public readonly sessionId: string,
    public readonly sessionType: string,
    public readonly studentUserId: string,
    public readonly scheduledAt: Date,
  ) {}
}

