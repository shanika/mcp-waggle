CREATE TABLE `progress_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`summary` text NOT NULL,
	`details` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_progress_created` ON `progress_entries` (`created_at`);--> statement-breakpoint
CREATE TABLE `research_activities` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`goal` text NOT NULL,
	`status` text DEFAULT 'in_progress' NOT NULL,
	`results` text,
	`tags` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_research_status` ON `research_activities` (`status`);--> statement-breakpoint
CREATE INDEX `idx_research_created` ON `research_activities` (`created_at`);--> statement-breakpoint
CREATE TABLE `test_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`suite` text NOT NULL,
	`status` text NOT NULL,
	`total` integer DEFAULT 0 NOT NULL,
	`passed` integer DEFAULT 0 NOT NULL,
	`failed` integer DEFAULT 0 NOT NULL,
	`skipped` integer DEFAULT 0 NOT NULL,
	`duration_ms` integer,
	`summary` text,
	`output` text,
	`research_id` text,
	`ran_at` text NOT NULL,
	FOREIGN KEY (`research_id`) REFERENCES `research_activities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_test_runs_suite` ON `test_runs` (`suite`);--> statement-breakpoint
CREATE INDEX `idx_test_runs_status` ON `test_runs` (`status`);--> statement-breakpoint
CREATE INDEX `idx_test_runs_ran` ON `test_runs` (`ran_at`);