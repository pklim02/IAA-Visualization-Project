import { MetricsService } from '../metricsService.js';
import { renderFunnelChart, renderTimelineChart } from '../charts.js';
import { openInspector } from './replicationView.js';

export function renderOverview(container, data) {
  const kpis = MetricsService.getExecutiveKPIs(data);
  const funnel = MetricsService.getRecruitingFunnel(data);
  const timeline = MetricsService.getTimelineActivity(data);
  const employers = MetricsService.getEmployerTrends(data).slice(0, 5);
  const sources = MetricsService.getSourceYield(data).slice(0, 5);
  const comp = MetricsService.getCompensationMetrics(data);

  container.innerHTML = `
    <div class="section-header">
      <div>
        <h2 class="section-title">Cohort Executive Overview & Outcomes</h2>
        <p class="section-desc">Class of 2027 placement outcomes, recruitment funnel conversion, and key partner benchmarks</p>
      </div>
      <div class="header-actions">
        <span class="badge badge-placed">Placement Target: 100%</span>
      </div>
    </div>

    <!-- Spacious Hero KPI Banner with Formula Replication Pills -->
    <div class="kpi-grid">
      <div class="kpi-card accent-green">
        <div class="kpi-header">
          <span class="kpi-label">Placement Rate</span>
          <button class="info-pill btn-inspect-kpi" data-key="placement_rate" title="Inspect CSV column and formula">
            Col 4 • Formula
          </button>
        </div>
        <div class="kpi-value">${kpis.placementRate}%</div>
        <div class="kpi-subtext">
          <span>${kpis.placedStudents} of ${kpis.totalStudents} students accepted</span>
          <span class="badge badge-placed" style="font-size: 0.7rem;">Target 100%</span>
        </div>
      </div>

      <div class="kpi-card accent-red">
        <div class="kpi-header">
          <span class="kpi-label">Total Interviews</span>
          <button class="info-pill btn-inspect-kpi" data-key="total_interviews" title="Inspect CSV column and formula">
            Col 4 • Formula
          </button>
        </div>
        <div class="kpi-value">${kpis.totalInterviews}</div>
        <div class="kpi-subtext">
          <span>Avg ${kpis.avgInterviewsPerStudent} interviews per student</span>
        </div>
      </div>

      <div class="kpi-card accent-amber">
        <div class="kpi-header">
          <span class="kpi-label">Job Offers Recorded</span>
          <button class="info-pill btn-inspect-kpi" data-key="total_offers" title="Inspect CSV column and formula">
            Col 4 • Formula
          </button>
        </div>
        <div class="kpi-value">${kpis.totalOffers}</div>
        <div class="kpi-subtext">
          <span>Across all reporting employers</span>
        </div>
      </div>

      <div class="kpi-card accent-blue">
        <div class="kpi-header">
          <span class="kpi-label">Median Total Comp</span>
          <button class="info-pill btn-inspect-kpi" data-key="median_comp" title="Inspect CSV column and formula">
            Col 12 • Formula
          </button>
        </div>
        <div class="kpi-value">$${kpis.medianComp.toLocaleString()}</div>
        <div class="kpi-subtext">
          <span>Avg: $${kpis.avgComp.toLocaleString()} (Salary + Bonus)</span>
        </div>
      </div>
    </div>

    <!-- Visual Charts: Funnel & Velocity -->
    <div class="charts-grid-2col">
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Recruitment Pipeline Funnel</h3>
            <p class="card-subtitle">Candidate activity across screening, rounds, offers, and acceptances</p>
          </div>
          <button class="info-pill btn-inspect-kpi" data-key="total_interviews">Inspect Cols 4 & 6</button>
        </div>
        <div class="chart-container">
          <canvas id="overview-funnel-chart"></canvas>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Placement Velocity & Volume</h3>
            <p class="card-subtitle">Cumulative accepted offers vs. monthly interview volume</p>
          </div>
          <button class="info-pill btn-inspect-kpi" data-key="placement_rate">Inspect Col 1</button>
        </div>
        <div class="chart-container">
          <canvas id="overview-timeline-chart"></canvas>
        </div>
      </div>
    </div>

    <!-- Side-by-Side Story Cards: Top Partners & Discovery Sources -->
    <div class="charts-grid-2col">
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Top Corporate Partners</h3>
            <p class="card-subtitle">Highest volume employer organizations for the Class of 2027</p>
          </div>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Employer</th>
                <th>Interviews</th>
                <th>Offers</th>
                <th>Conversion</th>
              </tr>
            </thead>
            <tbody>
              ${employers.map(e => `
                <tr>
                  <td><strong>${e.company}</strong></td>
                  <td>${e.interviews}</td>
                  <td style="font-weight: 600; color: #F59E0B;">${e.offers}</td>
                  <td><span class="badge ${parseFloat(e.conversionRate) > 15 ? 'badge-placed' : 'badge-interviewing'}">${e.conversionRate}%</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Recruitment Discovery Sources</h3>
            <p class="card-subtitle">Where candidates found their interview and offer opportunities</p>
          </div>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Channel</th>
                <th>Interviews</th>
                <th>Offers</th>
                <th>Yield Rate</th>
              </tr>
            </thead>
            <tbody>
              ${sources.map(s => `
                <tr>
                  <td><strong>${s.source}</strong></td>
                  <td>${s.interviews}</td>
                  <td style="font-weight: 600; color: #F59E0B;">${s.offers}</td>
                  <td><span class="badge ${parseFloat(s.yieldRate) > 10 ? 'badge-placed' : 'badge-interviewing'}">${s.yieldRate}%</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Recent Cohort Activity Feed (Newest First) -->
    <div class="card" style="margin-top: 1.75rem;">
      <div class="card-header">
        <div>
          <h3 class="card-title">Recent Cohort Activity Feed</h3>
          <p class="card-subtitle">Most recent candidate submissions recorded across the Class of 2027 (newest first)</p>
        </div>
        <span class="badge badge-placed">Live Feed</span>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Student Candidate</th>
              <th>Reported Activity</th>
              <th>Employer Organization</th>
              <th>Role / Stage</th>
              <th>Recruitment Source</th>
            </tr>
          </thead>
          <tbody>
            ${data.rawTracker.slice(0, 5).map((row, idx) => `
              <tr>
                <td style="font-size: 0.775rem; color: var(--text-muted);">
                  ${idx === 0 ? '<span class="badge badge-placed" style="font-size: 0.65rem; padding: 0.1rem 0.35rem; margin-right: 0.35rem;">Newest</span>' : ''}
                  ${row['Timestamp']}
                </td>
                <td><strong>${row['Last, First Name']}</strong></td>
                <td>
                  <span class="badge ${row['What are you reporting today?'] === 'Acceptance' ? 'badge-placed' : (row['What are you reporting today?'] === 'Offer' ? 'badge-offer' : 'badge-interviewing')}">
                    ${row['What are you reporting today?']}
                  </span>
                </td>
                <td><strong>${(row['Please list the company, position, department/division. '] || row['Please list the company and job title'] || row['Please list the company name and job title. '] || '-').split(',')[0]}</strong></td>
                <td style="font-size: 0.8rem; color: var(--text-secondary);">${row['Which interview was this? '] || row['What are the working conditions? '] || '-'}</td>
                <td style="font-size: 0.8rem; color: var(--text-muted);">${row['How did you hear about the job?'] || 'Institute'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Attach inspector clicks
  container.querySelectorAll('.btn-inspect-kpi').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const key = btn.getAttribute('data-key');
      openInspector(key);
    });
  });

  // Render charts
  requestAnimationFrame(() => {
    renderFunnelChart('overview-funnel-chart', funnel);
    renderTimelineChart('overview-timeline-chart', timeline);
  });
}
