export interface ParsedLlmAdvice {
  recommendation: string;
  progressMessage: string;
  actionItems: string[];
}

const cleanText = (value: string, maxLength: number): string => value
  .replace(/^[\s"'`]+|[\s"'`]+$/g, '')
  .replace(/\\n/g, ' ')
  .replace(/\\"/g, '"')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, maxLength);

const isSafeWellnessAction = (value: string): boolean => !(
  /mouth\s*tap/i.test(value)
  || /(?:stop|skip|increase|decrease|change)\s+(?:your\s+)?(?:medicine|medication|dose|prescription)/i.test(value)
  || /\b(?:diagnose|cure|guarantee)\b/i.test(value)
);

const normalizeCandidate = (candidate: string): string => candidate
  .replace(/[“”]/g, '"')
  .replace(/[‘’]/g, "'")
  .replace(/```(?:json)?|```/gi, '')
  .replace(/,\s*([}\]])/g, '$1')
  .replace(/([{,]\s*)(recommendation|progressMessage|actionItems|actions|wellnessActions)\s*:/g, '$1"$2":')
  .trim();

const objectCandidates = (raw: string): string[] => {
  const candidates = [raw.trim()];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;
  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === '{') {
      if (depth === 0) start = index;
      depth += 1;
    } else if (char === '}' && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) candidates.push(raw.slice(start, index + 1));
    }
  }
  const firstBrace = raw.indexOf('{');
  if (firstBrace >= 0 && depth > 0) candidates.push(`${raw.slice(firstBrace)}}`);
  return [...new Set(candidates.map(normalizeCandidate))];
};

const parseObject = (raw: string): Record<string, unknown> | null => {
  for (const candidate of objectCandidates(raw)) {
    try {
      const value = JSON.parse(candidate) as unknown;
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value as Record<string, unknown>;
      }
    } catch {
      // Continue to tolerant field extraction below.
    }
  }
  return null;
};

const extractQuotedField = (raw: string, names: string[]): string => {
  for (const name of names) {
    const doubleQuoted = raw.match(new RegExp(`["']?${name}["']?\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`, 'i'));
    if (doubleQuoted?.[1]) return cleanText(doubleQuoted[1], 800);
    const singleQuoted = raw.match(new RegExp(`["']?${name}["']?\\s*:\\s*'([^']*)'`, 'i'));
    if (singleQuoted?.[1]) return cleanText(singleQuoted[1], 800);
  }
  return '';
};

const extractLooseActions = (raw: string): string[] => {
  const arrayMatch = raw.match(/["']?(?:actionItems|actions|wellnessActions)["']?\s*:\s*\[([\s\S]*?)(?:\]|$)/i);
  const source = arrayMatch?.[1] ?? '';
  const quoted: string[] = [];
  const quotedPattern = /["']((?:\\.|[^"'\\]){4,})["']/g;
  let match: RegExpExecArray | null;
  while ((match = quotedPattern.exec(source)) !== null) quoted.push(cleanText(match[1], 420));
  if (quoted.length > 0) return quoted;
  return raw
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
    .filter((line) => line.length >= 12 && /^(?:try|keep|use|set|avoid|limit|choose|sleep|drink|dim|place|take|write|stop|start|move|practice)\b/i.test(line))
    .map((line) => cleanText(line, 420));
};

export const parseLlmAdvice = (
  raw: string,
  isImproving: boolean,
  fallbackRecommendation = '',
): ParsedLlmAdvice => {
  const normalizedRaw = normalizeCandidate(raw);
  const value = parseObject(normalizedRaw);
  const recommendationValue = value?.recommendation;
  const progressValue = value?.progressMessage;
  const actionValue = value?.actionItems ?? value?.actions ?? value?.wellnessActions;
  const recommendation = typeof recommendationValue === 'string'
    ? cleanText(recommendationValue, 800)
    : extractQuotedField(normalizedRaw, ['recommendation', 'summary']) || fallbackRecommendation;
  const generatedProgress = typeof progressValue === 'string'
    ? cleanText(progressValue, 300)
    : extractQuotedField(normalizedRaw, ['progressMessage', 'progress']);
  const rawActions = Array.isArray(actionValue)
    ? actionValue.filter((item): item is string => typeof item === 'string')
    : extractLooseActions(normalizedRaw);
  const actionItems = [...new Set(rawActions
    .map((item) => cleanText(item, 420))
    .filter((item) => item.length > 0 && isSafeWellnessAction(item)))].slice(0, 4);

  if (!recommendation || actionItems.length < 1) {
    throw new Error('Hagosaur could not format the personalized plan. Safe offline actions are shown instead.');
  }
  return {
    recommendation: cleanText(recommendation, 800),
    progressMessage: isImproving ? generatedProgress : '',
    actionItems,
  };
};
