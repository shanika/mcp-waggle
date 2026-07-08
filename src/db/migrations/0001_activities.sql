CREATE TABLE `activities` (
	`id` text PRIMARY KEY NOT NULL,
	`activity` text NOT NULL,
	`details` text,
	`research_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`research_id`) REFERENCES `research_activities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_activities_research` ON `activities` (`research_id`);--> statement-breakpoint
CREATE INDEX `idx_activities_created` ON `activities` (`created_at`);