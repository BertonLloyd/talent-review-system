-- =============================================================================
-- 自建部署：平台 RLS 角色与策略（幂等，可重复执行）
--
-- 背景：数据层中间件对每个请求执行 SET LOCAL ROLE：
--   系统账号 -> service_role_，登录用户 -> authenticated_，匿名 -> anon_
-- 妙搭平台托管这些角色；自建库需要本脚本创建，否则业务查询会报
-- "role \"anon_\" does not exist"。
--
-- 执行方式：必须用具备 CREATEROLE 权限的超级用户（如 postgres）执行，
-- 并通过 psql 变量 APP_ROLE 指定连接串所用的业务登录角色：
--
--   sudo -u postgres psql -d talent_review \
--     -v APP_ROLE=talent_user -f scripts/sql/00_roles.sql
--
-- 不传 APP_ROLE 时默认使用 talent_user。
-- 脚本可在建表前后执行：RLS 策略只作用于已存在的表，建表后再跑一次即可补齐。
-- =============================================================================

-- 1) 三个 NOLOGIN 组角色（service_role_ 绕过 RLS）
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon_') THEN
    CREATE ROLE anon_ NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated_') THEN
    CREATE ROLE authenticated_ NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role_') THEN
    CREATE ROLE service_role_ NOLOGIN BYPASSRLS;
  END IF;
END $$;

-- 2) 让业务登录角色成为三者成员，从而具备 SET ROLE 资格
DO $$
DECLARE
  app_role text := coalesce(NULLIF(current_setting('app_role', true), ''), 'talent_user');
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_role) THEN
    RAISE EXCEPTION '业务角色 % 不存在，请先创建或用 -v APP_ROLE=... 指定', app_role;
  END IF;
  EXECUTE format('GRANT anon_, authenticated_, service_role_ TO %I', app_role);
END $$;

-- 3) schema 与表权限
GRANT USAGE ON SCHEMA public TO anon_, authenticated_, service_role_;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon_;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public
  TO authenticated_, service_role_;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public
  TO authenticated_, service_role_;

-- 4) RLS 放行策略（登录/服务角色全放，匿名只读）；仅处理已存在的表
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'rule_set', 'rule_set_version', 'review_batch', 'review_participant',
      'reviewer_account', 'review_record', 'review_score_item', 'app_display_setting'
    ])
  LOOP
    IF EXISTS (SELECT 1 FROM pg_class c
               JOIN pg_namespace n ON n.oid = c.relnamespace
               WHERE n.nspname = 'public' AND c.relname = t) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);

      EXECUTE format('DROP POLICY IF EXISTS auth_open_policy ON %I', t);
      EXECUTE format(
        'CREATE POLICY auth_open_policy ON %I TO authenticated_, service_role_ USING (true) WITH CHECK (true)', t);

      EXECUTE format('DROP POLICY IF EXISTS anon_read_policy ON %I', t);
      EXECUTE format(
        'CREATE POLICY anon_read_policy ON %I FOR SELECT TO anon_ USING (true)', t);
    END IF;
  END LOOP;
END $$;
