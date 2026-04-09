import prisma from '../utils/prisma.js';


export interface SubmittedAnswer {
  homeworkId: string;
  answer: string;
}

export interface GradingResult {
  score: number;
  totalQuestions: number;
  correctCount: number;
}

/**
 * Compares student answers against the correct answers stored in the database.
 * Normalizes strings for comparison (trim, lowercase).
 * Supports fuzzy matching for fill-in-the-blank (handles minor typos).
 */
export async function gradeHomeworkSubmission(
  assignmentId: string,
  answers: SubmittedAnswer[]
): Promise<GradingResult> {
  let correctCount = 0;
  const totalQuestions = answers.length;

  for (const answer of answers) {
    // Get the correct answer from the database
    const homework = await prisma.homework.findUnique({
      where: { id: answer.homeworkId },
    });

    if (!homework) continue;

    // Normalize both strings for comparison
    const studentAnswer = normalizeAnswer(answer.answer);
    const correctAnswer = normalizeAnswer(homework.correctAnswer || '');

    const isCorrect = compareAnswers(studentAnswer, correctAnswer, homework.exerciseType);

    // Save response
    await prisma.homeworkResponse.create({
      data: {
        assignmentId,
        homeworkId: answer.homeworkId,
        studentAnswer: answer.answer,
        isCorrect,
      },
    });

    if (isCorrect) correctCount++;
  }

  const score = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;

  // Update assignment with score and submission time
  await prisma.homeworkAssignment.update({
    where: { id: assignmentId },
    data: {
      submittedAt: new Date(),
      score,
    },
  });

  return { score, totalQuestions, correctCount };
}

/**
 * Normalizes an answer string for fair comparison.
 */
function normalizeAnswer(answer: string): string {
  return answer
    .trim()
    .toLowerCase()
    .replace(/[.,!?;:'"]/g, '')  // Remove punctuation
    .replace(/\s+/g, ' ');       // Collapse whitespace
}

/**
 * Compares student answer vs correct answer.
 * For fill-in-the-blank, allows minor typos (Levenshtein distance ≤ 1).
 */
function compareAnswers(
  student: string,
  correct: string,
  exerciseType: string
): boolean {
  // Exact match for multiple choice, true/false, and most AI-generated tasks (Vocab/Grammar/etc)
  if (
    exerciseType === 'MULTIPLE_CHOICE' || 
    exerciseType === 'TRUE_FALSE' ||
    exerciseType === 'VOCABULARY' ||
    exerciseType === 'GRAMMAR' ||
    exerciseType === 'READING' ||
    exerciseType === 'LISTENING'
  ) {
    return student === correct;
  }

  // For fill-in-the-blank and short answer, allow minor typos
  if (student === correct) return true;

  // Allow Levenshtein distance of 1 for FILL_IN_BLANK
  if (exerciseType === 'FILL_IN_BLANK') {
    return levenshteinDistance(student, correct) <= 1;
  }

  // For SPEAKING and WRITING, we don't auto-grade (handled by teacher)
  return false;
}

/**
 * Calculates the Levenshtein distance between two strings.
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}
