-- =============================================================================
-- 人才盘点系统 · 演示数据（全部虚构，不含任何真实人名 / 公司 / 品牌）
-- 依赖：01_schema.sql 已执行
-- 说明：
--   * 7 个评价人账号（1 管理员 + 6 评价人），密码 bcrypt 哈希
--   * 1 条默认规则集 + 1 条 v1 版本快照 + 1 个批次 + 35 位参评人
--   * 25 条评分记录 + 225 条评分明细（未评分的参评人用于模拟进行中的盘点）
--   * 计算结果与 review-calc.ts 一致：total = 能力*0.6 + 意愿*0.4，
--     x 轴=能力均分、y 轴=意愿均分，红线=价值观任一子项 <= 1，档位线 4.0 / 2.5
-- =============================================================================

BEGIN;

-- 0. 清空旧数据（子表 -> 主表），便于重复执行
DELETE FROM review_score_item;
DELETE FROM review_record;
DELETE FROM review_participant;
DELETE FROM review_batch;
DELETE FROM rule_set_version;
DELETE FROM rule_set;
DELETE FROM reviewer_account;
DELETE FROM app_display_setting;

-- 1. 评价人账号（密码统一 crypt(明文, gen_salt('bf'))）
INSERT INTO reviewer_account (reviewer_key, reviewer_name, password_hash, role, department, status) VALUES
  ('admin', '系统管理员', crypt('admin123456', gen_salt('bf')), 'admin', '管理部', 'active'),
  ('zhang_zong_jian', '张总监', crypt('zzj123456', gen_salt('bf')), 'reviewer', '总经办', 'active'),
  ('li_zong_jian', '李总监', crypt('lzj123456', gen_salt('bf')), 'reviewer', '财务部', 'active'),
  ('wang_zhu_guan', '王主管', crypt('wzg123456', gen_salt('bf')), 'reviewer', '人力资源部', 'active'),
  ('chen_jing_li', '陈经理', crypt('cjl123456', gen_salt('bf')), 'reviewer', '客户服务部', 'active'),
  ('zhao_jing_li', '赵经理', crypt('zjl123456', gen_salt('bf')), 'reviewer', '线上运营部', 'active'),
  ('sun_jing_li', '孙经理', crypt('sjl123456', gen_salt('bf')), 'reviewer', '业务运营部', 'active');

-- 2. 规则集（默认，启用中）
INSERT INTO rule_set (name, description, status, is_default, config) VALUES
  ('默认规则',
   '三维九项通用人才盘点规则：价值观（红线）+ 能力（60%）+ 意愿（40%）',
   'active', TRUE,
   $config${
  "dimensions": [
    {
      "code": "value",
      "name": "价值观",
      "weight": 0,
      "isRedLine": true,
      "items": [
        { "code": "value_co_create", "name": "共创共享认同", "maxScore": 5, "sortOrder": 1 },
        { "code": "value_cost", "name": "成本利润意识", "maxScore": 5, "sortOrder": 2 },
        { "code": "value_ownership", "name": "主人翁精神", "maxScore": 5, "sortOrder": 3 }
      ]
    },
    {
      "code": "ability",
      "name": "能力",
      "weight": 0.6,
      "isRedLine": false,
      "items": [
        { "code": "ability_professional", "name": "专业胜任", "maxScore": 5, "sortOrder": 4 },
        { "code": "ability_quality", "name": "交付质量", "maxScore": 5, "sortOrder": 5 },
        { "code": "ability_problem_solve", "name": "问题解决", "maxScore": 5, "sortOrder": 6 }
      ]
    },
    {
      "code": "will",
      "name": "意愿",
      "weight": 0.4,
      "isRedLine": false,
      "items": [
        { "code": "will_initiative", "name": "主动性", "maxScore": 5, "sortOrder": 7 },
        { "code": "will_growth", "name": "成长性", "maxScore": 5, "sortOrder": 8 },
        { "code": "will_stability", "name": "稳定性", "maxScore": 5, "sortOrder": 9 }
      ]
    }
  ],
  "compositeDimensions": [],
  "gridThresholds": { "high": 4.0, "low": 2.5 },
  "xAxisDimension": "ability",
  "yAxisDimension": "will",
  "evidenceLevels": [
    { "code": "sufficient", "name": "充分", "minScore": 4, "maxScore": 5, "description": "有充分事实依据支撑评分" },
    { "code": "moderate", "name": "一般", "minScore": 3, "maxScore": 3.99, "description": "有一定事实依据支撑评分" },
    { "code": "insufficient", "name": "不足", "minScore": 1, "maxScore": 2.99, "description": "事实依据不足" }
  ],
  "scoreLevels": [
    { "code": "excellent", "name": "优秀", "minScore": 4.5, "maxScore": 5, "description": "远超预期" },
    { "code": "good", "name": "良好", "minScore": 3.5, "maxScore": 4.49, "description": "超过预期" },
    { "code": "qualified", "name": "合格", "minScore": 2.5, "maxScore": 3.49, "description": "达到预期" },
    { "code": "to_improve", "name": "待改进", "minScore": 1.5, "maxScore": 2.49, "description": "部分未达到预期" },
    { "code": "unqualified", "name": "不合格", "minScore": 1, "maxScore": 1.49, "description": "远未达到预期" }
  ],
  "positionTypes": [],
  "displayLabels": {}
}$config$::jsonb);

-- 3. 规则集版本 v1（config 与 rule_set 一致）
INSERT INTO rule_set_version (rule_set_id, version_no, config, change_note)
SELECT id, 1, config, '初始化默认规则'
FROM rule_set WHERE name = '默认规则' AND is_default = TRUE;

-- 4. 盘点批次
INSERT INTO review_batch (name, rule_set_id, start_date, end_date, status, description)
SELECT '2024年度人才盘点', rs.id, DATE '2024-11-01', DATE '2024-12-31', 'active',
       '面向 6 个条线的年度人才盘点批次（演示数据）'
FROM rule_set rs WHERE rs.name = '默认规则' AND rs.is_default = TRUE;

-- 5. 参评人员（35 人，分配给 6 位评价人）
INSERT INTO review_participant (batch_id, reviewer_key, reviewer_name, reviewee_name, department, position_type, sort_order, employee_no)
SELECT b.id, v.reviewer_key, v.reviewer_name, v.reviewee_name, v.department, v.position_type, v.sort_order, v.employee_no
FROM (VALUES
  ('zhang_zong_jian', '张总监', '李文彬', '财务部', 'position_b', 1, 'EMP-1001'),
  ('zhang_zong_jian', '张总监', '高欣怡', '人力资源部', 'position_b', 2, 'EMP-1002'),
  ('zhang_zong_jian', '张总监', '何俊杰', '行政部', 'position_a', 3, 'EMP-1003'),
  ('zhang_zong_jian', '张总监', '罗雅琴', '行政部', 'position_c', 4, 'EMP-1004'),
  ('zhang_zong_jian', '张总监', '邓志成', '财务部', 'position_b', 5, 'EMP-1005'),
  ('zhang_zong_jian', '张总监', '谢晓彤', '人力资源部', 'position_c', 6, 'EMP-1006'),
  ('li_zong_jian', '李总监', '钱立群', '财务部', 'position_b', 1, 'EMP-1007'),
  ('li_zong_jian', '李总监', '孙嘉琳', '财务部', 'position_b', 2, 'EMP-1008'),
  ('li_zong_jian', '李总监', '周慧珊', '财务部', 'position_a', 3, 'EMP-1009'),
  ('li_zong_jian', '李总监', '冯绍康', '财务部', 'position_c', 4, 'EMP-1010'),
  ('li_zong_jian', '李总监', '蒋雨嘉', '财务部', 'position_c', 5, 'EMP-1011'),
  ('wang_zhu_guan', '王主管', '沈卓然', '人力资源部', 'position_b', 1, 'EMP-1012'),
  ('wang_zhu_guan', '王主管', '韩雪莹', '人力资源部', 'position_b', 2, 'EMP-1013'),
  ('wang_zhu_guan', '王主管', '曹明轩', '行政部', 'position_a', 3, 'EMP-1014'),
  ('wang_zhu_guan', '王主管', '彭思远', '行政部', 'position_c', 4, 'EMP-1015'),
  ('wang_zhu_guan', '王主管', '董佳琪', '人力资源部', 'position_c', 5, 'EMP-1016'),
  ('chen_jing_li', '陈经理', '袁诗涵', '客户服务部', 'position_c', 1, 'EMP-1017'),
  ('chen_jing_li', '陈经理', '傅子豪', '客户服务部', 'position_c', 2, 'EMP-1018'),
  ('chen_jing_li', '陈经理', '苏婉清', '客户服务部', 'position_b', 3, 'EMP-1019'),
  ('chen_jing_li', '陈经理', '蔡俊宏', '客户服务部', 'position_c', 4, 'EMP-1020'),
  ('chen_jing_li', '陈经理', '潘美霖', '客户服务部', 'position_b', 5, 'EMP-1021'),
  ('chen_jing_li', '陈经理', '江浩然', '客户服务部', 'position_c', 6, 'EMP-1022'),
  ('zhao_jing_li', '赵经理', '唐依婷', '线上运营部', 'position_c', 1, 'EMP-1023'),
  ('zhao_jing_li', '赵经理', '石文涛', '线上运营部', 'position_c', 2, 'EMP-1024'),
  ('zhao_jing_li', '赵经理', '卢佳颖', '线上运营部', 'position_b', 3, 'EMP-1025'),
  ('zhao_jing_li', '赵经理', '崔泽宇', '技术部', 'position_a', 4, 'EMP-1026'),
  ('zhao_jing_li', '赵经理', '范清华', '技术部', 'position_b', 5, 'EMP-1027'),
  ('zhao_jing_li', '赵经理', '段雨欣', '线上运营部', 'position_c', 6, 'EMP-1028'),
  ('sun_jing_li', '孙经理', '侯明哲', '业务运营部', 'position_b', 1, 'EMP-1029'),
  ('sun_jing_li', '孙经理', '白晓雯', '业务运营部', 'position_c', 2, 'EMP-1030'),
  ('sun_jing_li', '孙经理', '汪立诚', '业务运营部', 'position_a', 3, 'EMP-1031'),
  ('sun_jing_li', '孙经理', '龚若彤', '业务运营部', 'position_c', 4, 'EMP-1032'),
  ('sun_jing_li', '孙经理', '施建国', '业务运营部', 'position_b', 5, 'EMP-1033'),
  ('sun_jing_li', '孙经理', '廖雨桐', '业务运营部', 'position_c', 6, 'EMP-1034'),
  ('sun_jing_li', '孙经理', '邵天成', '业务运营部', 'position_b', 7, 'EMP-1035')
) AS v(reviewer_key, reviewer_name, reviewee_name, department, position_type, sort_order, employee_no)
CROSS JOIN (SELECT id FROM review_batch WHERE name = '2024年度人才盘点' ORDER BY _created_at DESC LIMIT 1) b;

-- 6. 评分记录（25 条，约 70% 参评人已提交）
--    维度均分 / 总分 / 九宫格分类均由 9 项评分按规则集算法算得
INSERT INTO review_record (
  reviewer_key, reviewer_name, reviewee_name, employee_no, department, position_type,
  dimension_avgs, composite_scores, performance_score, total_score, grid_category,
  is_red_line, red_line_dimensions, is_deleted, is_test, rule_set_id, batch_id)
SELECT v.reviewer_key, v.reviewer_name, v.reviewee_name, v.employee_no, v.department, v.position_type,
       v.dimension_avgs::jsonb, '{}'::jsonb, 0, v.total_score, v.grid_category,
       v.is_red_line, v.red_line_dimensions::varchar[], FALSE, FALSE, rs.id, b.id
FROM (VALUES
  ('zhang_zong_jian', '张总监', '李文彬', 'EMP-1001', '财务部', 'position_b', '{"value": 4.67, "ability": 4.33, "will": 4.67}', 4.47, 'super_star', FALSE, '{}'),
  ('chen_jing_li', '陈经理', '苏婉清', 'EMP-1019', '客户服务部', 'position_b', '{"value": 5.00, "ability": 4.33, "will": 4.33}', 4.33, 'super_star', FALSE, '{}'),
  ('zhao_jing_li', '赵经理', '崔泽宇', 'EMP-1026', '技术部', 'position_a', '{"value": 4.33, "ability": 4.67, "will": 4.00}', 4.40, 'super_star', FALSE, '{}'),
  ('sun_jing_li', '孙经理', '汪立诚', 'EMP-1031', '业务运营部', 'position_a', '{"value": 4.67, "ability": 4.33, "will": 4.33}', 4.33, 'super_star', FALSE, '{}'),
  ('zhang_zong_jian', '张总监', '高欣怡', 'EMP-1002', '人力资源部', 'position_b', '{"value": 4.00, "ability": 4.33, "will": 3.33}', 3.93, 'potential_star', FALSE, '{}'),
  ('wang_zhu_guan', '王主管', '韩雪莹', 'EMP-1013', '人力资源部', 'position_b', '{"value": 3.67, "ability": 4.00, "will": 3.33}', 3.73, 'potential_star', FALSE, '{}'),
  ('chen_jing_li', '陈经理', '袁诗涵', 'EMP-1017', '客户服务部', 'position_c', '{"value": 3.67, "ability": 4.33, "will": 3.33}', 3.93, 'potential_star', FALSE, '{}'),
  ('zhao_jing_li', '赵经理', '卢佳颖', 'EMP-1025', '线上运营部', 'position_b', '{"value": 4.00, "ability": 4.00, "will": 3.33}', 3.73, 'potential_star', FALSE, '{}'),
  ('sun_jing_li', '孙经理', '龚若彤', 'EMP-1032', '业务运营部', 'position_c', '{"value": 3.67, "ability": 4.33, "will": 3.00}', 3.80, 'potential_star', FALSE, '{}'),
  ('li_zong_jian', '李总监', '钱立群', 'EMP-1007', '财务部', 'position_b', '{"value": 4.00, "ability": 4.00, "will": 3.33}', 3.73, 'potential_star', FALSE, '{}'),
  ('zhang_zong_jian', '张总监', '何俊杰', 'EMP-1003', '行政部', 'position_a', '{"value": 3.33, "ability": 3.33, "will": 3.33}', 3.33, 'backbone', FALSE, '{}'),
  ('li_zong_jian', '李总监', '孙嘉琳', 'EMP-1008', '财务部', 'position_b', '{"value": 3.00, "ability": 3.00, "will": 3.00}', 3.00, 'backbone', FALSE, '{}'),
  ('li_zong_jian', '李总监', '蒋雨嘉', 'EMP-1011', '财务部', 'position_c', '{"value": 3.33, "ability": 3.33, "will": 3.00}', 3.20, 'backbone', FALSE, '{}'),
  ('wang_zhu_guan', '王主管', '董佳琪', 'EMP-1016', '人力资源部', 'position_c', '{"value": 3.33, "ability": 3.00, "will": 3.33}', 3.13, 'backbone', FALSE, '{}'),
  ('chen_jing_li', '陈经理', '潘美霖', 'EMP-1021', '客户服务部', 'position_b', '{"value": 3.00, "ability": 3.33, "will": 3.00}', 3.20, 'backbone', FALSE, '{}'),
  ('zhao_jing_li', '赵经理', '范清华', 'EMP-1027', '技术部', 'position_b', '{"value": 3.00, "ability": 3.00, "will": 3.00}', 3.00, 'backbone', FALSE, '{}'),
  ('sun_jing_li', '孙经理', '侯明哲', 'EMP-1029', '业务运营部', 'position_b', '{"value": 3.33, "ability": 3.00, "will": 3.33}', 3.13, 'backbone', FALSE, '{}'),
  ('zhang_zong_jian', '张总监', '罗雅琴', 'EMP-1004', '行政部', 'position_c', '{"value": 2.67, "ability": 3.00, "will": 2.33}', 2.73, 'gap_employee', FALSE, '{}'),
  ('chen_jing_li', '陈经理', '蔡俊宏', 'EMP-1020', '客户服务部', 'position_c', '{"value": 2.67, "ability": 3.33, "will": 2.33}', 2.93, 'gap_employee', FALSE, '{}'),
  ('zhao_jing_li', '赵经理', '唐依婷', 'EMP-1023', '线上运营部', 'position_c', '{"value": 2.67, "ability": 3.00, "will": 2.00}', 2.60, 'gap_employee', FALSE, '{}'),
  ('zhao_jing_li', '赵经理', '石文涛', 'EMP-1024', '线上运营部', 'position_c', '{"value": 2.67, "ability": 2.33, "will": 2.00}', 2.20, 'problem_employee', FALSE, '{}'),
  ('sun_jing_li', '孙经理', '廖雨桐', 'EMP-1034', '业务运营部', 'position_c', '{"value": 2.33, "ability": 2.33, "will": 2.00}', 2.20, 'problem_employee', FALSE, '{}'),
  ('zhang_zong_jian', '张总监', '邓志成', 'EMP-1005', '财务部', 'position_b', '{"value": 2.00, "ability": 3.67, "will": 3.00}', 3.40, 'red_line', TRUE, '{"value"}'),
  ('chen_jing_li', '陈经理', '江浩然', 'EMP-1022', '客户服务部', 'position_c', '{"value": 2.00, "ability": 3.00, "will": 2.67}', 2.87, 'red_line', TRUE, '{"value"}'),
  ('sun_jing_li', '孙经理', '施建国', 'EMP-1033', '业务运营部', 'position_b', '{"value": 2.00, "ability": 2.67, "will": 2.67}', 2.67, 'red_line', TRUE, '{"value"}')
) AS v(reviewer_key, reviewer_name, reviewee_name, employee_no, department, position_type,
       dimension_avgs, total_score, grid_category, is_red_line, red_line_dimensions)
CROSS JOIN (SELECT id FROM rule_set WHERE is_default = TRUE AND status = 'active' ORDER BY _created_at DESC LIMIT 1) rs
CROSS JOIN (SELECT id FROM review_batch WHERE name = '2024年度人才盘点' ORDER BY _created_at DESC LIMIT 1) b;

-- 7. 评分明细（225 条 = 25 条记录 × 9 项）
WITH items (reviewer_key, reviewee_name, dimension_code, item_code, item_name, score, max_score, evidence_level, evidence_text, sort_order) AS (
  VALUES
  ('zhang_zong_jian', '李文彬', 'value', 'value_co_create', '共创共享认同', 5, 5, 'sufficient', '牵头跨部门协作项目，主动沉淀并共享方法给团队', 1),
  ('zhang_zong_jian', '李文彬', 'value', 'value_cost', '成本利润意识', 5, 5, 'sufficient', '通过流程优化为部门节省可观成本并固化为机制', 2),
  ('zhang_zong_jian', '李文彬', 'value', 'value_ownership', '主人翁精神', 4, 5, 'sufficient', '责任心强，能主动承担分内之外的协同工作', 3),
  ('zhang_zong_jian', '李文彬', 'ability', 'ability_professional', '专业胜任', 5, 5, 'sufficient', '专业能力在条线内领先，能处理高难度业务问题', 4),
  ('zhang_zong_jian', '李文彬', 'ability', 'ability_quality', '交付质量', 4, 5, 'sufficient', '交付质量稳定，偶有小瑕疵能自查修正', 5),
  ('zhang_zong_jian', '李文彬', 'ability', 'ability_problem_solve', '问题解决', 4, 5, 'sufficient', '能独立分析并解决问题，方案有效', 6),
  ('zhang_zong_jian', '李文彬', 'will', 'will_initiative', '主动性', 5, 5, 'sufficient', '主动发现机会点并推动落地，超出预期', 7),
  ('zhang_zong_jian', '李文彬', 'will', 'will_growth', '成长性', 5, 5, 'sufficient', '主动学习新技能并快速应用到业务中', 8),
  ('zhang_zong_jian', '李文彬', 'will', 'will_stability', '稳定性', 4, 5, 'sufficient', '状态稳定，情绪与产出波动小', 9),
  ('chen_jing_li', '苏婉清', 'value', 'value_co_create', '共创共享认同', 5, 5, 'sufficient', '在共创会上持续输出方案，主动分享经验与资源', 1),
  ('chen_jing_li', '苏婉清', 'value', 'value_cost', '成本利润意识', 5, 5, 'sufficient', '主动识别成本浪费点，降本方案落地见效', 2),
  ('chen_jing_li', '苏婉清', 'value', 'value_ownership', '主人翁精神', 5, 5, 'sufficient', '模糊地带主动补位并推动问题闭环', 3),
  ('chen_jing_li', '苏婉清', 'ability', 'ability_professional', '专业胜任', 5, 5, 'sufficient', '专业方案被其他团队作为标杆复用', 4),
  ('chen_jing_li', '苏婉清', 'ability', 'ability_quality', '交付质量', 4, 5, 'sufficient', '按期高质量交付，复核问题少', 5),
  ('chen_jing_li', '苏婉清', 'ability', 'ability_problem_solve', '问题解决', 4, 5, 'sufficient', '问题响应及时，解决结果良好', 6),
  ('chen_jing_li', '苏婉清', 'will', 'will_initiative', '主动性', 4, 5, 'sufficient', '主动承接任务，响应及时', 7),
  ('chen_jing_li', '苏婉清', 'will', 'will_growth', '成长性', 4, 5, 'sufficient', '主动复盘，能力提升明显', 8),
  ('chen_jing_li', '苏婉清', 'will', 'will_stability', '稳定性', 5, 5, 'sufficient', '心态平稳，压力下仍能持续输出', 9),
  ('zhao_jing_li', '崔泽宇', 'value', 'value_co_create', '共创共享认同', 4, 5, 'sufficient', '积极参与团队共创，愿意共享信息与资源', 1),
  ('zhao_jing_li', '崔泽宇', 'value', 'value_cost', '成本利润意识', 5, 5, 'sufficient', '通过流程优化为部门节省可观成本并固化为机制', 2),
  ('zhao_jing_li', '崔泽宇', 'value', 'value_ownership', '主人翁精神', 4, 5, 'sufficient', '责任心强，能主动承担分内之外的协同工作', 3),
  ('zhao_jing_li', '崔泽宇', 'ability', 'ability_professional', '专业胜任', 5, 5, 'sufficient', '专业能力在条线内领先，能处理高难度业务问题', 4),
  ('zhao_jing_li', '崔泽宇', 'ability', 'ability_quality', '交付质量', 5, 5, 'sufficient', '交付质量稳定优秀，返工率极低', 5),
  ('zhao_jing_li', '崔泽宇', 'ability', 'ability_problem_solve', '问题解决', 4, 5, 'sufficient', '能独立分析并解决问题，方案有效', 6),
  ('zhao_jing_li', '崔泽宇', 'will', 'will_initiative', '主动性', 4, 5, 'sufficient', '工作主动，能提前准备并推进事项', 7),
  ('zhao_jing_li', '崔泽宇', 'will', 'will_growth', '成长性', 4, 5, 'sufficient', '学习意愿强，能把新知识用于工作', 8),
  ('zhao_jing_li', '崔泽宇', 'will', 'will_stability', '稳定性', 4, 5, 'sufficient', '状态稳定，情绪与产出波动小', 9),
  ('sun_jing_li', '汪立诚', 'value', 'value_co_create', '共创共享认同', 5, 5, 'sufficient', '在共创会上持续输出方案，主动分享经验与资源', 1),
  ('sun_jing_li', '汪立诚', 'value', 'value_cost', '成本利润意识', 4, 5, 'sufficient', '主动控制费用，投入产出比良好', 2),
  ('sun_jing_li', '汪立诚', 'value', 'value_ownership', '主人翁精神', 5, 5, 'sufficient', '模糊地带主动补位并推动问题闭环', 3),
  ('sun_jing_li', '汪立诚', 'ability', 'ability_professional', '专业胜任', 4, 5, 'sufficient', '业务知识完整，可以指导他人', 4),
  ('sun_jing_li', '汪立诚', 'ability', 'ability_quality', '交付质量', 4, 5, 'sufficient', '按期高质量交付，复核问题少', 5),
  ('sun_jing_li', '汪立诚', 'ability', 'ability_problem_solve', '问题解决', 5, 5, 'sufficient', '面对复杂问题快速拆解并给出可行解', 6),
  ('sun_jing_li', '汪立诚', 'will', 'will_initiative', '主动性', 5, 5, 'sufficient', '无需安排即主动推进重点工作', 7),
  ('sun_jing_li', '汪立诚', 'will', 'will_growth', '成长性', 4, 5, 'sufficient', '主动复盘，能力提升明显', 8),
  ('sun_jing_li', '汪立诚', 'will', 'will_stability', '稳定性', 4, 5, 'sufficient', '抗压能力较好，稳定性良好', 9),
  ('zhang_zong_jian', '高欣怡', 'value', 'value_co_create', '共创共享认同', 4, 5, 'sufficient', '积极参与团队共创，愿意共享信息与资源', 1),
  ('zhang_zong_jian', '高欣怡', 'value', 'value_cost', '成本利润意识', 4, 5, 'sufficient', '有成本意识，日常决策能权衡投入产出', 2),
  ('zhang_zong_jian', '高欣怡', 'value', 'value_ownership', '主人翁精神', 4, 5, 'sufficient', '责任心强，能主动承担分内之外的协同工作', 3),
  ('zhang_zong_jian', '高欣怡', 'ability', 'ability_professional', '专业胜任', 5, 5, 'sufficient', '专业能力在条线内领先，能处理高难度业务问题', 4),
  ('zhang_zong_jian', '高欣怡', 'ability', 'ability_quality', '交付质量', 4, 5, 'sufficient', '交付质量稳定，偶有小瑕疵能自查修正', 5),
  ('zhang_zong_jian', '高欣怡', 'ability', 'ability_problem_solve', '问题解决', 4, 5, 'sufficient', '能独立分析并解决问题，方案有效', 6),
  ('zhang_zong_jian', '高欣怡', 'will', 'will_initiative', '主动性', 4, 5, 'sufficient', '工作主动，能提前准备并推进事项', 7),
  ('zhang_zong_jian', '高欣怡', 'will', 'will_growth', '成长性', 3, 5, 'moderate', '有学习意愿，转化到工作有限', 8),
  ('zhang_zong_jian', '高欣怡', 'will', 'will_stability', '稳定性', 3, 5, 'moderate', '整体稳定，压力大时波动明显', 9),
  ('wang_zhu_guan', '韩雪莹', 'value', 'value_co_create', '共创共享认同', 4, 5, 'sufficient', '配合团队目标主动补位，协作顺畅', 1),
  ('wang_zhu_guan', '韩雪莹', 'value', 'value_cost', '成本利润意识', 4, 5, 'sufficient', '主动控制费用，投入产出比良好', 2),
  ('wang_zhu_guan', '韩雪莹', 'value', 'value_ownership', '主人翁精神', 3, 5, 'moderate', '分内尽责，主动补位偏少', 3),
  ('wang_zhu_guan', '韩雪莹', 'ability', 'ability_professional', '专业胜任', 4, 5, 'sufficient', '业务知识完整，可以指导他人', 4),
  ('wang_zhu_guan', '韩雪莹', 'ability', 'ability_quality', '交付质量', 4, 5, 'sufficient', '按期高质量交付，复核问题少', 5),
  ('wang_zhu_guan', '韩雪莹', 'ability', 'ability_problem_solve', '问题解决', 4, 5, 'sufficient', '问题响应及时，解决结果良好', 6),
  ('wang_zhu_guan', '韩雪莹', 'will', 'will_initiative', '主动性', 3, 5, 'moderate', '能完成任务，主动发起较少', 7),
  ('wang_zhu_guan', '韩雪莹', 'will', 'will_growth', '成长性', 4, 5, 'sufficient', '主动复盘，能力提升明显', 8),
  ('wang_zhu_guan', '韩雪莹', 'will', 'will_stability', '稳定性', 3, 5, 'moderate', '状态基本稳定，偶有情绪起伏', 9),
  ('chen_jing_li', '袁诗涵', 'value', 'value_co_create', '共创共享认同', 4, 5, 'sufficient', '积极参与团队共创，愿意共享信息与资源', 1),
  ('chen_jing_li', '袁诗涵', 'value', 'value_cost', '成本利润意识', 3, 5, 'moderate', '基本按预算执行，成本意识一般', 2),
  ('chen_jing_li', '袁诗涵', 'value', 'value_ownership', '主人翁精神', 4, 5, 'sufficient', '责任心强，能主动承担分内之外的协同工作', 3),
  ('chen_jing_li', '袁诗涵', 'ability', 'ability_professional', '专业胜任', 5, 5, 'sufficient', '专业能力在条线内领先，能处理高难度业务问题', 4),
  ('chen_jing_li', '袁诗涵', 'ability', 'ability_quality', '交付质量', 4, 5, 'sufficient', '交付质量稳定，偶有小瑕疵能自查修正', 5),
  ('chen_jing_li', '袁诗涵', 'ability', 'ability_problem_solve', '问题解决', 4, 5, 'sufficient', '能独立分析并解决问题，方案有效', 6),
  ('chen_jing_li', '袁诗涵', 'will', 'will_initiative', '主动性', 3, 5, 'moderate', '按安排推进工作，主动性一般', 7),
  ('chen_jing_li', '袁诗涵', 'will', 'will_growth', '成长性', 3, 5, 'moderate', '有学习意愿，转化到工作有限', 8),
  ('chen_jing_li', '袁诗涵', 'will', 'will_stability', '稳定性', 4, 5, 'sufficient', '状态稳定，情绪与产出波动小', 9),
  ('zhao_jing_li', '卢佳颖', 'value', 'value_co_create', '共创共享认同', 4, 5, 'sufficient', '配合团队目标主动补位，协作顺畅', 1),
  ('zhao_jing_li', '卢佳颖', 'value', 'value_cost', '成本利润意识', 4, 5, 'sufficient', '主动控制费用，投入产出比良好', 2),
  ('zhao_jing_li', '卢佳颖', 'value', 'value_ownership', '主人翁精神', 4, 5, 'sufficient', '对结果负责，事项跟进到底', 3),
  ('zhao_jing_li', '卢佳颖', 'ability', 'ability_professional', '专业胜任', 4, 5, 'sufficient', '业务知识完整，可以指导他人', 4),
  ('zhao_jing_li', '卢佳颖', 'ability', 'ability_quality', '交付质量', 4, 5, 'sufficient', '按期高质量交付，复核问题少', 5),
  ('zhao_jing_li', '卢佳颖', 'ability', 'ability_problem_solve', '问题解决', 4, 5, 'sufficient', '问题响应及时，解决结果良好', 6),
  ('zhao_jing_li', '卢佳颖', 'will', 'will_initiative', '主动性', 4, 5, 'sufficient', '主动承接任务，响应及时', 7),
  ('zhao_jing_li', '卢佳颖', 'will', 'will_growth', '成长性', 3, 5, 'moderate', '按培训安排学习，成长平稳', 8),
  ('zhao_jing_li', '卢佳颖', 'will', 'will_stability', '稳定性', 3, 5, 'moderate', '状态基本稳定，偶有情绪起伏', 9),
  ('sun_jing_li', '龚若彤', 'value', 'value_co_create', '共创共享认同', 3, 5, 'moderate', '能配合团队分工完成协作，共享意识一般', 1),
  ('sun_jing_li', '龚若彤', 'value', 'value_cost', '成本利润意识', 4, 5, 'sufficient', '有成本意识，日常决策能权衡投入产出', 2),
  ('sun_jing_li', '龚若彤', 'value', 'value_ownership', '主人翁精神', 4, 5, 'sufficient', '责任心强，能主动承担分内之外的协同工作', 3),
  ('sun_jing_li', '龚若彤', 'ability', 'ability_professional', '专业胜任', 4, 5, 'sufficient', '专业能力扎实，能独立承担复杂任务', 4),
  ('sun_jing_li', '龚若彤', 'ability', 'ability_quality', '交付质量', 5, 5, 'sufficient', '交付质量稳定优秀，返工率极低', 5),
  ('sun_jing_li', '龚若彤', 'ability', 'ability_problem_solve', '问题解决', 4, 5, 'sufficient', '能独立分析并解决问题，方案有效', 6),
  ('sun_jing_li', '龚若彤', 'will', 'will_initiative', '主动性', 3, 5, 'moderate', '按安排推进工作，主动性一般', 7),
  ('sun_jing_li', '龚若彤', 'will', 'will_growth', '成长性', 3, 5, 'moderate', '有学习意愿，转化到工作有限', 8),
  ('sun_jing_li', '龚若彤', 'will', 'will_stability', '稳定性', 3, 5, 'moderate', '整体稳定，压力大时波动明显', 9),
  ('li_zong_jian', '钱立群', 'value', 'value_co_create', '共创共享认同', 4, 5, 'sufficient', '配合团队目标主动补位，协作顺畅', 1),
  ('li_zong_jian', '钱立群', 'value', 'value_cost', '成本利润意识', 4, 5, 'sufficient', '主动控制费用，投入产出比良好', 2),
  ('li_zong_jian', '钱立群', 'value', 'value_ownership', '主人翁精神', 4, 5, 'sufficient', '对结果负责，事项跟进到底', 3),
  ('li_zong_jian', '钱立群', 'ability', 'ability_professional', '专业胜任', 4, 5, 'sufficient', '业务知识完整，可以指导他人', 4),
  ('li_zong_jian', '钱立群', 'ability', 'ability_quality', '交付质量', 4, 5, 'sufficient', '按期高质量交付，复核问题少', 5),
  ('li_zong_jian', '钱立群', 'ability', 'ability_problem_solve', '问题解决', 4, 5, 'sufficient', '问题响应及时，解决结果良好', 6),
  ('li_zong_jian', '钱立群', 'will', 'will_initiative', '主动性', 3, 5, 'moderate', '能完成任务，主动发起较少', 7),
  ('li_zong_jian', '钱立群', 'will', 'will_growth', '成长性', 4, 5, 'sufficient', '主动复盘，能力提升明显', 8),
  ('li_zong_jian', '钱立群', 'will', 'will_stability', '稳定性', 3, 5, 'moderate', '状态基本稳定，偶有情绪起伏', 9),
  ('zhang_zong_jian', '何俊杰', 'value', 'value_co_create', '共创共享认同', 3, 5, 'moderate', '能配合团队分工完成协作，共享意识一般', 1),
  ('zhang_zong_jian', '何俊杰', 'value', 'value_cost', '成本利润意识', 4, 5, 'sufficient', '有成本意识，日常决策能权衡投入产出', 2),
  ('zhang_zong_jian', '何俊杰', 'value', 'value_ownership', '主人翁精神', 3, 5, 'moderate', '能完成本职工作，超出职责范围较被动', 3),
  ('zhang_zong_jian', '何俊杰', 'ability', 'ability_professional', '专业胜任', 3, 5, 'moderate', '能胜任常规工作，复杂问题需支持', 4),
  ('zhang_zong_jian', '何俊杰', 'ability', 'ability_quality', '交付质量', 3, 5, 'moderate', '质量基本达标，返工需一到两轮', 5),
  ('zhang_zong_jian', '何俊杰', 'ability', 'ability_problem_solve', '问题解决', 4, 5, 'sufficient', '能独立分析并解决问题，方案有效', 6),
  ('zhang_zong_jian', '何俊杰', 'will', 'will_initiative', '主动性', 3, 5, 'moderate', '按安排推进工作，主动性一般', 7),
  ('zhang_zong_jian', '何俊杰', 'will', 'will_growth', '成长性', 3, 5, 'moderate', '有学习意愿，转化到工作有限', 8),
  ('zhang_zong_jian', '何俊杰', 'will', 'will_stability', '稳定性', 4, 5, 'sufficient', '状态稳定，情绪与产出波动小', 9),
  ('li_zong_jian', '孙嘉琳', 'value', 'value_co_create', '共创共享认同', 3, 5, 'moderate', '按需参与共创，主动分享较少', 1),
  ('li_zong_jian', '孙嘉琳', 'value', 'value_cost', '成本利润意识', 3, 5, 'moderate', '能用好预算，主动优化意识有限', 2),
  ('li_zong_jian', '孙嘉琳', 'value', 'value_ownership', '主人翁精神', 3, 5, 'moderate', '分内尽责，主动补位偏少', 3),
  ('li_zong_jian', '孙嘉琳', 'ability', 'ability_professional', '专业胜任', 3, 5, 'moderate', '专业能力基本达标，深度有待加强', 4),
  ('li_zong_jian', '孙嘉琳', 'ability', 'ability_quality', '交付质量', 3, 5, 'moderate', '交付合格，细节偶有遗漏', 5),
  ('li_zong_jian', '孙嘉琳', 'ability', 'ability_problem_solve', '问题解决', 3, 5, 'moderate', '能提出方案，落地需他人推动', 6),
  ('li_zong_jian', '孙嘉琳', 'will', 'will_initiative', '主动性', 3, 5, 'moderate', '能完成任务，主动发起较少', 7),
  ('li_zong_jian', '孙嘉琳', 'will', 'will_growth', '成长性', 3, 5, 'moderate', '按培训安排学习，成长平稳', 8),
  ('li_zong_jian', '孙嘉琳', 'will', 'will_stability', '稳定性', 3, 5, 'moderate', '状态基本稳定，偶有情绪起伏', 9),
  ('li_zong_jian', '蒋雨嘉', 'value', 'value_co_create', '共创共享认同', 4, 5, 'sufficient', '积极参与团队共创，愿意共享信息与资源', 1),
  ('li_zong_jian', '蒋雨嘉', 'value', 'value_cost', '成本利润意识', 3, 5, 'moderate', '基本按预算执行，成本意识一般', 2),
  ('li_zong_jian', '蒋雨嘉', 'value', 'value_ownership', '主人翁精神', 3, 5, 'moderate', '能完成本职工作，超出职责范围较被动', 3),
  ('li_zong_jian', '蒋雨嘉', 'ability', 'ability_professional', '专业胜任', 3, 5, 'moderate', '能胜任常规工作，复杂问题需支持', 4),
  ('li_zong_jian', '蒋雨嘉', 'ability', 'ability_quality', '交付质量', 4, 5, 'sufficient', '交付质量稳定，偶有小瑕疵能自查修正', 5),
  ('li_zong_jian', '蒋雨嘉', 'ability', 'ability_problem_solve', '问题解决', 3, 5, 'moderate', '常规问题可自行解决，复杂问题需协助', 6),
  ('li_zong_jian', '蒋雨嘉', 'will', 'will_initiative', '主动性', 3, 5, 'moderate', '按安排推进工作，主动性一般', 7),
  ('li_zong_jian', '蒋雨嘉', 'will', 'will_growth', '成长性', 3, 5, 'moderate', '有学习意愿，转化到工作有限', 8),
  ('li_zong_jian', '蒋雨嘉', 'will', 'will_stability', '稳定性', 3, 5, 'moderate', '整体稳定，压力大时波动明显', 9),
  ('wang_zhu_guan', '董佳琪', 'value', 'value_co_create', '共创共享认同', 3, 5, 'moderate', '按需参与共创，主动分享较少', 1),
  ('wang_zhu_guan', '董佳琪', 'value', 'value_cost', '成本利润意识', 3, 5, 'moderate', '能用好预算，主动优化意识有限', 2),
  ('wang_zhu_guan', '董佳琪', 'value', 'value_ownership', '主人翁精神', 4, 5, 'sufficient', '对结果负责，事项跟进到底', 3),
  ('wang_zhu_guan', '董佳琪', 'ability', 'ability_professional', '专业胜任', 3, 5, 'moderate', '专业能力基本达标，深度有待加强', 4),
  ('wang_zhu_guan', '董佳琪', 'ability', 'ability_quality', '交付质量', 3, 5, 'moderate', '交付合格，细节偶有遗漏', 5),
  ('wang_zhu_guan', '董佳琪', 'ability', 'ability_problem_solve', '问题解决', 3, 5, 'moderate', '能提出方案，落地需他人推动', 6),
  ('wang_zhu_guan', '董佳琪', 'will', 'will_initiative', '主动性', 3, 5, 'moderate', '能完成任务，主动发起较少', 7),
  ('wang_zhu_guan', '董佳琪', 'will', 'will_growth', '成长性', 4, 5, 'sufficient', '主动复盘，能力提升明显', 8),
  ('wang_zhu_guan', '董佳琪', 'will', 'will_stability', '稳定性', 3, 5, 'moderate', '状态基本稳定，偶有情绪起伏', 9),
  ('chen_jing_li', '潘美霖', 'value', 'value_co_create', '共创共享认同', 3, 5, 'moderate', '能配合团队分工完成协作，共享意识一般', 1),
  ('chen_jing_li', '潘美霖', 'value', 'value_cost', '成本利润意识', 3, 5, 'moderate', '基本按预算执行，成本意识一般', 2),
  ('chen_jing_li', '潘美霖', 'value', 'value_ownership', '主人翁精神', 3, 5, 'moderate', '能完成本职工作，超出职责范围较被动', 3),
  ('chen_jing_li', '潘美霖', 'ability', 'ability_professional', '专业胜任', 4, 5, 'sufficient', '专业能力扎实，能独立承担复杂任务', 4),
  ('chen_jing_li', '潘美霖', 'ability', 'ability_quality', '交付质量', 3, 5, 'moderate', '质量基本达标，返工需一到两轮', 5),
  ('chen_jing_li', '潘美霖', 'ability', 'ability_problem_solve', '问题解决', 3, 5, 'moderate', '常规问题可自行解决，复杂问题需协助', 6),
  ('chen_jing_li', '潘美霖', 'will', 'will_initiative', '主动性', 3, 5, 'moderate', '按安排推进工作，主动性一般', 7),
  ('chen_jing_li', '潘美霖', 'will', 'will_growth', '成长性', 3, 5, 'moderate', '有学习意愿，转化到工作有限', 8),
  ('chen_jing_li', '潘美霖', 'will', 'will_stability', '稳定性', 3, 5, 'moderate', '整体稳定，压力大时波动明显', 9),
  ('zhao_jing_li', '范清华', 'value', 'value_co_create', '共创共享认同', 3, 5, 'moderate', '按需参与共创，主动分享较少', 1),
  ('zhao_jing_li', '范清华', 'value', 'value_cost', '成本利润意识', 3, 5, 'moderate', '能用好预算，主动优化意识有限', 2),
  ('zhao_jing_li', '范清华', 'value', 'value_ownership', '主人翁精神', 3, 5, 'moderate', '分内尽责，主动补位偏少', 3),
  ('zhao_jing_li', '范清华', 'ability', 'ability_professional', '专业胜任', 3, 5, 'moderate', '专业能力基本达标，深度有待加强', 4),
  ('zhao_jing_li', '范清华', 'ability', 'ability_quality', '交付质量', 3, 5, 'moderate', '交付合格，细节偶有遗漏', 5),
  ('zhao_jing_li', '范清华', 'ability', 'ability_problem_solve', '问题解决', 3, 5, 'moderate', '能提出方案，落地需他人推动', 6),
  ('zhao_jing_li', '范清华', 'will', 'will_initiative', '主动性', 3, 5, 'moderate', '能完成任务，主动发起较少', 7),
  ('zhao_jing_li', '范清华', 'will', 'will_growth', '成长性', 3, 5, 'moderate', '按培训安排学习，成长平稳', 8),
  ('zhao_jing_li', '范清华', 'will', 'will_stability', '稳定性', 3, 5, 'moderate', '状态基本稳定，偶有情绪起伏', 9),
  ('sun_jing_li', '侯明哲', 'value', 'value_co_create', '共创共享认同', 3, 5, 'moderate', '能配合团队分工完成协作，共享意识一般', 1),
  ('sun_jing_li', '侯明哲', 'value', 'value_cost', '成本利润意识', 4, 5, 'sufficient', '有成本意识，日常决策能权衡投入产出', 2),
  ('sun_jing_li', '侯明哲', 'value', 'value_ownership', '主人翁精神', 3, 5, 'moderate', '能完成本职工作，超出职责范围较被动', 3),
  ('sun_jing_li', '侯明哲', 'ability', 'ability_professional', '专业胜任', 3, 5, 'moderate', '能胜任常规工作，复杂问题需支持', 4),
  ('sun_jing_li', '侯明哲', 'ability', 'ability_quality', '交付质量', 3, 5, 'moderate', '质量基本达标，返工需一到两轮', 5),
  ('sun_jing_li', '侯明哲', 'ability', 'ability_problem_solve', '问题解决', 3, 5, 'moderate', '常规问题可自行解决，复杂问题需协助', 6),
  ('sun_jing_li', '侯明哲', 'will', 'will_initiative', '主动性', 4, 5, 'sufficient', '工作主动，能提前准备并推进事项', 7),
  ('sun_jing_li', '侯明哲', 'will', 'will_growth', '成长性', 3, 5, 'moderate', '有学习意愿，转化到工作有限', 8),
  ('sun_jing_li', '侯明哲', 'will', 'will_stability', '稳定性', 3, 5, 'moderate', '整体稳定，压力大时波动明显', 9),
  ('zhang_zong_jian', '罗雅琴', 'value', 'value_co_create', '共创共享认同', 3, 5, 'moderate', '按需参与共创，主动分享较少', 1),
  ('zhang_zong_jian', '罗雅琴', 'value', 'value_cost', '成本利润意识', 3, 5, 'moderate', '能用好预算，主动优化意识有限', 2),
  ('zhang_zong_jian', '罗雅琴', 'value', 'value_ownership', '主人翁精神', 2, 5, 'insufficient', '对结果关注不足，问题常回抛', 3),
  ('zhang_zong_jian', '罗雅琴', 'ability', 'ability_professional', '专业胜任', 3, 5, 'moderate', '专业能力基本达标，深度有待加强', 4),
  ('zhang_zong_jian', '罗雅琴', 'ability', 'ability_quality', '交付质量', 3, 5, 'moderate', '交付合格，细节偶有遗漏', 5),
  ('zhang_zong_jian', '罗雅琴', 'ability', 'ability_problem_solve', '问题解决', 3, 5, 'moderate', '能提出方案，落地需他人推动', 6),
  ('zhang_zong_jian', '罗雅琴', 'will', 'will_initiative', '主动性', 2, 5, 'insufficient', '被动接受任务，推进缓慢', 7),
  ('zhang_zong_jian', '罗雅琴', 'will', 'will_growth', '成长性', 2, 5, 'insufficient', '对反馈接受度低，改进缓慢', 8),
  ('zhang_zong_jian', '罗雅琴', 'will', 'will_stability', '稳定性', 3, 5, 'moderate', '状态基本稳定，偶有情绪起伏', 9),
  ('chen_jing_li', '蔡俊宏', 'value', 'value_co_create', '共创共享认同', 2, 5, 'insufficient', '协作中偏被动，较少主动分享信息', 1),
  ('chen_jing_li', '蔡俊宏', 'value', 'value_cost', '成本利润意识', 3, 5, 'moderate', '基本按预算执行，成本意识一般', 2),
  ('chen_jing_li', '蔡俊宏', 'value', 'value_ownership', '主人翁精神', 3, 5, 'moderate', '能完成本职工作，超出职责范围较被动', 3),
  ('chen_jing_li', '蔡俊宏', 'ability', 'ability_professional', '专业胜任', 3, 5, 'moderate', '能胜任常规工作，复杂问题需支持', 4),
  ('chen_jing_li', '蔡俊宏', 'ability', 'ability_quality', '交付质量', 4, 5, 'sufficient', '交付质量稳定，偶有小瑕疵能自查修正', 5),
  ('chen_jing_li', '蔡俊宏', 'ability', 'ability_problem_solve', '问题解决', 3, 5, 'moderate', '常规问题可自行解决，复杂问题需协助', 6),
  ('chen_jing_li', '蔡俊宏', 'will', 'will_initiative', '主动性', 2, 5, 'insufficient', '需反复督促才行动，主动性不足', 7),
  ('chen_jing_li', '蔡俊宏', 'will', 'will_growth', '成长性', 3, 5, 'moderate', '有学习意愿，转化到工作有限', 8),
  ('chen_jing_li', '蔡俊宏', 'will', 'will_stability', '稳定性', 2, 5, 'insufficient', '状态波动较大，影响协作节奏', 9),
  ('zhao_jing_li', '唐依婷', 'value', 'value_co_create', '共创共享认同', 3, 5, 'moderate', '按需参与共创，主动分享较少', 1),
  ('zhao_jing_li', '唐依婷', 'value', 'value_cost', '成本利润意识', 2, 5, 'insufficient', '成本敏感度不足，存在不必要开支', 2),
  ('zhao_jing_li', '唐依婷', 'value', 'value_ownership', '主人翁精神', 3, 5, 'moderate', '分内尽责，主动补位偏少', 3),
  ('zhao_jing_li', '唐依婷', 'ability', 'ability_professional', '专业胜任', 3, 5, 'moderate', '专业能力基本达标，深度有待加强', 4),
  ('zhao_jing_li', '唐依婷', 'ability', 'ability_quality', '交付质量', 3, 5, 'moderate', '交付合格，细节偶有遗漏', 5),
  ('zhao_jing_li', '唐依婷', 'ability', 'ability_problem_solve', '问题解决', 3, 5, 'moderate', '能提出方案，落地需他人推动', 6),
  ('zhao_jing_li', '唐依婷', 'will', 'will_initiative', '主动性', 2, 5, 'insufficient', '被动接受任务，推进缓慢', 7),
  ('zhao_jing_li', '唐依婷', 'will', 'will_growth', '成长性', 2, 5, 'insufficient', '对反馈接受度低，改进缓慢', 8),
  ('zhao_jing_li', '唐依婷', 'will', 'will_stability', '稳定性', 2, 5, 'insufficient', '对岗位认同感不足，稳定性存疑', 9),
  ('zhao_jing_li', '石文涛', 'value', 'value_co_create', '共创共享认同', 3, 5, 'moderate', '能配合团队分工完成协作，共享意识一般', 1),
  ('zhao_jing_li', '石文涛', 'value', 'value_cost', '成本利润意识', 2, 5, 'insufficient', '费用使用偏粗放，提醒后才调整', 2),
  ('zhao_jing_li', '石文涛', 'value', 'value_ownership', '主人翁精神', 3, 5, 'moderate', '能完成本职工作，超出职责范围较被动', 3),
  ('zhao_jing_li', '石文涛', 'ability', 'ability_professional', '专业胜任', 2, 5, 'insufficient', '专业能力不足以独立承担岗位工作', 4),
  ('zhao_jing_li', '石文涛', 'ability', 'ability_quality', '交付质量', 2, 5, 'insufficient', '返工较多，需多次修改才能达标', 5),
  ('zhao_jing_li', '石文涛', 'ability', 'ability_problem_solve', '问题解决', 3, 5, 'moderate', '常规问题可自行解决，复杂问题需协助', 6),
  ('zhao_jing_li', '石文涛', 'will', 'will_initiative', '主动性', 2, 5, 'insufficient', '需反复督促才行动，主动性不足', 7),
  ('zhao_jing_li', '石文涛', 'will', 'will_growth', '成长性', 2, 5, 'insufficient', '学习动力不足，技能更新滞后', 8),
  ('zhao_jing_li', '石文涛', 'will', 'will_stability', '稳定性', 2, 5, 'insufficient', '状态波动较大，影响协作节奏', 9),
  ('sun_jing_li', '廖雨桐', 'value', 'value_co_create', '共创共享认同', 2, 5, 'insufficient', '参与共创度不足，需要他人推动', 1),
  ('sun_jing_li', '廖雨桐', 'value', 'value_cost', '成本利润意识', 3, 5, 'moderate', '能用好预算，主动优化意识有限', 2),
  ('sun_jing_li', '廖雨桐', 'value', 'value_ownership', '主人翁精神', 2, 5, 'insufficient', '对结果关注不足，问题常回抛', 3),
  ('sun_jing_li', '廖雨桐', 'ability', 'ability_professional', '专业胜任', 2, 5, 'insufficient', '关键业务环节仍依赖他人', 4),
  ('sun_jing_li', '廖雨桐', 'ability', 'ability_quality', '交付质量', 3, 5, 'moderate', '交付合格，细节偶有遗漏', 5),
  ('sun_jing_li', '廖雨桐', 'ability', 'ability_problem_solve', '问题解决', 2, 5, 'insufficient', '遇到问题倾向上报，独立解决不足', 6),
  ('sun_jing_li', '廖雨桐', 'will', 'will_initiative', '主动性', 2, 5, 'insufficient', '被动接受任务，推进缓慢', 7),
  ('sun_jing_li', '廖雨桐', 'will', 'will_growth', '成长性', 2, 5, 'insufficient', '对反馈接受度低，改进缓慢', 8),
  ('sun_jing_li', '廖雨桐', 'will', 'will_stability', '稳定性', 2, 5, 'insufficient', '对岗位认同感不足，稳定性存疑', 9),
  ('zhang_zong_jian', '邓志成', 'value', 'value_co_create', '共创共享认同', 1, 5, 'insufficient', '拒绝配合跨部门协作，影响团队协同', 1),
  ('zhang_zong_jian', '邓志成', 'value', 'value_cost', '成本利润意识', 3, 5, 'moderate', '基本按预算执行，成本意识一般', 2),
  ('zhang_zong_jian', '邓志成', 'value', 'value_ownership', '主人翁精神', 2, 5, 'insufficient', '遇事推诿，需要明确分工才行动', 3),
  ('zhang_zong_jian', '邓志成', 'ability', 'ability_professional', '专业胜任', 4, 5, 'sufficient', '专业能力扎实，能独立承担复杂任务', 4),
  ('zhang_zong_jian', '邓志成', 'ability', 'ability_quality', '交付质量', 4, 5, 'sufficient', '交付质量稳定，偶有小瑕疵能自查修正', 5),
  ('zhang_zong_jian', '邓志成', 'ability', 'ability_problem_solve', '问题解决', 3, 5, 'moderate', '常规问题可自行解决，复杂问题需协助', 6),
  ('zhang_zong_jian', '邓志成', 'will', 'will_initiative', '主动性', 3, 5, 'moderate', '按安排推进工作，主动性一般', 7),
  ('zhang_zong_jian', '邓志成', 'will', 'will_growth', '成长性', 3, 5, 'moderate', '有学习意愿，转化到工作有限', 8),
  ('zhang_zong_jian', '邓志成', 'will', 'will_stability', '稳定性', 3, 5, 'moderate', '整体稳定，压力大时波动明显', 9),
  ('chen_jing_li', '江浩然', 'value', 'value_co_create', '共创共享认同', 2, 5, 'insufficient', '参与共创度不足，需要他人推动', 1),
  ('chen_jing_li', '江浩然', 'value', 'value_cost', '成本利润意识', 1, 5, 'insufficient', '无视成本约束，重复采购造成浪费', 2),
  ('chen_jing_li', '江浩然', 'value', 'value_ownership', '主人翁精神', 3, 5, 'moderate', '分内尽责，主动补位偏少', 3),
  ('chen_jing_li', '江浩然', 'ability', 'ability_professional', '专业胜任', 3, 5, 'moderate', '专业能力基本达标，深度有待加强', 4),
  ('chen_jing_li', '江浩然', 'ability', 'ability_quality', '交付质量', 3, 5, 'moderate', '交付合格，细节偶有遗漏', 5),
  ('chen_jing_li', '江浩然', 'ability', 'ability_problem_solve', '问题解决', 3, 5, 'moderate', '能提出方案，落地需他人推动', 6),
  ('chen_jing_li', '江浩然', 'will', 'will_initiative', '主动性', 3, 5, 'moderate', '能完成任务，主动发起较少', 7),
  ('chen_jing_li', '江浩然', 'will', 'will_growth', '成长性', 3, 5, 'moderate', '按培训安排学习，成长平稳', 8),
  ('chen_jing_li', '江浩然', 'will', 'will_stability', '稳定性', 2, 5, 'insufficient', '对岗位认同感不足，稳定性存疑', 9),
  ('sun_jing_li', '施建国', 'value', 'value_co_create', '共创共享认同', 3, 5, 'moderate', '能配合团队分工完成协作，共享意识一般', 1),
  ('sun_jing_li', '施建国', 'value', 'value_cost', '成本利润意识', 2, 5, 'insufficient', '费用使用偏粗放，提醒后才调整', 2),
  ('sun_jing_li', '施建国', 'value', 'value_ownership', '主人翁精神', 1, 5, 'insufficient', '严重推责，出问题先撇清关系', 3),
  ('sun_jing_li', '施建国', 'ability', 'ability_professional', '专业胜任', 3, 5, 'moderate', '能胜任常规工作，复杂问题需支持', 4),
  ('sun_jing_li', '施建国', 'ability', 'ability_quality', '交付质量', 2, 5, 'insufficient', '返工较多，需多次修改才能达标', 5),
  ('sun_jing_li', '施建国', 'ability', 'ability_problem_solve', '问题解决', 3, 5, 'moderate', '常规问题可自行解决，复杂问题需协助', 6),
  ('sun_jing_li', '施建国', 'will', 'will_initiative', '主动性', 2, 5, 'insufficient', '需反复督促才行动，主动性不足', 7),
  ('sun_jing_li', '施建国', 'will', 'will_growth', '成长性', 3, 5, 'moderate', '有学习意愿，转化到工作有限', 8),
  ('sun_jing_li', '施建国', 'will', 'will_stability', '稳定性', 3, 5, 'moderate', '整体稳定，压力大时波动明显', 9)
)
INSERT INTO review_score_item (review_id, dimension_code, item_code, item_name, score, max_score, evidence_level, evidence_text, sort_order)
SELECT r.id, i.dimension_code, i.item_code, i.item_name, i.score, i.max_score, i.evidence_level, i.evidence_text, i.sort_order
FROM items i
JOIN review_record r
  ON r.reviewer_key = i.reviewer_key AND r.reviewee_name = i.reviewee_name
 AND r.batch_id = (SELECT id FROM review_batch WHERE name = '2024年度人才盘点' ORDER BY _created_at DESC LIMIT 1)
ORDER BY i.reviewer_key, i.reviewee_name, i.sort_order;

-- 8. 显示设置（11 条通用配置）
INSERT INTO app_display_setting (setting_key, setting_value, sort_order) VALUES
  ('app_name', '人才盘点系统', 1),
  ('system_name', '人才盘点系统', 2),
  ('review_name', '人才评估', 3),
  ('reviewer_label', '评价人', 4),
  ('reviewee_label', '被盘人', 5),
  ('department_label', '部门', 6),
  ('grid_description', '九宫格人才地图', 7),
  ('grid_x_label', '能力均分', 8),
  ('grid_y_label', '意愿均分', 9),
  ('login_tip', '请选择身份并输入口令登录', 10),
  ('footer_note', '本系统为人才盘点演示环境，数据均为虚构', 11);

COMMIT;

-- ---------- 数据分布（人工核对用） ----------
-- 评分记录 25 条；参评人 35 人；已评 25 人（71%）
--   backbone             稳定贡献     7 条
--   gap_employee         观察改善     3 条
--   potential_star       重点培养     6 条
--   problem_employee     观察改善     2 条
--   red_line             红线区      3 条
--   super_star           核心骨干     4 条
