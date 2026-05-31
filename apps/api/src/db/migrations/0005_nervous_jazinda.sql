CREATE TYPE "public"."notification_channel_enum" AS ENUM('email', 'sms', 'both');--> statement-breakpoint
CREATE TYPE "public"."notification_status_enum" AS ENUM('sent', 'failed', 'opted_out');--> statement-breakpoint
CREATE TYPE "public"."notification_type_enum" AS ENUM('due_reminder', 'overdue_notice', 'fine_notice', 'hold_ready', 'hold_expired');--> statement-breakpoint
ALTER TABLE "notification_log" DROP CONSTRAINT "notification_log_school_id_schools_id_fk";
--> statement-breakpoint
ALTER TABLE "notification_log" DROP CONSTRAINT "notification_log_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "notification_log" DROP CONSTRAINT "notification_log_checkout_id_checkouts_id_fk";
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "notification_channel" SET DATA TYPE notification_channel_enum USING "notification_channel"::notification_channel_enum;--> statement-breakpoint
ALTER TABLE "notification_log" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_log" ALTER COLUMN "notification_type" SET DATA TYPE notification_type_enum USING "notification_type"::notification_type_enum;--> statement-breakpoint
ALTER TABLE "notification_log" ALTER COLUMN "channel" SET DATA TYPE notification_channel_enum USING "channel"::notification_channel_enum;--> statement-breakpoint
ALTER TABLE "notification_log" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "notification_log" ALTER COLUMN "status" SET DATA TYPE notification_status_enum USING "status"::notification_status_enum;--> statement-breakpoint
ALTER TABLE "notification_log" ALTER COLUMN "status" SET DEFAULT 'sent'::notification_status_enum;--> statement-breakpoint
ALTER TABLE "notification_log" ALTER COLUMN "message_preview" SET DATA TYPE varchar(200);--> statement-breakpoint
ALTER TABLE "notification_log" ADD CONSTRAINT "notification_log_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_log" ADD CONSTRAINT "notification_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_log" ADD CONSTRAINT "notification_log_checkout_id_checkouts_id_fk" FOREIGN KEY ("checkout_id") REFERENCES "public"."checkouts"("id") ON DELETE set null ON UPDATE no action;