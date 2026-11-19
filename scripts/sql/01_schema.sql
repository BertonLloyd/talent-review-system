-- =============================================================================
-- 人才盘点系统 · 业务表建表脚本
-- 依据：server/database/schema.ts（仅 8 张业务表，不含 *_bak_20261111 备份表）
-- 说明：
--   1. 脚本可独立执行，可重复执行（先 DROP 后 CREATE，会清空同名表数据）
--   2. 每张表含 4 个审计列、RLS 与 4 条默认 policy
--   3. reviewer_account 与 schema.ts / 线上库保持一致，只有 2 个时间审计列
--      （_created_at / _updated_at），不含 _created_by / _updated_by；
--      其余 7 张表均为 4 个审计列
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- user_profile 复合类型（平台约定：单字段 user_id）
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_profile') THEN
    CREATE TYPE user_profile AS (user_id text);
  END IF;
END $$;

-- 重置（子表先删）
DROP TABLE IF EXISTS review_score_item   CASCADE;
DROP TABLE IF EXISTS review_record       CASCADE;
DROP TABLE IF EXISTS review_participant  CASCADE;
DROP TABLE IF EXISTS review_batch        CASCADE;
DROP TABLE IF EXISTS rule_set_version    CASCADE;
DROP TABLE IF EXISTS rule_set            CASCADE;
DROP TABLE IF EXISTS reviewer_account    CASCADE;
DROP TABLE IF EXISTS app_display_setting CASCADE;


-- -----------------------------------------------------------------------------
-- 1. rule_set 规则集
-- -----------------------------------------------------------------------------
CREATE TABLE rule_set (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        varchar(100) NOT NULL,
  description text,
  status      varchar(20)  NOT NULL DEFAULT 'draft',
  is_default  boolean      NOT NULL DEFAULT false,
  config      jsonb        NOT NULL DEFAULT '{}',
  _created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _created_by user_profile DEFAULT (
    CASE
      WHEN NULLIF(current_setting('app.user_id', TRUE), '') IS NULL THEN NULL
      ELSE ROW(current_setting('app.user_id', TRUE))::user_profile
    END
  ),
  _updated_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_by user_profile DEFAULT (
    CASE
      WHEN NULLIF(current_setting('app.user_id', TRUE), '') IS NULL THEN NULL
      ELSE ROW(current_setting('app.user_id', TRUE))::user_profile
    END
  )
);

COMMENT ON TABLE  rule_set IS '规则集';
COMMENT ON COLUMN rule_set.config IS '@type { dimensions: Array<{ code: string; name: string; weight: number; isRedLine: boolean; items: Array<{ code: string; name: string; maxScore: number; sortOrder: number }> }>; gridThresholds: { high: number; low: number }; xAxisDimension: string; yAxisDimension: string; evidenceLevels?: Array<{ code: string; name: string; minScore: number; maxScore: number; description: string }>; scoreLevels?: Array<{ code: string; name: string; minScore: number; maxScore: number; description: string }>; positionTypes?: Array<{ code: string; name: string; performanceItems: Array<{ code: string; name: string; maxScore: number; weight: number }> }>; compositeDimensions?: Array<{ code: string; name: string; formula: string; sortOrder: number }>; displayLabels?: Record<string, string> }';


-- -----------------------------------------------------------------------------
-- 2. rule_set_version 规则集版本快照
-- -----------------------------------------------------------------------------
CREATE TABLE rule_set_version (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_set_id uuid NOT NULL,
  version_no  integer NOT NULL,
  config      jsonb NOT NULL DEFAULT '{}',
  change_note varchar(500),
  _created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _created_by user_profile DEFAULT (
    CASE
      WHEN NULLIF(current_setting('app.user_id', TRUE), '') IS NULL THEN NULL
      ELSE ROW(current_setting('app.user_id', TRUE))::user_profile
    END
  ),
  _updated_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_by user_profile DEFAULT (
    CASE
      WHEN NULLIF(current_setting('app.user_id', TRUE), '') IS NULL THEN NULL
      ELSE ROW(current_setting('app.user_id', TRUE))::user_profile
    END
  ),
  CONSTRAINT rule_set_version_rule_set_id_fkey
    FOREIGN KEY (rule_set_id) REFERENCES rule_set (id) ON DELETE CASCADE
);

COMMENT ON TABLE  rule_set_version IS '规则集版本快照';
COMMENT ON COLUMN rule_set_version.config IS '@type { dimensions: Array<{ code: string; name: string; weight: number; isRedLine: boolean; items: Array<{ code: string; name: string; maxScore: number; sortOrder: number }> }>; gridThresholds: { high: number; low: number }; xAxisDimension: string; yAxisDimension: string; evidenceLevels?: Array<{ code: string; name: string; minScore: number; maxScore: number; description: string }>; scoreLevels?: Array<{ code: string; name: string; minScore: number; maxScore: number; description: string }>; positionTypes?: Array<{ code: string; name: string; performanceItems: Array<{ code: string; name: string; maxScore: number; weight: number }> }>; compositeDimensions?: Array<{ code: string; name: string; formula: string; sortOrder: number }>; displayLabels?: Record<string, string> }';

CREATE UNIQUE INDEX idx_rule_set_version_rsid_vno ON rule_set_version (rule_set_id, version_no);
CREATE INDEX        idx_rule_set_version_rule_set_id ON rule_set_version (rule_set_id);


-- -----------------------------------------------------------------------------
-- 3. review_batch 盘点批次
-- -----------------------------------------------------------------------------
CREATE TABLE review_batch (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        varchar(100) NOT NULL,
  rule_set_id uuid NOT NULL,
  start_date  date,
  end_date    date,
  status      varchar(20) NOT NULL DEFAULT 'active',
  description text,
  _created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _created_by user_profile DEFAULT (
    CASE
      WHEN NULLIF(current_setting('app.user_id', TRUE), '') IS NULL THEN NULL
      ELSE ROW(current_setting('app.user_id', TRUE))::user_profile
    END
  ),
  _updated_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_by user_profile DEFAULT (
    CASE
      WHEN NULLIF(current_setting('app.user_id', TRUE), '') IS NULL THEN NULL
      ELSE ROW(current_setting('app.user_id', TRUE))::user_profile
    END
  ),
  CONSTRAINT review_batch_rule_set_id_fkey
    FOREIGN KEY (rule_set_id) REFERENCES rule_set (id)
);

COMMENT ON TABLE review_batch IS '盘点批次';


-- -----------------------------------------------------------------------------
-- 4. review_participant 参评人员（评价人 → 被盘人）
-- -----------------------------------------------------------------------------
CREATE TABLE review_participant (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id      uuid NOT NULL,
  reviewer_key  varchar(50) NOT NULL,
  reviewer_name varchar(50) NOT NULL,
  reviewee_name varchar(50) NOT NULL,
  department    varchar(100),
  position_type varchar(50),
  sort_order    integer DEFAULT 0,
  employee_no   varchar(50),
  _created_at   timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _created_by   user_profile DEFAULT (
    CASE
      WHEN NULLIF(current_setting('app.user_id', TRUE), '') IS NULL THEN NULL
      ELSE ROW(current_setting('app.user_id', TRUE))::user_profile
    END
  ),
  _updated_at   timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_by   user_profile DEFAULT (
    CASE
      WHEN NULLIF(current_setting('app.user_id', TRUE), '') IS NULL THEN NULL
      ELSE ROW(current_setting('app.user_id', TRUE))::user_profile
    END
  ),
  CONSTRAINT review_participant_batch_id_fkey
    FOREIGN KEY (batch_id) REFERENCES review_batch (id)
);

COMMENT ON TABLE review_participant IS '参评人员';

CREATE UNIQUE INDEX idx_participant_batch_reviewer_reviewee ON review_participant (batch_id, reviewer_key, reviewee_name);
CREATE INDEX        idx_participant_batch    ON review_participant (batch_id);
CREATE INDEX        idx_participant_reviewer ON review_participant (reviewer_key);


-- -----------------------------------------------------------------------------
-- 5. reviewer_account 评价人账号（密码 bcrypt 哈希）
-- -----------------------------------------------------------------------------
CREATE TABLE reviewer_account (
  reviewer_key  varchar(50) PRIMARY KEY,
  reviewer_name varchar(50) NOT NULL,
  password_hash varchar(255) NOT NULL,
  role          varchar(20) NOT NULL DEFAULT 'reviewer',
  department    varchar(100),
  status        varchar(20) NOT NULL DEFAULT 'active',
  _created_at   timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_at   timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE reviewer_account IS '评价人账号（bcrypt 密码哈希）';


-- -----------------------------------------------------------------------------
-- 6. review_record 评分记录（主表，含自动计算结果）
-- -----------------------------------------------------------------------------
CREATE TABLE review_record (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_key        varchar(50)  NOT NULL,
  reviewer_name       varchar(50)  NOT NULL,
  reviewee_name       varchar(50)  NOT NULL,
  employee_no         varchar(50),
  department          varchar(100),
  position_type       varchar(50),
  dimension_avgs      jsonb   NOT NULL DEFAULT '{}',
  composite_scores    jsonb   NOT NULL DEFAULT '{}',
  performance_score   numeric NOT NULL DEFAULT 0,
  total_score         numeric NOT NULL DEFAULT 0,
  grid_category       varchar(30) NOT NULL,
  is_red_line         boolean NOT NULL DEFAULT false,
  red_line_dimensions varchar[] NOT NULL DEFAULT '{}',
  is_deleted          boolean NOT NULL DEFAULT false,
  is_test             boolean NOT NULL DEFAULT false,
  rule_set_id         uuid,
  batch_id            uuid,
  _created_at         timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _created_by         user_profile DEFAULT (
    CASE
      WHEN NULLIF(current_setting('app.user_id', TRUE), '') IS NULL THEN NULL
      ELSE ROW(current_setting('app.user_id', TRUE))::user_profile
    END
  ),
  _updated_at         timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_by         user_profile DEFAULT (
    CASE
      WHEN NULLIF(current_setting('app.user_id', TRUE), '') IS NULL THEN NULL
      ELSE ROW(current_setting('app.user_id', TRUE))::user_profile
    END
  )
);

COMMENT ON TABLE  review_record IS '评分记录（含九宫格自动计算结果）';
COMMENT ON COLUMN review_record.dimension_avgs   IS '@type Record<string, number>';
COMMENT ON COLUMN review_record.composite_scores IS '@type Record<string, number>';

CREATE INDEX idx_review_record_reviewer_key    ON review_record (reviewer_key);
CREATE INDEX idx_review_record_reviewee_name   ON review_record (reviewee_name);
CREATE INDEX idx_review_record_department      ON review_record (department);
CREATE INDEX idx_review_record_grid_category   ON review_record (grid_category);
CREATE INDEX idx_review_record_created_at      ON review_record (_created_at);
CREATE INDEX idx_review_record_rule_set        ON review_record (rule_set_id);
CREATE INDEX idx_review_record_batch           ON review_record (batch_id);
CREATE INDEX idx_review_record_is_test         ON review_record (is_test);
CREATE INDEX idx_review_record_position_type   ON review_record (position_type);


-- -----------------------------------------------------------------------------
-- 7. review_score_item 评分明细（3 维度 × 3 子项）
-- -----------------------------------------------------------------------------
CREATE TABLE review_score_item (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id      uuid NOT NULL,
  dimension_code varchar(50)  NOT NULL,
  item_code      varchar(50)  NOT NULL,
  item_name      varchar(100) NOT NULL,
  score          integer      NOT NULL,
  max_score      integer      NOT NULL DEFAULT 5,
  evidence_level varchar(20),
  evidence_text  text         NOT NULL,
  sort_order     integer      NOT NULL DEFAULT 0,
  _created_at    timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _created_by    user_profile DEFAULT (
    CASE
      WHEN NULLIF(current_setting('app.user_id', TRUE), '') IS NULL THEN NULL
      ELSE ROW(current_setting('app.user_id', TRUE))::user_profile
    END
  ),
  _updated_at    timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_by    user_profile DEFAULT (
    CASE
      WHEN NULLIF(current_setting('app.user_id', TRUE), '') IS NULL THEN NULL
      ELSE ROW(current_setting('app.user_id', TRUE))::user_profile
    END
  )
);

COMMENT ON TABLE review_score_item IS '评分明细（每份记录 9 项）';

CREATE UNIQUE INDEX idx_review_score_item_unique    ON review_score_item (review_id, item_code);
CREATE INDEX        idx_review_score_item_review    ON review_score_item (review_id);
CREATE INDEX        idx_review_score_item_dimension ON review_score_item (dimension_code);


-- -----------------------------------------------------------------------------
-- 8. app_display_setting 显示设置
-- -----------------------------------------------------------------------------
CREATE TABLE app_display_setting (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key   varchar(50)   NOT NULL,
  setting_value varchar(1000) NOT NULL,
  sort_order    integer DEFAULT 0,
  _created_at   timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _created_by   user_profile DEFAULT (
    CASE
      WHEN NULLIF(current_setting('app.user_id', TRUE), '') IS NULL THEN NULL
      ELSE ROW(current_setting('app.user_id', TRUE))::user_profile
    END
  ),
  _updated_at   timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_by   user_profile DEFAULT (
    CASE
      WHEN NULLIF(current_setting('app.user_id', TRUE), '') IS NULL THEN NULL
      ELSE ROW(current_setting('app.user_id', TRUE))::user_profile
    END
  )
);

COMMENT ON TABLE app_display_setting IS '界面显示设置（键值对）';

CREATE UNIQUE INDEX idx_display_setting_key ON app_display_setting (setting_key);


-- -----------------------------------------------------------------------------
-- RLS + 默认 policy（role 不存在时自动跳过，保证脚本可独立执行）
--   service_role_bypass_policy  服务角色全量放行
--   修改全部数据                 登录用户可写全部行
--   查看全部数据                 登录用户 / 匿名可读
--   修改本人数据                 仅可写自己创建的行
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  t          text;
  sel_roles  text;
BEGIN
  SELECT string_agg(quote_ident(rolname), ', ')
    INTO sel_roles
  FROM pg_roles
  WHERE rolname IN ('authenticated', 'anon');

  FOREACH t IN ARRAY ARRAY[
    'rule_set', 'rule_set_version', 'review_batch', 'review_participant',
    'reviewer_account', 'review_record', 'review_score_item', 'app_display_setting'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('DROP POLICY IF EXISTS service_role_bypass_policy ON %I', t);
      EXECUTE format('CREATE POLICY service_role_bypass_policy ON %I TO service_role USING (true)', t);
    END IF;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE format('DROP POLICY IF EXISTS "修改全部数据" ON %I', t);
      EXECUTE format('CREATE POLICY "修改全部数据" ON %I AS PERMISSIVE FOR ALL TO authenticated USING (true)', t);

      EXECUTE format('DROP POLICY IF EXISTS "查看全部数据" ON %I', t);
      EXECUTE format('CREATE POLICY "查看全部数据" ON %I AS PERMISSIVE FOR SELECT TO %s USING (true)', t, sel_roles);

      -- reviewer_account 没有 _created_by 列（与线上库一致），跳过「修改本人数据」
      IF t <> 'reviewer_account' THEN
        EXECUTE format('DROP POLICY IF EXISTS "修改本人数据" ON %I', t);
        EXECUTE format(
          'CREATE POLICY "修改本人数据" ON %I AS PERMISSIVE FOR ALL TO authenticated USING (current_setting(''app.user_id''::text, true) = ((_created_by).user_id)::text)',
          t
        );
      END IF;
    END IF;
  END LOOP;
END $$;
