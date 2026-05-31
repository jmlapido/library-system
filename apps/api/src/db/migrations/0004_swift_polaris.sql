CREATE TABLE "notification_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid,
	"user_id" uuid,
	"checkout_id" uuid,
	"notification_type" text NOT NULL,
	"channel" text NOT NULL,
	"status" text DEFAULT 'sent' NOT NULL,
	"message_preview" text,
	"sent_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "notification_channel" varchar(10);--> statement-breakpoint
ALTER TABLE "notification_log" ADD CONSTRAINT "notification_log_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_log" ADD CONSTRAINT "notification_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_log" ADD CONSTRAINT "notification_log_checkout_id_checkouts_id_fk" FOREIGN KEY ("checkout_id") REFERENCES "public"."checkouts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_log_user_id_idx" ON "notification_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notification_log_sent_at_idx" ON "notification_log" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "notification_log_type_idx" ON "notification_log" USING btree ("notification_type");