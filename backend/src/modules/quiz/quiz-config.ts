export interface QuizGenerationConfig {
  readonly answerDuplicateThreshold: number;
  readonly attemptsPerSlot: number;
  readonly lexicalDuplicateThreshold: number;
  readonly topUpSlotMultiplier: number;
}

export function loadQuizGenerationConfig(
  environment: NodeJS.ProcessEnv = process.env,
): QuizGenerationConfig {
  return {
    answerDuplicateThreshold: readRatio(
      environment.QUIZ_ANSWER_DUPLICATE_THRESHOLD,
      0.92,
    ),
    attemptsPerSlot: readInteger(
      environment.QUIZ_GENERATION_ATTEMPTS_PER_SLOT,
      5,
      1,
      10,
    ),
    lexicalDuplicateThreshold: readRatio(
      environment.QUIZ_LEXICAL_DUPLICATE_THRESHOLD,
      0.88,
    ),
    topUpSlotMultiplier: readInteger(
      environment.QUIZ_TOP_UP_SLOT_MULTIPLIER,
      2,
      1,
      5,
    ),
  };
}

function readInteger(
  rawValue: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (rawValue === undefined) return fallback;
  const value = Number.parseInt(rawValue, 10);
  return Number.isSafeInteger(value) && value >= minimum && value <= maximum
    ? value
    : fallback;
}

function readRatio(rawValue: string | undefined, fallback: number): number {
  if (rawValue === undefined) return fallback;
  const value = Number.parseFloat(rawValue);
  return Number.isFinite(value) && value > 0 && value <= 1 ? value : fallback;
}
