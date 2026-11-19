import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq, and, desc, asc, count, sql } from 'drizzle-orm';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { AuthService, type JwtPayload } from '../../auth/auth.service';
import {
  ruleSet,
  ruleSetVersion,
  reviewBatch,
  reviewParticipant,
  appDisplaySetting,
  reviewerAccount,
} from '@server/database/schema';
import { computeReviewByConfig } from '../../shared-review-calc/review-calc';
import * as XLSX from 'xlsx';
import { getPinyinInitials, getInitialPassword } from '@server/common/utils/pinyin-helper';
import type {
  BatchListResponse,
  BatchStatus,
  CreateBatchRequest,
  CreateDisplaySettingRequest,
  CreateParticipantRequest,
  CreateRuleSetRequest,
  DisplaySettingListResponse,
  ParticipantListResponse,
  ReviewBatchRecord,
  ReviewCalcResult,
  ReviewParticipantRecord,
  CompositeDimension,
  RuleDimension,
  RuleSetConfig,
  RuleSetRecord,
  RuleSetStatus,
  RuleSetListResponse,
  RuleSetVersionRecord,
  RuleSetVersionListResponse,
  ScoreItemInput,
  UpdateBatchRequest,
  UpdateDisplaySettingRequest,
  UpdateParticipantRequest,
  UpdateRuleSetRequest,
  DisplaySettingRecord,
  ReviewerAccountItem,
  ReviewerAccountStatus,
  CreateReviewerAccountRequest,
} from '@shared/api.interface';

// ---------- Default display settings (seed on first access) ----------

const DEFAULT_DISPLAY_SETTINGS: Array<{
  settingKey: string;
  settingValue: string;
  sortOrder: number;
}> = [
  { settingKey: 'app_name', settingValue: '人才评估系统', sortOrder: 1 },
  { settingKey: 'review_name', settingValue: '人才评估', sortOrder: 2 },
  { settingKey: 'reviewer_label', settingValue: '评估人', sortOrder: 3 },
  { settingKey: 'reviewee_label', settingValue: '被评估人', sortOrder: 4 },
  { settingKey: 'department_label', settingValue: '部门', sortOrder: 5 },
  { settingKey: 'grid_description', settingValue: '九宫格人才地图', sortOrder: 6 },
];

// ---------- Row type helpers ----------

type RuleSetRow = typeof ruleSet.$inferSelect;
type RuleSetVersionRow = typeof ruleSetVersion.$inferSelect;
type BatchRow = typeof reviewBatch.$inferSelect;
type ParticipantRow = typeof reviewParticipant.$inferSelect;
type DisplaySettingRow = typeof appDisplaySetting.$inferSelect;

function rowToRuleSet(row: RuleSetRow): RuleSetRecord {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    status: row.status as RuleSetStatus,
    isDefault: row.isDefault,
    config: (row.config ?? {}) as unknown as RuleSetConfig,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function rowToBatch(row: BatchRow): ReviewBatchRecord {
  return {
    id: row.id,
    name: row.name,
    ruleSetId: row.ruleSetId,
    startDate: row.startDate ? String(row.startDate) : null,
    endDate: row.endDate ? String(row.endDate) : null,
    status: row.status as BatchStatus,
    description: row.description ?? '',
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function rowToParticipant(row: ParticipantRow): ReviewParticipantRecord {
  return {
    id: row.id,
    batchId: row.batchId,
    reviewerKey: row.reviewerKey,
    reviewerName: row.reviewerName,
    revieweeName: row.revieweeName,
    department: row.department ?? null,
    positionType: row.positionType ?? null,
    employeeNo: row.employeeNo ?? null,
    sortOrder: row.sortOrder ?? 0,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function rowToDisplaySetting(row: DisplaySettingRow): DisplaySettingRecord {
  return {
    id: row.id,
    settingKey: row.settingKey,
    settingValue: row.settingValue,
    sortOrder: row.sortOrder ?? 0,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function rowToRuleSetVersion(row: RuleSetVersionRow): RuleSetVersionRecord {
  return {
    id: row.id,
    ruleSetId: row.ruleSetId,
    versionNo: row.versionNo,
    config: (row.config ?? {}) as unknown as RuleSetConfig,
    changeNote: row.changeNote ?? '',
    createdAt: row.createdAt.toISOString(),
    createdBy: row.createdBy ?? '',
  };
}

// ---------- Service ----------

@Injectable()
export class ReviewConfigService {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly authService: AuthService,
  ) {}

  private ensureAdmin(user: JwtPayload): void {
    if (user.role !== 'admin') {
      throw new ForbiddenException('需要管理员权限');
    }
  }

  // ---------- Rule Set CRUD ----------

  async listRuleSets(
    user: JwtPayload,
    status?: RuleSetStatus,
  ): Promise<RuleSetListResponse> {
    this.ensureAdmin(user);

    const whereConditions = [];
    if (status) {
      whereConditions.push(eq(ruleSet.status, status));
    }

    const rows: RuleSetRow[] = await this.db
      .select()
      .from(ruleSet)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(ruleSet.createdAt));

    return { items: rows.map((row: RuleSetRow) => rowToRuleSet(row)) };
  }

  async getRuleSet(user: JwtPayload, id: string): Promise<RuleSetRecord> {
    this.ensureAdmin(user);

    const rows: RuleSetRow[] = await this.db
      .select()
      .from(ruleSet)
      .where(eq(ruleSet.id, id));
    if (rows.length === 0) {
      throw new NotFoundException('规则集不存在');
    }
    return rowToRuleSet(rows[0]);
  }

  async getDefaultRuleSet(): Promise<RuleSetRecord | null> {
    const conditions = [
      eq(ruleSet.isDefault, true),
      eq(ruleSet.status, 'active'),
    ];
    const rows: RuleSetRow[] = await this.db
      .select()
      .from(ruleSet)
      .where(and(...conditions))
      .orderBy(desc(ruleSet.updatedAt))
      .limit(1);
    return rows.length > 0 ? rowToRuleSet(rows[0]) : null;
  }

  /**
   * 规则试算：根据指定规则集配置 + 传入的明细分值，计算各项结果（只读，不修改数据）。
   */
  async tryCalculate(
    user: JwtPayload,
    id: string,
    items: ScoreItemInput[],
  ): Promise<ReviewCalcResult> {
    this.ensureAdmin(user);

    const ruleSetRec = await this.getRuleSet(user, id);
    return computeReviewByConfig(ruleSetRec.config, items);
  }

  async createRuleSet(
    user: JwtPayload,
    dto: CreateRuleSetRequest,
  ): Promise<RuleSetRecord> {
    this.ensureAdmin(user);

    const errors = this.validateRuleSetConfig(dto.config);
    if (errors.length > 0) {
      throw new BadRequestException('规则集配置校验失败：\n' + errors.join('\n'));
    }

    // 如果设置为默认，先取消其他的默认
    if (dto.isDefault) {
      await this.clearDefaultFlag();
    }

    const insertValues: typeof ruleSet.$inferInsert = {
      name: dto.name,
      description: dto.description ?? '',
      config: dto.config as unknown as Record<string, unknown>,
      isDefault: dto.isDefault ?? false,
      status: 'draft',
    };

    const result: RuleSetRow[] = await this.db
      .insert(ruleSet)
      .values(insertValues)
      .returning();
    const created = result[0];

    // 创建 v1 版本快照
    await this.createVersionSnapshot(created.id, '创建规则集');

    return rowToRuleSet(created);
  }

  async updateRuleSet(
    user: JwtPayload,
    id: string,
    dto: UpdateRuleSetRequest,
  ): Promise<RuleSetRecord> {
    this.ensureAdmin(user);

    const existing: RuleSetRow[] = await this.db
      .select()
      .from(ruleSet)
      .where(eq(ruleSet.id, id));
    if (existing.length === 0) {
      throw new NotFoundException('规则集不存在');
    }

    const patch: Partial<typeof ruleSet.$inferInsert> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.description !== undefined) patch.description = dto.description;
    if (dto.status !== undefined) patch.status = dto.status;
    if (dto.config !== undefined) {
      const errors = this.validateRuleSetConfig(dto.config);
      if (errors.length > 0) {
        throw new BadRequestException('规则集配置校验失败：\n' + errors.join('\n'));
      }
      patch.config = dto.config as unknown as Record<string, unknown>;
    }

    // 处理默认标记
    if (dto.isDefault === true) {
      await this.clearDefaultFlag();
      patch.isDefault = true;
    } else if (dto.isDefault === false) {
      patch.isDefault = false;
    }

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('未提供可更新字段');
    }

    patch.updatedAt = new Date();

    const updated: RuleSetRow[] = await this.db
      .update(ruleSet)
      .set(patch)
      .where(eq(ruleSet.id, id))
      .returning();
    if (updated.length === 0) {
      throw new NotFoundException('规则集不存在');
    }

    // 判断是否需要创建版本快照：配置变更 或 状态变更为启用
    const needSnapshot = patch.config !== undefined
      || (patch.status !== undefined && patch.status === 'active');
    if (needSnapshot) {
      let note: string | undefined;
      if (dto.changeNote) {
        note = dto.changeNote;
      } else if (patch.status === 'active' && existing[0].status === 'draft') {
        note = '启用';
      } else if (patch.config !== undefined) {
        note = '更新配置';
      }
      await this.createVersionSnapshot(id, note);
    }

    return rowToRuleSet(updated[0]);
  }

  async copyRuleSet(user: JwtPayload, id: string): Promise<RuleSetRecord> {
    this.ensureAdmin(user);

    const existing: RuleSetRow[] = await this.db
      .select()
      .from(ruleSet)
      .where(eq(ruleSet.id, id));
    if (existing.length === 0) {
      throw new NotFoundException('规则集不存在');
    }

    const src = existing[0];
    const baseName = src.name.replace(/ 副本\d*$/, '');

    const allNames = await this.db
      .select({ name: ruleSet.name })
      .from(ruleSet);
    const usedNames = new Set(allNames.map((r) => r.name));

    let copyName = `${baseName} 副本`;
    let counter = 2;
    while (usedNames.has(copyName)) {
      copyName = `${baseName} 副本${counter}`;
      counter += 1;
    }

    const inserted: RuleSetRow[] = await this.db
      .insert(ruleSet)
      .values({
        name: copyName,
        description: src.description ?? '',
        status: 'draft',
        isDefault: false,
        config: src.config as unknown as Record<string, unknown>,
      })
      .returning();
    const newRuleSet = inserted[0];

    // 新规则集创建 v1 版本快照
    await this.createVersionSnapshot(
      newRuleSet.id,
      `复制自 ${src.name}`,
    );

    return rowToRuleSet(newRuleSet);
  }

  async deleteRuleSet(user: JwtPayload, id: string): Promise<void> {
    this.ensureAdmin(user);

    const existing: RuleSetRow[] = await this.db
      .select()
      .from(ruleSet)
      .where(eq(ruleSet.id, id));
    if (existing.length === 0) {
      throw new NotFoundException('规则集不存在');
    }

    // 检查是否有批次引用
    const batchCount = await this.db
      .select()
      .from(reviewBatch)
      .where(eq(reviewBatch.ruleSetId, id));
    if (batchCount.length > 0) {
      throw new BadRequestException('该规则集仍有批次引用，无法删除');
    }

    await this.db.delete(ruleSet).where(eq(ruleSet.id, id));
  }

  async activateRuleSet(user: JwtPayload, id: string): Promise<RuleSetRecord> {
    this.ensureAdmin(user);

    const existing: RuleSetRow[] = await this.db
      .select()
      .from(ruleSet)
      .where(eq(ruleSet.id, id));
    if (existing.length === 0) {
      throw new NotFoundException('规则集不存在');
    }
    const current = existing[0];

    // 取消其他规则集的默认
    await this.clearDefaultFlag();

    const updated: RuleSetRow[] = await this.db
      .update(ruleSet)
      .set({
        status: 'active',
        isDefault: true,
        updatedAt: new Date(),
      })
      .where(eq(ruleSet.id, id))
      .returning();
    if (updated.length === 0) {
      throw new NotFoundException('规则集不存在');
    }

    // 启用时创建版本快照
    if (current.status !== 'active') {
      await this.createVersionSnapshot(id, '启用');
    }

    return rowToRuleSet(updated[0]);
  }

  // ---------- Rule Set Version Snapshot ----------

  async createVersionSnapshot(
    ruleSetId: string,
    changeNote?: string,
  ): Promise<RuleSetVersionRecord | null> {
    const rsRows: RuleSetRow[] = await this.db
      .select()
      .from(ruleSet)
      .where(eq(ruleSet.id, ruleSetId));
    if (rsRows.length === 0) {
      return null;
    }
    const current = rsRows[0];

    // 查询当前最大版本号
    const maxRows: Array<{ max: unknown }> = await this.db
      .select({ max: sql`MAX(${ruleSetVersion.versionNo})`.as('max') })
      .from(ruleSetVersion)
      .where(eq(ruleSetVersion.ruleSetId, ruleSetId));
    const maxVersion = Number(maxRows[0]?.max ?? 0);
    const nextVersionNo = maxVersion + 1;

    const inserted: RuleSetVersionRow[] = await this.db
      .insert(ruleSetVersion)
      .values({
        ruleSetId,
        versionNo: nextVersionNo,
        config: current.config as unknown as Record<string, unknown>,
        changeNote: changeNote ?? null,
      })
      .returning();

    return inserted.length > 0 ? rowToRuleSetVersion(inserted[0]) : null;
  }

  async getVersions(
    user: JwtPayload,
    ruleSetId: string,
  ): Promise<RuleSetVersionListResponse> {
    this.ensureAdmin(user);

    // 验证规则集存在
    const rsRows: RuleSetRow[] = await this.db
      .select()
      .from(ruleSet)
      .where(eq(ruleSet.id, ruleSetId));
    if (rsRows.length === 0) {
      throw new NotFoundException('规则集不存在');
    }

    const rows: RuleSetVersionRow[] = await this.db
      .select()
      .from(ruleSetVersion)
      .where(eq(ruleSetVersion.ruleSetId, ruleSetId))
      .orderBy(desc(ruleSetVersion.versionNo));

    return { items: rows.map((row: RuleSetVersionRow) => rowToRuleSetVersion(row)) };
  }

  async getVersion(
    user: JwtPayload,
    ruleSetId: string,
    versionNo: number,
  ): Promise<RuleSetVersionRecord> {
    this.ensureAdmin(user);

    const rows: RuleSetVersionRow[] = await this.db
      .select()
      .from(ruleSetVersion)
      .where(and(
        eq(ruleSetVersion.ruleSetId, ruleSetId),
        eq(ruleSetVersion.versionNo, versionNo),
      ));
    if (rows.length === 0) {
      throw new NotFoundException('版本不存在');
    }
    return rowToRuleSetVersion(rows[0]);
  }

  async rollbackToVersion(
    user: JwtPayload,
    ruleSetId: string,
    versionNo: number,
  ): Promise<RuleSetVersionRecord> {
    this.ensureAdmin(user);

    // 1. 找到目标版本
    const versionRows: RuleSetVersionRow[] = await this.db
      .select()
      .from(ruleSetVersion)
      .where(and(
        eq(ruleSetVersion.ruleSetId, ruleSetId),
        eq(ruleSetVersion.versionNo, versionNo),
      ));
    if (versionRows.length === 0) {
      throw new NotFoundException('版本不存在');
    }
    const targetVersion = versionRows[0];

    // 2. 更新 rule_set 的 config
    const updated: RuleSetRow[] = await this.db
      .update(ruleSet)
      .set({
        config: targetVersion.config as unknown as Record<string, unknown>,
        updatedAt: new Date(),
      })
      .where(eq(ruleSet.id, ruleSetId))
      .returning();
    if (updated.length === 0) {
      throw new NotFoundException('规则集不存在');
    }

    // 3. 创建新版本（change_note 写明回滚来源）
    const newVersion = await this.createVersionSnapshot(
      ruleSetId,
      `回滚到 v${versionNo}`,
    );
    if (!newVersion) {
      throw new BadRequestException('回滚失败：无法创建新版本');
    }

    return newVersion;
  }

  private validateRuleSetConfig(config: RuleSetConfig): string[] {
    const errors: string[] = [];
    const {
      dimensions,
      gridThresholds,
      xAxisDimension,
      yAxisDimension,
      compositeDimensions,
    } = config;

    // 1. 权重合计 ≈ 1.0（基础维度 + 合成维度中 weight > 0 的都计入）
    let totalWeight = dimensions.reduce(
      (sum: number, d: RuleDimension) =>
        sum + ((d.weight ?? 0) > 0 ? d.weight! : 0),
      0,
    );
    if (compositeDimensions && compositeDimensions.length > 0) {
      totalWeight += compositeDimensions.reduce(
        (sum: number, cd: CompositeDimension) =>
          sum + ((cd.weight ?? 0) > 0 ? cd.weight! : 0),
        0,
      );
    }
    if (Math.abs(totalWeight - 1.0) > 0.001) {
      errors.push(`维度权重合计为 ${Math.round(totalWeight * 1000) / 10}%，必须等于 100%`);
    }

    // 2. 九宫格高分线 > 低分线，且都在 1~5 之间
    const { high, low } = gridThresholds;
    if (high < 1 || high > 5) {
      errors.push('高分线必须在 1~5 之间');
    }
    if (low < 1 || low > 5) {
      errors.push('低分线必须在 1~5 之间');
    }
    if (high <= low) {
      errors.push('高分线必须大于低分线');
    }

    // 3. 每个子项 maxScore >= 1
    // 4. 维度 code 不重复、不为空；子项 code 在同一维度内不重复、不为空
    // 5. 横轴纵轴维度校验（稍后）
    // 6. 至少一个红线维度
    // 7. 每个维度至少一个子项
    const dimCodes = new Set<string>();
    let redLineCount = 0;

    for (const dim of dimensions) {
      if (!dim.code || dim.code.trim() === '') {
        errors.push('维度 code 不能为空');
      } else if (dimCodes.has(dim.code)) {
        errors.push(`维度 code 重复：${dim.code}`);
      } else {
        dimCodes.add(dim.code);
      }

      if (dim.isRedLine) {
        redLineCount += 1;
      }

      // 维度至少一个子项（绩效维度子项来自 positionTypes，允许空 items）
      const hasPositionTypes =
        (config.positionTypes?.length ?? 0) > 0;
      const isPerfDimWithPosTypes = hasPositionTypes && dim.code === 'performance';
      if ((!dim.items || dim.items.length === 0) && !isPerfDimWithPosTypes) {
        errors.push(`维度「${dim.name ?? dim.code ?? ''}」至少需要一个子项`);
        continue;
      }

      const itemCodes = new Set<string>();
      for (const item of dim.items) {
        if (item.maxScore < 1) {
          errors.push(`维度「${dim.name ?? dim.code ?? ''}」的子项「${item.name ?? item.code ?? ''}」满分必须 ≥ 1`);
        }

        if (!item.code || item.code.trim() === '') {
          errors.push(`维度「${dim.name ?? dim.code ?? ''}」的子项 code 不能为空`);
        } else if (itemCodes.has(item.code)) {
          errors.push(`维度「${dim.name ?? dim.code ?? ''}」的子项 code 重复：${item.code}`);
        } else {
          itemCodes.add(item.code);
        }
      }
    }

    // 至少一个红线维度
    if (redLineCount === 0) {
      errors.push('至少需要一个红线维度');
    }

    // 横轴纵轴维度校验（基础维度 + 合成维度 + 'total' 综合总分特殊值）
    const baseDimCodes = new Set(dimensions.map((d: RuleDimension) => d.code));
    const compositeCodes = new Set(
      (compositeDimensions ?? []).map((cd: CompositeDimension) => cd.code),
    );
    const allDimCodes = new Set([...baseDimCodes, ...compositeCodes, 'total']);
    if (!allDimCodes.has(xAxisDimension)) {
      errors.push('九宫格横轴指定的维度不存在');
    }
    if (!allDimCodes.has(yAxisDimension)) {
      errors.push('九宫格纵轴指定的维度不存在');
    }
    if (xAxisDimension === yAxisDimension) {
      errors.push('横轴和纵轴不能指定同一个维度');
    }

    // 每个非空岗位的绩效项权重合计必须等于 100%
    const positionTypes = config.positionTypes;
    if (positionTypes && positionTypes.length > 0) {
      for (const pt of positionTypes) {
        const perfItems = pt.performanceItems;
        if (!perfItems || perfItems.length === 0) continue;
        const totalPtWeight = perfItems.reduce(
          (sum: number, item: { weight?: number }) =>
            sum + (item.weight ?? 0),
          0,
        );
        if (Math.abs(totalPtWeight - 100) > 0.1) {
          errors.push(
            `岗位「${pt.name ?? pt.code ?? ''}」绩效项权重合计为 ${totalPtWeight.toFixed(1)}%，必须等于 100%`,
          );
        }
      }
    }

    return errors;
  }

  private async clearDefaultFlag(): Promise<void> {
    await this.db
      .update(ruleSet)
      .set({ isDefault: false, updatedAt: new Date() });
  }

  // ---------- Seed default unified rule set (通用三维九项) ----------

  async seedDefaultUnifiedRuleSet(user: JwtPayload): Promise<RuleSetRecord> {
    this.ensureAdmin(user);

    const existing = await this.db
      .select()
      .from(ruleSet)
      .where(and(
        eq(ruleSet.isDefault, true),
        eq(ruleSet.status, 'active'),
      ));
    if (existing.length > 0) {
      return rowToRuleSet(existing[0]);
    }

    const config: RuleSetConfig = {
      dimensions: [
        {
          code: 'value',
          name: '价值观',
          weight: 0,
          isRedLine: true,
          items: [
            { code: 'value_co_create', name: '共创共享认同', maxScore: 5, sortOrder: 1 },
            { code: 'value_cost', name: '成本利润意识', maxScore: 5, sortOrder: 2 },
            { code: 'value_ownership', name: '主人翁精神', maxScore: 5, sortOrder: 3 },
          ],
        },
        {
          code: 'ability',
          name: '能力',
          weight: 0.6,
          isRedLine: false,
          items: [
            { code: 'ability_professional', name: '专业胜任', maxScore: 5, sortOrder: 4 },
            { code: 'ability_quality', name: '交付质量', maxScore: 5, sortOrder: 5 },
            { code: 'ability_problem_solve', name: '问题解决', maxScore: 5, sortOrder: 6 },
          ],
        },
        {
          code: 'will',
          name: '意愿',
          weight: 0.4,
          isRedLine: false,
          items: [
            { code: 'will_initiative', name: '主动性', maxScore: 5, sortOrder: 7 },
            { code: 'will_growth', name: '成长性', maxScore: 5, sortOrder: 8 },
            { code: 'will_stability', name: '稳定性', maxScore: 5, sortOrder: 9 },
          ],
        },
      ],
      compositeDimensions: [],
      gridThresholds: { high: 4.0, low: 2.5 },
      xAxisDimension: 'ability',
      yAxisDimension: 'will',
      evidenceLevels: [
        { code: 'sufficient', name: '充分', minScore: 4, maxScore: 5, description: '有充分事实依据支撑评分' },
        { code: 'moderate', name: '一般', minScore: 3, maxScore: 3.99, description: '有一定事实依据支撑评分' },
        { code: 'insufficient', name: '不足', minScore: 1, maxScore: 2.99, description: '事实依据不足' },
      ],
      scoreLevels: [
        { code: 'excellent', name: '优秀', minScore: 4.5, maxScore: 5, description: '远超预期' },
        { code: 'good', name: '良好', minScore: 3.5, maxScore: 4.49, description: '超过预期' },
        { code: 'qualified', name: '合格', minScore: 2.5, maxScore: 3.49, description: '达到预期' },
        { code: 'to_improve', name: '待改进', minScore: 1.5, maxScore: 2.49, description: '部分未达到预期' },
        { code: 'unqualified', name: '不合格', minScore: 1, maxScore: 1.49, description: '远未达到预期' },
      ],
      positionTypes: [],
      displayLabels: {},
    };

    const inserted = await this.db
      .insert(ruleSet)
      .values({
        name: '默认规则',
        description: '三维九项通用人才盘点规则：价值观（红线）+ 能力（60%） + 意愿（40%）',
        status: 'active',
        isDefault: true,
        config: config as unknown as Record<string, unknown>,
      })
      .returning();

    // 创建 v1 版本快照
    await this.createVersionSnapshot(inserted[0].id, '初始化默认规则');

    return rowToRuleSet(inserted[0]);
  }

  // ---------- Batch CRUD ----------

  async listBatches(
    user: JwtPayload,
    status?: BatchStatus,
  ): Promise<BatchListResponse> {
    this.ensureAdmin(user);

    const whereConditions = [];
    if (status) {
      whereConditions.push(eq(reviewBatch.status, status));
    }

    const rows: BatchRow[] = await this.db
      .select()
      .from(reviewBatch)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(reviewBatch.createdAt));

    return { items: rows.map((row: BatchRow) => rowToBatch(row)) };
  }

  async getBatch(user: JwtPayload, id: string): Promise<ReviewBatchRecord> {
    this.ensureAdmin(user);

    const rows: BatchRow[] = await this.db
      .select()
      .from(reviewBatch)
      .where(eq(reviewBatch.id, id));
    if (rows.length === 0) {
      throw new NotFoundException('盘点批次不存在');
    }
    return rowToBatch(rows[0]);
  }

  async createBatch(
    user: JwtPayload,
    dto: CreateBatchRequest,
  ): Promise<ReviewBatchRecord> {
    this.ensureAdmin(user);

    // 验证 ruleSetId 存在
    const ruleSetRows: RuleSetRow[] = await this.db
      .select()
      .from(ruleSet)
      .where(eq(ruleSet.id, dto.ruleSetId));
    if (ruleSetRows.length === 0) {
      throw new BadRequestException('关联的规则集不存在');
    }

    const insertValues: typeof reviewBatch.$inferInsert = {
      name: dto.name,
      ruleSetId: dto.ruleSetId,
      startDate: dto.startDate ?? null,
      endDate: dto.endDate ?? null,
      description: dto.description ?? '',
      status: 'active',
    };

    const result: BatchRow[] = await this.db
      .insert(reviewBatch)
      .values(insertValues)
      .returning();
    return rowToBatch(result[0]);
  }

  async updateBatch(
    user: JwtPayload,
    id: string,
    dto: UpdateBatchRequest,
  ): Promise<ReviewBatchRecord> {
    this.ensureAdmin(user);

    const existing: BatchRow[] = await this.db
      .select()
      .from(reviewBatch)
      .where(eq(reviewBatch.id, id));
    if (existing.length === 0) {
      throw new NotFoundException('盘点批次不存在');
    }

    const patch: Partial<typeof reviewBatch.$inferInsert> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.status !== undefined) patch.status = dto.status;
    if (dto.ruleSetId !== undefined) {
      const rsRows: RuleSetRow[] = await this.db
        .select()
        .from(ruleSet)
        .where(eq(ruleSet.id, dto.ruleSetId));
      if (rsRows.length === 0) {
        throw new BadRequestException('关联的规则集不存在');
      }
      patch.ruleSetId = dto.ruleSetId;
    }
    if (dto.startDate !== undefined) {
      patch.startDate = dto.startDate ?? null;
    }
    if (dto.endDate !== undefined) {
      patch.endDate = dto.endDate ?? null;
    }
    if (dto.description !== undefined) patch.description = dto.description;

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('未提供可更新字段');
    }

    patch.updatedAt = new Date();

    const updated: BatchRow[] = await this.db
      .update(reviewBatch)
      .set(patch)
      .where(eq(reviewBatch.id, id))
      .returning();
    if (updated.length === 0) {
      throw new NotFoundException('盘点批次不存在');
    }
    return rowToBatch(updated[0]);
  }

  async deleteBatch(user: JwtPayload, id: string): Promise<void> {
    this.ensureAdmin(user);

    const existing: BatchRow[] = await this.db
      .select()
      .from(reviewBatch)
      .where(eq(reviewBatch.id, id));
    if (existing.length === 0) {
      throw new NotFoundException('盘点批次不存在');
    }

    // 检查是否有参评人引用
    const participantCount = await this.db
      .select()
      .from(reviewParticipant)
      .where(eq(reviewParticipant.batchId, id));
    if (participantCount.length > 0) {
      throw new BadRequestException('该批次仍有参评人数据，无法删除');
    }

    await this.db.delete(reviewBatch).where(eq(reviewBatch.id, id));
  }

  // ---------- Participant CRUD ----------

  async listParticipants(
    user: JwtPayload,
    batchId: string,
    reviewerKey?: string,
  ): Promise<ParticipantListResponse> {
    this.ensureAdmin(user);

    const whereConditions = [eq(reviewParticipant.batchId, batchId)];
    if (reviewerKey) {
      whereConditions.push(eq(reviewParticipant.reviewerKey, reviewerKey));
    }

    const rows: ParticipantRow[] = await this.db
      .select()
      .from(reviewParticipant)
      .where(and(...whereConditions))
      .orderBy(
        asc(reviewParticipant.sortOrder),
        asc(reviewParticipant.reviewerKey),
        asc(reviewParticipant.revieweeName),
      );

    return { items: rows.map((row: ParticipantRow) => rowToParticipant(row)) };
  }

  async getActiveBatchParticipants(): Promise<ParticipantRow[]> {
    const batches: BatchRow[] = await this.db
      .select()
      .from(reviewBatch)
      .where(eq(reviewBatch.status, 'active'))
      .orderBy(desc(reviewBatch.createdAt))
      .limit(1);

    if (batches.length === 0) return [];

    const rows: ParticipantRow[] = await this.db
      .select()
      .from(reviewParticipant)
      .where(eq(reviewParticipant.batchId, batches[0].id))
      .orderBy(
        asc(reviewParticipant.sortOrder),
        asc(reviewParticipant.reviewerKey),
        asc(reviewParticipant.revieweeName),
      );
    return rows;
  }

  async getParticipant(
    user: JwtPayload,
    id: string,
  ): Promise<ReviewParticipantRecord> {
    this.ensureAdmin(user);

    const rows: ParticipantRow[] = await this.db
      .select()
      .from(reviewParticipant)
      .where(eq(reviewParticipant.id, id));
    if (rows.length === 0) {
      throw new NotFoundException('参评记录不存在');
    }
    return rowToParticipant(rows[0]);
  }

  async createParticipant(
    user: JwtPayload,
    dto: CreateParticipantRequest,
  ): Promise<ReviewParticipantRecord> {
    this.ensureAdmin(user);

    // 验证 batchId
    const batchRows: BatchRow[] = await this.db
      .select()
      .from(reviewBatch)
      .where(eq(reviewBatch.id, dto.batchId));
    if (batchRows.length === 0) {
      throw new BadRequestException('关联的批次不存在');
    }

    const insertValues: typeof reviewParticipant.$inferInsert = {
      batchId: dto.batchId,
      reviewerKey: dto.reviewerKey,
      reviewerName: dto.reviewerName,
      revieweeName: dto.revieweeName,
      department: dto.department ?? null,
      positionType: dto.positionType ?? null,
      employeeNo: dto.employeeNo ?? null,
      sortOrder: dto.sortOrder ?? 0,
    };

    const result: ParticipantRow[] = await this.db
      .insert(reviewParticipant)
      .values(insertValues)
      .returning();

    await this.autoCreateReviewerAccounts([result[0]]);

    return rowToParticipant(result[0]);
  }

  async getParticipantTemplate(
    user: JwtPayload,
  ): Promise<Buffer> {
    this.ensureAdmin(user);

    const headers = ['姓名', '工号', '部门', '岗位类型', '角色', '评价人姓名'];
    const notes = [
      ['填写说明'],
      ['1. 角色只能填「评价人」或「被盘人」'],
      ['2. 被盘人必须填对应的评价人姓名，且该评价人必须已在名单中'],
      ['3. 姓名、部门、角色为必填项'],
      ['4. 填写前请删除本行及以上说明行'],
    ];
    const samples = [
      { 姓名: '张三', 工号: '', 部门: '运营管理中心·客服部', 岗位类型: '客服', 角色: '评价人', 评价人姓名: '' },
      { 姓名: '李四', 工号: '', 部门: '运营管理中心·客服部', 岗位类型: '客服', 角色: '被盘人', 评价人姓名: '张三' },
    ];

    const wsData: unknown[][] = [
      ...notes,
      headers,
      ...samples.map((s) => headers.map((h) => s[h as keyof typeof s])),
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(wsData);
    worksheet['!cols'] = [
      { wch: 12 },
      { wch: 14 },
      { wch: 28 },
      { wch: 12 },
      { wch: 10 },
      { wch: 14 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '人员名单');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return buffer as Buffer;
  }

  async batchImportParticipants(
    user: JwtPayload,
    batchId: string,
    items: Omit<CreateParticipantRequest, 'batchId'>[],
  ): Promise<{ success: number; failed: number }> {
    this.ensureAdmin(user);

    // 验证 batchId
    const batchRows: BatchRow[] = await this.db
      .select()
      .from(reviewBatch)
      .where(eq(reviewBatch.id, batchId));
    if (batchRows.length === 0) {
      throw new BadRequestException('关联的批次不存在');
    }

    if (items.length === 0) {
      return { success: 0, failed: 0 };
    }

    const values: Array<typeof reviewParticipant.$inferInsert> = items.map(
      (item) => ({
        batchId,
        reviewerKey: item.reviewerKey,
        reviewerName: item.reviewerName,
        revieweeName: item.revieweeName,
        department: item.department ?? null,
        positionType: item.positionType ?? null,
        employeeNo: item.employeeNo ?? null,
        sortOrder: item.sortOrder ?? 0,
      }),
    );

    const result: ParticipantRow[] = await this.db
      .insert(reviewParticipant)
      .values(values)
      .onConflictDoNothing()
      .returning();

    // 自动为评价人行创建 reviewer_account
    await this.autoCreateReviewerAccounts(result);

    return {
      success: result.length,
      failed: items.length - result.length,
    };
  }

  async updateParticipant(
    user: JwtPayload,
    id: string,
    dto: UpdateParticipantRequest,
  ): Promise<ReviewParticipantRecord> {
    this.ensureAdmin(user);

    const existing: ParticipantRow[] = await this.db
      .select()
      .from(reviewParticipant)
      .where(eq(reviewParticipant.id, id));
    if (existing.length === 0) {
      throw new NotFoundException('参评记录不存在');
    }

    const patch: Partial<typeof reviewParticipant.$inferInsert> = {};
    if (dto.reviewerKey !== undefined) patch.reviewerKey = dto.reviewerKey;
    if (dto.reviewerName !== undefined) patch.reviewerName = dto.reviewerName;
    if (dto.revieweeName !== undefined) patch.revieweeName = dto.revieweeName;
    if (dto.department !== undefined) patch.department = dto.department;
    if (dto.positionType !== undefined) patch.positionType = dto.positionType;
    if (dto.employeeNo !== undefined) patch.employeeNo = dto.employeeNo;
    if (dto.sortOrder !== undefined) patch.sortOrder = dto.sortOrder;

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('未提供可更新字段');
    }

    patch.updatedAt = new Date();

    const updated: ParticipantRow[] = await this.db
      .update(reviewParticipant)
      .set(patch)
      .where(eq(reviewParticipant.id, id))
      .returning();
    if (updated.length === 0) {
      throw new NotFoundException('参评记录不存在');
    }
    return rowToParticipant(updated[0]);
  }

  async deleteParticipant(user: JwtPayload, id: string): Promise<void> {
    this.ensureAdmin(user);

    const existing: ParticipantRow[] = await this.db
      .select()
      .from(reviewParticipant)
      .where(eq(reviewParticipant.id, id));
    if (existing.length === 0) {
      throw new NotFoundException('参评记录不存在');
    }

    await this.db.delete(reviewParticipant).where(eq(reviewParticipant.id, id));
  }

  async clearBatchParticipants(user: JwtPayload, batchId: string): Promise<void> {
    this.ensureAdmin(user);

    const batchRows: BatchRow[] = await this.db
      .select()
      .from(reviewBatch)
      .where(eq(reviewBatch.id, batchId));
    if (batchRows.length === 0) {
      throw new NotFoundException('盘点批次不存在');
    }

    await this.db
      .delete(reviewParticipant)
      .where(eq(reviewParticipant.batchId, batchId));
  }

  // ---------- API Key Management ----------

  private static readonly API_KEY_SETTING_KEY = 'openapi_api_key';

  private generateApiKey(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let key = 'trk_';
    for (let i = 0; i < 32; i++) {
      key += chars[Math.floor(Math.random() * chars.length)];
    }
    return key;
  }

  async getOrCreateApiKey(user: JwtPayload): Promise<{ apiKey: string }> {
    this.ensureAdmin(user);

    const existing = await this.db
      .select()
      .from(appDisplaySetting)
      .where(eq(appDisplaySetting.settingKey, ReviewConfigService.API_KEY_SETTING_KEY));

    if (existing.length > 0 && existing[0].settingValue) {
      return { apiKey: existing[0].settingValue };
    }

    const newKey = this.generateApiKey();
    await this.db.insert(appDisplaySetting).values({
      settingKey: ReviewConfigService.API_KEY_SETTING_KEY,
      settingValue: newKey,
      sortOrder: 99,
    });

    return { apiKey: newKey };
  }

  async resetApiKey(user: JwtPayload): Promise<{ apiKey: string }> {
    this.ensureAdmin(user);

    const newKey = this.generateApiKey();
    const existing = await this.db
      .select()
      .from(appDisplaySetting)
      .where(eq(appDisplaySetting.settingKey, ReviewConfigService.API_KEY_SETTING_KEY));

    if (existing.length > 0) {
      await this.db
        .update(appDisplaySetting)
        .set({ settingValue: newKey, updatedAt: new Date() })
        .where(eq(appDisplaySetting.id, existing[0].id));
    } else {
      await this.db.insert(appDisplaySetting).values({
        settingKey: ReviewConfigService.API_KEY_SETTING_KEY,
        settingValue: newKey,
        sortOrder: 99,
      });
    }

    return { apiKey: newKey };
  }

  async validateApiKey(key: string): Promise<boolean> {
    if (!key) return false;
    const rows = await this.db
      .select({ settingValue: appDisplaySetting.settingValue })
      .from(appDisplaySetting)
      .where(eq(appDisplaySetting.settingKey, ReviewConfigService.API_KEY_SETTING_KEY));
    if (rows.length === 0) return false;
    return rows[0].settingValue === key;
  }

  // ---------- OpenAPI Participant Sync ----------

  async syncParticipantsByApiKey(
    apiKey: string,
    batchId: string | undefined,
    items: Array<{
      reviewerName: string;
      revieweeName: string;
      department?: string;
      positionType?: string;
      employeeNo?: string;
    }>,
    mode: string,
  ): Promise<{
    success: number;
    skipped: number;
    failed: number;
    failures: Array<{ index: number; reason: string }>;
    batchId: string;
  }> {
    const valid = await this.validateApiKey(apiKey);
    if (!valid) {
      throw new ForbiddenException('无效的 API Key');
    }

    let targetBatchId = batchId;
    if (!targetBatchId) {
      const batches: BatchRow[] = await this.db
        .select()
        .from(reviewBatch)
        .where(eq(reviewBatch.status, 'active'))
        .orderBy(desc(reviewBatch.createdAt))
        .limit(1);
      if (batches.length === 0) {
        throw new BadRequestException('未找到生效的盘点批次，请指定 batchId');
      }
      targetBatchId = batches[0].id;
    } else {
      const batchRows: BatchRow[] = await this.db
        .select()
        .from(reviewBatch)
        .where(eq(reviewBatch.id, targetBatchId));
      if (batchRows.length === 0) {
        throw new BadRequestException('指定的批次不存在');
      }
    }

    if (!items || items.length === 0) {
      return { success: 0, skipped: 0, failed: 0, failures: [], batchId: targetBatchId };
    }

    const failures: Array<{ index: number; reason: string }> = [];
    const validItems: Array<typeof reviewParticipant.$inferInsert> = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.reviewerName || !item.reviewerName.trim()) {
        failures.push({ index: i, reason: '评价人姓名不能为空' });
        continue;
      }
      if (!item.revieweeName || !item.revieweeName.trim()) {
        failures.push({ index: i, reason: '被盘人姓名不能为空' });
        continue;
      }
      const reviewerKey = item.reviewerName
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_');
      validItems.push({
        batchId: targetBatchId,
        reviewerKey,
        reviewerName: item.reviewerName.trim(),
        revieweeName: item.revieweeName.trim(),
        department: item.department?.trim() || null,
        positionType: item.positionType?.trim() || null,
        employeeNo: item.employeeNo?.trim() || null,
        sortOrder: i,
      });
    }

    if (validItems.length === 0) {
      return {
        success: 0,
        skipped: 0,
        failed: failures.length,
        failures,
        batchId: targetBatchId,
      };
    }

    const inserted: ParticipantRow[] = await this.db
      .insert(reviewParticipant)
      .values(validItems)
      .onConflictDoNothing()
      .returning();

    const skipped = validItems.length - inserted.length;

    return {
      success: inserted.length,
      skipped,
      failed: failures.length,
      failures,
      batchId: targetBatchId,
    };
  }

  // ---------- Display Setting CRUD ----------

  private async seedDisplayDefaultsIfEmpty(): Promise<boolean> {
    const existing = await this.db
      .select({ count: count() })
      .from(appDisplaySetting);

    if (existing[0] && existing[0].count > 0) return false;

    const values = DEFAULT_DISPLAY_SETTINGS.map((item) => ({
      settingKey: item.settingKey,
      settingValue: item.settingValue,
      sortOrder: item.sortOrder,
    }));

    await this.db.insert(appDisplaySetting).values(values);
    return true;
  }

  /**
   * Public read: get display settings (no admin check).
   * Lazily seeds default values if the table is empty.
   */
  async getDisplaySettings(): Promise<DisplaySettingListResponse> {
    await this.seedDisplayDefaultsIfEmpty();

    const rows: DisplaySettingRow[] = await this.db
      .select()
      .from(appDisplaySetting)
      .where(sql`setting_key != ${ReviewConfigService.API_KEY_SETTING_KEY}`)
      .orderBy(
        asc(appDisplaySetting.sortOrder),
        asc(appDisplaySetting.settingKey),
      );

    return { items: rows.map((row: DisplaySettingRow) => rowToDisplaySetting(row)) };
  }

  async listDisplaySettings(
    user: JwtPayload,
  ): Promise<DisplaySettingListResponse> {
    this.ensureAdmin(user);

    // Lazy seed: ensure defaults exist
    await this.seedDisplayDefaultsIfEmpty();

    const rows: DisplaySettingRow[] = await this.db
      .select()
      .from(appDisplaySetting)
      .where(sql`setting_key != ${ReviewConfigService.API_KEY_SETTING_KEY}`)
      .orderBy(
        asc(appDisplaySetting.sortOrder),
        asc(appDisplaySetting.settingKey),
      );

    return { items: rows.map((row: DisplaySettingRow) => rowToDisplaySetting(row)) };
  }

  async getDisplaySetting(
    user: JwtPayload,
    id: string,
  ): Promise<DisplaySettingRecord> {
    this.ensureAdmin(user);

    const rows: DisplaySettingRow[] = await this.db
      .select()
      .from(appDisplaySetting)
      .where(eq(appDisplaySetting.id, id));
    if (rows.length === 0) {
      throw new NotFoundException('显示配置不存在');
    }
    return rowToDisplaySetting(rows[0]);
  }

  async createDisplaySetting(
    user: JwtPayload,
    dto: CreateDisplaySettingRequest,
  ): Promise<DisplaySettingRecord> {
    this.ensureAdmin(user);

    const insertValues: typeof appDisplaySetting.$inferInsert = {
      settingKey: dto.settingKey,
      settingValue: dto.settingValue,
      sortOrder: dto.sortOrder ?? 0,
    };

    const result: DisplaySettingRow[] = await this.db
      .insert(appDisplaySetting)
      .values(insertValues)
      .returning();
    return rowToDisplaySetting(result[0]);
  }

  async updateDisplaySetting(
    user: JwtPayload,
    id: string,
    dto: UpdateDisplaySettingRequest,
  ): Promise<DisplaySettingRecord> {
    this.ensureAdmin(user);

    const existing: DisplaySettingRow[] = await this.db
      .select()
      .from(appDisplaySetting)
      .where(eq(appDisplaySetting.id, id));
    if (existing.length === 0) {
      throw new NotFoundException('显示配置不存在');
    }

    const patch: Partial<typeof appDisplaySetting.$inferInsert> = {};
    if (dto.settingKey !== undefined) patch.settingKey = dto.settingKey;
    if (dto.settingValue !== undefined) patch.settingValue = dto.settingValue;
    if (dto.sortOrder !== undefined) patch.sortOrder = dto.sortOrder;

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('未提供可更新字段');
    }

    patch.updatedAt = new Date();

    const updated: DisplaySettingRow[] = await this.db
      .update(appDisplaySetting)
      .set(patch)
      .where(eq(appDisplaySetting.id, id))
      .returning();
    if (updated.length === 0) {
      throw new NotFoundException('显示配置不存在');
    }
    return rowToDisplaySetting(updated[0]);
  }

  async upsertDisplaySettingByKey(
    user: JwtPayload,
    key: string,
    value: string,
    sortOrder?: number,
  ): Promise<DisplaySettingRecord | null> {
    this.ensureAdmin(user);

    if (!key) throw new BadRequestException('settingKey 不能为空');
    if (key === ReviewConfigService.API_KEY_SETTING_KEY) {
      throw new ForbiddenException('不允许通过此接口修改 API 密钥');
    }

    const existing: DisplaySettingRow[] = await this.db
      .select()
      .from(appDisplaySetting)
      .where(eq(appDisplaySetting.settingKey, key));

    const now = new Date();

    if (!value || value.trim() === '') {
      if (existing.length > 0) {
        await this.db
          .delete(appDisplaySetting)
          .where(eq(appDisplaySetting.id, existing[0].id));
      }
      return null;
    }

    if (existing.length > 0) {
      const updated: DisplaySettingRow[] = await this.db
        .update(appDisplaySetting)
        .set({ settingValue: value, updatedAt: now })
        .where(eq(appDisplaySetting.id, existing[0].id))
        .returning();
      return rowToDisplaySetting(updated[0]);
    }

    const inserted: DisplaySettingRow[] = await this.db
      .insert(appDisplaySetting)
      .values({
        settingKey: key,
        settingValue: value,
        sortOrder: sortOrder ?? 0,
      })
      .returning();
    return rowToDisplaySetting(inserted[0]);
  }

  async deleteDisplaySetting(user: JwtPayload, id: string): Promise<void> {
    this.ensureAdmin(user);

    const existing: DisplaySettingRow[] = await this.db
      .select()
      .from(appDisplaySetting)
      .where(eq(appDisplaySetting.id, id));
    if (existing.length === 0) {
      throw new NotFoundException('显示配置不存在');
    }

    await this.db.delete(appDisplaySetting).where(eq(appDisplaySetting.id, id));
  }

  async replaceDisplaySettings(
    user: JwtPayload,
    items: Array<{ settingKey: string; settingValue: string; sortOrder?: number }>,
  ): Promise<DisplaySettingListResponse> {
    this.ensureAdmin(user);

    await this.db.transaction(async (tx) => {
      // 只替换非 API Key 的设置项
      await tx.delete(appDisplaySetting).where(
        sql`setting_key != ${ReviewConfigService.API_KEY_SETTING_KEY}`,
      );
      if (items.length > 0) {
        const values = items.map((item) => ({
          settingKey: item.settingKey,
          settingValue: item.settingValue,
          sortOrder: item.sortOrder ?? 0,
        }));
        await tx.insert(appDisplaySetting).values(values);
      }
    });

    const rows: DisplaySettingRow[] = await this.db
      .select()
      .from(appDisplaySetting)
      .where(sql`setting_key != ${ReviewConfigService.API_KEY_SETTING_KEY}`)
      .orderBy(
        asc(appDisplaySetting.sortOrder),
        asc(appDisplaySetting.settingKey),
      );

    return { items: rows.map((row: DisplaySettingRow) => rowToDisplaySetting(row)) };
  }

  // ---------- Reviewer Account Auto-Creation ----------

  /**
   * 从参评记录中识别评价人行（revieweeName === reviewerName），
   * 自动在 reviewer_account 表中创建账号。
   *
   * 登录名（reviewer_key）规则：
   * 1. 基础 key = 评价人中文姓名（去空格）
   * 2. 同姓名 + 同部门 → 视为同一人，不重复建号（幂等）
   * 3. 同姓名不同部门 → key = 姓名_部门名（部门去空格）
   * 4. 姓名_部门 也冲突 → 按序号追加：姓名2、姓名3...（从 2 开始）
   */
  private async autoCreateReviewerAccounts(
    participants: Array<{ reviewerKey?: string | null; reviewerName?: string | null; revieweeName?: string | null; department?: string | null }>,
  ): Promise<void> {
    const nameDeptMap = new Map<string, { name: string; department: string | null }>();

    for (const p of participants) {
      const name = p.reviewerName?.trim();
      if (!name) continue;
      const dept = p.department?.trim() || null;
      const mapKey = `${name}__${dept ?? ''}`;
      if (!nameDeptMap.has(mapKey)) {
        nameDeptMap.set(mapKey, { name, department: dept });
      }
    }

    if (nameDeptMap.size === 0) return;

    const allNames = Array.from(new Set(Array.from(nameDeptMap.values()).map((r) => r.name)));
    const nameSql = allNames.length === 0
      ? sql`ARRAY[]::text[]`
      : sql`ARRAY[${sql.join(allNames.map((n: string) => sql`${n}`), sql`, `)}]::text[]`;
    const existingRows = await this.db
      .select({
        reviewerKey: reviewerAccount.reviewerKey,
        reviewerName: reviewerAccount.reviewerName,
        department: reviewerAccount.department,
      })
      .from(reviewerAccount)
      .where(sql`reviewer_name = ANY(${nameSql})`);

    const existingByName = new Map<string, Array<{ key: string; department: string | null }>>();
    for (const row of existingRows) {
      const arr = existingByName.get(row.reviewerName) ?? [];
      arr.push({ key: row.reviewerKey, department: row.department ?? null });
      existingByName.set(row.reviewerName, arr);
    }

    const toInsert: Array<{ key: string; name: string; department: string | null }> = [];
    const assignedKeys = new Set<string>();
    for (const row of existingRows) assignedKeys.add(row.reviewerKey);

    for (const { name, department } of nameDeptMap.values()) {
      const existing = existingByName.get(name) ?? [];

      const sameDeptMatch = existing.find((e) => e.department === department);
      if (sameDeptMatch) continue;

      let candidateKey: string;

      if (existing.length === 0) {
        candidateKey = name;
      } else if (department) {
        const deptKey = `${name}_${department}`;
        const deptExists = existing.some((e) => e.key === deptKey) || assignedKeys.has(deptKey);
        if (!deptExists) {
          candidateKey = deptKey;
        } else {
          let n = 2;
          while (true) {
            const seqKey = `${name}${n}`;
            if (!existing.some((e) => e.key === seqKey) && !assignedKeys.has(seqKey)) {
              candidateKey = seqKey;
              break;
            }
            n += 1;
          }
        }
      } else {
        let n = 2;
        while (true) {
          const seqKey = `${name}${n}`;
          if (!existing.some((e) => e.key === seqKey) && !assignedKeys.has(seqKey)) {
            candidateKey = seqKey;
            break;
          }
          n += 1;
        }
      }

      toInsert.push({ key: candidateKey, name, department });
      assignedKeys.add(candidateKey);
      const arr = existingByName.get(name) ?? [];
      arr.push({ key: candidateKey, department });
      existingByName.set(name, arr);
    }

    if (toInsert.length === 0) return;

    for (const account of toInsert) {
      await this.db.execute(sql`
        INSERT INTO reviewer_account (reviewer_key, reviewer_name, password_hash, role, department, status)
        VALUES (${account.key}, ${account.name}, crypt(${getInitialPassword(account.name)}, gen_salt('bf')), 'reviewer', ${account.department ?? null}, 'active')
        ON CONFLICT (reviewer_key) DO NOTHING
      `);
    }
  }

  // ---------- Reviewer Account Management ----------

  async listReviewerAccounts(
    user: JwtPayload,
    page = 1,
    pageSize = 50,
  ): Promise<{ items: ReviewerAccountItem[]; total: number }> {
    this.ensureAdmin(user);

    const offset = (page - 1) * pageSize;
    const [rows, countResult] = await Promise.all([
      this.db
        .select()
        .from(reviewerAccount)
        .orderBy(desc(reviewerAccount.createdAt))
        .limit(pageSize)
        .offset(offset),
      this.db
        .select({ count: count() })
        .from(reviewerAccount),
    ]);

    const total = Number(countResult[0]?.count ?? 0);
    const items: ReviewerAccountItem[] = rows.map((row) => ({
      reviewerKey: row.reviewerKey,
      reviewerName: row.reviewerName,
      role: row.role,
      department: row.department ?? null,
      status: (row.status as ReviewerAccountStatus) ?? 'active',
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));

    return { items, total };
  }

  async resetReviewerPassword(
    user: JwtPayload,
    reviewerKey: string,
  ): Promise<{ success: boolean; newPassword: string }> {
    this.ensureAdmin(user);

    const existing = await this.db
      .select()
      .from(reviewerAccount)
      .where(eq(reviewerAccount.reviewerKey, reviewerKey));
    if (existing.length === 0) {
      throw new NotFoundException('账号不存在');
    }

    // 生成8位随机字母数字密码
    const newPassword = this.generateRandomPassword(8);
    await this.db.execute(sql`
      UPDATE reviewer_account
      SET password_hash = crypt(${newPassword}, gen_salt('bf')),
          _updated_at = CURRENT_TIMESTAMP
      WHERE reviewer_key = ${reviewerKey}
    `);

    return { success: true, newPassword };
  }

  async disableReviewerAccount(
    user: JwtPayload,
    reviewerKey: string,
  ): Promise<{ success: boolean }> {
    this.ensureAdmin(user);

    const updated = await this.db
      .update(reviewerAccount)
      .set({ status: 'disabled', updatedAt: new Date() })
      .where(eq(reviewerAccount.reviewerKey, reviewerKey))
      .returning({ reviewerKey: reviewerAccount.reviewerKey });
    if (updated.length === 0) {
      throw new NotFoundException('账号不存在');
    }
    return { success: true };
  }

  async enableReviewerAccount(
    user: JwtPayload,
    reviewerKey: string,
  ): Promise<{ success: boolean }> {
    this.ensureAdmin(user);

    const updated = await this.db
      .update(reviewerAccount)
      .set({ status: 'active', updatedAt: new Date() })
      .where(eq(reviewerAccount.reviewerKey, reviewerKey))
      .returning({ reviewerKey: reviewerAccount.reviewerKey });
    if (updated.length === 0) {
      throw new NotFoundException('账号不存在');
    }
    return { success: true };
  }

  private async generateReviewerKey(name: string, department: string | null): Promise<string> {
    const existing = await this.db
      .select({
        reviewerKey: reviewerAccount.reviewerKey,
        department: reviewerAccount.department,
      })
      .from(reviewerAccount)
      .where(eq(reviewerAccount.reviewerName, name));

    if (existing.length === 0) return name;

    const sameDept = existing.find((e) => (e.department ?? null) === department);
    if (sameDept) {
      throw new BadRequestException('该部门下已存在同名评价人账号');
    }

    if (department) {
      const deptKey = `${name}_${department}`;
      if (!existing.some((e) => e.reviewerKey === deptKey)) return deptKey;
    }

    let n = 2;
    while (true) {
      const seqKey = `${name}${n}`;
      if (!existing.some((e) => e.reviewerKey === seqKey)) return seqKey;
      n += 1;
    }
  }

  async createReviewerAccount(
    user: JwtPayload,
    dto: CreateReviewerAccountRequest,
  ): Promise<{ success: boolean; initialPassword: string; reviewerKey: string }> {
    this.ensureAdmin(user);

    const name = dto.reviewerName?.trim();
    if (!name) {
      throw new BadRequestException('姓名不能为空');
    }

    const department = dto.department?.trim() || null;
    let reviewerKey = dto.reviewerKey?.trim();

    if (!reviewerKey) {
      reviewerKey = await this.generateReviewerKey(name, department);
    } else {
      const existing = await this.db
        .select({ reviewerKey: reviewerAccount.reviewerKey })
        .from(reviewerAccount)
        .where(eq(reviewerAccount.reviewerKey, reviewerKey));
      if (existing.length > 0) {
        throw new BadRequestException('该账号 key 已存在');
      }
    }

    const initialPassword = dto.password?.trim() || getInitialPassword(name);
    const role = dto.role?.trim() || 'reviewer';

    await this.db.execute(sql`
      INSERT INTO reviewer_account (reviewer_key, reviewer_name, password_hash, role, department, status)
      VALUES (${reviewerKey}, ${name}, crypt(${initialPassword}, gen_salt('bf')), ${role}, ${department ?? null}, 'active')
    `);

    return { success: true, initialPassword, reviewerKey };
  }

  private generateRandomPassword(length: number): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}
