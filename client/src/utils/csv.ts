/** Minimal RFC 4180 CSV parser: handles quoted fields, escaped quotes and CRLF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows;
}

export const QUESTION_CSV_HEADER = 'question,option_a,option_b,option_c,option_d,correct,marks,difficulty,topic';

export const QUESTION_CSV_SAMPLE = `${QUESTION_CSV_HEADER}
"What does HTTP stand for?",HyperText Transfer Protocol,High Transfer Text Protocol,Hyperlink Text Transport,Host Transfer Protocol,a,1,easy,Web basics
"Which SQL clause filters grouped rows?",WHERE,HAVING,ORDER BY,LIMIT,b,2,medium,Databases
`;

export interface ParsedQuestion {
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: 'a' | 'b' | 'c' | 'd';
  marks: number;
  difficulty: 'easy' | 'medium' | 'hard';
  topic: string;
}

/** Turn CSV text into questions, collecting a readable error for each bad row. */
export function parseQuestionCsv(text: string): { questions: ParsedQuestion[]; errors: string[] } {
  const rows = parseCsv(text.replace(/^﻿/, ''));
  const errors: string[] = [];
  const questions: ParsedQuestion[] = [];
  if (rows.length === 0) return { questions, errors: ['The file is empty.'] };

  const hasHeader = rows[0][0]?.trim().toLowerCase() === 'question';
  const body = hasHeader ? rows.slice(1) : rows;

  body.forEach((cells, idx) => {
    const line = idx + (hasHeader ? 2 : 1);
    const [question, a, b, c, d, correctRaw, marksRaw, difficultyRaw, topic] = cells.map((x) => (x ?? '').trim());
    const correct = (correctRaw || '').toLowerCase();
    const difficulty = (difficultyRaw || 'medium').toLowerCase();
    const marks = marksRaw ? Number(marksRaw) : 1;

    if (!question || !a || !b || !c || !d) return errors.push(`Row ${line}: a question and all four options are required.`);
    if (!['a', 'b', 'c', 'd'].includes(correct)) return errors.push(`Row ${line}: "correct" must be a, b, c or d.`);
    if (!Number.isFinite(marks) || marks <= 0) return errors.push(`Row ${line}: marks must be a positive number.`);
    if (!['easy', 'medium', 'hard'].includes(difficulty)) return errors.push(`Row ${line}: difficulty must be easy, medium or hard.`);

    questions.push({
      question_text: question,
      option_a: a,
      option_b: b,
      option_c: c,
      option_d: d,
      correct_answer: correct as ParsedQuestion['correct_answer'],
      marks,
      difficulty: difficulty as ParsedQuestion['difficulty'],
      topic: topic || '',
    });
  });

  return { questions, errors };
}
