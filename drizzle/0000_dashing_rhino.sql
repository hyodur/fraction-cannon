CREATE TABLE `players` (
	`id` text PRIMARY KEY NOT NULL,
	`nickname` text NOT NULL,
	`unlocked` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `records` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`stage` integer NOT NULL,
	`season` text NOT NULL,
	`score` integer NOT NULL,
	`shots` integer NOT NULL,
	`errors` integer NOT NULL,
	`milliseconds` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_records_player_stage_season` ON `records` (`player_id`,`stage`,`season`);--> statement-breakpoint
CREATE INDEX `idx_records_ranking` ON `records` (`season`,`stage`,`score`,`shots`,`errors`,`milliseconds`);--> statement-breakpoint
CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`stage` integer NOT NULL,
	`state` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_runs_player_updated` ON `runs` (`player_id`,`updated_at`);