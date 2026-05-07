CREATE INDEX "book_inventory_book_id_idx" ON "book_inventory" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "book_inventory_school_id_idx" ON "book_inventory" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "book_inventory_status_idx" ON "book_inventory" USING btree ("status");--> statement-breakpoint
CREATE INDEX "books_school_id_idx" ON "books" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "checkouts_user_id_idx" ON "checkouts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "checkouts_book_inventory_id_idx" ON "checkouts" USING btree ("book_inventory_id");--> statement-breakpoint
CREATE INDEX "checkouts_status_idx" ON "checkouts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "holds_user_id_idx" ON "holds" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "users_school_id_idx" ON "users" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");