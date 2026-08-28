/**
 * Módulo de Repetición Espaciada Local (SM-2 Simplificado Offline) — LinguaFox
 * 
 * Gestiona el intervalo de repaso de tarjetas de vocabulario y conceptos gramaticales
 * de forma 100% determinista, local y sin llamadas a red ni telemetría.
 */

export interface SRSCard {
  id: string;
  word: string;
  translation: string;
  contextExample: string;
  category: "vocabulary" | "grammar" | "phrase";
  interval: number; // Intervalo en días hasta el próximo repaso
  easeFactor: number; // Factor de facilidad (mínimo 1.3, base 2.5)
  repetitions: number; // Racha de repasos correctos consecutivos
  dueDate: string; // Fecha en formato ISO YYYY-MM-DD (UTC)
  lastReviewed?: string;
  historyCount: number;
}

export type ReviewGrade = 0 | 1 | 2 | 3;
// 0: Olvido total (Blackout)
// 1: Respuesta difícil con esfuerzo / error parcial
// 2: Respuesta correcta con duda normal (Bien)
// 3: Respuesta inmediata y perfecta (Fácil)

/**
 * Calcula el siguiente intervalo y fecha de repaso según el desempeño del usuario.
 */
export function calculateNextReview(card: SRSCard, grade: ReviewGrade, currentDate: Date = new Date()): SRSCard {
  let { interval, easeFactor, repetitions } = card;

  if (grade >= 2) {
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 3;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetitions += 1;
  } else {
    // Si falla o es muy difícil, reiniciamos la racha y se repasa al día siguiente
    repetitions = 0;
    interval = 1;
  }

  // Ajuste del factor de facilidad (fórmula SM-2 acotada)
  easeFactor = Math.max(
    1.3,
    easeFactor + (0.1 - (3 - grade) * (0.08 + (3 - grade) * 0.02))
  );

  const nextReviewDate = new Date(currentDate.getTime());
  nextReviewDate.setUTCDate(nextReviewDate.getUTCDate() + interval);

  const todayIso = currentDate.toISOString().split("T")[0];
  const dueIso = nextReviewDate.toISOString().split("T")[0];

  return {
    ...card,
    interval,
    easeFactor: Number(easeFactor.toFixed(2)),
    repetitions,
    dueDate: dueIso,
    lastReviewed: todayIso,
    historyCount: card.historyCount + 1,
  };
}

/**
 * Filtra las tarjetas que están listas para repasar hoy.
 */
export function getCardsDueForReview(cards: SRSCard[], currentDate: Date = new Date()): SRSCard[] {
  const todayIso = currentDate.toISOString().split("T")[0];
  return cards.filter((c) => c.dueDate <= todayIso);
}

/**
 * Inicializa una tarjeta nueva para ser incorporada al sistema de repaso.
 */
export function createNewSRSCard(
  id: string,
  word: string,
  translation: string,
  contextExample: string,
  category: "vocabulary" | "grammar" | "phrase" = "vocabulary"
): SRSCard {
  const todayIso = new Date().toISOString().split("T")[0];
  return {
    id,
    word,
    translation,
    contextExample,
    category,
    interval: 0,
    easeFactor: 2.5,
    repetitions: 0,
    dueDate: todayIso,
    historyCount: 0,
  };
}
