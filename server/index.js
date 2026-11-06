import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import Papa from 'papaparse';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../iaa.db');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// 1. Create Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS students (
    unity_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    avatar_url TEXT
  );

  CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    _id TEXT UNIQUE,
    timestamp TEXT,
    email TEXT NOT NULL,
    name TEXT,
    report_type TEXT,
    company_position_dept TEXT,
    interview_stage TEXT,
    job_source TEXT,
    technical_notes TEXT,
    company_job_title_offer TEXT,
    wants_meeting TEXT,
    company_job_title_accept TEXT,
    final_offer_compensation TEXT,
    job_location TEXT,
    working_conditions TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_submissions_email ON submissions(email);

  CREATE TABLE IF NOT EXISTS warning_acknowledgments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    unity_id TEXT NOT NULL,
    warning_type TEXT NOT NULL,
    event_timestamp TEXT,
    record_id INTEGER,
    acknowledged_at TEXT NOT NULL,
    admin_note TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_ack_unity ON warning_acknowledgments(unity_id);
`);

// Ensure warning_acknowledgments schema is up-to-date
const ackCols = db.prepare('PRAGMA table_info(warning_acknowledgments)').all().map(c => c.name);
if (!ackCols.includes('record_id')) {
  try {
    db.exec('ALTER TABLE warning_acknowledgments ADD COLUMN record_id INTEGER;');
  } catch (_e) {}
}

// 2. Seed student roster if empty
const countStudents = db.prepare('SELECT COUNT(*) as count FROM students').get().count;
if (countStudents === 0) {
  const rosterPath = path.resolve(__dirname, '../data/student_roster.csv');
  if (fs.existsSync(rosterPath)) {
    const rosterText = fs.readFileSync(rosterPath, 'utf8');
    const parsed = Papa.parse(rosterText, { header: true, skipEmptyLines: true });
    const insert = db.prepare('INSERT OR REPLACE INTO students (unity_id, name, email, avatar_url) VALUES (?, ?, ?, ?)');
    
    const seed = db.transaction((rows) => {
      for (const r of rows) {
        const name = (r['Last, First Name'] || '').trim();
        const unityID = (r['UnityID'] || '').trim().toLowerCase();
        if (unityID) {
          insert.run(unityID, name, `${unityID}@ncsu.edu`, `/data/avatars/${unityID}.png`);
        }
      }
    });
    seed(parsed.data);
    console.log(`Seeded ${parsed.data.length} students into SQLite.`);
  }
}

/** Map CSV row to DB record without any parsing */
function rowToRecord(row, idx) {
  return {
    _id:                      row._id || `sub_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp:                row['Timestamp'] || '',
    email:                    (row['Email Address'] || '').trim().toLowerCase(),
    name:                     row['Last, First Name'] || '',
    report_type:              row['What are you reporting today?'] || '',
    company_position_dept:    row['Please list the company, position, department/division. '] || row['Please list the company, position, department/division.'] || '',
    interview_stage:          row['Which interview was this? '] || row['Which interview was this?'] || '',
    job_source:               row['How did you hear about the job?'] || '',
    technical_notes:          row['Were there any technical concepts or questions that were challenging or new to you? '] || row['Were there any technical concepts or questions that were challenging or new to you?'] || '',
    company_job_title_offer:  row['Please list the company and job title'] || '',
    wants_meeting:            row['Do you want to meet with career services to discuss further?:'] || row['Do you want to meet with career services to discuss further?'] || '',
    company_job_title_accept: row['Please list the company name and job title. '] || row['Please list the company name and job title.'] || '',
    final_offer_compensation: row['What is the final offer? Please break down by salary and bonuses.'] || '',
    job_location:             row['Where is the job located (city/state)? '] || row['Where is the job located (city/state)?'] || '',
    working_conditions:       row['What are the working conditions? '] || row['What are the working conditions?'] || ''
  };
}

/** Map DB record back to exact CSV headers for frontend display */
function recordToRow(r) {
  return {
    _id: r._id,
    _dbId: r.id,
    'Timestamp': r.timestamp,
    'Email Address': r.email,
    'Last, First Name': r.name,
    'What are you reporting today?': r.report_type,
    'Please list the company, position, department/division. ': r.company_position_dept,
    'Which interview was this? ': r.interview_stage,
    'How did you hear about the job?': r.job_source,
    'Were there any technical concepts or questions that were challenging or new to you? ': r.technical_notes,
    'Please list the company and job title': r.company_job_title_offer,
    'Do you want to meet with career services to discuss further?:': r.wants_meeting,
    'Please list the company name and job title. ': r.company_job_title_accept,
    'What is the final offer? Please break down by salary and bonuses.': r.final_offer_compensation,
    'Where is the job located (city/state)? ': r.job_location,
    'What are the working conditions? ': r.working_conditions
  };
}

const INSERT_SUBMISSION = db.prepare(`
  INSERT INTO submissions
    (_id, timestamp, email, name, report_type,
     company_position_dept, interview_stage, job_source, technical_notes,
     company_job_title_offer, wants_meeting,
     company_job_title_accept, final_offer_compensation, job_location, working_conditions)
  VALUES
    (@_id, @timestamp, @email, @name, @report_type,
     @company_position_dept, @interview_stage, @job_source, @technical_notes,
     @company_job_title_offer, @wants_meeting,
     @company_job_title_accept, @final_offer_compensation, @job_location, @working_conditions)
`);

const UPDATE_SUBMISSION = db.prepare(`
  UPDATE submissions SET
    timestamp = @timestamp,
    email = @email,
    name = @name,
    report_type = @report_type,
    company_position_dept = @company_position_dept,
    interview_stage = @interview_stage,
    job_source = @job_source,
    technical_notes = @technical_notes,
    company_job_title_offer = @company_job_title_offer,
    wants_meeting = @wants_meeting,
    company_job_title_accept = @company_job_title_accept,
    final_offer_compensation = @final_offer_compensation,
    job_location = @job_location,
    working_conditions = @working_conditions
  WHERE id = @id
`);

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));

/** 1. Get all students */
app.get('/api/students', (_req, res) => {
  const students = db.prepare('SELECT unity_id as unityID, name, email, avatar_url as avatarUrl FROM students ORDER BY name ASC').all();
  res.json(students);
});

/** 2. Get all submissions */
app.get('/api/submissions', (_req, res) => {
  const rows = db.prepare('SELECT * FROM submissions ORDER BY id DESC').all();
  res.json(rows.map(recordToRow));
});

/** 3. Insert one new submission */
app.post('/api/submissions', (req, res) => {
  const record = rowToRecord(req.body, 0);
  const info = INSERT_SUBMISSION.run(record);
  res.status(201).json({ ok: true, id: info.lastInsertRowid, _id: record._id });
});

/** 3b. Update an existing submission */
app.put('/api/submissions/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const record = rowToRecord(req.body, 0);
  record.id = id;
  UPDATE_SUBMISSION.run(record);
  res.json({ ok: true, id });
});

/** 3c. Delete a submission */
app.delete('/api/submissions/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  db.prepare('DELETE FROM submissions WHERE id = ?').run(id);
  res.json({ ok: true, id });
});

/** 4. Bulk import submissions from CSV */
app.post('/api/submissions/import', (req, res) => {
  if (!Array.isArray(req.body)) return res.status(400).json({ error: 'Expected array' });
  const importAll = db.transaction((rows) => {
    db.prepare('DELETE FROM submissions').run();
    rows.forEach((row, i) => {
      INSERT_SUBMISSION.run(rowToRecord(row, i));
    });
  });
  importAll(req.body);
  res.json({ ok: true, count: req.body.length });
});

/** 4b. Clear all submissions (Reset to 0) */
app.post('/api/submissions/clear', (_req, res) => {
  db.prepare('DELETE FROM submissions').run();
  db.prepare('DELETE FROM warning_acknowledgments').run();
  res.json({ ok: true });
});

/** 5. Get all warning acknowledgments / notes */
app.get('/api/acknowledgments', (_req, res) => {
  const acks = db.prepare(`
    SELECT id, unity_id as unityID, warning_type as warningType, 
           event_timestamp as eventTimestamp, record_id as recordId,
           acknowledged_at as acknowledgedAt, admin_note as adminNote 
    FROM warning_acknowledgments 
    ORDER BY id DESC
  `).all();
  res.json(acks);
});

/** 6. Acknowledge / Handle a warning */
app.post('/api/acknowledgments', (req, res) => {
  const { unityID, warningType, eventTimestamp, recordId, adminNote } = req.body;
  if (!unityID || !warningType) {
    return res.status(400).json({ error: 'unityID and warningType required' });
  }
  const now = new Date().toISOString();
  const parsedRecordId = recordId ? parseInt(recordId, 10) : null;
  const info = db.prepare(`
    INSERT INTO warning_acknowledgments (unity_id, warning_type, event_timestamp, record_id, acknowledged_at, admin_note)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(unityID.toLowerCase().trim(), warningType.trim(), eventTimestamp || '', parsedRecordId, now, adminNote || '');
  res.status(201).json({ ok: true, id: info.lastInsertRowid, unityID, warningType, eventTimestamp, recordId: parsedRecordId, acknowledgedAt: now, adminNote });
});

/** 7. Update an acknowledgment note */
app.put('/api/acknowledgments/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { adminNote } = req.body;
  db.prepare('UPDATE warning_acknowledgments SET admin_note = ? WHERE id = ?').run(adminNote || '', id);
  res.json({ ok: true, id, adminNote });
});

/** 8. Delete / Unacknowledge a warning */
app.delete('/api/acknowledgments/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  db.prepare('DELETE FROM warning_acknowledgments WHERE id = ?').run(id);
  res.json({ ok: true, id });
});

/** 8b. Quick delete / Undo by unityID and warningType */
app.delete('/api/acknowledgments', (req, res) => {
  const { unityID, warningType, id } = req.body || {};
  if (id) {
    db.prepare('DELETE FROM warning_acknowledgments WHERE id = ?').run(id);
  } else if (unityID && warningType) {
    db.prepare(`
      DELETE FROM warning_acknowledgments 
      WHERE id = (SELECT id FROM warning_acknowledgments WHERE unity_id = ? AND warning_type = ? ORDER BY id DESC LIMIT 1)
    `).run(unityID.toLowerCase().trim(), warningType.trim());
  }
  res.json({ ok: true });
});

const PORT = 3001;
app.listen(PORT, () => console.log(`IAA API running on http://localhost:${PORT}`));

