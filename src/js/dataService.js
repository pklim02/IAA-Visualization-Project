import Papa from 'papaparse';

export function normalizeCompanyName(raw) {
  if (!raw) return '';
  let comp = raw.split(',')[0].trim();
  comp = comp.replace(/[.;]+$/, '').trim();
  return comp;
}

export function getWarningLabel(type) {
  switch (type) {
    case 'withdraw_check': return 'Withdrawal Check (Post-Acceptance)';
    case 'meeting_wanted': return 'Meeting Wanted';
    case 'screening_polish': return 'Screening Polish (>2 Screenings)';
    case 'stalled': return 'Stalled (30+ Days)';
    default: return type;
  }
}

class DataService {
  constructor() {
    this.students = [];      // Array of student objects
    this.submissions = [];   // Array of raw CSV rows
    this.acknowledgments = []; // Array of { unityID, warningType, acknowledgedAt }
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
    // 1. Fetch roster, submissions, and warning acknowledgments in parallel
    const [stuRes, subRes, ackRes] = await Promise.all([
      fetch('/api/students'),
      fetch('/api/submissions'),
      fetch('/api/acknowledgments')
    ]);
    const stuList = stuRes.ok ? await stuRes.json() : [];
    this.submissions = subRes.ok ? await subRes.json() : [];
    this.acknowledgments = ackRes.ok ? await ackRes.json() : [];

    // Real-time clock of the current moment accessing the application
    const now = new Date();

    // 3. Link submissions to each student using purely discrete counts and deterministic attention rules
    this.students = stuList.map(stu => {
      const email = (stu.email || '').toLowerCase().trim();
      const studentRows = this.submissions.filter(r => (r['Email Address'] || '').toLowerCase().trim() === email);
      const studentAcks = this.acknowledgments.filter(a => (a.unityID || '').toLowerCase() === (stu.unityID || '').toLowerCase());

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
          if (tb !== ta) return tb - ta;
          return (b._dbId || 0) - (a._dbId || 0);
        });
        const latestRow = sortedRows[0];
        const wantsMeeting = (latestRow['Do you want to meet with career services to discuss further?:'] || latestRow['Do you want to meet with career services to discuss further?'] || '').trim();
        if (wantsMeeting.toLowerCase().startsWith('yes')) {
          const occurredAt = latestRow['Timestamp'] || '';
          const occurredTime = occurredAt ? new Date(occurredAt).getTime() : Date.now();
          const recordId = latestRow._dbId || null;
          flags.push({ type: 'meeting_wanted', label: 'Meeting Wanted', level: 'urgent', occurredAt, occurredTime, recordId });
        }
      }

      if (isPlaced) {
        // PLACED CANDIDATE LOGIC: Exempt from coaching, inactivity, and offer delays
        const acceptDate = acceptance['Timestamp'] ? new Date(acceptance['Timestamp']).getTime() : 0;
        const acceptDbId = acceptance._dbId || 0;

        // Check if candidate is still actively logging interviews after acceptance
        const postAcceptInterviews = interviews.filter(r => {
          const rDate = r['Timestamp'] ? new Date(r['Timestamp']).getTime() : 0;
          const rDbId = r._dbId || 0;
          const isDateAfter = acceptDate > 0 && rDate > acceptDate;
          const isDbAfter = acceptDbId > 0 && rDbId > acceptDbId;
          return isDateAfter || isDbAfter;
        }).sort((a, b) => {
          const ta = a['Timestamp'] ? new Date(a['Timestamp']).getTime() : 0;
          const tb = b['Timestamp'] ? new Date(b['Timestamp']).getTime() : 0;
          if (tb !== ta) return tb - ta;
          return (b._dbId || 0) - (a._dbId || 0);
        });

        if (postAcceptInterviews.length > 0) {
          const latest = postAcceptInterviews[0];
          const occurredAt = latest['Timestamp'] || '';
          const occurredTime = occurredAt ? new Date(occurredAt).getTime() : Date.now();
          const recordId = latest._dbId || null;
          flags.push({ type: 'withdraw_check', label: 'Withdrawal Check (Post-Acceptance)', level: 'warning', occurredAt, occurredTime, recordId });
        }
      } else {
        // ACTIVE / SEEKING CANDIDATE LOGIC
        // Rule 2: Screening Polish (> 2 distinct company screenings and 0 advanced rounds)
        const companyPipelines = new Map();

        for (const r of interviews) {
          const rawComp = r['Please list the company, position, department/division. '] || r['Please list the company, position, department/division.'] || '';
          const cleanComp = normalizeCompanyName(rawComp);
          if (!cleanComp) continue;
          const key = cleanComp.toLowerCase();

          const stage = (r['Which interview was this? '] || r['Which interview was this?'] || '').toLowerCase();
          const isScreening = stage.includes('screen');
          const isAdvanced = /second|final/i.test(stage);
          const ts = r['Timestamp'] ? new Date(r['Timestamp']).getTime() : 0;
          const tsStr = r['Timestamp'] || '';

          if (!companyPipelines.has(key)) {
            companyPipelines.set(key, { companyName: cleanComp, hasScreening: false, hasAdvanced: false, latestTs: 0, latestTsStr: '', latestRecordId: null });
          }
          const pipe = companyPipelines.get(key);
          if (isScreening) {
            pipe.hasScreening = true;
            if (ts >= pipe.latestTs) {
              pipe.latestRecordId = r._dbId || null;
            }
          }
          if (isAdvanced) pipe.hasAdvanced = true;
          if (ts >= pipe.latestTs) {
            pipe.latestTs = ts;
            pipe.latestTsStr = tsStr;
          }
        }

        // Also check offers: an offer from that company counts as advanced
        for (const r of offers) {
          const rawComp = r['Please list the company and job title'] || '';
          const cleanComp = normalizeCompanyName(rawComp);
          if (!cleanComp) continue;
          const key = cleanComp.toLowerCase();
          if (companyPipelines.has(key)) {
            companyPipelines.get(key).hasAdvanced = true;
          }
        }

        const screenedCompanies = Array.from(companyPipelines.values()).filter(p => p.hasScreening);
        const advancedScreenedCompanies = screenedCompanies.filter(p => p.hasAdvanced);

        if (screenedCompanies.length > 2 && advancedScreenedCompanies.length === 0) {
          screenedCompanies.sort((a, b) => b.latestTs - a.latestTs);
          const latest = screenedCompanies[0];
          const occurredAt = latest.latestTsStr || '';
          const occurredTime = latest.latestTs || 0;
          const recordId = latest.latestRecordId || null;
          flags.push({
            type: 'screening_polish',
            label: 'Screening Polish (>2 Screenings)',
            level: 'warning',
            occurredAt,
            occurredTime,
            recordId
          });
        }

        // Rule 3: Inactive / Stalled (0 activity in past 30 days)
        if (this.submissions.length > 0) {
          if (studentRows.length === 0) {
            flags.push({ type: 'stalled', label: 'Stalled (30+ Days)', level: 'muted', occurredAt: 'Cohort Inception', occurredTime: 0, recordId: null });
          } else if (latestStudentTs > 0) {
            const sortedStudentRows = [...studentRows].sort((a, b) => {
              const ta = a['Timestamp'] ? new Date(a['Timestamp']).getTime() : 0;
              const tb = b['Timestamp'] ? new Date(b['Timestamp']).getTime() : 0;
              return tb - ta;
            });
            const latestStudentRow = sortedStudentRows[0];
            const daysSinceActivity = (now.getTime() - latestStudentTs) / (1000 * 60 * 60 * 24);
            if (daysSinceActivity > 30) {
              flags.push({ 
                type: 'stalled', 
                label: 'Stalled (30+ Days)', 
                level: 'muted', 
                occurredAt: new Date(latestStudentTs).toLocaleDateString(), 
                occurredTime: latestStudentTs,
                recordId: latestStudentRow?._dbId || null
              });
            }
          }
        }
      }

      // Filter flags: An event is considered active if NO acknowledgment exists that covers it.
      const activeFlags = [];
      for (const flag of flags) {
        const isCovered = studentAcks.some(a => {
          if (a.warningType !== flag.type) return false;

          // 1. Stalled: Check-in covers inactivity for up to 30 days following the check-in
          if (flag.type === 'stalled') {
            const ackTime = a.acknowledgedAt ? new Date(a.acknowledgedAt).getTime() : 0;
            const daysSinceCheckin = (now.getTime() - ackTime) / (1000 * 60 * 60 * 24);
            if (daysSinceCheckin <= 30 && (!flag.occurredTime || ackTime >= flag.occurredTime)) {
              return true;
            }
            return false;
          }

          // 2. Submission-driven flags (withdraw_check, meeting_wanted, screening_polish):
          // If recordId is available, covered only if acknowledgment was recorded for THIS record or a NEWER record
          if (a.recordId && flag.recordId) {
            return a.recordId >= flag.recordId;
          }

          // Fallback to timestamp comparison
          if (a.eventTimestamp && flag.occurredAt && a.eventTimestamp === flag.occurredAt) {
            return true;
          }
          if (a.eventTimestamp && flag.occurredTime) {
            const aTime = new Date(a.eventTimestamp).getTime();
            if (!isNaN(aTime) && aTime >= flag.occurredTime) {
              return true;
            }
          }

          return false;
        });
        if (!isCovered) {
          activeFlags.push(flag);
        }
      }

      // Handled flags log for this student (all historical interventions, newest first)
      const handledFlags = studentAcks.map(a => ({
        id: a.id,
        type: a.warningType,
        recordId: a.recordId || null,
        label: getWarningLabel(a.warningType),
        eventTimestamp: a.eventTimestamp || '',
        acknowledgedAt: a.acknowledgedAt || '',
        adminNote: a.adminNote || ''
      })).sort((a, b) => b.id - a.id);

      // Sort active flags by urgency priority: urgent > warning > info > muted
      const priorityOrder = { urgent: 1, warning: 2, info: 3, muted: 4 };
      activeFlags.sort((a, b) => (priorityOrder[a.level] || 99) - (priorityOrder[b.level] || 99));
      const primaryFlag = activeFlags.length > 0 ? activeFlags[0] : null;

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
        attentionFlags: activeFlags,
        handledFlags,
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
   * Update an existing submission row in SQLite
   */
  async updateSubmission(id, row) {
    const res = await fetch(`/api/submissions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(row)
    });
    if (!res.ok) throw new Error('Failed to update submission in SQLite');
    await this.fetchData();
    this.notify();
    return this.getData();
  }

  /**
   * Delete a single submission row from SQLite
   */
  async deleteSubmission(id) {
    const res = await fetch(`/api/submissions/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete submission from SQLite');
    await this.fetchData();
    this.notify();
    return this.getData();
  }

  /**
   * Clear all submissions from SQLite (reset to 0)
   */
  async clearAll() {
    const res = await fetch('/api/submissions/clear', { method: 'POST' });
    if (!res.ok) throw new Error('Failed to clear submissions in SQLite');
    this.submissions = [];
    this.acknowledgments = [];
    await this.fetchData();
    this.notify();
    return this.getData();
  }

  /**
   * Approach A: Acknowledge / Mark a warning as handled with event timestamp, optional record ID & coaching note
   */
  async acknowledgeWarning(unityID, warningType, eventTimestamp = '', adminNote = '', recordId = null) {
    const res = await fetch('/api/acknowledgments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unityID, warningType, eventTimestamp, adminNote, recordId })
    });
    if (!res.ok) throw new Error('Failed to acknowledge warning');
    await this.fetchData();
    this.notify();
    return this.getData();
  }

  /**
   * Update coaching note on an existing acknowledgment
   */
  async updateAcknowledgmentNote(id, adminNote) {
    const res = await fetch(`/api/acknowledgments/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminNote })
    });
    if (!res.ok) throw new Error('Failed to update acknowledgment note');
    await this.fetchData();
    this.notify();
    return this.getData();
  }

  /**
   * Delete a specific acknowledgment entry by id
   */
  async deleteAcknowledgment(id) {
    const res = await fetch(`/api/acknowledgments/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete acknowledgment');
    await this.fetchData();
    this.notify();
    return this.getData();
  }

  /**
   * Quick restore / undo latest warning by unityID & warningType
   */
  async unacknowledgeWarning(unityID, warningType) {
    const res = await fetch('/api/acknowledgments', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unityID, warningType })
    });
    if (!res.ok) throw new Error('Failed to restore warning');
    await this.fetchData();
    this.notify();
    return this.getData();
  }

  /**
   * Suggest previous companies/roles for autocomplete
   */
  getCompanySuggestions(unityID = null) {
    const studentCompSet = new Set();
    const globalCompSet = new Set();

    for (const r of this.submissions) {
      const email = (r['Email Address'] || '').toLowerCase().trim();
      const rawComp = r['Please list the company, position, department/division. '] 
        || r['Please list the company, position, department/division.'] 
        || r['Please list the company and job title'] 
        || r['Please list the company name and job title. '] 
        || r['Please list the company name and job title.'] 
        || '';
      const cleanComp = normalizeCompanyName(rawComp);
      if (!cleanComp) continue;

      if (unityID && email.startsWith(unityID.toLowerCase())) {
        studentCompSet.add(cleanComp);
      } else {
        globalCompSet.add(cleanComp);
      }
    }

    return {
      studentCompanies: Array.from(studentCompSet).sort(),
      globalCompanies: Array.from(globalCompSet).sort()
    };
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
      .sort((a, b) => b.count - a.count);

    const topSources = Object.entries(sourceTally)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Attention Queue Tallies
    const needsAttentionStudents = this.students.filter(s => s.attentionFlag !== null);

    return {
      students: this.students,
      submissions: this.submissions,
      acknowledgments: this.acknowledgments,
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
        screeningPolish: this.students.filter(s => s.attentionFlags.some(f => f.type === 'screening_polish')).length,
        stalled: this.students.filter(s => s.attentionFlags.some(f => f.type === 'stalled')).length,
        withdrawCheck: this.students.filter(s => s.attentionFlags.some(f => f.type === 'withdraw_check')).length
      }
    };
  }
}

export const dataService = new DataService();
