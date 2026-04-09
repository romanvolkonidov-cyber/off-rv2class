import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs/promises';
import path from 'path';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// Structured types for AI-generated content
export interface AITeacherNote {
  slide_number: number;
  questions: string[];
  answers: string[];
  tips?: string;
}

export interface AIHomeworkItem {
  question_text: string;
  exercise_type: 'VOCABULARY' | 'LISTENING' | 'SPEAKING' | 'READING' | 'WRITING' | 'GRAMMAR';
  options?: string[];
  correct_answer: string | null;
  needs_human_grading: boolean;
}

export interface AIGeneratedContent {
  teacher_notes: AITeacherNote[];
  homework: AIHomeworkItem[];
  listening_script?: string;
}

const SYSTEM_PROMPT = `You are an expert ESL (English as a Second Language) teacher and curriculum designer.

I am uploading slide images from a lesson. Analyze the grammar, vocabulary, exercises, and concepts taught in these slides.

IMPORTANT: Provide your response ONLY in valid JSON format with exactly three root keys: "teacher_notes", "homework", and "listening_script".

1. "teacher_notes" — An array of objects, one per slide. They must be concise and actionable for a teacher. Each MUST have:
   - "slide_number": Integer (1-indexed, matching the order of slides provided)
   - "questions": Array of strings — exact questions the teacher should ask the student based on the slide's picture or content
   - "answers": Array of strings — right answers if the slide has questions or gaps
   - "tips": Optional string — if the slide contains a chart or grammar explanation, briefly highlight the most important points for the teacher to focus on

2. "listening_script" — A highly detailed script for audio generation (like ElevenLabs or a human voice actor) that clearly relates to the lesson content. It must include exact spoken dialog, PLUS specific bracketed notes for [background sounds] (e.g. [cafe ambient noise, birds chirping]), [speaker roles/names], and [intonation/emotion] (e.g. [excited], [whispering]). This script will be used to generate the audio for the LISTENING homework task.

3. "homework" — An array of exactly 6 exercises, one for each specific skill. Each object MUST have:
   - "question_text": String — the full task/question text (For the LISTENING task, reference the listening_script)
   - "exercise_type": One of "VOCABULARY", "LISTENING", "SPEAKING", "READING", "WRITING", "GRAMMAR"
   - "options": Array of strings (required ONLY if it's a multiple choice question, null otherwise)
   - "correct_answer": String or null. (Must be a precise string for VOCABULARY, LISTENING, READING, and GRAMMAR so they can be auto-graded. Must be null for SPEAKING and WRITING).
   - "needs_human_grading": Boolean (Must be true for SPEAKING and WRITING. Must be false for the rest).

Make sure the homework exercises directly test the material shown in the slides, but keep them reasonably sized (1 exercise for each type). All text content should be appropriate for ESL students studying English.`;

/**
 * Sends compressed slide images to Claude and returns structured teacher notes + homework.
 * Falls back to stub data if no API key is configured.
 */
export async function generateLessonContent(
  lessonId: string,
  slidePaths: string[]
): Promise<AIGeneratedContent> {
  // If no API key, return stub data for development
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'your_anthropic_api_key_here') {
    console.log(`⚠️ No Anthropic API key configured. Generating stub content for lesson ${lessonId}`);
    return generateStubContent(slidePaths.length);
  }

  // Read all slide images as base64
  const imageContents: Anthropic.ImageBlockParam[] = [];

  for (const slidePath of slidePaths) {
    const absolutePath = path.join(process.cwd(), slidePath);
    const buffer = await fs.readFile(absolutePath);
    const base64 = buffer.toString('base64');

    imageContents.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/jpeg',
        data: base64,
      },
    });
  }

  console.log(`🤖 Sending ${slidePaths.length} slides to Claude for lesson ${lessonId}...`);

  const response = await anthropic.messages.create({
    model: 'claude-3-5-haiku-20241022',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: SYSTEM_PROMPT },
          ...imageContents,
        ],
      },
    ],
  });

  // Extract text content from response
  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  // Parse JSON from the response
  const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in Claude response');
  }

  const parsed: AIGeneratedContent = JSON.parse(jsonMatch[0]);

  console.log(
    `✅ Generated ${parsed.teacher_notes.length} teacher notes and ${parsed.homework.length} homework items for lesson ${lessonId}`
  );

  return parsed;
}

/**
 * Generates placeholder content for development without an API key.
 */
function generateStubContent(slideCount: number): AIGeneratedContent {
  const teacher_notes: AITeacherNote[] = [];

  for (let i = 1; i <= slideCount; i++) {
    teacher_notes.push({
      slide_number: i,
      questions: [`What do you see in the picture on slide ${i}?`],
      answers: [`Slide ${i} correct answer`],
      tips: `Highlight the grammar rule in the chart on slide ${i}.`,
    });
  }

  const homework: AIHomeworkItem[] = [
    {
      question_text: 'Match the word to its definition...',
      exercise_type: 'VOCABULARY',
      correct_answer: 'word1',
      needs_human_grading: false,
    },
    {
      question_text: 'What did the speaker say about the topic?',
      exercise_type: 'LISTENING',
      correct_answer: 'topic info',
      needs_human_grading: false,
    },
    {
      question_text: 'Record a short voice message describing your typical day.',
      exercise_type: 'SPEAKING',
      correct_answer: null,
      needs_human_grading: true,
    },
    {
      question_text: 'Read the short text and answer: True or False?',
      exercise_type: 'READING',
      options: ['True', 'False'],
      correct_answer: 'True',
      needs_human_grading: false,
    },
    {
      question_text: 'Write a short paragraph about your last vacation.',
      exercise_type: 'WRITING',
      correct_answer: null,
      needs_human_grading: true,
    },
    {
      question_text: 'Choose the correct form: She ___ to school every day.',
      exercise_type: 'GRAMMAR',
      options: ['go', 'goes', 'going', 'went'],
      correct_answer: 'goes',
      needs_human_grading: false,
    },
  ];

  return { teacher_notes, homework, listening_script: "This is a short script for the teacher to read..." };
}
