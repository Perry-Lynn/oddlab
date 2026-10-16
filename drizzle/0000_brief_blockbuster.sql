CREATE TABLE `activity_daily` (
	`day` text NOT NULL,
	`kind` text NOT NULL,
	`source_path` text NOT NULL,
	`target_url` text NOT NULL,
	`action` text NOT NULL,
	`locale` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`day`, `kind`, `source_path`, `target_url`, `action`, `locale`)
);
