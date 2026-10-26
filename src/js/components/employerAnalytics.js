import { MetricsService } from '../metricsService.js';
import { renderEmployerChart } from '../charts.js';

export function renderEmployerAnalytics(container, data) {
  const employers = MetricsService.getEmployerTrends(data);
  const totalEmployers = employers.length;
  const topPartner = employers[0] || { company: 'None', interviews: 0, offers: 0 };
  const totalOffers = employers.reduce((acc, e) => acc + e.offers, 0);

  // Highest conversion employer with >= 5 interviews
  const highConversionPartner = [...employers]
    .filter(e => e.interviews >= 4)
    .sort((a, b) => parseFloat(b.conversionRate) - parseFloat(a.conversionRate))[0] || topPartner;

  container.innerHTML = `
    <div class="section-header">
      <div>
        <h2 class="section-title">Employer Recruitment & Partnership Trends</h2>
        <p class="section-desc">Analysis of recruiting organizations, interview engagement volume, and candidate conversion yields</p>
      </div>
      <span class="badge badge-placed">${totalEmployers} Corporate Partners Active</span>
    </div>

    <!-- Employer KPI Cards -->
    <div class="kpi-grid">
      <div class="kpi-card accent-blue">
        <div class="kpi-label">Active Employers</div>
        <div class="kpi-value">${totalEmployers}</div>
        <div class="kpi-subtext">Interviewing IAA Class of 2027</div>
      </div>

      <div class="kpi-card accent-red">
        <div class="kpi-label">Most Active Partner</div>
        <div class="kpi-value" style="font-size: 1.5rem; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;" title="${topPartner.company}">
          ${topPartner.company}
        </div>
        <div class="kpi-subtext">${topPartner.interviews} interviews • ${topPartner.offers} offers</div>
      </div>

      <div class="kpi-card accent-green">
        <div class="kpi-label">Highest Yield Partner</div>
        <div class="kpi-value" style="font-size: 1.5rem; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;" title="${highConversionPartner.company}">
          ${highConversionPartner.company}
        </div>
        <div class="kpi-subtext">${highConversionPartner.conversionRate}% interview-to-offer rate</div>
      </div>

      <div class="kpi-card accent-amber">
        <div class="kpi-label">Total Corporate Offers</div>
        <div class="kpi-value">${totalOffers}</div>
        <div class="kpi-subtext">Across ${employers.filter(e => e.offers > 0).length} distinct employers</div>
      </div>
    </div>

    <!-- Chart: Top Employers Volume vs Offers -->
    <div class="card" style="margin-bottom: 2rem;">
      <div class="card-header">
        <div>
          <h3 class="card-title">Top 8 Employers by Recruitment Volume</h3>
          <p class="card-subtitle">Interview engagement frequency compared to formal job offers extended</p>
        </div>
      </div>
      <div class="chart-container" style="height: 340px;">
        <canvas id="employer-trends-chart"></canvas>
      </div>
    </div>

    <!-- Employer Roster Table -->
    <div class="card">
      <div class="card-header">
        <div>
          <h3 class="card-title">Employer Engagement Leaderboard</h3>
          <p class="card-subtitle">Detailed breakdown for Career Services outreach and strategic partnership expansion</p>
        </div>
        <div class="search-box" style="max-width: 260px;">
          <input type="text" id="employer-search" class="search-input" placeholder="Search company...">
        </div>
      </div>

      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Employer Organization</th>
              <th>Candidates Evaluated</th>
              <th>Interviews Conducted</th>
              <th>Offers Extended</th>
              <th>Hires (Accepted)</th>
              <th>Conversion Yield</th>
              <th>Partnership Tier</th>
              <th>Primary Job Titles</th>
            </tr>
          </thead>
          <tbody id="employer-table-body"></tbody>
        </table>
      </div>
    </div>
  `;

  function renderTable(filter = '') {
    const tbody = document.getElementById('employer-table-body');
    if (!tbody) return;

    const filtered = employers.filter(e => e.company.toLowerCase().includes(filter.toLowerCase()));

    tbody.innerHTML = filtered.map(emp => {
      let tierBadge = '<span class="badge badge-seeking">Emerging Partner</span>';
      if (emp.offers >= 3 || emp.interviews >= 15) {
        tierBadge = '<span class="badge badge-placed">Strategic Anchor</span>';
      } else if (emp.offers >= 1 || emp.interviews >= 8) {
        tierBadge = '<span class="badge badge-interviewing">Active Recruiter</span>';
      }

      return `
        <tr>
          <td><strong>${emp.company}</strong></td>
          <td>${emp.studentCount} students</td>
          <td>${emp.interviews}</td>
          <td style="font-weight: 600; color: ${emp.offers > 0 ? '#F59E0B' : 'inherit'};">${emp.offers}</td>
          <td style="font-weight: 600; color: ${emp.acceptances > 0 ? '#10B981' : 'inherit'};">${emp.acceptances}</td>
          <td>${emp.conversionRate}%</td>
          <td>${tierBadge}</td>
          <td style="font-size: 0.75rem; color: var(--text-muted); max-width: 220px;">${emp.rolesList || 'Analytics'}</td>
        </tr>
      `;
    }).join('');
  }

  const searchInput = document.getElementById('employer-search');
  searchInput?.addEventListener('input', (e) => {
    renderTable(e.target.value);
  });

  renderTable();

  requestAnimationFrame(() => {
    renderEmployerChart('employer-trends-chart', employers);
  });
}
