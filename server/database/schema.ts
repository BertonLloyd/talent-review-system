/* eslint-disable */
/** auto generated, do not edit */
import { sql } from 'drizzle-orm';
import { boolean, date, foreignKey, index, integer, jsonb, numeric, pgTable, text, uniqueIndex, uuid, varchar, customType } from "drizzle-orm/pg-core"

export const customTimestamptz = customType<{
  data: Date;
  driverData: string;
  config: { precision?: number };
}>({
  dataType(config) {
    const precision = typeof config?.precision !== 'undefined'
      ? ` (${config.precision})`
      : '';
    return `timestamptz${precision}`;
  },
  toDriver(value: Date | string | number) {
    if (value == null) return value as any;
    if (typeof value === 'number') return new Date(value).toISOString();
    if (typeof value === 'string') return value;
    if (value instanceof Date) return value.toISOString();
    throw new Error('Invalid timestamp value');
  },
  fromDriver(value: string | Date): Date {
    if (value instanceof Date) return value;
    return new Date(value);
  },
});

export const userProfile = customType<{
  data: string;
  driverData: string;
}>({
  dataType() {
    return 'user_profile';
  },
  toDriver(value: string) {
    return sql`ROW(${value})::user_profile`;
  },
  fromDriver(value: string) {
    const [userId] = value.slice(1, -1).split(',');
    return userId.trim();
  },
});

export type FileAttachment = {
  bucket_id: string;
  file_path: string;
};

export const fileAttachment = customType<{
  data: FileAttachment;
  driverData: string;
}>({
  dataType() {
    return 'file_attachment';
  },
  toDriver(value: FileAttachment) {
    return sql`ROW(${value.bucket_id},${value.file_path})::file_attachment`;
  },
  fromDriver(value: string): FileAttachment {
    const [bucketId, filePath] = value.slice(1, -1).split(',');
    return { bucket_id: bucketId.trim(), file_path: filePath.trim() };
  },
});

export function escapeLiteral(str: string): string {
  return "'" + str.replace(/'/g, "''") + "'";
}

export const userProfileArray = customType<{
  data: string[];
  driverData: string;
}>({
  dataType() {
    return 'user_profile[]';
  },
  toDriver(value: string[]) {
    if (!value || value.length === 0) {
      return sql`'{}'::user_profile[]`;
    }
    const elements = value.map(id => `ROW(${escapeLiteral(id)})::user_profile`).join(',');
    return sql.raw(`ARRAY[${elements}]::user_profile[]`);
  },
  fromDriver(value: string): string[] {
    if (!value || value === '{}') return [];
    const inner = value.slice(1, -1);
    const matches = inner.match(/\([^)]*\)/g) || [];
    return matches.map(m => m.slice(1, -1).split(',')[0].trim());
  },
});

export const fileAttachmentArray = customType<{
  data: FileAttachment[];
  driverData: string;
}>({
  dataType() {
    return 'file_attachment[]';
  },
  toDriver(value: FileAttachment[]) {
    if (!value || value.length === 0) {
      return sql`'{}'::file_attachment[]`;
    }
    const elements = value.map(f =>
      `ROW(${escapeLiteral(f.bucket_id)},${escapeLiteral(f.file_path)})::file_attachment`
    ).join(',');
    return sql.raw(`ARRAY[${elements}]::file_attachment[]`);
  },
  fromDriver(value: string): FileAttachment[] {
    if (!value || value === '{}') return [];
    const inner = value.slice(1, -1);
    const matches = inner.match(/\([^)]*\)/g) || [];
    return matches.map(m => {
      const [bucketId, filePath] = m.slice(1, -1).split(',');
      return { bucket_id: bucketId.trim(), file_path: filePath.trim() };
    });
  },
});

export const reviewRecord = pgTable("review_record", {
  id: uuid("id").primaryKey().defaultRandom(),
  reviewerKey: varchar("reviewer_key", { length: 50 }).notNull(),
  reviewerName: varchar("reviewer_name", { length: 50 }).notNull(),
  revieweeName: varchar("reviewee_name", { length: 50 }).notNull(),
  employeeNo: varchar("employee_no", { length: 50 }),
  department: varchar("department", { length: 100 }),
  positionType: varchar("position_type", { length: 50 }),
  /**
   * @type { Record<string, number> }
   */
  dimensionAvgs: jsonb("dimension_avgs").notNull().default('{}'),
  /**
   * @type { Record<string, number> }
   */
  compositeScores: jsonb("composite_scores").notNull().default('{}'),
  performanceScore: numeric("performance_score").notNull().default('0'),
  totalScore: numeric("total_score").notNull().default('0'),
  gridCategory: varchar("grid_category", { length: 30 }).notNull(),
  isRedLine: boolean("is_red_line").notNull().default(false),
  redLineDimensions: varchar("red_line_dimensions").array().notNull().default([]),
  isDeleted: boolean("is_deleted").notNull().default(false),
  isTest: boolean("is_test").notNull().default(false),
  ruleSetId: uuid("rule_set_id"),
  batchId: uuid("batch_id"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_review_record_reviewer_key").on(table.reviewerKey),
  index("idx_review_record_reviewee_name").on(table.revieweeName),
  index("idx_review_record_department").on(table.department),
  index("idx_review_record_grid_category").on(table.gridCategory),
  index("idx_review_record_created_at").on(table.createdAt),
  index("idx_review_record_rule_set").on(table.ruleSetId),
  index("idx_review_record_batch").on(table.batchId),
  index("idx_review_record_is_test").on(table.isTest),
  index("idx_review_record_position_type").on(table.positionType),
]);

export const ruleSetVersion = pgTable("rule_set_version", {
  id: uuid("id").primaryKey().defaultRandom(),
  ruleSetId: uuid("rule_set_id").notNull(),
  versionNo: integer("version_no").notNull(),
  /**
   * @type { dimensions: Array<{code:string,name:string,weight:number,isRedLine:boolean,items:Array<{code:string,name:string,maxScore:number,sortOrder:number,evidenceRequired:boolean}>,sortOrder:number}>; compositeDimensions?: Array<{code:string,name:string,formula:string,sortOrder:number}>; positionTypes?: Array<{code:string,name:string,performanceItems:Array<{code:string,name:string,maxScore:number,weight:number}>}>; gridThresholds: {high:number,low:number}; xAxisDimension: string; yAxisDimension: string; evidenceLevels?: Array<{code:string,name:string,minScore:number,maxScore:number,description:string}>; scoreLevels?: Array<{code:string,name:string,minScore:number,maxScore:number,description:string}> }
   */
  config: jsonb("config").notNull().default('{}'),
  changeNote: varchar("change_note", { length: 500 }),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("idx_rule_set_version_rsid_vno").on(table.ruleSetId, table.versionNo),
  index("idx_rule_set_version_rule_set_id").on(table.ruleSetId),
  foreignKey({
    columns: [table.ruleSetId],
    foreignColumns: [ruleSet.id],
    name: "rule_set_version_rule_set_id_fkey",
  }).onDelete("cascade"),
]);

export const appDisplaySetting = pgTable("app_display_setting", {
  id: uuid("id").primaryKey().defaultRandom(),
  settingKey: varchar("setting_key", { length: 50 }).notNull().unique(),
  settingValue: varchar("setting_value", { length: 1000 }).notNull(),
  sortOrder: integer("sort_order").default(0),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("idx_display_setting_key").on(table.settingKey),
]);

export const reviewParticipant = pgTable("review_participant", {
  id: uuid("id").primaryKey().defaultRandom(),
  batchId: uuid("batch_id").notNull(),
  reviewerKey: varchar("reviewer_key", { length: 50 }).notNull(),
  reviewerName: varchar("reviewer_name", { length: 50 }).notNull(),
  revieweeName: varchar("reviewee_name", { length: 50 }).notNull(),
  department: varchar("department", { length: 100 }),
  positionType: varchar("position_type", { length: 50 }),
  sortOrder: integer("sort_order").default(0),
  employeeNo: varchar("employee_no", { length: 50 }),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("idx_participant_batch_reviewer_reviewee").on(table.batchId, table.reviewerKey, table.revieweeName),
  index("idx_participant_batch").on(table.batchId),
  index("idx_participant_reviewer").on(table.reviewerKey),
  foreignKey({
    columns: [table.batchId],
    foreignColumns: [reviewBatch.id],
    name: "review_participant_batch_id_fkey",
  }),
]);

export const reviewBatch = pgTable("review_batch", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
  ruleSetId: uuid("rule_set_id").notNull(),
  startDate: date("start_date"),
  endDate: date("end_date"),
  status: varchar("status", { length: 20 }).notNull().default('active'),
  description: text("description"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  foreignKey({
    columns: [table.ruleSetId],
    foreignColumns: [ruleSet.id],
    name: "review_batch_rule_set_id_fkey",
  }),
]);

export const ruleSet = pgTable("rule_set", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 20 }).notNull().default('draft'),
  isDefault: boolean("is_default").notNull().default(false),
  /**
   * @type { dimensions: Array<{code:string,name:string,weight:number,isRedLine:boolean,items:Array<{code:string,name:string,maxScore:number,sortOrder:number}>}>; gridThresholds: {high:number,low:number}; xAxisDimension: string; yAxisDimension: string; evidenceLevels: Array<{code:string,name:string,minScore:number,maxScore:number,description:string}>; scoreLevels: Array<{code:string,name:string,minScore:number,maxScore:number,description:string}>; positionTypes?: Array<{code:string,name:string,performanceItems:Array<{code:string,name:string,maxScore:number}>}> }
   */
  config: jsonb("config").notNull().default('{}'),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
});

export const reviewScoreItem = pgTable("review_score_item", {
  id: uuid("id").primaryKey().defaultRandom(),
  reviewId: uuid("review_id").notNull(),
  dimensionCode: varchar("dimension_code", { length: 50 }).notNull(),
  itemCode: varchar("item_code", { length: 50 }).notNull(),
  itemName: varchar("item_name", { length: 100 }).notNull(),
  score: integer("score").notNull(),
  maxScore: integer("max_score").notNull().default(5),
  evidenceLevel: varchar("evidence_level", { length: 20 }),
  evidenceText: text("evidence_text").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("idx_review_score_item_unique").on(table.reviewId, table.itemCode),
  index("idx_review_score_item_review").on(table.reviewId),
  index("idx_review_score_item_dimension").on(table.dimensionCode),
]);

export const reviewerAccount = pgTable("reviewer_account", {
  reviewerKey: varchar("reviewer_key", { length: 50 }).primaryKey(),
  reviewerName: varchar("reviewer_name", { length: 50 }).notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: varchar("role", { length: 20 }).notNull().default('reviewer'),
  department: varchar("department", { length: 100 }),
  status: varchar("status", { length: 20 }).notNull().default('active'),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

// table aliases
export const appDisplaySettingTable = appDisplaySetting;
export const reviewBatchTable = reviewBatch;
export const reviewParticipantTable = reviewParticipant;
export const reviewRecordTable = reviewRecord;
export const reviewScoreItemTable = reviewScoreItem;
export const reviewerAccountTable = reviewerAccount;
export const ruleSetTable = ruleSet;
export const ruleSetVersionTable = ruleSetVersion;
