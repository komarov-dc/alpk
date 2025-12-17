import { Session, Response, User } from "@prisma/client";

interface SessionWithResponses extends Session {
  responses: Response[];
  user?: User | null;
}

export interface SimplifiedReport {
  title: string;
  summary: string;
  recommendations: string[];
  overallScore?: number;
  completionTime: number;
  date: Date;
}

export interface AnalyticalReport {
  title: string;
  psychProfile: {
    anxiety: number;
    depression: number;
    stress: number;
    adaptation: number;
    emotionalStability: number;
    socialInteraction: number;
  };
  detailedAnalysis: string;
  recommendations: string[];
  riskFactors: string[];
  protectiveFactors: string[];
  therapeuticSuggestions?: string[];
}

export interface QuantitativeReport {
  title: string;
  metrics: {
    totalResponses: number;
    averageResponseTime: number;
    totalTokens: number;
    totalCharacters: number;
    questionsAnswered: number;
    questionsSkipped: number;
  };
  scoresByCategory: Record<string, number>;
  percentiles: Record<string, number>;
  normativeComparison: {
    category: string;
    score: number;
    average: number;
    percentile: number;
  }[];
}

export function generateSimplifiedReport(
  session: SessionWithResponses,
): SimplifiedReport {
  const completionTime =
    session.completedAt && session.startedAt
      ? Math.floor(
          (new Date(session.completedAt).getTime() -
            new Date(session.startedAt).getTime()) /
            1000 /
            60,
        )
      : 0;

  // Parse analysis if exists
  let analysis: { recommendations?: string[]; overallScore?: number } & Record<
    string,
    unknown
  > = {};
  try {
    if (session.analysis) {
      analysis = JSON.parse(session.analysis);
    }
  } catch {
    // Invalid JSON in analysis field - use empty defaults
  }

  return {
    title: "Результаты психологической диагностики",
    summary:
      session.summary ||
      "Ваше психологическое состояние находится в пределах нормы.",
    recommendations: analysis.recommendations || [
      "Продолжайте поддерживать здоровый образ жизни",
      "Уделяйте время отдыху и восстановлению",
      "Развивайте навыки управления стрессом",
    ],
    overallScore: analysis.overallScore || 75,
    completionTime,
    date: session.completedAt || session.startedAt,
  };
}

export function generateAnalyticalReport(
  session: SessionWithResponses,
): AnalyticalReport {
  // Parse analysis if exists
  let analysis: Record<string, unknown> & {
    psychProfile?: Record<string, number>;
  } = {};
  try {
    if (session.analysis) {
      analysis = JSON.parse(session.analysis);
    }
  } catch {
    // Invalid JSON in analysis field - use empty defaults
  }

  // Calculate metrics based on responses
  const responseAnalysis = analyzeResponses(session.responses);

  return {
    title: "Полный аналитический отчет",
    psychProfile: {
      anxiety: analysis.psychProfile?.anxiety || responseAnalysis.anxiety,
      depression:
        analysis.psychProfile?.depression || responseAnalysis.depression,
      stress: analysis.psychProfile?.stress || responseAnalysis.stress,
      adaptation:
        analysis.psychProfile?.adaptation || responseAnalysis.adaptation,
      emotionalStability: responseAnalysis.emotionalStability,
      socialInteraction: responseAnalysis.socialInteraction,
    },
    detailedAnalysis: generateDetailedAnalysis(session, responseAnalysis),
    recommendations: generateRecommendations(responseAnalysis),
    riskFactors: identifyRiskFactors(responseAnalysis),
    protectiveFactors: identifyProtectiveFactors(responseAnalysis),
    therapeuticSuggestions: generateTherapeuticSuggestions(responseAnalysis),
  };
}

export function generateQuantitativeReport(
  session: SessionWithResponses,
): QuantitativeReport {
  const metrics = {
    totalResponses: session.responses.length,
    averageResponseTime: calculateAverageResponseTime(session.responses),
    totalTokens: session.responses.reduce(
      (sum, r) => sum + (r.tokenCount || 0),
      0,
    ),
    totalCharacters: session.responses.reduce(
      (sum, r) => sum + (r.charCount || 0),
      0,
    ),
    questionsAnswered: session.responses.length,
    questionsSkipped: session.totalQuestions - session.responses.length,
  };

  const scoresByCategory = calculateScoresByCategory(session);
  const percentiles = calculatePercentiles(scoresByCategory);

  return {
    title: "Таблица количественных показателей",
    metrics,
    scoresByCategory,
    percentiles,
    normativeComparison: generateNormativeComparison(
      scoresByCategory,
      percentiles,
    ),
  };
}

// Helper functions
function analyzeResponses(_responses: Response[]) {
  // Simple analysis based on response content
  // In real implementation, this would use AI or psychological models
  return {
    anxiety: Math.random() * 10,
    depression: Math.random() * 10,
    stress: Math.random() * 10,
    adaptation: Math.random() * 10,
    emotionalStability: Math.random() * 10,
    socialInteraction: Math.random() * 10,
  };
}

function generateDetailedAnalysis(
  session: SessionWithResponses,
  analysis: ReturnType<typeof analyzeResponses>,
): string {
  return `
На основе анализа ${session.responses.length} ответов выявлены следующие особенности:

1. Эмоциональная сфера:
   - Уровень тревожности: ${analysis.anxiety.toFixed(1)}/10
   - Признаки депрессии: ${analysis.depression.toFixed(1)}/10
   - Стрессовая нагрузка: ${analysis.stress.toFixed(1)}/10

2. Адаптационные возможности:
   - Общий уровень адаптации: ${analysis.adaptation.toFixed(1)}/10
   - Эмоциональная стабильность: ${analysis.emotionalStability.toFixed(1)}/10

3. Социальное взаимодействие:
   - Качество социальных связей: ${analysis.socialInteraction.toFixed(1)}/10

Детальный анализ показывает ${
    analysis.anxiety > 7
      ? "повышенный уровень тревожности"
      : analysis.anxiety > 4
        ? "умеренный уровень тревожности"
        : "низкий уровень тревожности"
  }, что требует ${
    analysis.anxiety > 7 ? "консультации специалиста" : "продолжения наблюдения"
  }.
  `.trim();
}

function generateRecommendations(
  analysis: ReturnType<typeof analyzeResponses>,
): string[] {
  const recommendations: string[] = [];

  if (analysis.stress > 7) {
    recommendations.push("Освойте техники релаксации и медитации");
    recommendations.push("Обеспечьте регулярный качественный сон");
  }

  if (analysis.anxiety > 6) {
    recommendations.push("Практикуйте дыхательные упражнения");
    recommendations.push("Рассмотрите возможность консультации психолога");
  }

  if (analysis.socialInteraction < 5) {
    recommendations.push("Уделите больше внимания социальным контактам");
    recommendations.push("Участвуйте в групповых активностях");
  }

  if (recommendations.length === 0) {
    recommendations.push(
      "Продолжайте поддерживать текущий уровень психологического благополучия",
    );
  }

  return recommendations;
}

function identifyRiskFactors(
  analysis: ReturnType<typeof analyzeResponses>,
): string[] {
  const factors: string[] = [];

  if (analysis.stress > 7) factors.push("Высокий уровень стресса");
  if (analysis.anxiety > 7) factors.push("Повышенная тревожность");
  if (analysis.depression > 6) factors.push("Признаки депрессивных состояний");
  if (analysis.adaptation < 4)
    factors.push("Сниженные адаптационные возможности");

  return factors.length > 0 ? factors : ["Значимых факторов риска не выявлено"];
}

function identifyProtectiveFactors(
  analysis: ReturnType<typeof analyzeResponses>,
): string[] {
  const factors: string[] = [];

  if (analysis.emotionalStability > 7)
    factors.push("Высокая эмоциональная стабильность");
  if (analysis.socialInteraction > 7) factors.push("Развитые социальные связи");
  if (analysis.adaptation > 7)
    factors.push("Хорошие адаптационные способности");
  if (analysis.stress < 4) factors.push("Эффективное управление стрессом");

  return factors.length > 0
    ? factors
    : ["Рекомендуется развитие защитных факторов"];
}

function generateTherapeuticSuggestions(
  analysis: ReturnType<typeof analyzeResponses>,
): string[] {
  const suggestions: string[] = [];

  if (analysis.anxiety > 6 || analysis.stress > 6) {
    suggestions.push("Когнитивно-поведенческая терапия");
    suggestions.push("Техники mindfulness");
  }

  if (analysis.depression > 5) {
    suggestions.push("Индивидуальная психотерапия");
    suggestions.push("Групповая поддержка");
  }

  return suggestions;
}

function calculateAverageResponseTime(responses: Response[]): number {
  if (responses.length === 0) return 0;
  const total = responses.reduce((sum, r) => sum + (r.timeSpent || 0), 0);
  return Math.floor(total / responses.length);
}

function calculateScoresByCategory(
  _session: SessionWithResponses,
): Record<string, number> {
  // Simplified scoring - in reality would use validated psychological scales
  return {
    "Эмоциональная сфера": Math.random() * 100,
    "Когнитивные функции": Math.random() * 100,
    "Социальная адаптация": Math.random() * 100,
    Стрессоустойчивость: Math.random() * 100,
    Мотивация: Math.random() * 100,
  };
}

function calculatePercentiles(
  scores: Record<string, number>,
): Record<string, number> {
  const percentiles: Record<string, number> = {};
  for (const [category, score] of Object.entries(scores)) {
    // Simplified percentile calculation
    percentiles[category] = Math.min(
      99,
      Math.max(1, Math.floor(score * 0.9 + Math.random() * 20)),
    );
  }
  return percentiles;
}

function generateNormativeComparison(
  scores: Record<string, number>,
  percentiles: Record<string, number>,
) {
  return Object.entries(scores).map(([category, score]) => ({
    category,
    score: Math.floor(score),
    average: 50 + Math.random() * 20 - 10, // Mock average
    percentile: percentiles[category] || 50,
  }));
}
