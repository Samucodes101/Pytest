import pool from '../config/database';
import { RowDataPacket } from 'mysql2';

async function seedDatabase() {
  try {
    console.log('Starting database seed...');

    const TITLE = 'Mathematics Final Exam';

    // Idempotency: skip if the exam already exists
    const [existing] = await pool.execute<RowDataPacket[]>(
      `SELECT id FROM exams WHERE title = ?`,
      [TITLE]
    );
    if (existing.length > 0) {
      console.log('✓ Exam already seeded — nothing to do.');
      process.exit(0);
    }

    // Sample questions
    const questions = [
      { text: 'What is 2 + 2?', a: '3', b: '4', c: '5', d: '6', correct: 'b', marks: 1 },
      { text: 'What is the derivative of x²?', a: 'x', b: '2x', c: '2', d: '1', correct: 'b', marks: 2 },
      { text: 'Solve: 3x + 5 = 14', a: '2', b: '3', c: '4', d: '5', correct: 'b', marks: 2 },
      { text: 'What is √16?', a: '2', b: '3', c: '4', d: '5', correct: 'c', marks: 1 },
      { text: 'What is 15% of 200?', a: '20', b: '25', c: '30', d: '40', correct: 'c', marks: 1 },
      { text: 'What is the sum of angles in a triangle?', a: '90°', b: '180°', c: '270°', d: '360°', correct: 'b', marks: 1 },
      { text: 'What is 12 ÷ 3?', a: '2', b: '3', c: '4', d: '5', correct: 'c', marks: 1 },
      { text: 'Simplify: (2³)²', a: '8', b: '16', c: '32', d: '64', correct: 'd', marks: 2 },
      { text: 'What is the area of a rectangle with length 5 and width 3?', a: '8', b: '15', c: '16', d: '20', correct: 'b', marks: 1 },
      { text: 'What is log₁₀(100)?', a: '1', b: '2', c: '3', d: '10', correct: 'b', marks: 2 },
    ];

    const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0);

    // Create exam with questions
    const [examResult]: any = await pool.execute(
      `INSERT INTO exams (title, description, subject, department_id, pass_mark, average_threshold, duration_minutes, total_marks, total_questions, created_by, is_active)
       VALUES (?, ?, ?, (SELECT id FROM departments WHERE code = 'CSC'), ?, ?, ?, ?, ?, (SELECT id FROM users WHERE email = 'admin@example.com'), ?)`,
      [TITLE, 'Comprehensive mathematics exam covering algebra and calculus', 'Mathematics', 50, 75, 90, totalMarks, questions.length, true]
    );

    const examId = (examResult as any).insertId;

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      await pool.execute(
        `INSERT INTO questions (exam_id, question_text, option_a, option_b, option_c, option_d, correct_answer, marks, order_index) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [examId, q.text, q.a, q.b, q.c, q.d, q.correct, q.marks, i]
      );
    }

    // Assign exam to every student in the exam's department
    const [students] = await pool.execute<RowDataPacket[]>(
      `SELECT u.id FROM users u JOIN departments d ON d.id = u.department_id WHERE u.role = 'student' AND d.code = 'CSC'`
    );
    for (const student of students) {
      await pool.execute(
        `INSERT IGNORE INTO exam_assignments (exam_id, user_id, status) VALUES (?, ?, 'pending')`,
        [examId, student.id]
      );
    }

    console.log('✓ Database seed completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('✗ Seeding error:', error);
    process.exit(1);
  }
}

seedDatabase();