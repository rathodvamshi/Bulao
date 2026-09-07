CREATE TABLE `blocks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`target_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`target_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `block_once` ON `blocks` (`user_id`,`target_id`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`icon` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `interactions` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`job_id` text,
	`service_id` text,
	`owner_id` text NOT NULL,
	`worker_id` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`owner_confirmed_at` integer,
	`worker_confirmed_at` integer,
	`details` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`service_id`) REFERENCES `service_profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`worker_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `application_unique` ON `interactions` (`job_id`,`worker_id`);--> statement-breakpoint
CREATE INDEX `interaction_owner` ON `interactions` (`owner_id`,`status`);--> statement-breakpoint
CREATE INDEX `interaction_worker` ON `interactions` (`worker_id`,`status`);--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`category_id` text NOT NULL,
	`role_id` text NOT NULL,
	`area` text NOT NULL,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	`starts_at` integer NOT NULL,
	`workers` integer NOT NULL,
	`pay_paise` integer NOT NULL,
	`pay_unit` text NOT NULL,
	`details` text NOT NULL,
	`status` text DEFAULT 'PUBLISHED' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `jobs_discovery` ON `jobs` (`status`,`category_id`,`latitude`);--> statement-breakpoint
CREATE TABLE `locations` (
	`id` text PRIMARY KEY NOT NULL,
	`area` text NOT NULL,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`reporter_id` text NOT NULL,
	`target_id` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`reporter_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`target_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`interaction_id` text NOT NULL,
	`author_id` text NOT NULL,
	`target_id` text NOT NULL,
	`stars` integer NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`interaction_id`) REFERENCES `interactions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`target_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `review_once` ON `reviews` (`interaction_id`,`author_id`);--> statement-breakpoint
CREATE INDEX `review_target` ON `reviews` (`target_id`);--> statement-breakpoint
CREATE TABLE `roles` (
	`id` text PRIMARY KEY NOT NULL,
	`category_id` text NOT NULL,
	`name` text NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `service_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`category_id` text NOT NULL,
	`area` text NOT NULL,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	`radius_km` real NOT NULL,
	`experience` integer NOT NULL,
	`available` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `service_user_category` ON `service_profiles` (`user_id`,`category_id`);--> statement-breakpoint
CREATE INDEX `service_discovery` ON `service_profiles` (`category_id`,`available`,`latitude`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`phone` text NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`area` text DEFAULT '' NOT NULL,
	`suspended` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_phone_unique` ON `users` (`phone`);