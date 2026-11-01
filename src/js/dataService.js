import Papa from 'papaparse';

class DataService {
  constructor() {
    this.students = [];      // Array of student objects
    this.submissions = [];   // Array of raw CSV rows
    this.listeners = [];
    this.isLoaded = false;
  }

  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  notify() {
    this.listeners.forEach(cb => cb(this.getData()));
  }

  async init() {
    await this.fetchData();
    this.isLoaded = true;
    this.notify();
    return this.getData();
  }

  async fetchData() {
    // 1. Fetch official student roster from SQLite
    const stuRes = await fetch('/api/students');
    const stuList = stuRes.ok ? await stuRes.json() : [];

    // 2. Fetch raw submissions from SQLite
    const subRes = await fetch('/api/submissions');
    this.submissions = subRes.ok ? await subRes.json() : [];

    // Real-time clock of the current moment accessing the application
    const now = new Date();

    // 3. Link submissions to each student using purely discrete counts and deterministic attention rules
    this.students = stuList.map(stu => {
      const email = (stu.email || '').toLowerCase().trim();
      const studentRows = this.submissions.filter(r => (r['Email Address'] || '').toLowerCase().trim() === email);

      const interviews = studentRows.filter(r => (r['What are you reporting today?'] || '').trim() === 'Interview');
      const offers = studentRows.filter(r => (r['What are you reporting today?'] || '').trim() === 'Offer');
      const acceptance = studentRows.find(r => (r['What are you reporting today?'] || '').trim() === 'Acceptance') || null;

      // Pure status determination
      let status = 'Seeking';
      if (acceptance) {
        status = 'Placed';
      } else if (offers.length > 0) {
        status = 'Has Offer';
      } else if (interviews.length > 0) {
        status = 'Interviewing';
      }

      // Attention / Problem Flag Evaluation
      const flags = [];
      const isPlaced = !!acceptance;

      // Find the true latest submission timestamp for this student
      let latestStudentTs = 0;
      for (const r of studentRows) {
        const t = r['Timestamp'] ? new Date(r['Timestamp']).getTime() : 0;
        if (!isNaN(t) && t > latestStudentTs) {
          latestStudentTs = t;
        }
      }

      // Rule 1: Meeting Requested on most recent submission (applies to all students)
      if (studentRows.length > 0) {
        const sortedRows = [...studentRows].sort((a, b) => {
          const ta = a['Timestamp'] ? new Date(a['Timestamp']).getTime() : 0;
          const tb = b['Timestamp'] ? new Date(b['Timestamp']).getTime() : 0;
          return tb - ta;
        });
        const latestRow = sortedRows[0];
        const wantsMeeting = (latestRow['Do you want to meet with career services to discuss further?:'] || latestRow['Do you want to meet with career services to discuss further?'] || '').trim();
        if (wantsMeeting.toLowerCase().startsWith('yes')) {
          flags.push({ type: 'meeting_wanted', label: 'Meeting Wanted', level: 'urgent' });
        }
      }

      if (isPlaced) {
        // PLACED CANDIDATE LOGIC: Exempt from coaching, inactivity, and offer delays
        const acceptDate = acceptance['Timestamp'] ? new Date(acceptance['Timestamp']).getTime() : 0;
        const acceptDbId = acceptance._dbId || 0;

        // Check if candidate is still actively logging interviews after acceptance
        const postAcceptInterviews = interviews.some(r => {
          const rDate = r['Timestamp'] ? new Date(r['Timestamp']).getTime() : 0;
          const rDbId = r._dbId || 0;
          const isDateAfter = acceptDate > 0 && rDate > acceptDate;
          const isDbAfter = acceptDbId > 0 && rDbId > acceptDbId;
          return isDateAfter || isDbAfter;
        });
        if (postAcceptInterviews) {
          flags.push({ type: 'withdraw_check', label: 'Withdrawal Check (Post-Acceptance)', level: 'warning' });
        }
      } else {
        // ACTIVE / SEEKING CANDIDATE LOGIC
        // Rule 2: Holding Offer > 4 Days without decision
        const hasStagnantOffer = offers.some(r => {
          const rDate = r['Timestamp'] ? new Date(r['Timestamp']).getTime() : 0;
          if (!rDate) return false;
          // Days elapsed from offer date to current real-time clock
          const daysHeld = (now.getTime() - rDate) / (1000 * 60 * 60 * 24);
          // If offer is held > 4 days in real time, flag it
          return daysHeld > 4;
        });
        if (hasStagnantOffer) {
          flags.push({ type: 'offer_decision', label: 'Decision Needed (>4d)', level: 'warning' });
        }

        // Rule 3: Multiple Active Offers (holding >= 2 concurrent offers)
        if (offers.length >= 2) {
          flags.push({ type: 'multi_offer', label: 'Multi-Offer Review', level: 'info' });
        }

        // Rule 4: Closing Support (> 2 Final Rounds and 0 Offers)
        const finalRoundsCount = interviews.filter(r => {
          const stage = r['Which interview was this? '] || r['Which interview was this?'] || '';
          return stage.toLowerCase().includes('final');
        }).length;
        if (finalRoundsCount > 2 && offers.length === 0) {
          flags.push({ type: 'closing_support', label: 'Closing Support (>2 Finals)', level: 'urgent' });
        }

        // Rule 5: Screening Drop-off (>= 4 screenings and 0 advanced rounds)
        const screeningCount = interviews.filter(r => {
          const stage = r['Which interview was this? '] || r['Which interview was this?'] || '';
          return stage.toLowerCase().includes('screen');
        }).length;
        const advancedCount = interviews.filter(r => {
          const stage = r['Which interview was this? '] || r['Which interview was this?'] || '';
          return /second|final/i.test(stage);
        }).length;
        if (screeningCount >= 4 && advancedCount === 0) {
          flags.push({ type: 'screening_polish', label: 'Screening Polish', level: 'warning' });
        }

        // Rule 6: Inactive / Stalled (0 activity in past 30 days)
        // Cross-references with the real-time clock of the current date:
        if (this.submissions.length > 0) {
          if (studentRows.length === 0) {
            flags.push({ type: 'stalled', label: 'Stalled (30+ Days)', level: 'muted' });
          } else if (latestStudentTs > 0) {
            const daysSinceActivity = (now.getTime() - latestStudentTs) / (1000 * 60 * 60 * 24);
            // If the activity occurred today or recently (<= 30 days), daysSinceActivity <= 30.
            // If the event was submitted today, daysSinceActivity is ~0 days (NOT stalled!).
            if (daysSinceActivity > 30) {
              flags.push({ type: 'stalled', label: 'Stalled (30+ Days)', level: 'muted' });
            }
          }
        }
      }

      // Sort flags by urgency priority: urgent > warning > info > muted
      const priorityOrder = { urgent: 1, warning: 2, info: 3, muted: 4 };
      flags.sort((a, b) => (priorityOrder[a.level] || 99) - (priorityOrder[b.level] || 99));
      const primaryFlag = flags.length > 0 ? flags[0] : null;

      return {
        unityID: stu.unityID,
        name: stu.name,
        email: stu.email,
        avatarUrl: stu.avatarUrl || `/data/avatars/${stu.unityID}.png`,
        status,
        interviewCount: interviews.length,
        offerCount: offers.length,
        isPlaced,
        acceptanceRecord: acceptance,
        attentionFlag: primaryFlag,
        attentionFlags: flags,
        history: studentRows // Keep full raw chronological rows
      };
    });
  }

  /**
   * Add a single new submission row into SQLite
   */
  async addSubmission(row) {
    const res = await fetch('/api/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(row)
    });
    if (!res.ok) throw new Error('Failed to save submission to SQLite');
    await this.fetchData();
    this.notify();
    return this.getData();
  }

  /**
   * Import CSV and persist directly into SQLite
   */
  async importCSV(file) {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          try {
            const res = await fetch('/api/submissions/import', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(results.data)
            });
            if (!res.ok) throw new Error('Failed to import into SQLite');
            await this.fetchData();
            this.notify();
            resolve(this.getData());
          } catch (err) {
            reject(err);
          }
        },
        error: (err) => reject(err)
      });
    });
  }

  /**
   * Clear all submissions from SQLite (reset to 0)
   */
  async clearAll() {
    const res = await fetch('/api/submissions/clear', { method: 'POST' });
    if (!res.ok) throw new Error('Failed to clear submissions in SQLite');
    this.submissions = [];
    await this.fetchData();
    this.notify();
    return this.getData();
  }

  getData() {
    const totalStudents = this.students.length;
    const placedCount = this.students.filter(s => s.status === 'Placed').length;
    const offerCount = this.students.filter(s => s.status === 'Has Offer').length;
    const interviewingCount = this.students.filter(s => s.status === 'Interviewing').length;
    const seekingCount = this.students.filter(s => s.status === 'Seeking').length;

    // Recruitment Pipeline Funnel Totals
    let screeningTotal = 0;
    let roundOneTwoTotal = 0;
    let finalRoundTotal = 0;
    let offersTotal = 0;
    let acceptanceTotal = 0;

    // Company & Source tallies
    const companyTally = {};
    const sourceTally = {};

    for (const r of this.submissions) {
      const type = (r['What are you reporting today?'] || '').trim();
      const stage = (r['Which interview was this? '] || r['Which interview was this?'] || '').toLowerCase();
      const source = (r['How did you hear about the job?'] || '').trim();

      if (type === 'Interview') {
        if (stage.includes('screen')) screeningTotal++;
        else if (stage.includes('final')) finalRoundTotal++;
        else roundOneTwoTotal++;

        if (source) {
          sourceTally[source] = (sourceTally[source] || 0) + 1;
        }
      } else if (type === 'Offer') {
        offersTotal++;
        const comp = (r['Please list the company and job title'] || '').split(',')[0].trim();
        if (comp) companyTally[comp] = (companyTally[comp] || 0) + 1;
      } else if (type === 'Acceptance') {
        acceptanceTotal++;
        const comp = (r['Please list the company name and job title. '] || r['Please list the company name and job title.'] || '').split(',')[0].trim();
        if (comp) companyTally[comp] = (companyTally[comp] || 0) + 1;
      }
    }

    const topCompanies = Object.entries(companyTally)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    const topSources = Object.entries(sourceTally)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Attention Queue Tallies
    const needsAttentionStudents = this.students.filter(s => s.attentionFlag !== null);

    return {
      students: this.students,
      totalSubmissions: this.submissions.length,
      totalStudents,
      placedCount,
      offerCount,
      interviewingCount,
      seekingCount,
      placedRate: totalStudents > 0 ? Math.round((placedCount / totalStudents) * 100) : 0,
      funnel: {
        screening: screeningTotal,
        roundOneTwo: roundOneTwoTotal,
        finalRound: finalRoundTotal,
        offers: offersTotal,
        acceptance: acceptanceTotal
      },
      topCompanies,
      topSources,
      attention: {
        totalNeedsAttention: needsAttentionStudents.length,
        meetingWanted: this.students.filter(s => s.attentionFlags.some(f => f.type === 'meeting_wanted')).length,
        offerImpending: this.students.filter(s => s.attentionFlags.some(f => f.type === 'offer_decision')).length,
        multiOffer: this.students.filter(s => s.attentionFlags.some(f => f.type === 'multi_offer')).length,
        closingSupport: this.students.filter(s => s.attentionFlags.some(f => f.type === 'closing_support')).length,
        screeningPolish: this.students.filter(s => s.attentionFlags.some(f => f.type === 'screening_polish')).length,
        stalled: this.students.filter(s => s.attentionFlags.some(f => f.type === 'stalled')).length,
        withdrawCheck: this.students.filter(s => s.attentionFlags.some(f => f.type === 'withdraw_check')).length
      }
    };
  }
}

export const dataService = new DataService();
