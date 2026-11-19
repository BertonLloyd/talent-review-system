import type { TalentReviewScores, TalentReviewComputed, GridCategory } from '@shared/api.interface';

export function computeReviewMetrics(scores: TalentReviewScores): TalentReviewComputed {
  const valueAvg = round2(
    (scores.valueCoCreate.score + scores.valueCost.score + scores.valueOwnership.score) / 3,
  );
  const abilityAvg = round2(
    (scores.abilityProfessional.score +
      scores.abilityDelivery.score +
      scores.abilityProblemSolve.score) /
      3,
  );
  const willAvg = round2(
    (scores.willInitiative.score + scores.willGrowth.score + scores.willStability.score) / 3,
  );
  const performanceScore = round2(abilityAvg * 0.6 + willAvg * 0.4);

  const isRedLine =
    scores.valueCoCreate.score <= 1 ||
    scores.valueCost.score <= 1 ||
    scores.valueOwnership.score <= 1;

  const gridCategory = computeTenGridCategory(isRedLine, performanceScore, abilityAvg);

  return {
    valueAvg,
    abilityAvg,
    willAvg,
    performanceScore,
    gridCategory,
    isRedLine,
  };
}

export function computeTenGridCategory(
  isRedLine: boolean,
  verticalScore: number,
  horizontalScore: number,
): GridCategory {
  if (isRedLine) return 'red_line';
  if (verticalScore >= 4.0 && horizontalScore >= 4.0) return 'super_star';
  if (verticalScore >= 4.0 && horizontalScore >= 2.5) return 'performance_star';
  if (verticalScore >= 4.0 && horizontalScore < 2.5) return 'skilled_employee';
  if (verticalScore >= 2.5 && verticalScore < 4.0 && horizontalScore >= 4.0) return 'potential_star';
  if (
    verticalScore >= 2.5 &&
    verticalScore < 4.0 &&
    horizontalScore >= 2.5 &&
    horizontalScore < 4.0
  )
    return 'backbone';
  if (verticalScore >= 2.5 && verticalScore < 4.0 && horizontalScore < 2.5) return 'regular_employee';
  if (verticalScore < 2.5 && horizontalScore >= 4.0) return 'to_develop';
  if (verticalScore < 2.5 && horizontalScore >= 2.5) return 'gap_employee';
  return 'problem_employee';
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
