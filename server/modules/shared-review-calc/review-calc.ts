import type {
  CompositeDimension,
  GridCategory,
  RuleDimension,
  RuleSetConfig,
  ReviewCalcResult,
  ScoreItemInput,
} from '@shared/api.interface';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * 纯函数计算引擎：根据 rule_set 配置 + 明细行计算各项结果。
 * 无 Nest 依赖，可在任意 service 中直接 import 使用。
 */
export function computeReviewByConfig(
  config: RuleSetConfig,
  items: ScoreItemInput[],
): ReviewCalcResult {
  // 1. 按维度分组，对该维度下 items 按权重加权平均 → baseDimensionAverages
  //    每项默认 weight=1（等权）
  const baseDimensionAverages: Record<string, number> = {};

  for (const dim of config.dimensions) {
    const dimItems = items.filter((it: ScoreItemInput) => it.dimensionCode === dim.code);
    if (dimItems.length === 0) {
      baseDimensionAverages[dim.code] = 0;
    } else {
      let weightedSum = 0;
      let totalWeight = 0;
      for (const it of dimItems) {
        const w = it.weight ?? 1;
        weightedSum += it.score * w;
        totalWeight += w;
      }
      baseDimensionAverages[dim.code] =
        totalWeight > 0 ? round2(weightedSum / totalWeight) : 0;
    }
  }

  // 2. 计算合成维度均分
  const compositeAverages: Record<string, number> = {};
  if (config.compositeDimensions && config.compositeDimensions.length > 0) {
    for (const cd of config.compositeDimensions) {
      const sourceAvgs: number[] = cd.sourceDimensionCodes
        .map((code: string) => {
          if (baseDimensionAverages[code] !== undefined) return baseDimensionAverages[code];
          if (compositeAverages[code] !== undefined) return compositeAverages[code];
          return null;
        })
        .filter((v: number | null): v is number => v !== null);

      if (sourceAvgs.length === 0) {
        compositeAverages[cd.code] = 0;
      } else if (cd.combineMethod === 'average') {
        const sum = sourceAvgs.reduce((acc: number, v: number) => acc + v, 0);
        compositeAverages[cd.code] = round2(sum / sourceAvgs.length);
      } else {
        compositeAverages[cd.code] = 0;
      }
    }
  }

  const dimensionAverages: Record<string, number> = {
    ...baseDimensionAverages,
    ...compositeAverages,
  };

  // 3. 红线判定：isRedLine=true 的维度，其任一子项 score ≤ 1 则为红线
  //    （1 分是红线固定阈值，不是 gridThresholds.low）
  let isRedLine = false;
  const redLineDimensionCodes = config.dimensions
    .filter((d: RuleDimension) => d.isRedLine)
    .map((d: RuleDimension) => d.code);

  for (const dimCode of redLineDimensionCodes) {
    const dimItems = items.filter((it: ScoreItemInput) => it.dimensionCode === dimCode);
    for (const it of dimItems) {
      if (it.score <= 1) {
        isRedLine = true;
        break;
      }
    }
    if (isRedLine) break;
  }

  // 4. totalScore：weight > 0 的维度（含合成维度）按权重加权，除以权重总和（归一化）
  let totalScore = 0;
  const weightedDimensions: Array<{ code: string; weight: number }> = [];

  for (const dim of config.dimensions) {
    if (dim.weight > 0) {
      weightedDimensions.push({ code: dim.code, weight: dim.weight });
    }
  }
  if (config.compositeDimensions) {
    for (const cd of config.compositeDimensions) {
      if (cd.weight > 0) {
        weightedDimensions.push({ code: cd.code, weight: cd.weight });
      }
    }
  }

  if (weightedDimensions.length > 0) {
    const totalWeight = weightedDimensions.reduce(
      (acc: number, wd: { code: string; weight: number }) => acc + wd.weight,
      0,
    );
    if (totalWeight > 0) {
      const weightedSum = weightedDimensions.reduce(
        (acc: number, wd: { code: string; weight: number }) => {
          const avg = dimensionAverages[wd.code] ?? 0;
          return acc + avg * wd.weight;
        },
        0,
      );
      totalScore = round2(weightedSum / totalWeight);
    }
  }

  // 5. x/y 轴取值
  const xAxisScore: number = dimensionAverages[config.xAxisDimension] ?? totalScore;
  const yAxisScore: number = dimensionAverages[config.yAxisDimension] ?? totalScore;

  // 6. 九宫格落位
  const gridCategory = computeGridCategory(
    isRedLine,
    yAxisScore,
    xAxisScore,
    config.gridThresholds.high,
    config.gridThresholds.low,
  );

  return {
    dimensionAverages,
    totalScore,
    isRedLine,
    gridCategory,
    xAxisScore: round2(xAxisScore),
    yAxisScore: round2(yAxisScore),
  };
}

function computeGridCategory(
  isRedLine: boolean,
  verticalScore: number,
  horizontalScore: number,
  high: number,
  low: number,
): GridCategory {
  if (isRedLine) return 'red_line';
  if (verticalScore >= high && horizontalScore >= high) return 'super_star';
  if (verticalScore >= high && horizontalScore >= low) return 'performance_star';
  if (verticalScore >= high && horizontalScore < low) return 'skilled_employee';
  if (verticalScore >= low && verticalScore < high && horizontalScore >= high) return 'potential_star';
  if (
    verticalScore >= low &&
    verticalScore < high &&
    horizontalScore >= low &&
    horizontalScore < high
  )
    return 'backbone';
  if (verticalScore >= low && verticalScore < high && horizontalScore < low) return 'regular_employee';
  if (verticalScore < low && horizontalScore >= high) return 'to_develop';
  if (verticalScore < low && horizontalScore >= low) return 'gap_employee';
  return 'problem_employee';
}

export { round2 };
export type { CompositeDimension };
