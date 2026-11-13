/**
 * Demo data for a staging environment.
 *
 * Creates departments, admins, candidates, three exams and a spread of
 * attempts (completed, in progress and not started) so the dashboards,
 * analytics and item analysis have something to show. Every timestamp is
 * the time the script runs. Completed attempts are graded with the same
 * finalizeAttempt() the live exam room uses.
 *
 * All demo accounts use the @demo.pytest.local domain and the password below.
 * Run with: npm run seed:demo   (remove with: npm run seed:demo -- --reset)
 */
import bcrypt from 'bcryptjs';
import { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import pool from '../config/database';
import { finalizeAttempt, shuffle } from '../services/attempt.service';
import { logActivity } from '../utils/activity';

const PASSWORD = 'Demo@2026';
const DOMAIN = 'demo.pytest.local';

const DEPARTMENTS = [
  { name: 'Information and Communication Technology', code: 'ICT' },
  { name: 'Business Development', code: 'BD' },
  { name: 'Human Resources', code: 'HR' },
  { name: 'Finance and Accounts', code: 'FIN' },
];

type Role = 'superadmin' | 'admin' | 'student';
interface DemoUser { name: string; email: string; role: Role; dept: string | null; ability: number }

const u = (name: string, role: Role, dept: string | null, ability = 0): DemoUser => ({
  name,
  email: `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@${DOMAIN}`,
  role,
  dept,
  ability,
});

const USERS: DemoUser[] = [
  u('Oluwaseun Adeyemi', 'superadmin', null),
  u('Chinedu Okafor', 'admin', 'ICT'),
  u('Aisha Bello', 'admin', 'BD'),
  u('Folake Adebayo', 'admin', 'HR'),
  // Candidates; ability is the rough chance of answering a medium question correctly.
  u('Emeka Nwosu', 'student', 'ICT', 0.85),
  u('Tunde Bakare', 'student', 'ICT', 0.7),
  u('Ifeoma Eze', 'student', 'ICT', 0.6),
  u('Ibrahim Musa', 'student', 'ICT', 0.45),
  u('Kelechi Obi', 'student', 'ICT', 0.75),
  u('Zainab Abubakar', 'student', 'ICT', 0.55),
  u('Ngozi Okonkwo', 'student', 'BD', 0.8),
  u('Babatunde Ogunleye', 'student', 'BD', 0.5),
  u('Hauwa Suleiman', 'student', 'BD', 0.65),
  u('Chiamaka Nnadi', 'student', 'BD', 0.4),
  u('Yusuf Danjuma', 'student', 'BD', 0.7),
  u('Funmilayo Ojo', 'student', 'HR', 0.6),
  u('Adaeze Uche', 'student', 'HR', 0.75),
  u('Segun Afolabi', 'student', 'HR', 0.5),
];

type Q = [text: string, a: string, b: string, c: string, d: string, correct: 'a' | 'b' | 'c' | 'd', difficulty: 'easy' | 'medium' | 'hard', topic: string];

const EXAMS: {
  title: string; subject: string; description: string; dept: string; author: string;
  duration: number; pass: number; above: number; maxViolations: number; questions: Q[];
}[] = [
  {
    title: 'ICT Fundamentals Assessment',
    subject: 'Information Technology',
    description: 'Networking, hardware, security and office productivity basics for ICT interns.',
    dept: 'ICT',
    author: 'Chinedu Okafor',
    duration: 20,
    pass: 50,
    above: 75,
    maxViolations: 3,
    questions: [
      ['Which device forwards packets between different networks?', 'Switch', 'Router', 'Hub', 'Repeater', 'b', 'easy', 'Networking'],
      ['What does DHCP do on a network?', 'Encrypts traffic', 'Assigns IP addresses automatically', 'Resolves domain names', 'Blocks malware', 'b', 'easy', 'Networking'],
      ['Which port does HTTPS use by default?', '21', '80', '443', '3389', 'c', 'medium', 'Networking'],
      ['Which of these is a private IPv4 address?', '8.8.8.8', '172.217.1.1', '192.168.1.10', '41.58.0.1', 'c', 'medium', 'Networking'],
      ['What is the main purpose of a UPS?', 'Speed up the CPU', 'Keep equipment powered during an outage', 'Cool the server room', 'Back up files', 'b', 'easy', 'Hardware'],
      ['RAM is best described as…', 'Permanent storage', 'Volatile working memory', 'A type of hard disk', 'A network card', 'b', 'easy', 'Hardware'],
      ['A user receives an email asking them to confirm their password via a link. This is most likely…', 'Phishing', 'A firmware update', 'Spam filtering', 'Two-factor authentication', 'a', 'easy', 'Security'],
      ['Which is the strongest password?', 'Password123', 'pyrich2026', 'T7#qL!m2vR9x', 'admin', 'c', 'medium', 'Security'],
      ['What does the principle of least privilege mean?', 'Give everyone admin rights', 'Grant only the access a user needs', 'Disable all accounts at night', 'Share one account per team', 'b', 'medium', 'Security'],
      ['In Excel, which function returns a value from a table by looking up a key?', 'SUM', 'VLOOKUP', 'COUNT', 'CONCAT', 'b', 'medium', 'Productivity'],
      ['Which RAID level mirrors data across two disks?', 'RAID 0', 'RAID 1', 'RAID 5', 'RAID 10', 'b', 'hard', 'Hardware'],
      ['A /24 subnet contains how many usable host addresses?', '256', '255', '254', '128', 'c', 'hard', 'Networking'],
    ],
  },
  {
    title: 'Business Development Aptitude Test',
    subject: 'Business Development',
    description: 'Sales concepts, market analysis and client communication.',
    dept: 'BD',
    author: 'Aisha Bello',
    duration: 15,
    pass: 50,
    above: 75,
    maxViolations: 0,
    questions: [
      ['What does a SWOT analysis examine?', 'Sales, Wages, Orders, Taxes', 'Strengths, Weaknesses, Opportunities, Threats', 'Supply, Warehousing, Output, Transport', 'Staff, Work, Objectives, Targets', 'b', 'easy', 'Strategy'],
      ['A lead that has shown interest and fits the target profile is called…', 'A cold lead', 'A qualified lead', 'A churned client', 'A vendor', 'b', 'easy', 'Sales'],
      ['Revenue is ₦5,000,000 and cost of sales is ₦3,000,000. What is the gross margin?', '20%', '40%', '60%', '66%', 'b', 'medium', 'Numeracy'],
      ['Which is the best first step before pitching to a new client?', 'Send a price list', 'Research the client\'s needs', 'Offer a discount', 'Ask for a referral', 'b', 'easy', 'Client communication'],
      ['What is a key performance indicator (KPI)?', 'A measurable value that shows progress toward a goal', 'A company\'s tax number', 'A type of contract', 'A marketing slogan', 'a', 'easy', 'Strategy'],
      ['A tender asks for a "technical and financial proposal". What should the technical part contain?', 'Only the price', 'How the work will be delivered', 'The company\'s bank details', 'Staff salaries', 'b', 'medium', 'Proposals'],
      ['If 40 of 200 prospects become clients, what is the conversion rate?', '5%', '10%', '20%', '40%', 'c', 'medium', 'Numeracy'],
      ['Which describes a "B2G" market?', 'Business to graduates', 'Business to government', 'Business to groups', 'Business to global', 'b', 'medium', 'Strategy'],
      ['A client says your price is too high. The best response is to…', 'Lower the price immediately', 'End the conversation', 'Restate the value and ask what budget they have', 'Ignore the objection', 'c', 'medium', 'Sales'],
      ['Customer lifetime value is best defined as…', 'The first invoice amount', 'Total expected revenue from a client over the relationship', 'The cost of acquiring a client', 'The client\'s annual turnover', 'b', 'hard', 'Strategy'],
    ],
  },
  {
    title: 'General Aptitude Test',
    subject: 'Quantitative and Verbal Reasoning',
    description: 'General aptitude test for all interns and corps members.',
    dept: 'HR',
    author: 'Folake Adebayo',
    duration: 15,
    pass: 50,
    above: 80,
    maxViolations: 2,
    questions: [
      ['What is 15% of 2,400?', '240', '320', '360', '400', 'c', 'easy', 'Percentages'],
      ['Complete the series: 3, 6, 12, 24, …', '30', '36', '48', '60', 'c', 'easy', 'Sequences'],
      ['Choose the word closest in meaning to "diligent".', 'Lazy', 'Hard-working', 'Careless', 'Quiet', 'b', 'easy', 'Vocabulary'],
      ['A car travels 180 km in 3 hours. What is its average speed?', '50 km/h', '60 km/h', '70 km/h', '90 km/h', 'b', 'easy', 'Rates'],
      ['If 5 workers finish a job in 12 days, how long would 6 workers take at the same rate?', '8 days', '10 days', '12 days', '14 days', 'b', 'medium', 'Rates'],
      ['Choose the correctly spelt word.', 'Accomodation', 'Accommodation', 'Acommodation', 'Acomodation', 'b', 'medium', 'Spelling'],
      ['A price rises from ₦8,000 to ₦10,000. What is the percentage increase?', '20%', '25%', '30%', '80%', 'b', 'medium', 'Percentages'],
      ['All managers are staff. Some staff are engineers. Which must be true?', 'All engineers are managers', 'Some managers are engineers', 'All managers are staff', 'No staff are managers', 'c', 'hard', 'Logic'],
      ['Find the odd one out: 2, 3, 5, 9, 11', '2', '5', '9', '11', 'c', 'medium', 'Sequences'],
      ['The ratio of men to women in a team is 3:2. If there are 15 people, how many are women?', '5', '6', '9', '10', 'b', 'hard', 'Ratios'],
    ],
  },
];

// Which candidates each exam goes to, and what happens to their attempt.
const PLAN: Record<string, { depts: string[]; pending: number; inProgress: number }> = {
  'ICT Fundamentals Assessment': { depts: ['ICT'], pending: 1, inProgress: 1 },
  'Business Development Aptitude Test': { depts: ['BD'], pending: 1, inProgress: 0 },
  'General Aptitude Test': { depts: ['ICT', 'BD', 'HR'], pending: 2, inProgress: 1 },
};

// Deterministic random numbers so every run produces the same data.
let seed = 20261109;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const DIFFICULTY_SHIFT = { easy: 0.15, medium: 0, hard: -0.25 } as const;

function answerFor(q: Q, ability: number): 'a' | 'b' | 'c' | 'd' | null {
  if (rand() < 0.03) return null; // occasionally skipped
  const p = Math.min(0.97, Math.max(0.1, ability + DIFFICULTY_SHIFT[q[6]]));
  if (rand() < p) return q[5];
  const wrong = (['a', 'b', 'c', 'd'] as const).filter((o) => o !== q[5]);
  return wrong[Math.floor(rand() * wrong.length)];
}

/** The first ~60% of answers in question order: what a candidate partway through has autosaved. */
function partial(answers: Record<string, string>, qIds: number[]) {
  const keep = new Set(qIds.slice(0, Math.ceil(qIds.length * 0.6)).map(String));
  return Object.fromEntries(Object.entries(answers).filter(([id]) => keep.has(id)));
}

async function reset(conn: PoolConnection) {
  await conn.execute(`DELETE FROM exams WHERE title IN (${EXAMS.map(() => '?').join(',')})`, EXAMS.map((e) => e.title));
  await conn.execute(`DELETE FROM users WHERE email LIKE ?`, [`%@${DOMAIN}`]);
  console.log('Removed demo exams and users.');
}

async function run() {
  const conn = await pool.getConnection();
  try {
    if (process.argv.includes('--reset')) {
      await reset(conn);
      return;
    }

    const [existing] = await conn.execute<RowDataPacket[]>(`SELECT id FROM users WHERE email LIKE ? LIMIT 1`, [`%@${DOMAIN}`]);
    if (existing.length) {
      console.log('Demo data already present. Run with --reset first to recreate it.');
      return;
    }

    await conn.beginTransaction();

    const deptId: Record<string, number> = {};
    for (const d of DEPARTMENTS) {
      await conn.execute(`INSERT INTO departments (name, code) VALUES (?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name)`, [d.name, d.code]);
      const [rows] = await conn.execute<RowDataPacket[]>(`SELECT id FROM departments WHERE code = ?`, [d.code]);
      deptId[d.code] = rows[0].id;
    }

    const hash = await bcrypt.hash(PASSWORD, 10);
    const userId: Record<string, number> = {};
    for (const usr of USERS) {
      const [r] = await conn.execute<ResultSetHeader>(
        `INSERT INTO users (name, email, password, role, department_id) VALUES (?, ?, ?, ?, ?)`,
        [usr.name, usr.email, hash, usr.role, usr.dept ? deptId[usr.dept] : null]
      );
      userId[usr.name] = r.insertId;
    }
    const superId = userId['Oluwaseun Adeyemi'];
    for (const usr of USERS.filter((x) => x.role !== 'superadmin')) {
      const action = usr.role === 'admin' ? 'user.create_admin' : 'user.create_student';
      await logActivity(superId, 'superadmin', action, 'user', userId[usr.name], { email: usr.email }, conn);
    }

    let completed = 0;
    for (const exam of EXAMS) {
      const totalMarks = exam.questions.length;
      const authorId = userId[exam.author];
      const [er] = await conn.execute<ResultSetHeader>(
        `INSERT INTO exams (title, description, subject, department_id, pass_mark, average_threshold, duration_minutes,
                            total_marks, total_questions, shuffle_questions, show_answers, max_violations, created_by, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, TRUE, ?, ?, TRUE)`,
        [exam.title, exam.description, exam.subject, deptId[exam.dept], exam.pass, exam.above, exam.duration,
         totalMarks, exam.questions.length, exam.maxViolations, authorId]
      );
      const examId = er.insertId;
      await logActivity(authorId, 'admin', 'exam.create', 'exam', examId, { title: exam.title, questions: totalMarks }, conn);

      const qIds: number[] = [];
      for (const [i, q] of exam.questions.entries()) {
        const [qr] = await conn.execute<ResultSetHeader>(
          `INSERT INTO questions (exam_id, question_text, option_a, option_b, option_c, option_d, correct_answer, marks, difficulty, topic, order_index)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
          [examId, q[0], q[1], q[2], q[3], q[4], q[5], q[6], q[7], i]
        );
        qIds.push(qr.insertId);
      }

      const plan = PLAN[exam.title];
      const candidates = USERS.filter((x) => x.role === 'student' && x.dept && plan.depts.includes(x.dept));
      await logActivity(authorId, 'admin', 'exam.assign', 'exam', examId, { count: candidates.length }, conn);

      for (const [i, cand] of candidates.entries()) {
        const fromEnd = candidates.length - i;
        const state = fromEnd <= plan.pending ? 'pending' : fromEnd <= plan.pending + plan.inProgress ? 'in_progress' : 'completed';
        const [ar] = await conn.execute<ResultSetHeader>(
          `INSERT INTO exam_assignments (exam_id, user_id, status, due_date) VALUES (?, ?, 'pending', DATE_ADD(NOW(), INTERVAL 14 DAY))`,
          [examId, userId[cand.name]]
        );
        const assignmentId = ar.insertId;
        if (state === 'pending') continue;

        const order = shuffle(qIds);
        const answers: Record<string, string> = {};
        exam.questions.forEach((q, qi) => {
          const a = answerFor(q, cand.ability);
          if (a) answers[String(qIds[qi])] = a;
        });

        // Time spent in the exam room, so time_taken_seconds is realistic.
        const secondsSpent = Math.round(exam.duration * 60 * (0.45 + rand() * 0.5));
        await conn.execute(
          `UPDATE exam_assignments SET status = 'in_progress', started_at = DATE_SUB(NOW(), INTERVAL ? SECOND),
                  question_order = ?, saved_answers = ?, last_saved_at = NOW() WHERE id = ?`,
          [state === 'in_progress' ? 120 : secondsSpent, JSON.stringify(order), JSON.stringify(state === 'in_progress' ? partial(answers, qIds) : answers), assignmentId]
        );
        await logActivity(userId[cand.name], 'student', 'exam.start', 'exam_assignment', assignmentId, { exam_id: examId }, conn);
        if (state === 'in_progress') continue;

        const violations = exam.maxViolations > 0 && rand() < 0.2 ? 1 : 0;
        const [rows] = await conn.execute<RowDataPacket[]>(
          `SELECT a.*, e.pass_mark, e.average_threshold, e.duration_minutes
           FROM exam_assignments a JOIN exams e ON e.id = a.exam_id WHERE a.id = ? FOR UPDATE`,
          [assignmentId]
        );
        await finalizeAttempt(conn, rows[0], answers, { autoSubmitted: false, violations, reason: 'submitted' });
        completed++;
      }
    }

    await conn.commit();
    console.log(`Demo data created: ${USERS.length} users, ${EXAMS.length} exams, ${completed} graded attempts.`);
    console.log(`Every demo account uses the password "${PASSWORD}". For example:`);
    for (const usr of USERS.slice(0, 4)) console.log(`  ${usr.role.padEnd(10)} ${usr.email}`);
    console.log(`  student    ${USERS[4].email}`);
  } catch (err) {
    await conn.rollback().catch(() => undefined);
    console.error('Demo seed failed:', err);
    process.exitCode = 1;
  } finally {
    conn.release();
    await pool.end();
  }
}

run();
