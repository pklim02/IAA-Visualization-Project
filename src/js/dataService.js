import Papa from 'papaparse';

/**
 * Parses compensation string into numeric base, bonus, and total first-year compensation.
 * Handles patterns such as:
 * - "$122,500 base salary, $5,000 signing bonus"
 * - "$97,000 base salary, no bonus"
 * - "$108,000 base salary, $3,000 relocation"
 * - "$122,000 base salary, 5% annual performance bonus"
 */
export function parseCompensation(str) {
  if (!str) return { base: 0, bonus: 0, total: 0, raw: '' };

  let base = 0;
  let bonus = 0;

  // Extract base salary ($xxx,xxx)
  const baseMatch = str.match(/\$([0-9,]+)\s*(?:base|salary)?/i);
  if (baseMatch) {
    base = parseInt(baseMatch[1].replace(/,/g, ''), 10) || 0;
  }

  // Extract lump sum bonus / relocation ($x,xxx)
  const bonusMatch = str.match(/\$([0-9,]+)\s*(?:signing bonus|relocation|bonus|sign on)/i);
  if (bonusMatch) {
    bonus = parseInt(bonusMatch[1].replace(/,/g, ''), 10) || 0;
  } else {
    // Check percentage bonus (e.g. 10% annual performance bonus)
    const pctMatch = str.match(/([0-9.]+)%\s*(?:annual\s*)?(?:performance\s*)?bonus/i);
    if (pctMatch && base > 0) {
      const pct = parseFloat(pctMatch[1]);
      bonus = Math.round(base * (pct / 100));
    }
  }

  return {
    base,
    bonus,
    total: base + bonus,
    raw: str.trim()
  };
}

/**
 * Normalizes company and job title from various form fields.
 */
export function parseCompanyRole(row) {
  const rawText = 
    row['Please list the company, position, department/division. '] ||
    row['Please list the company and job title'] ||
    row['Please list the company name and job title. '] ||
    '';

  const parts = rawText.split(',').map(s => s.trim()).filter(Boolean);
  const company = parts[0] || 'Unspecified Employer';
  const role = parts[1] || 'Analytics Specialist';
  const department = parts[2] || 'Analytics & Insights';

  return { company, role, department, rawText };
}

class DataService {
  constructor() {
    this.students = new Map(); // UnityID -> Student Object
    this.roster = [];
    this.rawTracker = [];
    this.subscribers = [];
    this.isLoaded = false;
  }

  /**
   * Subscribe to dataset change events (e.g. new form submission or CSV reload).
   */
  subscribe(fn) {
    this.subscribers.push(fn);
    return () => {
      this.subscribers = this.subscribers.filter(sub => sub !== fn);
    };
  }

  notify() {
    const data = this.getData();
    this.subscribers.forEach(fn => fn(data));
  }

  /**
   * Loads both CSV datasets from the public static assets.
   */
  async init() {
    const [rosterRes, trackerRes] = await Promise.all([
      fetch('/data/student_roster.csv'),
      fetch('/data/employment_tracker_synthetic.csv')
    ]);

    const rosterText = await rosterRes.text();
    const trackerText = await trackerRes.text();

    const rosterParsed = Papa.parse(rosterText, { header: true, skipEmptyLines: true });
    const trackerParsed = Papa.parse(trackerText, { header: true, skipEmptyLines: true });

    this.roster = rosterParsed.data;
    this.rawTracker = trackerParsed.data;

    this.processData();
    this.isLoaded = true;
    this.notify();
    return this.getData();
  }

  /**
   * Ingest a user-uploaded CSV file.
   */
  async importTrackerCSV(file) {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          this.rawTracker = results.data;
          this.processData();
          this.notify();
          resolve(this.getData());
        },
        error: (err) => reject(err)
      });
    });
  }

  /**
   * Add a new live response submitted via the Google Form Simulator.
   */
  addSubmission(entry) {
    this.rawTracker.unshift(entry);
    this.processData();
    this.notify();
  }

  /**
   * Normalizes roster, maps avatar images, joins submissions,
   * and computes student-level metrics.
   */
  processData() {
    this.students.clear();

    // 1. Initialize all roster students
    this.roster.forEach(item => {
      const name = (item['Last, First Name'] || '').trim();
      const unityID = (item['UnityID'] || '').trim().toLowerCase();
      if (!unityID) return;

      this.students.set(unityID, {
        unityID,
        name,
        email: `${unityID}@ncsu.edu`,
        avatarUrl: `/data/avatars/${unityID}.png`,
        status: 'Seeking', // Seeking | Interviewing | Has Offer | Placed
        interviews: [],
        offers: [],
        acceptance: null,
        totalInterviews: 0,
        screensCount: 0,
        firstRoundsCount: 0,
        secondRoundsCount: 0,
        finalRoundsCount: 0,
        offersCount: 0,
        highestStage: 'None',
        supportFlags: [],
        meetingRequested: false,
        lastActivityDate: null
      });
    });

    // 2. Map submissions to students
    this.rawTracker.forEach(row => {
      const email = (row['Email Address'] || '').trim().toLowerCase();
      const unityID = email.split('@')[0];
      const student = this.students.get(unityID);

      const reportType = (row['What are you reporting today?'] || '').trim();
      const timestamp = (row['Timestamp'] || '').trim();
      const date = timestamp ? new Date(timestamp) : new Date();

      const { company, role, department } = parseCompanyRole(row);
      const stage = (row['Which interview was this? '] || '').trim();
      const source = (row['How did you hear about the job?'] || '').trim() || 'Unspecified';
      const notes = (row['Were there any technical concepts or questions that were challenging or new to you? '] || '').trim();
      const wantsMeeting = (row['Do you want to meet with career services to discuss further?:'] || '').trim().toLowerCase() === 'yes';
      const compStr = row['What is the final offer? Please break down by salary and bonuses.'] || '';
      const compensation = parseCompensation(compStr);
      const location = (row['Where is the job located (city/state)? '] || '').trim();
      const workingConditions = (row['What are the working conditions? '] || '').trim();

      const record = {
        timestamp,
        date,
        reportType,
        company,
        role,
        department,
        stage,
        source,
        notes,
        wantsMeeting,
        compensation,
        location,
        workingConditions,
        raw: row
      };

      if (student) {
        if (!student.lastActivityDate || date > student.lastActivityDate) {
          student.lastActivityDate = date;
        }

        if (wantsMeeting) {
          student.meetingRequested = true;
        }

        if (reportType === 'Interview') {
          student.interviews.push(record);
          student.totalInterviews += 1;

          if (stage === 'Recruiter Screening') student.screensCount += 1;
          else if (stage === 'First Round') student.firstRoundsCount += 1;
          else if (stage === 'Second Round') student.secondRoundsCount += 1;
          else if (stage === 'Final Round') student.finalRoundsCount += 1;
        } else if (reportType === 'Offer') {
          student.offers.push(record);
          student.offersCount += 1;
        } else if (reportType === 'Acceptance') {
          student.acceptance = record;
        }
      }
    });

    // 3. Compute student statuses and support intervention flags
    this.students.forEach(student => {
      // Determine overall status
      if (student.acceptance) {
        student.status = 'Placed';
        student.highestStage = 'Offer Accepted';
      } else if (student.offersCount > 0) {
        student.status = 'Has Offer';
        student.highestStage = 'Job Offer Received';
      } else if (student.totalInterviews > 0) {
        student.status = 'Interviewing';
        if (student.finalRoundsCount > 0) student.highestStage = 'Final Round';
        else if (student.secondRoundsCount > 0) student.highestStage = 'Second Round';
        else if (student.firstRoundsCount > 0) student.highestStage = 'First Round';
        else student.highestStage = 'Recruiter Screen';
      } else {
        student.status = 'Seeking';
        student.highestStage = 'No Interviews Yet';
      }

      // Determine early-intervention flags for active (unplaced) candidates (PDF Goal 3)
      const flags = [];

      if (!student.acceptance) {
        // Flag 1: 3 or more recruiter screens / early rounds without reaching final round or offer
        const earlyRounds = student.screensCount + student.firstRoundsCount;
        if (student.offersCount === 0 && student.finalRoundsCount === 0 && earlyRounds >= 3) {
          flags.push({
            type: 'stalled_early',
            severity: 'high',
            label: 'Stalled in Early Rounds',
            reason: `${earlyRounds} early interviews without advancing to final round. Recommended: behavioral & pitch coaching.`
          });
        }

        // Flag 2: Student explicitly requested to meet with career services on active offers
        if (student.meetingRequested) {
          flags.push({
            type: 'meeting_requested',
            severity: 'medium',
            label: 'Coaching Requested',
            reason: 'Student checked "Yes" to meet with Career Services regarding offer evaluation or negotiation.'
          });
        }

        // Flag 3: Completed final round interviews but zero offers received
        if (student.offersCount === 0 && student.finalRoundsCount >= 2) {
          flags.push({
            type: 'final_round_plateau',
            severity: 'high',
            label: 'Final Round Conversion Gap',
            reason: `${student.finalRoundsCount} final round interviews without an offer yet. Recommended: technical debrief & closing prep.`
          });
        }

        // Flag 4: Zero interviews reported (passive / low activity)
        if (student.totalInterviews === 0) {
          flags.push({
            type: 'inactive',
            severity: 'low',
            label: 'Zero Activity Logged',
            reason: 'No interviews or applications recorded yet. Recommended: check-in on resume and pipeline.'
          });
        }
      }

      student.supportFlags = flags;
    });
  }

  /**
   * Returns complete processed snapshot.
   */
  getData() {
    const studentList = Array.from(this.students.values());
    return {
      students: studentList,
      rawTracker: this.rawTracker,
      totalStudents: studentList.length,
      placedCount: studentList.filter(s => s.status === 'Placed').length,
      offersCount: studentList.filter(s => s.status === 'Has Offer' || s.status === 'Placed').length,
      interviewingCount: studentList.filter(s => s.status === 'Interviewing').length,
      seekingCount: studentList.filter(s => s.status === 'Seeking').length,
      flaggedStudents: studentList.filter(s => s.supportFlags.length > 0)
    };
  }
}

export const dataService = new DataService();
