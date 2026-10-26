import { openStudentDrawer } from './studentDirectory.js';

export function renderSupportRadar(container, data) {
  const flagged = data.flaggedStudents;

  // Categorize
  const stalledEarly = flagged.filter(s => s.supportFlags.some(f => f.type === 'stalled_early'));
  const meetingRequests = flagged.filter(s => s.supportFlags.some(f => f.type === 'meeting_requested'));
  const finalStalled = flagged.filter(s => s.supportFlags.some(f => f.type === 'final_round_plateau'));
  const inactive = flagged.filter(s => s.supportFlags.some(f => f.type === 'inactive'));

  container.innerHTML = `
    <div class="section-header">
      <div>
        <h2 class="section-title">Career Services Support & Coaching Radar</h2>
        <p class="section-desc">Automated detection of candidates encountering recruitment barriers or requesting personalized coaching</p>
      </div>
      <span class="badge badge-coaching">${flagged.length} Candidates Needing Intervention</span>
    </div>

    <!-- Support KPI Cards -->
    <div class="kpi-grid">
      <div class="kpi-card accent-red">
        <div class="kpi-label">Early-Round Stalls</div>
        <div class="kpi-value">${stalledEarly.length}</div>
        <div class="kpi-subtext">3+ screens without advancing to final round</div>
      </div>

      <div class="kpi-card accent-amber">
        <div class="kpi-label">Meeting Requests Pending</div>
        <div class="kpi-value">${meetingRequests.length}</div>
        <div class="kpi-subtext">Requested Career Services consultation in form</div>
      </div>

      <div class="kpi-card accent-blue">
        <div class="kpi-label">Final Round Conversion Gaps</div>
        <div class="kpi-value">${finalStalled.length}</div>
        <div class="kpi-subtext">2+ final rounds without offer closure</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-label">Low Activity / Passive</div>
        <div class="kpi-value">${inactive.length}</div>
        <div class="kpi-subtext">Zero interview submissions recorded</div>
      </div>
    </div>

    <!-- Actionable Coaching Roster Table -->
    <div class="card">
      <div class="card-header">
        <div>
          <h3 class="card-title">Candidate Triage Queue</h3>
          <p class="card-subtitle">Prioritized roster for targeted mock interviews, pitch review, and resume coaching</p>
        </div>
        <div class="filter-group">
          <label for="radar-filter-select" class="filter-label">Filter Category:</label>
          <select id="radar-filter-select" class="select-control">
            <option value="ALL">All Flagged Candidates (${flagged.length})</option>
            <option value="stalled_early">Stalled in Early Rounds (${stalledEarly.length})</option>
            <option value="meeting_requested">Requested Meetings (${meetingRequests.length})</option>
            <option value="final_round_plateau">Final Round Gaps (${finalStalled.length})</option>
            <option value="inactive">Zero Activity (${inactive.length})</option>
          </select>
        </div>
      </div>

      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Candidate</th>
              <th>Status</th>
              <th>Flag Category</th>
              <th>Interview Activity Breakdown</th>
              <th>Diagnostic Reason</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody id="radar-table-body"></tbody>
        </table>
      </div>
    </div>
  `;

  function renderTableRows(filterType = 'ALL') {
    const tbody = document.getElementById('radar-table-body');
    if (!tbody) return;

    const filtered = flagged.filter(s => {
      if (filterType === 'ALL') return true;
      return s.supportFlags.some(f => f.type === filterType);
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">
            No candidates matching this specific coaching flag category.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(student => {
      const primaryFlag = student.supportFlags[0];
      const severityClass = primaryFlag.severity === 'high' ? 'badge-alert' : 'badge-offer';

      return `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <img 
                src="${student.avatarUrl}" 
                alt="${student.name}" 
                class="student-avatar" 
                style="width: 38px; height: 38px;"
                onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(student.name)}&background=1E293B&color=F8FAFC'"
              />
              <div>
                <div style="font-weight: 600;">${student.name}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted); font-family: var(--font-mono);">${student.unityID}</div>
              </div>
            </div>
          </td>
          <td><span class="badge ${student.status === 'Interviewing' ? 'badge-interviewing' : 'badge-seeking'}">${student.status}</span></td>
          <td><span class="badge ${severityClass}">${primaryFlag.label}</span></td>
          <td style="font-size: 0.8rem; color: var(--text-secondary);">
            ${student.screensCount} screens • ${student.firstRoundsCount} 1st • ${student.finalRoundsCount} finals
          </td>
          <td style="font-size: 0.8rem; max-width: 320px; color: var(--text-secondary);">
            ${primaryFlag.reason}
          </td>
          <td>
            <button class="btn btn-secondary btn-radar-review" data-unity="${student.unityID}" style="padding: 0.35rem 0.75rem; font-size: 0.75rem;">
              Review Dossier
            </button>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.btn-radar-review').forEach(btn => {
      btn.addEventListener('click', () => {
        const unity = btn.getAttribute('data-unity');
        const student = data.students.find(s => s.unityID === unity);
        if (student) openStudentDrawer(student);
      });
    });
  }

  const select = document.getElementById('radar-filter-select');
  select?.addEventListener('change', (e) => {
    renderTableRows(e.target.value);
  });

  renderTableRows('ALL');
}
