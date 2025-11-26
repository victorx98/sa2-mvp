ALTER TYPE "public"."hold_status" ADD VALUE 'expired';--> statement-breakpoint
CREATE TABLE "meeting_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" varchar(255) NOT NULL,
	"event_id" varchar(255) NOT NULL,
	"provider" varchar(20) NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"operator_id" varchar(255),
	"operator_role" integer,
	"meeting_no" varchar(20),
	"meeting_topic" varchar(255),
	"meeting_start_time" timestamp with time zone,
	"meeting_end_time" timestamp with time zone,
	"event_data" jsonb NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meeting_events_event_id_unique" UNIQUE("event_id"),
	CONSTRAINT "uq_meeting_event_id" UNIQUE("event_id")
);
--> statement-breakpoint
CREATE TABLE "meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_no" varchar(20) NOT NULL,
	"meeting_provider" varchar(20) NOT NULL,
	"meeting_id" varchar(255) NOT NULL,
	"topic" varchar(255) NOT NULL,
	"meeting_url" text NOT NULL,
	"schedule_start_time" timestamp with time zone NOT NULL,
	"schedule_duration" integer NOT NULL,
	"status" varchar(20) DEFAULT 'scheduled' NOT NULL,
	"actual_duration" integer,
	"meeting_time_list" jsonb DEFAULT '[]'::jsonb,
	"recording_url" text,
	"last_meeting_ended_timestamp" timestamp with time zone,
	"pending_task_id" varchar(255),
	"event_type" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unique_meeting_no_provider_time" UNIQUE("meeting_no","meeting_provider","schedule_start_time")
);
--> statement-breakpoint
CREATE TABLE "mentoring_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"mentor_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'scheduled' NOT NULL,
	"service_duration" integer,
	"feedback" text,
	"rating" integer,
	"topic" varchar(255),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "unique_mentoring_meeting_id" UNIQUE("meeting_id")
);
--> statement-breakpoint
DROP INDEX "idx_session_meeting";--> statement-breakpoint
ALTER TABLE "service_holds" ADD COLUMN "expiry_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "mentoring_sessions" ADD CONSTRAINT "mentoring_sessions_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_meeting_no" ON "meeting_events" USING btree ("meeting_no");--> statement-breakpoint
CREATE INDEX "idx_meeting_event_type" ON "meeting_events" USING btree ("event_type","provider");--> statement-breakpoint
CREATE INDEX "idx_meeting_event_lookup" ON "meeting_events" USING btree ("meeting_id","event_type");--> statement-breakpoint
CREATE INDEX "idx_meeting_event_operator" ON "meeting_events" USING btree ("operator_id","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_meeting_event_time" ON "meeting_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "idx_meeting_no_created_at" ON "meetings" USING btree ("meeting_no","created_at");--> statement-breakpoint
CREATE INDEX "idx_meeting_status" ON "meetings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_schedule_start_time" ON "meetings" USING btree ("schedule_start_time");--> statement-breakpoint
CREATE INDEX "idx_mentoring_student_created_at" ON "mentoring_sessions" USING btree ("student_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_mentoring_mentor_created_at" ON "mentoring_sessions" USING btree ("mentor_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_mentoring_status" ON "mentoring_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_mentoring_deleted_at" ON "mentoring_sessions" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_session_meeting_no" ON "sessions" USING btree ("meeting_no");--> statement-breakpoint
ALTER TABLE "sessions" DROP COLUMN "meeting_id";