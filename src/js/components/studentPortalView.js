import { authService } from '../authService.js';
import { MetricsService } from '../metricsService.js';

/**
 * Renders the dedicated, personalized portal when logged in as an individual student.
 */
export function renderStudentPortal(container, data) {
  const user = authService.getUser();
  const student = data.students.find(s => s.unityID === user.unityID) || data.students[0];
  const kpis = MetricsService.getExecutiveKPIs(data);

  if (!student) {
    container.innerHTML = `<div style="padding: 3rem; text-align: center;">Student record not found.</div>`;
    return;
  }

  const allEvents = [...student.interviews, ...student.offers];
  if (student.acceptance) allEvents.push(student.acceptance);
  allEvents.sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));

  const stages = ['Screen', 'Round 1', 'Round 2', 'Final', 'Offer', 'Placed'];
  let filledCount = 0;
  if (student.status === 'Placed') filledCount = 6;
  else if (student.offersCount > 0) filledCount = 5;
  else if (student.finalRoundsCount > 0) filledCount = 4;
  else if (student.secondRoundsCount > 0) filledCount = 3;
  else if (student.firstRoundsCount > 0) filledCount = 2;
  else if (student.screensCount > 0) filledCount = 1;

  container.innerHTML = `
    <!-- Student Hero Greeting Banner (IAA Slate-Teal Theme) -->
    <div class="card" style="margin-bottom: 2rem; border: none; background: linear-gradient(135deg, var(--iaa-teal) 0%, var(--iaa-teal-dark) 100%); color: #FFFFFF; box-shadow: var(--shadow-md);">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1.5rem;">
        <div style="display: flex; align-items: center; gap: 1.25rem;">
          <img 
            src="${student.avatarUrl}" 
            alt="${student.name}" 
            class="student-avatar" 
            style="width: 72px; height: 72px; border: 3px solid #FFFFFF;"
            onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(student.name)}&background=375364&color=FFFFFF'"
          />
          <div>
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <h2 style="font-size: 1.6rem; font-weight: 800; color: #FFFFFF;">Welcome, ${student.name}</h2>
              <span class="badge ${student.status === 'Placed' ? 'badge-placed' : (student.status === 'Has Offer' ? 'badge-offer' : 'badge-interviewing')}">
                ${student.status}
              </span>
            </div>
            <p style="color: rgba(255, 255, 255, 0.88); font-size: 0.85rem; font-family: var(--font-mono); margin-top: 0.25rem;">
              UnityID: ${student.unityID} • ${student.email} • Class of 2027
            </p>
          </div>
        </div>

        <button id="btn-student-log-entry" class="btn btn-primary" style="padding: 0.75rem 1.35rem; font-size: 0.95rem;">
          <svg class="btn-icon" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
          </svg>
          Log My New Interview or Offer
        </button>
      </div>
    </div>

    <!-- Personal Funnel & Milestone Card -->
    <div class="card" style="margin-bottom: 2rem;">
      <div class="card-header">
        <div>
          <h3 class="card-title">My Recruitment Milestone Progress</h3>
          <p class="card-subtitle">Current progression through interview rounds, offers, and final employment acceptance</p>
        </div>
        <span class="badge badge-placed">${student.highestStage}</span>
      </div>

      <div class="mini-funnel" style="height: 10px; margin: 1rem 0;">
        ${stages.map((st, i) => `
          <div class="funnel-step ${i < filledCount ? (filledCount === 6 ? 'filled-green' : 'filled') : ''}" style="height: 10px;" title="${st}"></div>
        `).join('')}
      </div>

      <div style="display: flex; justify-content: space-between; font-size: 0.825rem; color: var(--text-muted); margin-top: 0.5rem;">
        <span>Recruiter Screen (${student.screensCount})</span>
        <span>Round 1 (${student.firstRoundsCount})</span>
        <span>Round 2 (${student.secondRoundsCount})</span>
        <span>Final Round (${student.finalRoundsCount})</span>
        <span>Job Offers (${student.offersCount})</span>
        <span>Placed (${student.acceptance ? 'Accepted' : 'Pending'})</span>
      </div>
    </div>

    ${student.acceptance ? `
      <!-- Accepted Employment Details -->
      <div class="card" style="margin-bottom: 2rem; border-color: rgba(16, 185, 129, 0.4); background: rgba(16, 185, 129, 0.05);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
          <div>
            <span class="badge badge-placed" style="margin-bottom: 0.5rem;">My Accepted Position</span>
            <h3 style="font-size: 1.4rem; font-weight: 800;">${student.acceptance.company}</h3>
            <p style="color: var(--text-secondary); font-size: 0.95rem;">${student.acceptance.role}</p>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 1.75rem; font-weight: 800; color: #10B981;">
              $${student.acceptance.compensation.total.toLocaleString()}
            </div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">First-Year Total Package</div>
          </div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; font-size: 0.85rem; border-top: 1px solid var(--border-subtle); padding-top: 1rem;">
          <div>Base Salary: <strong style="color: var(--text-primary);">$${student.acceptance.compensation.base.toLocaleString()}</strong></div>
          <div>Signing Bonus: <strong style="color: var(--text-primary);">$${student.acceptance.compensation.bonus.toLocaleString()}</strong></div>
          <div>Location: <strong style="color: var(--text-primary);">${student.acceptance.location || 'N/A'}</strong></div>
          <div>Work Mode: <strong style="color: var(--text-primary);">${student.acceptance.workingConditions || 'N/A'}</strong></div>
        </div>
      </div>
    ` : ''}

    <!-- Two Column: My Activity History & Cohort Benchmarks -->
    <div class="charts-grid-2col">
      <!-- Activity Timeline -->
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">My Activity History</h3>
            <p class="card-subtitle">${allEvents.length} submissions recorded on your record</p>
          </div>
        </div>
        ${allEvents.length === 0 ? `
          <div style="padding: 2.5rem; text-align: center; color: var(--text-muted);">
            No interviews or offers reported yet. Click "Log My New Interview or Offer" to submit your first entry!
          </div>
        ` : `
          <div class="timeline">
            ${allEvents.map((evt, idx) => `
              <div class="timeline-item">
                <div class="timeline-dot ${evt.reportType === 'Acceptance' ? 'dot-placed' : (evt.reportType === 'Offer' ? 'dot-offer' : '')}"></div>
                <div class="timeline-content">
                  <div class="timeline-header">
                    <span>${evt.timestamp || 'Recent'}</span>
                    <div style="display: flex; gap: 0.35rem; align-items: center;">
                      ${idx === 0 ? '<span class="badge badge-placed" style="font-size: 0.65rem; padding: 0.1rem 0.4rem;">Most Recent</span>' : ''}
                      <span class="badge ${evt.reportType === 'Acceptance' ? 'badge-placed' : (evt.reportType === 'Offer' ? 'badge-offer' : 'badge-interviewing')}">
                        ${evt.reportType} ${evt.stage ? `• ${evt.stage}` : ''}
                      </span>
                    </div>
                  </div>
                  <div class="timeline-title">${evt.company}</div>
                  <div class="timeline-desc">${evt.role || evt.department}</div>
                  ${evt.notes ? `<div class="timeline-feedback">"${evt.notes}"</div>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>

      <!-- Cohort Anonymous Benchmarks -->
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Class of 2027 Benchmarks</h3>
            <p class="card-subtitle">Cohort-wide recruitment statistics</p>
          </div>
        </div>
        <div style="display: flex; flex-direction: column; gap: 1.25rem;">
          <div class="formula-box">
            <div style="font-size: 0.8rem; color: var(--text-muted);">Cohort Placement Rate</div>
            <div style="font-size: 1.6rem; font-weight: 800; color: #10B981; margin: 0.2rem 0;">${kpis.placementRate}%</div>
            <div style="font-size: 0.775rem; color: var(--text-secondary);">${kpis.placedStudents} of ${kpis.totalStudents} classmates placed</div>
          </div>

          <div class="formula-box">
            <div style="font-size: 0.8rem; color: var(--text-muted);">Median First-Year Compensation</div>
            <div style="font-size: 1.6rem; font-weight: 800; color: #38BDF8; margin: 0.2rem 0;">$${kpis.medianComp.toLocaleString()}</div>
            <div style="font-size: 0.775rem; color: var(--text-secondary);">Salary range: $95,000 - $134,000 across reporting offers</div>
          </div>

          <div class="formula-box">
            <div style="font-size: 0.8rem; color: var(--text-muted);">Average Cohort Interviews</div>
            <div style="font-size: 1.6rem; font-weight: 800; color: #F59E0B; margin: 0.2rem 0;">${kpis.avgInterviewsPerStudent} rounds</div>
            <div style="font-size: 0.775rem; color: var(--text-secondary);">Your recorded interviews: <strong>${student.totalInterviews}</strong></div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Attach button click to open Google Form modal with prefilled student
  container.querySelector('#btn-student-log-entry')?.addEventListener('click', () => {
    const modalBtn = document.getElementById('btn-open-form');
    modalBtn?.click();
    const select = document.getElementById('form-student-select');
    if (select) {
      select.value = student.unityID;
    }
  });
}
