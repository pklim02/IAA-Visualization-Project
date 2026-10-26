import { MetricsService } from '../metricsService.js';
import { renderFunnelChart, renderTimelineChart } from '../charts.js';

export function renderOverview(container, data) {
  const kpis = MetricsService.getExecutiveKPIs(data);
  const funnel = MetricsService.getRecruitingFunnel(data);
  const timeline = MetricsService.getTimelineActivity(data);

  container.innerHTML = `
    <div class="section-header">
      <div>
        <h2 class="section-title">Cohort Recruitment Overview</h2>
        <p class="section-desc">Class of 2027 employment outcomes, progression funnels, and recruitment velocity</p>
      </div>
      <div class="header-actions">
        <span class="badge badge-placed">Placement Target: 100%</span>
      </div>
    </div>

    <!-- KPI Cards Grid -->
    <div class="kpi-grid">
      <div class="kpi-card accent-green">
        <div class="kpi-label">Placement Rate</div>
        <div class="kpi-value">${kpis.placementRate}%</div>
        <div class="kpi-subtext">
          <span>${kpis.placedStudents} of ${kpis.totalStudents} students placed</span>
        </div>
      </div>

      <div class="kpi-card accent-red">
        <div class="kpi-label">Total Interviews Logged</div>
        <div class="kpi-value">${kpis.totalInterviews}</div>
        <div class="kpi-subtext">
          <span>Avg ${kpis.avgInterviewsPerStudent} interviews per student</span>
        </div>
      </div>

      <div class="kpi-card accent-amber">
        <div class="kpi-label">Job Offers Recorded</div>
        <div class="kpi-value">${kpis.totalOffers}</div>
        <div class="kpi-subtext">
          <span>Across all reporting employers</span>
        </div>
      </div>

      <div class="kpi-card accent-blue">
        <div class="kpi-label">Median First-Year Comp</div>
        <div class="kpi-value">$${kpis.medianComp.toLocaleString()}</div>
        <div class="kpi-subtext">
          <span>Avg: $${kpis.avgComp.toLocaleString()} (Salary + Bonus)</span>
        </div>
      </div>
    </div>

    <!-- Charts Row 1: Funnel & Cumulative Velocity -->
    <div class="charts-grid-2col">
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Recruitment Stage Progression</h3>
            <p class="card-subtitle">Drop-off and conversion across recruitment pipeline stages</p>
          </div>
        </div>
        <div class="chart-container">
          <canvas id="overview-funnel-chart"></canvas>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Placement & Interview Velocity</h3>
            <p class="card-subtitle">Cumulative accepted offers vs monthly interview volume</p>
          </div>
        </div>
        <div class="chart-container">
          <canvas id="overview-timeline-chart"></canvas>
        </div>
      </div>
    </div>

    <!-- Quick Status Breakdown Row -->
    <div class="card">
      <div class="card-header">
        <div>
          <h3 class="card-title">Cohort Placement Breakdown</h3>
          <p class="card-subtitle">Real-time status across all 75 enrolled students</p>
        </div>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Status Category</th>
              <th>Student Count</th>
              <th>Percentage</th>
              <th>Pipeline Action</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><span class="badge badge-placed">Placed (Offer Accepted)</span></td>
              <td><strong>${data.placedCount}</strong></td>
              <td>${((data.placedCount / data.totalStudents) * 100).toFixed(1)}%</td>
              <td>Offer verified & compensation recorded</td>
            </tr>
            <tr>
              <td><span class="badge badge-offer">Has Offer (Deciding)</span></td>
              <td><strong>${data.offersCount - data.placedCount}</strong></td>
              <td>${(((data.offersCount - data.placedCount) / data.totalStudents) * 100).toFixed(1)}%</td>
              <td>Decision deadline & negotiation support</td>
            </tr>
            <tr>
              <td><span class="badge badge-interviewing">Active in Interviews</span></td>
              <td><strong>${data.interviewingCount}</strong></td>
              <td>${((data.interviewingCount / data.totalStudents) * 100).toFixed(1)}%</td>
              <td>Monitoring stage progression</td>
            </tr>
            <tr>
              <td><span class="badge badge-seeking">Seeking Opportunities</span></td>
              <td><strong>${data.seekingCount}</strong></td>
              <td>${((data.seekingCount / data.totalStudents) * 100).toFixed(1)}%</td>
              <td>Targeted alumni & Institute outreach</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Initialize charts after DOM injection
  requestAnimationFrame(() => {
    renderFunnelChart('overview-funnel-chart', funnel);
    renderTimelineChart('overview-timeline-chart', timeline);
  });
}
