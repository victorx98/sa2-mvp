import { Module } from "@nestjs/common";
import { MentoringService } from "./services/mentoring.service";
import { MentoringEventListener } from "./listeners/mentoring-event.listener";

/**
 * Mentoring Module
 *
 * Business domain module for mentoring sessions
 *
 * Responsibilities:
 * 1. Manage mentoring session business logic and state
 * 2. Listen to Core Meeting lifecycle events
 * 3. Handle mentoring-specific billing, feedback, and rating
 *
 * Dependencies:
 * - Core Meeting Module (via events and FK references)
 * - Database (via DATABASE_CONNECTION)
 */
@Module({
  providers: [
    MentoringService,
    MentoringEventListener,
  ],
  exports: [
    MentoringService,
  ],
})
export class MentoringModule {}

