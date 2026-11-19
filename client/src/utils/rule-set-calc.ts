import type {
  RuleSetConfig,
  ReviewCalcResult,
  GridCategory,
} from '@shared/api.interface';

export interface ItemScoreMap {
  [itemCode: string]: number;
}

/**
 * 根据规则集配置计算盘点结果
 * - 各维度均分 = 维度内子项分数的算术平均
 * - 横轴分 = xAxisDimension 对应维度均分；若是合成维度，按源维度 weight 加权平均
 * - 纵轴分 = yAxisDimension 对应维度均分
 * - 红线判定：isRedLine=true 的维度下任一子项 score ≤ 1
 * - 九宫格落位：按 gridThresholds 判定高低档
 */
export function computeReviewMetricsFromConfig(
  config: RuleSetConfig,
  itemScores: ItemScoreMap,
): ReviewCalcResult {
  // 1. 计算各维度均分
  const dimensionAverages: Record<string, number> = {};
  for (const dim of config.dimensions) {
    const validScores: number[] = [];
    for (const item of dim.items) {
      const s = itemScores[item.code];
      if (s !== undefined && s > 0) {
        validScores.push(s);
      }
    }
    dimensionAverages[dim.code] =
      validScores.length > 0
        ? validScores.reduce((a: number, b: number) => a + b, 0) / validScores.length
        : 0;
  }

  // 2. 纵轴分：先查是否为合成维度，否则按普通维度取均分
  let yAxisScore = 0;
  const yComposite = config.compositeDimensions?.find(
    (c) => c.code === config.yAxisDimension,
  );
  if (yComposite) {
    const sourceDims = yComposite.sourceDimensionCodes
      .map((code: string) => config.dimensions.find((d) => d.code === code))
      .filter((d): d is (typeof config.dimensions)[number] => Boolean(d));
    const totalWeight = sourceDims.reduce(
      (sum: number, d) => sum + d.weight,
      0,
    );
    if (totalWeight > 0) {
      yAxisScore =
        sourceDims.reduce(
          (sum: number, d) =>
            sum + (dimensionAverages[d.code] ?? 0) * d.weight,
          0,
        ) / totalWeight;
    }
  } else {
    yAxisScore = dimensionAverages[config.yAxisDimension] ?? 0;
  }

  // 3. 横轴分：先查是否为合成维度，否则按普通维度取均分
  let xAxisScore = 0;
  const composite = config.compositeDimensions?.find(
    (c) => c.code === config.xAxisDimension,
  );

  if (composite) {
    const sourceDims = composite.sourceDimensionCodes
      .map((code: string) => config.dimensions.find((d) => d.code === code))
      .filter((d): d is (typeof config.dimensions)[number] => Boolean(d));
    const totalWeight = sourceDims.reduce(
      (sum: number, d) => sum + d.weight,
      0,
    );
    if (totalWeight > 0) {
      xAxisScore =
        sourceDims.reduce(
          (sum: number, d) =>
            sum + (dimensionAverages[d.code] ?? 0) * d.weight,
          0,
        ) / totalWeight;
    }
  } else {
    xAxisScore = dimensionAverages[config.xAxisDimension] ?? 0;
  }

  // 4. 红线判定
  let isRedLine = false;
  for (const dim of config.dimensions) {
    if (!dim.isRedLine) continue;
    for (const item of dim.items) {
      const s = itemScores[item.code];
      if (s !== undefined && s > 0 && s <= 1) {
        isRedLine = true;
        break;
      }
    }
    if (isRedLine) break;
  }

  // 5. 九宫格落位
  const gridCategory = computeGridCategory(
    isRedLine,
    yAxisScore,
    xAxisScore,
    config.gridThresholds,
  );

  // 6. 总分（所有维度按 weight 加权）
  const totalDimWeight = config.dimensions.reduce(
    (sum: number, d) => sum + d.weight,
    0,
  );
  const totalScore =
    totalDimWeight > 0
      ? config.dimensions.reduce(
          (sum: number, d) =>
            sum + (dimensionAverages[d.code] ?? 0) * d.weight,
          0,
        ) / totalDimWeight
      : 0;

  return {
    dimensionAverages,
    totalScore: round2(totalScore),
    isRedLine,
    gridCategory,
    xAxisScore: round2(xAxisScore),
    yAxisScore: round2(yAxisScore),
  };
}

function computeGridCategory(
  isRedLine: boolean,
  yScore: number,
  xScore: number,
  thresholds: { high: number; low: number },
): GridCategory {
  if (isRedLine) return 'red_line';

  const yLevel = yScore >= thresholds.high ? 'high' : yScore >= thresholds.low ? 'mid' : 'low';
  const xLevel = xScore >= thresholds.high ? 'high' : xScore >= thresholds.low ? 'mid' : 'low';

  const gridMap: Record<string, GridCategory> = {
    'high-high': 'super_star',
    'high-mid': 'performance_star',
    'high-low': 'skilled_employee',
    'mid-high': 'potential_star',
    'mid-mid': 'backbone',
    'mid-low': 'regular_employee',
    'low-high': 'to_develop',
    'low-mid': 'gap_employee',
    'low-low': 'problem_employee',
  };

  return gridMap[`${yLevel}-${xLevel}`] ?? 'backbone';
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
