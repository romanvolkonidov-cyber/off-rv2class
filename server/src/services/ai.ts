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
  lesson_video_prompt: string;
  lesson_video_notes: string;
  homework_video_prompt: string;
  homework_video_question: string;
  homework_video_options: string[];
  homework_video_answer: string;
}

const SYSTEM_PROMPT = `You are an expert ESL (English as a Second Language) teacher and curriculum designer.

I am uploading slide images from a lesson. Analyze the grammar, vocabulary, exercises, and concepts taught in these slides.

IMPORTANT: Provide your response ONLY in valid JSON format with exactly nine root keys: "teacher_notes", "homework", "listening_script", "lesson_video_prompt", "lesson_video_notes", "homework_video_prompt", "homework_video_question", "homework_video_options", and "homework_video_answer".
1. "teacher_notes" — An array of objects for EACH slide. Include "slide_number", "questions" (array), "answers" (array), and "tips" (string).
2. "homework" — An array of 5-8 various exercises (VOCABULARY, GRAMMAR, etc.) based on the slides.
3. "listening_script" — A script for a listening exercise.

4. "lesson_video_prompt" — A highly descriptive, cinematic prompt (approx. 50-75 words) for an 8-second AI video. It should describe a visually engaging "hook" representing the lesson's main topic in a real-world scenario. Use vivid sensory details.
5. "lesson_video_notes" — Specific questions or discussion points for the teacher to ask while watching the lesson intro video. (MUST BE IN RUSSIAN)
6. "homework_video_prompt" — A short, engaging 8-second prompt. It MUST describe a scene with one VERY SPECIFIC visual detail (e.g. an object's color, a number, a specific action) that can be verified by watching.
7. "homework_video_question" — A multiple-choice question based on that specific visual detail. (MUST BE IN ENGLISH)
8. "homework_video_options" — Array of 4 strings for the question.
9. "homework_video_answer" — The correct string from the options.

CRITICAL INSTRUCTION: Ensure the pedagogical density is high. Do not use generic placeholders.`;

/**
 * Sends compressed slide images to Claude and returns structured teacher notes + homework.
 * Falls back to stub data if no API key is configured.
 */
export async function generateLessonContent(
  lessonId: string,
  collagePath: string,
  slideCount: number,
  level: string = 'B1'
): Promise<AIGeneratedContent> {
  // If no API key, return stub data for development
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'your_anthropic_api_key_here') {
    console.log(`No Anthropic API key configured. Generating stub content for lesson ${lessonId}`);
    return generateStubContent(slideCount);
  }

  // Read collage image as base64
  const absolutePath = path.join(process.cwd(), collagePath);
  const buffer = await fs.readFile(absolutePath);
  const base64 = buffer.toString('base64');

  console.log(`Sending collage for lesson ${lessonId} to Claude...`);

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: SYSTEM_PROMPT + `\n\nThe target student's CEFR level is ${level.toUpperCase()}.\nThere are ${slideCount} slides in this collage. Each is numbered from 1 to ${slideCount}.` },
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/jpeg',
              data: base64,
            },
          },
        ],
      },
    ],
  });

  // Extract text content from response
  const textBlock = response.content.find((block: any) => block.type === 'text');
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
 * Refines existing lesson content based on a user-provided correction prompt.
 * Uses the same slide collage as context.
 */
export async function refineLessonContent(
  lessonId: string,
  collagePath: string,
  slideCount: number,
  correctionPrompt: string,
  level: string = 'B1'
): Promise<AIGeneratedContent> {
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'your_anthropic_api_key_here') {
    return generateStubContent(slideCount);
  }

  const absolutePath = path.join(process.cwd(), collagePath);
  const buffer = await fs.readFile(absolutePath);
  const base64 = buffer.toString('base64');

  const REFINE_PROMPT = `${SYSTEM_PROMPT}
  
  You previously generated content for this lesson, but the user wants to refine it with these specific instructions:
  "${correctionPrompt}"
  
  Please regenerate the full JSON (teacher_notes, homework, listening_script) incorporating these changes while remaining faithful to the original slides content.`;

  console.log(`🤖 Refining content for lesson ${lessonId} with Claude...`);

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: REFINE_PROMPT + `\n\nTarget CEFR Level: ${level.toUpperCase()}\nSlides: ${slideCount}.` },
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/jpeg',
              data: base64,
            },
          },
        ],
      },
    ],
  });

  const textBlock = response.content.find((block: any) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') throw new Error('No text response from Claude');

  const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON found in Claude response');

  return JSON.parse(jsonMatch[0]);
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

  return { 
    teacher_notes, 
    homework, 
    listening_script: "This is a short script for the teacher to read...",
    lesson_video_prompt: "A cinematic shot of a person learning English in a modern office, bright colors, high quality.",
    lesson_video_notes: "Спросите ученика: Что делает человек на видео? Как он себя чувствует?",
    homework_video_prompt: "A student sitting at a desk with a laptop, focused and motivated, wearing a blue scarf.",
    homework_video_question: "What color is the student's scarf?",
    homework_video_options: ["Red", "Blue", "Green", "Yellow"],
    homework_video_answer: "Blue"
  };
}
