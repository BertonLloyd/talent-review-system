import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  lte,
  sql,
} from 'drizzle-orm';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import {
  reviewRecord,
  reviewScoreItem,
  reviewParticipant,
  reviewerAccount,
  ruleSet,
  reviewBatch,
} from '@server/database/schema';
import { computeReviewByConfig } from '../shared-review-calc/review-calc';
import { AuthService, type JwtPayload } from '../auth/auth.service';
import { EVIDENCE_LEVELS } from '@shared/api.interface';
import type {
  GridCategory,
  ReviewScoreItem as ReviewScoreItemType,
  RuleSetConfig,
  ScoreItemInput,
  UnifiedReviewRecordV2,
  UnifiedReviewListResponseV2,
  UnifiedReviewSummaryItem,
  UnifiedReviewSummaryResponse,
} from '@shared/api.interface';

type ReviewRecordRow = typeof reviewRecord.$inferSelect;
type ReviewScoreItemRow = typeof reviewScoreItem.$inferSelect;
type ParticipantRow = typeof reviewParticipant.$inferSelect;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function rowToRecord(row: ReviewRecordRow): UnifiedReviewRecordV2 {
  return {
    id: row.id,
    reviewerKey: row.reviewerKey,
    reviewerName: row.reviewerName,
    revieweeName: row.revieweeName,
    employeeNo: row.employeeNo ?? null,
    department: row.department ?? null,
    positionType: row.positionType ?? null,
    ruleSetId: row.ruleSetId ?? null,
    batchId: row.batchId ?? null,
    dimensionAvgs: (row.dimensionAvgs ?? {}) as Record<string, number>,
    compositeScores: (row.compositeScores ?? {}) as Record<string, number>,
    performanceScore: Number(row.performanceScore),
    totalScore: Number(row.totalScore),
    gridCategory: row.gridCategory as GridCategory,
    isRedLine: row.isRedLine,
    redLineDimensions: row.redLineDimensions ?? [],
    isDeleted: row.isDeleted,
    isTest: row.isTest,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function rowToScoreItem(row: ReviewScoreItemRow): ReviewScoreItemType {
  return {
    dimensionCode: row.dimensionCode,
    itemCode: row.itemCode,
    itemName: row.itemName,
    score: row.score,
    evidenceText: row.evidenceText ?? '',
    evidenceLevel: row.evidenceLevel ?? undefined,
    sortOrder: row.sortOrder,
  };
}

function rowToSummaryItem(row: ReviewRecordRow): UnifiedReviewSummaryItem {
  return {
    id: row.id,
    revieweeName: row.revieweeName,
    employeeNo: row.employeeNo ?? null,
    department: row.department ?? null,
    positionType: row.positionType ?? null,
    reviewerName: row.reviewerName,
    reviewerKey: row.reviewerKey,
    totalScore: Number(row.totalScore),
    performanceScore: Number(row.performanceScore),
    gridCategory: row.gridCategory as GridCategory,
    isRedLine: row.isRedLine,
    reviewDate: formatDate(row.createdAt),
  };
}

@Injectable()
export class ReviewService {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly authService: AuthService,
  ) {}

  private static readonly ADMIN_REVIEWER_KEY = 'admin';
  private static readonly ADMIN_PASSWORD =
    process.env.ADMIN_INITIAL_PASSWORD || 'admin123456';

  // ==================== 被盘人列表（按 reviewer_key） ====================

  async getRevieweesByReviewer(
    reviewerKey: string,
    includeTest = false,
  ): Promise<{
    reviewerName: string;
    reviewees: Array<{
      name: string;
      department: string | null;
      positionType: string | null;
      employeeNo: string | null;
      hasSubmitted: boolean;
    }>;
  }> {
    // 从 reviewer_account 取评价人姓名
    const accountRows = await this.db
      .select({ reviewerName: reviewerAccount.reviewerName })
      .from(reviewerAccount)
      .where(eq(reviewerAccount.reviewerKey, reviewerKey))
      .limit(1);
    const reviewerName = accountRows[0]?.reviewerName ?? reviewerKey;

    // 从 review_participant 取该评价人的被盘人（取最新激活批次）
    const batches = await this.db
      .select({ id: reviewBatch.id })
      .from(reviewBatch)
      .where(eq(reviewBatch.status, 'active'))
      .orderBy(desc(reviewBatch.createdAt))
      .limit(1);

    let participants: ParticipantRow[] = [];
    if (batches.length > 0) {
      participants = await this.db
        .select()
        .from(reviewParticipant)
        .where(and(
          eq(reviewParticipant.batchId, batches[0].id),
          eq(reviewParticipant.reviewerKey, reviewerKey),
        ))
        .orderBy(reviewParticipant.sortOrder, reviewParticipant.revieweeName);
    }

    // 查询该评价人已提交的评分（按被盘人名去重）
    const submittedRows = await this.db
      .select({ revieweeName: reviewRecord.revieweeName })
      .from(reviewRecord)
      .where(and(
        eq(reviewRecord.reviewerKey, reviewerKey),
        eq(reviewRecord.isDeleted, false),
        ...(includeTest ? [] : [eq(reviewRecord.isTest, false)]),
      ));
    const submittedSet = new Set(submittedRows.map((r) => r.revieweeName));

    const reviewees = participants.map((p) => ({
      name: p.revieweeName,
      department: p.department ?? null,
      positionType: p.positionType ?? null,
      employeeNo: p.employeeNo ?? null,
      hasSubmitted: submittedSet.has(p.revieweeName),
    }));

    return { reviewerName, reviewees };
  }

  // ==================== 规则集加载 ====================

  private async loadRuleSetConfig(ruleSetId?: string): Promise<RuleSetConfig | null> {
    let rsId = ruleSetId;

    // 没指定时取首个 active 且 isDefault 的规则集
    if (!rsId) {
      const defaultRows = await this.db
        .select({ id: ruleSet.id })
        .from(ruleSet)
        .where(and(
          eq(ruleSet.status, 'active'),
          eq(ruleSet.isDefault, true),
        ))
        .limit(1);
      if (defaultRows.length === 0) return null;
      rsId = defaultRows[0].id;
    }

    const rows = await this.db
      .select({ config: ruleSet.config })
      .from(ruleSet)
      .where(eq(ruleSet.id, rsId));
    if (rows.length === 0) return null;

    return (rows[0].config ?? {}) as unknown as RuleSetConfig;
  }

  private async resolveRuleSetId(ruleSetId?: string): Promise<string | null> {
    if (ruleSetId) {
      const rows = await this.db
        .select({ id: ruleSet.id })
        .from(ruleSet)
        .where(eq(ruleSet.id, ruleSetId));
      return rows.length > 0 ? rows[0].id : null;
    }
    const defaultRows = await this.db
      .select({ id: ruleSet.id })
      .from(ruleSet)
      .where(and(
        eq(ruleSet.status, 'active'),
        eq(ruleSet.isDefault, true),
      ))
      .limit(1);
    return defaultRows.length > 0 ? defaultRows[0].id : null;
  }

  // ==================== 计算引擎封装 ====================

  private computeScores(
    config: RuleSetConfig,
    items: Array<{
      dimensionCode: string;
      itemCode: string;
      score: number;
      weight?: number;
    }>,
    positionType?: string,
    performanceItems?: Record<string, { score: number; evidence?: string }>,
  ): {
    dimensionAvgs: Record<string, number>;
    compositeScores: Record<string, number>;
    performanceScore: number;
    totalScore: number;
    gridCategory: GridCategory;
    isRedLine: boolean;
    redLineDimensions: string[];
  } {
    // 1. 构建 ScoreItemInput
    const scoreInputs: ScoreItemInput[] = items.map((it) => ({
      dimensionCode: it.dimensionCode,
      itemCode: it.itemCode,
      score: it.score,
      weight: it.weight,
    }));

    // 2. 如果有岗位绩效项，计算 performanceScore 并加入维度
    let performanceScore = 0;
    const extraItems: ScoreItemInput[] = [];

    if (
      positionType &&
      performanceItems &&
      Object.keys(performanceItems).length > 0 &&
      config.positionTypes
    ) {
      const ptConfig = config.positionTypes.find((pt) => pt.code === positionType);
      if (ptConfig && ptConfig.performanceItems.length > 0) {
        let perfWeightedSum = 0;
        let perfTotalWeight = 0;
        for (const pi of ptConfig.performanceItems) {
          const userScore = performanceItems[pi.code]?.score ?? 0;
          const w = pi.weight ?? 1;
          perfWeightedSum += userScore * w;
          perfTotalWeight += w;
          extraItems.push({
            dimensionCode: 'performance',
            itemCode: pi.code,
            score: userScore,
            weight: w,
          });
        }
        performanceScore = perfTotalWeight > 0
          ? round2(perfWeightedSum / perfTotalWeight)
          : 0;
      }
    }

    const allInputs = [...scoreInputs, ...extraItems];

    // 3. 调算分引擎
    const calcResult = computeReviewByConfig(config, allInputs);

    // 4. 提取合成维度（compositeDimensions 对应的 key）
    const compositeScores: Record<string, number> = {};
    if (config.compositeDimensions) {
      for (const cd of config.compositeDimensions) {
        if (calcResult.dimensionAverages[cd.code] !== undefined) {
          compositeScores[cd.code] = calcResult.dimensionAverages[cd.code];
        }
      }
    }

    // 5. 红线维度明细
    const redLineDimensions: string[] = [];
    if (calcResult.isRedLine) {
      for (const dim of config.dimensions) {
        if (!dim.isRedLine) continue;
        const dimItems = allInputs.filter(
          (it) => it.dimensionCode === dim.code,
        );
        if (dimItems.some((it) => it.score <= 1)) {
          redLineDimensions.push(dim.code);
        }
      }
    }

    return {
      dimensionAvgs: calcResult.dimensionAverages,
      compositeScores,
      performanceScore,
      totalScore: calcResult.totalScore,
      gridCategory: calcResult.gridCategory,
      isRedLine: calcResult.isRedLine,
      redLineDimensions,
    };
  }

  // ==================== Evidence Level Validation ====================

  /**
   * 校验 evidenceLevel 与分值是否匹配
   * 5分 → solid；3-4分 → basic；1-2分 → insufficient
   * @returns 错误描述或 null（校验通过）
   */
  private validateEvidenceLevel(
    score: number,
    level: string | undefined | null,
    itemName: string,
    evidenceRequired: boolean,
  ): string | null {
    // evidenceRequired=true 时 evidenceLevel 不能为空
    if (evidenceRequired && (!level || level.trim() === '')) {
      return `${itemName}：证据档位不能为空`;
    }
    // evidenceRequired=false 且为空时不校验
    if (!level || level.trim() === '') {
      return null;
    }
    // 根据分值判断匹配的档位
    const matchedLevels = EVIDENCE_LEVELS.filter(
      (lv) => score >= lv.scoreRange[0] && score <= lv.scoreRange[1],
    );
    if (matchedLevels.length === 0) {
      return null; // 分值不在任何档位范围，不校验（分值本身错误由其他校验负责）
    }
    const isValid = matchedLevels.some((lv) => lv.code === level);
    if (!isValid) {
      const expectedLabels = matchedLevels.map((lv) => lv.label).join('/');
      return `${itemName}：${score}分对应「${expectedLabels}」档位，当前选择「${level}」不匹配`;
    }
    return null;
  }

  // ==================== Create ====================

  async createReview(dto: {
    reviewerKey: string;
    reviewerName?: string;
    revieweeName: string;
    employeeNo?: string;
    department?: string;
    positionType?: string;
    ruleSetId?: string;
    batchId?: string;
    items: Array<{
      dimensionCode: string;
      itemCode: string;
      itemName: string;
      score: number;
      maxScore?: number;
      evidenceText?: string;
      evidenceLevel?: string;
      sortOrder?: number;
    }>;
    performanceItems?: Record<string, { score: number; evidence?: string; evidenceLevel?: string }>;
    isTest?: boolean;
  }): Promise<UnifiedReviewRecordV2> {
    if (!dto.reviewerKey) {
      throw new BadRequestException('reviewerKey 不能为空');
    }
    if (!dto.revieweeName) {
      throw new BadRequestException('被盘人姓名不能为空');
    }
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('评分项不能为空');
    }

    // 解析 reviewerName
    let reviewerName = dto.reviewerName;
    if (!reviewerName) {
      const accountRows = await this.db
        .select({ reviewerName: reviewerAccount.reviewerName })
        .from(reviewerAccount)
        .where(eq(reviewerAccount.reviewerKey, dto.reviewerKey))
        .limit(1);
      reviewerName = accountRows[0]?.reviewerName ?? dto.reviewerKey;
    }

    // 加载规则集
    const resolvedRuleSetId = await this.resolveRuleSetId(dto.ruleSetId);
    const config = resolvedRuleSetId
      ? await this.loadRuleSetConfig(resolvedRuleSetId)
      : null;

    if (!config) {
      throw new BadRequestException('未找到可用的规则集配置');
    }

    // evidenceRequired 校验：配置为必填依据的子项，evidenceText 不能为空
    const evidenceErrors: string[] = [];
    for (const dim of config.dimensions) {
      for (const item of dim.items) {
        if (item.evidenceRequired) {
          const input = dto.items.find(
            (it) => it.dimensionCode === dim.code && it.itemCode === item.code,
          );
          if (!input || !input.evidenceText || input.evidenceText.trim().length === 0) {
            evidenceErrors.push(`${item.name}：依据不能为空`);
          }
        }
      }
    }
    if (
      dto.positionType &&
      dto.performanceItems &&
      config.positionTypes
    ) {
      const ptConfig = config.positionTypes.find((pt) => pt.code === dto.positionType);
      if (ptConfig) {
        for (const pi of ptConfig.performanceItems) {
          if (pi.evidenceRequired) {
            const perf = dto.performanceItems[pi.code];
            if (!perf || !perf.evidence || perf.evidence.trim().length === 0) {
              evidenceErrors.push(`${pi.name}：依据不能为空`);
            }
          }
        }
      }
    }
    if (evidenceErrors.length > 0) {
      throw new BadRequestException(
        '以下子项必须填写事实依据：\n' + evidenceErrors.join('\n'),
      );
    }

    // evidenceLevel 与分值匹配校验
    const levelErrors: string[] = [];
    for (const dim of config.dimensions) {
      for (const item of dim.items) {
        const input = dto.items.find(
          (it) => it.dimensionCode === dim.code && it.itemCode === item.code,
        );
        if (!input) continue;
        const err = this.validateEvidenceLevel(
          input.score,
          input.evidenceLevel,
          item.name,
          !!item.evidenceRequired,
        );
        if (err) levelErrors.push(err);
      }
    }
    if (
      dto.positionType &&
      dto.performanceItems &&
      config.positionTypes
    ) {
      const ptConfig = config.positionTypes.find((pt) => pt.code === dto.positionType);
      if (ptConfig) {
        for (const pi of ptConfig.performanceItems) {
          const perf = dto.performanceItems[pi.code];
          if (!perf) continue;
          const err = this.validateEvidenceLevel(
            perf.score,
            perf.evidenceLevel,
            pi.name,
            !!pi.evidenceRequired,
          );
          if (err) levelErrors.push(err);
        }
      }
    }
    if (levelErrors.length > 0) {
      throw new BadRequestException(
        '证据档位与分值不匹配：\n' + levelErrors.join('\n'),
      );
    }

    // 算分
    const computed = this.computeScores(
      config,
      dto.items,
      dto.positionType,
      dto.performanceItems,
    );

    return await this.db.transaction(async (tx) => {
      // 插入主表
      const inserted: ReviewRecordRow[] = await tx
        .insert(reviewRecord)
        .values({
          reviewerKey: dto.reviewerKey,
          reviewerName: reviewerName!,
          revieweeName: dto.revieweeName,
          employeeNo: dto.employeeNo ?? null,
          department: dto.department ?? null,
          positionType: dto.positionType ?? null,
          ruleSetId: resolvedRuleSetId ?? null,
          batchId: dto.batchId ?? null,
          dimensionAvgs: computed.dimensionAvgs as unknown as Record<string, unknown>,
          compositeScores: computed.compositeScores as unknown as Record<string, unknown>,
          performanceScore: String(computed.performanceScore),
          totalScore: String(computed.totalScore),
          gridCategory: computed.gridCategory,
          isRedLine: computed.isRedLine,
          redLineDimensions: computed.redLineDimensions,
          isDeleted: false,
          isTest: dto.isTest ?? false,
        })
        .returning();

      const recordId = inserted[0].id;

      // 插入明细（维度子项 + 绩效子项）
      const allScoreItems: Array<typeof reviewScoreItem.$inferInsert> = [];
      let sortIdx = 0;
      for (const it of dto.items) {
        allScoreItems.push({
          reviewId: recordId,
          dimensionCode: it.dimensionCode,
          itemCode: it.itemCode,
          itemName: it.itemName,
          score: it.score,
          maxScore: it.maxScore ?? 5,
          evidenceLevel: it.evidenceLevel ?? null,
          evidenceText: it.evidenceText ?? '',
          sortOrder: sortIdx++,
        });
      }
      // 绩效项写入 review_score_item
      if (
        dto.positionType &&
        dto.performanceItems &&
        Object.keys(dto.performanceItems).length > 0 &&
        config.positionTypes
      ) {
        const ptConfig = config.positionTypes.find((pt) => pt.code === dto.positionType);
        if (ptConfig) {
          for (const pi of ptConfig.performanceItems) {
            const perf = dto.performanceItems[pi.code];
            if (perf) {
              allScoreItems.push({
                reviewId: recordId,
                dimensionCode: 'performance',
                itemCode: pi.code,
                itemName: pi.name,
                score: perf.score,
                maxScore: pi.maxScore ?? 5,
                evidenceLevel: perf.evidenceLevel ?? null,
                evidenceText: perf.evidence ?? '',
                sortOrder: sortIdx++,
              });
            }
          }
        }
      }
      if (allScoreItems.length > 0) {
        await tx.insert(reviewScoreItem).values(allScoreItems);
      }

      const result = rowToRecord(inserted[0]);
      result.items = allScoreItems.map((it) => ({
        dimensionCode: it.dimensionCode,
        itemCode: it.itemCode,
        itemName: it.itemName,
        score: it.score,
        evidenceText: it.evidenceText ?? '',
        sortOrder: it.sortOrder ?? 0,
      }));

      return result;
    });
  }

  // ==================== Update ====================

  async updateReview(
    id: string,
    reviewerKey: string,
    dto: {
      reviewerName?: string;
      revieweeName?: string;
      employeeNo?: string;
      department?: string;
      positionType?: string;
      items?: Array<{
        dimensionCode: string;
        itemCode: string;
        itemName: string;
        score: number;
        maxScore?: number;
        evidenceText?: string;
        evidenceLevel?: string;
        sortOrder?: number;
      }>;
      performanceItems?: Record<string, { score: number; evidence?: string; evidenceLevel?: string }>;
      isTest?: boolean;
    },
  ): Promise<UnifiedReviewRecordV2> {
    const existing = await this.db
      .select()
      .from(reviewRecord)
      .where(eq(reviewRecord.id, id));
    if (existing.length === 0) {
      throw new NotFoundException('评分记录不存在');
    }
    if (existing[0].reviewerKey !== reviewerKey) {
      throw new ForbiddenException('无权修改他人的评分记录');
    }

    const current = existing[0];

    // 加载规则集
    const config = current.ruleSetId
      ? await this.loadRuleSetConfig(current.ruleSetId)
      : await this.loadRuleSetConfig();

    if (!config) {
      throw new BadRequestException('未找到可用的规则集配置');
    }

    // 取当前明细（用于合并未更新的项）
    const currentItems = await this.db
      .select()
      .from(reviewScoreItem)
      .where(and(
        eq(reviewScoreItem.reviewId, id),
      ))
      .orderBy(reviewScoreItem.sortOrder);

    const useItems = dto.items ?? currentItems.map((row) => ({
      dimensionCode: row.dimensionCode,
      itemCode: row.itemCode,
      itemName: row.itemName,
      score: row.score,
      maxScore: row.maxScore,
      evidenceText: row.evidenceText ?? undefined,
      evidenceLevel: row.evidenceLevel ?? undefined,
      sortOrder: row.sortOrder,
    }));

    // evidenceRequired 校验：配置为必填依据的子项，evidenceText 不能为空
    const updateEvidenceErrors: string[] = [];
    for (const dim of config.dimensions) {
      for (const item of dim.items) {
        if (item.evidenceRequired) {
          const input = useItems.find(
            (it) => it.dimensionCode === dim.code && it.itemCode === item.code,
          );
          if (!input || !input.evidenceText || input.evidenceText.trim().length === 0) {
            updateEvidenceErrors.push(`${item.name}：依据不能为空`);
          }
        }
      }
    }
    const usePositionTypeForEv = dto.positionType ?? current.positionType ?? undefined;
    if (
      usePositionTypeForEv &&
      dto.performanceItems &&
      config.positionTypes
    ) {
      const ptConfig = config.positionTypes.find((pt) => pt.code === usePositionTypeForEv);
      if (ptConfig) {
        for (const pi of ptConfig.performanceItems) {
          if (pi.evidenceRequired) {
            const perf = dto.performanceItems[pi.code];
            if (!perf || !perf.evidence || perf.evidence.trim().length === 0) {
              updateEvidenceErrors.push(`${pi.name}：依据不能为空`);
            }
          }
        }
      }
    }
    if (updateEvidenceErrors.length > 0) {
      throw new BadRequestException(
        '以下子项必须填写事实依据：\n' + updateEvidenceErrors.join('\n'),
      );
    }

    // evidenceLevel 与分值匹配校验
    const updateLevelErrors: string[] = [];
    for (const dim of config.dimensions) {
      for (const item of dim.items) {
        const input = useItems.find(
          (it) => it.dimensionCode === dim.code && it.itemCode === item.code,
        );
        if (!input) continue;
        const err = this.validateEvidenceLevel(
          input.score,
          input.evidenceLevel,
          item.name,
          !!item.evidenceRequired,
        );
        if (err) updateLevelErrors.push(err);
      }
    }
    if (
      usePositionTypeForEv &&
      dto.performanceItems &&
      config.positionTypes
    ) {
      const ptConfig = config.positionTypes.find((pt) => pt.code === usePositionTypeForEv);
      if (ptConfig) {
        for (const pi of ptConfig.performanceItems) {
          const perf = dto.performanceItems[pi.code];
          if (!perf) continue;
          const err = this.validateEvidenceLevel(
            perf.score,
            perf.evidenceLevel,
            pi.name,
            !!pi.evidenceRequired,
          );
          if (err) updateLevelErrors.push(err);
        }
      }
    }
    if (updateLevelErrors.length > 0) {
      throw new BadRequestException(
        '证据档位与分值不匹配：\n' + updateLevelErrors.join('\n'),
      );
    }

    // 算分
    const computed = this.computeScores(
      config,
      useItems,
      dto.positionType ?? current.positionType ?? undefined,
      dto.performanceItems,
    );

    return await this.db.transaction(async (tx) => {
      const patch: Partial<typeof reviewRecord.$inferInsert> = {};
      if (dto.reviewerName !== undefined) patch.reviewerName = dto.reviewerName;
      if (dto.revieweeName !== undefined) patch.revieweeName = dto.revieweeName;
      if (dto.employeeNo !== undefined) patch.employeeNo = dto.employeeNo ?? null;
      if (dto.department !== undefined) patch.department = dto.department ?? null;
      if (dto.positionType !== undefined) patch.positionType = dto.positionType ?? null;
      if (dto.isTest !== undefined) patch.isTest = dto.isTest;

      patch.dimensionAvgs = computed.dimensionAvgs as unknown as Record<string, unknown>;
      patch.compositeScores = computed.compositeScores as unknown as Record<string, unknown>;
      patch.performanceScore = String(computed.performanceScore);
      patch.totalScore = String(computed.totalScore);
      patch.gridCategory = computed.gridCategory;
      patch.isRedLine = computed.isRedLine;
      patch.redLineDimensions = computed.redLineDimensions;
      patch.updatedAt = new Date();

      const updated: ReviewRecordRow[] = await tx
        .update(reviewRecord)
        .set(patch)
        .where(eq(reviewRecord.id, id))
        .returning();

      // 如果传入了 items，全量替换明细（维度子项 + 绩效子项）
      if (dto.items && dto.items.length > 0) {
        await tx
          .delete(reviewScoreItem)
          .where(eq(reviewScoreItem.reviewId, id));

        const allItems: Array<typeof reviewScoreItem.$inferInsert> = [];
        let sortIdx = 0;
        for (const it of dto.items) {
          allItems.push({
            reviewId: id,
            dimensionCode: it.dimensionCode,
            itemCode: it.itemCode,
            itemName: it.itemName,
            score: it.score,
            maxScore: it.maxScore ?? 5,
            evidenceLevel: it.evidenceLevel ?? null,
            evidenceText: it.evidenceText ?? '',
            sortOrder: sortIdx++,
          });
        }
        const usePositionType = dto.positionType ?? current.positionType ?? undefined;
        if (
          usePositionType &&
          dto.performanceItems &&
          Object.keys(dto.performanceItems).length > 0 &&
          config.positionTypes
        ) {
          const ptConfig = config.positionTypes.find((pt) => pt.code === usePositionType);
          if (ptConfig) {
            for (const pi of ptConfig.performanceItems) {
              const perf = dto.performanceItems[pi.code];
              if (perf) {
                allItems.push({
                  reviewId: id,
                  dimensionCode: 'performance',
                  itemCode: pi.code,
                  itemName: pi.name,
                  score: perf.score,
                  maxScore: pi.maxScore ?? 5,
                  evidenceLevel: perf.evidenceLevel ?? null,
                  evidenceText: perf.evidence ?? '',
                  sortOrder: sortIdx++,
                });
              }
            }
          }
        }
        if (allItems.length > 0) {
          await tx.insert(reviewScoreItem).values(allItems);
        }
      }

      const result = rowToRecord(updated[0]);
      // 返回明细
      let finalItems: ReviewScoreItemType[];
      if (dto.items && dto.items.length > 0) {
        const merged: Array<{ dimensionCode: string; itemCode: string; itemName: string; score: number; evidenceText: string; sortOrder: number }> = [];
        let sIdx = 0;
        for (const it of dto.items) {
          merged.push({
            dimensionCode: it.dimensionCode,
            itemCode: it.itemCode,
            itemName: it.itemName,
            score: it.score,
            evidenceText: it.evidenceText ?? '',
            sortOrder: sIdx++,
          });
        }
        const usePositionType = dto.positionType ?? current.positionType ?? undefined;
        if (usePositionType && dto.performanceItems && config.positionTypes) {
          const ptConfig = config.positionTypes.find((pt) => pt.code === usePositionType);
          if (ptConfig) {
            for (const pi of ptConfig.performanceItems) {
              const perf = dto.performanceItems[pi.code];
              if (perf) {
                merged.push({
                  dimensionCode: 'performance',
                  itemCode: pi.code,
                  itemName: pi.name,
                  score: perf.score,
                  evidenceText: perf.evidence ?? '',
                  sortOrder: sIdx++,
                });
              }
            }
          }
        }
        finalItems = merged;
      } else {
        finalItems = currentItems.map(rowToScoreItem);
      }
      result.items = finalItems;

      return result;
    });
  }

  // ==================== Delete (soft) ====================

  async deleteReview(id: string, reviewerKey: string): Promise<void> {
    const existing = await this.db
      .select()
      .from(reviewRecord)
      .where(eq(reviewRecord.id, id));
    if (existing.length === 0) {
      throw new NotFoundException('评分记录不存在');
    }
    if (existing[0].reviewerKey !== reviewerKey) {
      throw new ForbiddenException('无权删除他人的评分记录');
    }

    await this.db.transaction(async (tx) => {
      await tx
        .update(reviewRecord)
        .set({ isDeleted: true, updatedAt: new Date() })
        .where(eq(reviewRecord.id, id));
      await tx.delete(reviewScoreItem).where(eq(reviewScoreItem.reviewId, id));
    });
  }

  // ==================== List (by reviewer) ====================

  async getMyReviews(
    reviewerKey: string,
    includeTest = true,
  ): Promise<UnifiedReviewRecordV2[]> {
    const rows: ReviewRecordRow[] = await this.db
      .select()
      .from(reviewRecord)
      .where(and(
        eq(reviewRecord.reviewerKey, reviewerKey),
        eq(reviewRecord.isDeleted, false),
        ...(includeTest ? [] : [eq(reviewRecord.isTest, false)]),
      ))
      .orderBy(desc(reviewRecord.createdAt));

    // 每个被盘人取最新一条
    const latestByReviewee = new Map<string, ReviewRecordRow>();
    for (const row of rows) {
      if (!latestByReviewee.has(row.revieweeName)) {
        latestByReviewee.set(row.revieweeName, row);
      }
    }
    return Array.from(latestByReviewee.values())
      .map(rowToRecord)
      .sort((a, b) => a.revieweeName.localeCompare(b.revieweeName));
  }

  // ==================== Detail ====================

  async getReviewById(id: string, reviewerKey?: string): Promise<UnifiedReviewRecordV2> {
    const rows: ReviewRecordRow[] = await this.db
      .select()
      .from(reviewRecord)
      .where(eq(reviewRecord.id, id));
    if (rows.length === 0 || rows[0].isDeleted) {
      throw new NotFoundException('评分记录不存在');
    }
    const record = rows[0];

    if (reviewerKey && record.reviewerKey !== reviewerKey) {
      // 管理员可以看所有？这里只做简单校验，管理员判断由上层处理
      throw new ForbiddenException('无权查看他人的评分记录');
    }

    const items = await this.db
      .select()
      .from(reviewScoreItem)
      .where(eq(reviewScoreItem.reviewId, id))
      .orderBy(reviewScoreItem.sortOrder);

    const result = rowToRecord(record);
    result.items = items.map(rowToScoreItem);
    return result;
  }

  // ==================== Admin: List with filters ====================

  async listReviews(query: {
    reviewerKey?: string;
    revieweeName?: string;
    department?: string;
    positionType?: string;
    gridCategory?: string;
    isRedLine?: boolean;
    ruleSetId?: string;
    batchId?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    pageSize?: number;
    includeTest?: boolean;
  }): Promise<UnifiedReviewListResponseV2> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const whereConditions = this.buildWhereConditions(query);

    const [rows, countRows] = await Promise.all([
      this.db
        .select()
        .from(reviewRecord)
        .where(and(...whereConditions))
        .orderBy(desc(reviewRecord.createdAt))
        .limit(pageSize)
        .offset(offset),
      this.db
        .select({ count: sql`COUNT(*)`.as('count') })
        .from(reviewRecord)
        .where(and(...whereConditions)),
    ]);

    const total = Number(countRows[0]?.count ?? 0);

    return {
      items: rows.map(rowToRecord),
      total,
      page,
      pageSize,
    };
  }

  // ==================== OpenAPI: Summary (latest per person) ====================

  async getSummary(query: {
    reviewerKey?: string;
    department?: string;
    positionType?: string;
    gridCategory?: string;
    isRedLine?: boolean;
    dateFrom?: string;
    dateTo?: string;
    includeTest?: boolean;
  }): Promise<UnifiedReviewSummaryResponse> {
    const whereConditions = this.buildWhereConditions({
      department: query.department,
      positionType: query.positionType,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    });

    // 用子查询+ROW_NUMBER 取每人最新一条
    const deptLike = query.department ? `%${query.department}%` : '';
    const dateFromDate = query.dateFrom ? new Date(query.dateFrom) : null;
    const dateToDate = query.dateTo ? new Date(`${query.dateTo}T23:59:59.999Z`) : null;

    const rows = await this.db.execute(sql`
      SELECT r.*
      FROM (
        SELECT *,
          ROW_NUMBER() OVER (PARTITION BY reviewee_name ORDER BY _created_at DESC) as rn
        FROM review_record
        WHERE is_deleted = false
          ${query.includeTest ? sql`` : sql`AND is_test = false`}
          ${query.department ? sql`AND department ILIKE ${deptLike}` : sql``}
          ${query.positionType ? sql`AND position_type = ${query.positionType}` : sql``}
          ${query.reviewerKey ? sql`AND reviewer_key = ${query.reviewerKey}` : sql``}
          ${query.gridCategory ? sql`AND grid_category = ${query.gridCategory}` : sql``}
          ${query.isRedLine !== undefined ? sql`AND is_red_line = ${query.isRedLine}` : sql``}
          ${dateFromDate ? sql`AND _created_at >= ${dateFromDate}` : sql``}
          ${dateToDate ? sql`AND _created_at <= ${dateToDate}` : sql``}
      ) r
      WHERE r.rn = 1
      ORDER BY r._created_at DESC
    `) as unknown as { rows: ReviewRecordRow[] };

    const rawRows = Array.isArray(rows) ? rows : (rows as any).rows || [];
    const items = rawRows.map((r: any) => ({
      id: r.id,
      reviewerKey: r.reviewer_key,
      reviewerName: r.reviewer_name,
      revieweeName: r.reviewee_name,
      employeeNo: r.employee_no,
      department: r.department,
      positionType: r.position_type,
      totalScore: r.total_score,
      performanceScore: r.performance_score,
      gridCategory: r.grid_category,
      isRedLine: r.is_red_line,
      createdAt: r._created_at ? new Date(r._created_at) : null,
    })) as ReviewRecordRow[];

    return {
      items: items.map(rowToSummaryItem),
      total: items.length,
    };
  }

  // ==================== Helper: build where conditions ====================

  private buildWhereConditions(query: {
    reviewerKey?: string;
    revieweeName?: string;
    department?: string;
    positionType?: string;
    gridCategory?: string;
    isRedLine?: boolean;
    ruleSetId?: string;
    batchId?: string;
    dateFrom?: string;
    dateTo?: string;
    includeTest?: boolean;
  }) {
    const conditions = [];
    conditions.push(eq(reviewRecord.isDeleted, false));
    if (!query.includeTest) {
      conditions.push(eq(reviewRecord.isTest, false));
    }

    if (query.reviewerKey) {
      conditions.push(eq(reviewRecord.reviewerKey, query.reviewerKey));
    }
    if (query.revieweeName) {
      conditions.push(ilike(reviewRecord.revieweeName, `%${query.revieweeName}%`));
    }
    if (query.department) {
      conditions.push(ilike(reviewRecord.department, `%${query.department}%`));
    }
    if (query.positionType) {
      conditions.push(eq(reviewRecord.positionType, query.positionType));
    }
    if (query.gridCategory) {
      conditions.push(eq(reviewRecord.gridCategory, query.gridCategory));
    }
    if (query.isRedLine !== undefined) {
      conditions.push(eq(reviewRecord.isRedLine, query.isRedLine));
    }
    if (query.ruleSetId) {
      conditions.push(eq(reviewRecord.ruleSetId, query.ruleSetId));
    }
    if (query.batchId) {
      conditions.push(eq(reviewRecord.batchId, query.batchId));
    }
    if (query.dateFrom) {
      conditions.push(gte(reviewRecord.createdAt, new Date(query.dateFrom)));
    }
    if (query.dateTo) {
      // dateTo 是日期字符串，取当天结束
      conditions.push(lte(reviewRecord.createdAt, new Date(`${query.dateTo}T23:59:59.999Z`)));
    }

    return conditions;
  }

  // ==================== Validate API Key (for openapi) ====================

  async validateApiKey(key: string): Promise<boolean> {
    if (!key) return false;
    // 统一按 setting_key 查找，不再按 review_type 区分
    const rows = await this.db.execute(sql`
      SELECT setting_value
      FROM app_display_setting
      WHERE setting_key = ${'openapi_api_key'}
      LIMIT 1
    `) as unknown as { rows: Array<{ setting_value: string }> };
    const result = Array.isArray(rows) ? rows : (rows as any).rows || [];
    if (result.length === 0) return false;
    return result[0].setting_value === key;
  }

  // ==================== 登录 ====================

  async login(reviewerKey: string, password: string): Promise<{
    success: boolean;
    token: string;
    reviewerKey: string;
    reviewerName: string;
    role: string;
  }> {
    if (!reviewerKey || !password) {
      throw new BadRequestException('评价人姓名和密码均不能为空');
    }

    let reviewerKeyFinal: string;
    let reviewerNameFinal: string;
    let roleFinal: string;

    // 管理员登录（admin + 固定口令）
    if (reviewerKey === 'admin' && password === ReviewService.ADMIN_PASSWORD) {
      reviewerKeyFinal = ReviewService.ADMIN_REVIEWER_KEY;
      reviewerNameFinal = '管理员';
      roleFinal = 'admin';
    } else {
      const rows = await this.db
        .select()
        .from(reviewerAccount)
        .where(eq(reviewerAccount.reviewerKey, reviewerKey));
      if (rows.length === 0) {
        throw new UnauthorizedException('评价人不存在或密码错误');
      }
      const row = rows[0];
      // 检查账号状态
      if (row.status && row.status !== 'active') {
        throw new UnauthorizedException('账号已停用，请联系管理员');
      }
      const matchRows = await this.db
        .select({ reviewerKey: reviewerAccount.reviewerKey })
        .from(reviewerAccount)
        .where(and(
          eq(reviewerAccount.reviewerKey, reviewerKey),
          sql`crypt(${password}, ${row.passwordHash}) = ${row.passwordHash}`,
        ));
      if (matchRows.length === 0) {
        throw new UnauthorizedException('评价人不存在或密码错误');
      }
      reviewerKeyFinal = row.reviewerKey;
      reviewerNameFinal = row.reviewerName;
      roleFinal = row.role === 'admin' ? 'admin' : 'reviewer';
    }

    const token = this.authService.generateToken({
      reviewerKey: reviewerKeyFinal,
      reviewerName: reviewerNameFinal,
      role: roleFinal,
    });

    return {
      success: true,
      token,
      reviewerKey: reviewerKeyFinal,
      reviewerName: reviewerNameFinal,
      role: roleFinal,
    };
  }

  // ==================== 修改密码 ====================

  async changePassword(
    user: JwtPayload,
    oldPassword: string,
    newPassword: string,
  ): Promise<{ success: boolean; message: string }> {
    const reviewerKey = user.reviewerKey;
    if (!oldPassword || !newPassword) {
      throw new BadRequestException('原密码和新密码均不能为空');
    }
    if (newPassword.length < 6) {
      throw new BadRequestException('新密码长度不能少于6位');
    }
    const rows = await this.db
      .select()
      .from(reviewerAccount)
      .where(eq(reviewerAccount.reviewerKey, reviewerKey));
    if (rows.length === 0) {
      throw new NotFoundException('评价人不存在');
    }
    const row = rows[0];
    const matchRows = await this.db
      .select({ reviewerKey: reviewerAccount.reviewerKey })
      .from(reviewerAccount)
      .where(and(
        eq(reviewerAccount.reviewerKey, reviewerKey),
        sql`crypt(${oldPassword}, ${row.passwordHash}) = ${row.passwordHash}`,
      ));
    if (matchRows.length === 0) {
      throw new ForbiddenException('原密码错误');
    }
    await this.db
      .update(reviewerAccount)
      .set({
        passwordHash: sql`crypt(${newPassword}, gen_salt('bf'))`,
      })
      .where(eq(reviewerAccount.reviewerKey, reviewerKey));
    return { success: true, message: '密码修改成功' };
  }

  // ==================== 评价人列表 ====================

  async getReviewers(): Promise<{
    reviewers: Array<{
      key: string;
      name: string;
      role: string;
      reviewees: Array<{ name: string; department: string }>;
    }>;
  }> {
    // 从活跃批次的参评名单读取
    const batches = await this.db
      .select()
      .from(reviewBatch)
      .where(eq(reviewBatch.status, 'active'))
      .orderBy(desc(reviewBatch.createdAt))
      .limit(1);

    if (batches.length === 0) {
      return { reviewers: [] };
    }

    const participants = await this.db
      .select()
      .from(reviewParticipant)
      .where(eq(reviewParticipant.batchId, batches[0].id))
      .orderBy(
        asc(reviewParticipant.sortOrder),
        asc(reviewParticipant.reviewerKey),
        asc(reviewParticipant.revieweeName),
      );

    const reviewerMap = new Map<string, {
      key: string;
      name: string;
      role: string;
      reviewees: Array<{ name: string; department: string }>;
    }>();

    for (const p of participants) {
      if (!reviewerMap.has(p.reviewerKey)) {
        reviewerMap.set(p.reviewerKey, {
          key: p.reviewerKey,
          name: p.reviewerName,
          role: '评价人',
          reviewees: [],
        });
      }
      const reviewer = reviewerMap.get(p.reviewerKey)!;
      reviewer.reviewees.push({
        name: p.revieweeName,
        department: p.department ?? '',
      });
    }

    return { reviewers: Array.from(reviewerMap.values()) };
  }
}
