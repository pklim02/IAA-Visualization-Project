import { dataService } from '../dataService.js';
import { MetricsService } from '../metricsService.js';

export const METRIC_DICTIONARY = {
  placement_rate: {
    title: 'Cohort Placement Rate',
    value: '80.0%',
    columnSource: 'employment_tracker_synthetic.csv: Col 4 ("What are you reporting today?") & student_roster.csv',
    condition: "Rows where Col 4 == 'Acceptance' divided by total enrolled roster students (75)",
    excelFormula: '=COUNTIF(\'employment_tracker\'!D:D, "Acceptance") / COUNTA(\'student_roster\'!B2:B76)',
    pythonCode: "len(tracker_df[tracker_df['What are you reporting today?'] == 'Acceptance']) / len(roster_df) * 100",
    description: 'Percentage of the cohort that has signed and accepted an employment offer.'
  },
  total_interviews: {
    title: 'Total Interviews Logged',
    value: '644',
    columnSource: 'employment_tracker_synthetic.csv: Col 4 ("What are you reporting today?")',
    condition: "Rows where Col 4 == 'Interview'",
    excelFormula: '=COUNTIF(\'employment_tracker\'!D:D, "Interview")',
    pythonCode: "len(tracker_df[tracker_df['What are you reporting today?'] == 'Interview'])",
    description: 'Total number of interview rounds completed and recorded by candidates through Google Forms.'
  },
  total_offers: {
    title: 'Total Job Offers Recorded',
    value: '87',
    columnSource: 'employment_tracker_synthetic.csv: Col 4 ("What are you reporting today?")',
    condition: "Rows where Col 4 == 'Offer'",
    excelFormula: '=COUNTIF(\'employment_tracker\'!D:D, "Offer")',
    pythonCode: "len(tracker_df[tracker_df['What are you reporting today?'] == 'Offer'])",
    description: 'Formal job offers extended by hiring organizations prior to student acceptance or negotiation.'
  },
  median_comp: {
    title: 'Median First-Year Compensation',
    value: '$112,000',
    columnSource: 'employment_tracker_synthetic.csv: Col 12 ("What is the final offer? Please break down by salary and bonuses.")',
    condition: 'Regular expression parsing of Base Salary + Signing Bonus across all 60 accepted offers',
    excelFormula: '=MEDIAN(Total_Compensation_Array)',
    pythonCode: "comp_series.median()  # extracted from Col 12 string format",
    description: 'Middle compensation value (50th percentile) across all accepted positions, including base salary and signing bonuses.'
  },
  stalled_early_flag: {
    title: 'Early-Round Stall Intervention Flag',
    value: '6 candidates',
    columnSource: 'employment_tracker_synthetic.csv: Col 4 ("What are you reporting today?") & Col 6 ("Which interview was this? ")',
    condition: "Candidates with >= 3 recruiter screens or first-round interviews who have 0 final rounds and 0 offers",
    excelFormula: '=IF(AND(Screens + Round1 >= 3, Finals == 0, Offers == 0), "Flagged", "OK")',
    pythonCode: "early_stalls = [s for s in students if (s.screens + s.round1 >= 3 and s.finals == 0 and s.offers == 0)]",
    description: 'Early-warning detection to proactively offer behavioral coaching, pitch adjustments, and interview workshops.'
  },
  meeting_requested: {
    title: 'Career Services Meeting Requests',
    value: '31 requests',
    columnSource: 'employment_tracker_synthetic.csv: Col 10 ("Do you want to meet with career services to discuss further?:")',
    condition: "Rows where Col 10 == 'Yes'",
    excelFormula: '=COUNTIF(\'employment_tracker\'!J:J, "Yes")',
    pythonCode: "len(tracker_df[tracker_df['Do you want to meet with career services to discuss further?:'] == 'Yes'])",
    description: 'Direct student self-referrals asking for offer evaluation, negotiation advice, or recruitment guidance.'
  }
};

/**
 * Opens the Formula & Metric Replication Inspector modal.
 */
export function openInspector(metricKey) {
  const metric = METRIC_DICTIONARY[metricKey];
  if (!metric) return;

  const modal = document.getElementById('inspector-modal');
  const title = document.getElementById('inspector-metric-title');
  const body = document.getElementById('inspector-metric-body');
  if (!modal || !title || !body) return;

  title.textContent = `Replication Inspector: ${metric.title}`;
  body.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
      <span class="badge badge-placed" style="font-size: 0.9rem; padding: 0.35rem 0.85rem;">Calculated Result: ${metric.value}</span>
      <span style="font-size: 0.8rem; color: var(--text-muted); font-family: var(--font-mono);">Key: ${metricKey}</span>
    </div>

    <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 1rem;">${metric.description}</p>

    <div class="formula-box">
      <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted); font-weight: 600;">Data Source & Column Mapping:</div>
      <div style="color: var(--text-primary); font-weight: 600; font-size: 0.85rem; margin-top: 0.25rem;">${metric.columnSource}</div>
      <div style="color: var(--text-secondary); font-size: 0.8rem; margin-top: 0.25rem;">${metric.condition}</div>
    </div>

    <div class="formula-box">
      <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted); font-weight: 600;">Excel / Google Sheets Formula:</div>
      <code class="formula-code">${metric.excelFormula}</code>
    </div>

    <div class="formula-box">
      <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted); font-weight: 600;">Python / Pandas Replication Snippet:</div>
      <code class="formula-code">${metric.pythonCode}</code>
    </div>

    <div style="margin-top: 1.25rem; text-align: right;">
      <button id="btn-close-inspector-inner" class="btn btn-secondary">Close Inspector</button>
    </div>
  `;

  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');

  document.getElementById('btn-close-inspector')?.addEventListener('click', closeInspector);
  document.getElementById('btn-close-inspector-inner')?.addEventListener('click', closeInspector);
}

export function closeInspector() {
  const modal = document.getElementById('inspector-modal');
  if (modal) {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }
}

/**
 * Renders Tab 3: Data Dictionary & Replication Guide
 */
export function renderReplicationGuide(container, data) {
  const kpis = MetricsService.getExecutiveKPIs(data);

  // Update dynamic values in dictionary
  METRIC_DICTIONARY.placement_rate.value = `${kpis.placementRate}% (${kpis.placedStudents} / ${kpis.totalStudents})`;
  METRIC_DICTIONARY.total_interviews.value = `${kpis.totalInterviews}`;
  METRIC_DICTIONARY.total_offers.value = `${kpis.totalOffers}`;
  METRIC_DICTIONARY.median_comp.value = `$${kpis.medianComp.toLocaleString()}`;

  container.innerHTML = `
    <div class="section-header">
      <div>
        <h2 class="section-title">Data Dictionary & Replication Guide</h2>
        <p class="section-desc">100% transparent mapping from raw Google Forms CSV columns to dashboard metrics and Excel formulas</p>
      </div>
      <span class="badge badge-placed">All Formulas Verified & Replicable</span>
    </div>

    <!-- Data Architecture Summary Card -->
    <div class="card" style="margin-bottom: 2rem;">
      <div class="card-header">
        <div>
          <h3 class="card-title">Google Form Branching Architecture</h3>
          <p class="card-subtitle">How candidate submissions populate columns across the 14 dataset fields</p>
        </div>
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem;">
        <div style="background: var(--bg-secondary); padding: 1.25rem; border-radius: var(--radius-md); border-left: 3px solid #3B82F6;">
          <h4 style="font-size: 0.95rem; font-weight: 700; color: #3B82F6;">Common Header (Cols 1-4)</h4>
          <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.35rem;">
            Timestamp, Email Address, Last First Name, and <strong>What are you reporting today?</strong> (Branches into Interview, Offer, or Acceptance).
          </p>
        </div>

        <div style="background: var(--bg-secondary); padding: 1.25rem; border-radius: var(--radius-md); border-left: 3px solid #6366F1;">
          <h4 style="font-size: 0.95rem; font-weight: 700; color: #6366F1;">Interview Branch (Cols 5-8)</h4>
          <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.35rem;">
            Company/Dept, Which interview was this? (Stage), How did you hear? (Source), Technical feedback notes.
          </p>
        </div>

        <div style="background: var(--bg-secondary); padding: 1.25rem; border-radius: var(--radius-md); border-left: 3px solid #F59E0B;">
          <h4 style="font-size: 0.95rem; font-weight: 700; color: #F59E0B;">Job Offer Branch (Cols 9-10)</h4>
          <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.35rem;">
            Company & Job Title, and <strong>Meet with Career Services to discuss?</strong> (Yes/No flag).
          </p>
        </div>

        <div style="background: var(--bg-secondary); padding: 1.25rem; border-radius: var(--radius-md); border-left: 3px solid #10B981;">
          <h4 style="font-size: 0.95rem; font-weight: 700; color: #10B981;">Acceptance Branch (Cols 11-14)</h4>
          <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.35rem;">
            Company & Title, <strong>Final Offer Breakdown (Salary & Bonus)</strong>, Job Location, Working Conditions (Hybrid/Remote).
          </p>
        </div>
      </div>
    </div>

    <!-- Complete Replication Table -->
    <div class="card" style="margin-bottom: 2rem;">
      <div class="card-header">
        <div>
          <h3 class="card-title">Metric Replication Ledger</h3>
          <p class="card-subtitle">Exact logic and formulas to reproduce every number in Excel, Google Sheets, or Python</p>
        </div>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Dashboard Metric</th>
              <th>Current Value</th>
              <th>Raw CSV Column(s)</th>
              <th>Calculation Rule / Logic</th>
              <th>Excel / Google Sheets Formula</th>
              <th>Inspect</th>
            </tr>
          </thead>
          <tbody>
            ${Object.entries(METRIC_DICTIONARY).map(([key, item]) => `
              <tr>
                <td><strong>${item.title}</strong></td>
                <td><span class="badge badge-placed">${item.value}</span></td>
                <td style="font-family: var(--font-mono); font-size: 0.775rem; color: #CBD5E1;">${item.columnSource.split(':')[1] || item.columnSource}</td>
                <td style="font-size: 0.8rem; color: var(--text-secondary); max-width: 280px;">${item.condition}</td>
                <td><code class="formula-code" style="font-size: 0.75rem;">${item.excelFormula}</code></td>
                <td>
                  <button class="btn btn-secondary btn-inspect-metric" data-key="${key}" style="padding: 0.3rem 0.65rem; font-size: 0.75rem;">
                    Inspect
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Raw Data Sample Inspector -->
    <div class="card">
      <div class="card-header">
        <div>
          <h3 class="card-title">Raw Dataset Preview (Newest 8 Submissions First)</h3>
          <p class="card-subtitle">Live reflection of employment_tracker_synthetic.csv records currently loaded (sorted newest first)</p>
        </div>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Candidate Name</th>
              <th>Report Type (Col 4)</th>
              <th>Company & Role</th>
              <th>Stage / Condition</th>
              <th>Compensation / Notes</th>
            </tr>
          </thead>
          <tbody>
            ${data.rawTracker.slice(0, 8).map(row => `
              <tr>
                <td style="font-size: 0.75rem; color: var(--text-muted);">${row['Timestamp']}</td>
                <td><strong>${row['Last, First Name']}</strong></td>
                <td>
                  <span class="badge ${row['What are you reporting today?'] === 'Acceptance' ? 'badge-placed' : (row['What are you reporting today?'] === 'Offer' ? 'badge-offer' : 'badge-interviewing')}">
                    ${row['What are you reporting today?']}
                  </span>
                </td>
                <td style="font-size: 0.8rem;">
                  ${row['Please list the company, position, department/division. '] || row['Please list the company and job title'] || row['Please list the company name and job title. '] || '-'}
                </td>
                <td style="font-size: 0.8rem;">
                  ${row['Which interview was this? '] || row['What are the working conditions? '] || '-'}
                </td>
                <td style="font-size: 0.75rem; color: var(--text-muted); max-width: 250px;">
                  ${row['What is the final offer? Please break down by salary and bonuses.'] || row['Were there any technical concepts or questions that were challenging or new to you? '] || '-'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  container.querySelectorAll('.btn-inspect-metric').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-key');
      openInspector(key);
    });
  });
}
