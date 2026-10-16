import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
export const activityDaily = sqliteTable('activity_daily', {
 day: text('day').notNull(),kind:text('kind').notNull(),sourcePath:text('source_path').notNull(),targetUrl:text('target_url').notNull(),action:text('action').notNull(),locale:text('locale').notNull(),
 count:integer('count').notNull().default(0),updatedAt:text('updated_at').notNull()
}, t=>[primaryKey({columns:[t.day,t.kind,t.sourcePath,t.targetUrl,t.action,t.locale]})]);
