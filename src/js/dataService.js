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

    // 3. Link submissions to each student using purely discrete counts (zero regex, zero parsing)
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

      return {
        unityID: stu.unityID,
        name: stu.name,
        email: stu.email,
        avatarUrl: stu.avatarUrl || `/data/avatars/${stu.unityID}.png`,
        status,
        interviewCount: interviews.length,
        offerCount: offers.length,
        isPlaced: !!acceptance,
        acceptanceRecord: acceptance,
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
    return {
      students: this.students,
      totalSubmissions: this.submissions.length,
      placedCount: this.students.filter(s => s.status === 'Placed').length,
      offerCount: this.students.filter(s => s.status === 'Has Offer').length,
      interviewingCount: this.students.filter(s => s.status === 'Interviewing').length,
      seekingCount: this.students.filter(s => s.status === 'Seeking').length
    };
  }
}

export const dataService = new DataService();
