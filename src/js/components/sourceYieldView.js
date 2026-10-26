import { MetricsService } from '../metricsService.js';
import { renderSourceYieldChart } from '../charts.js';

export function renderSourceYield(container, data) {
  const sources = MetricsService.getSourceYield(data);
  const totalInterviews = sources.reduce((acc, s) => acc + s.interviews, 0);
  const totalOffers = sources.reduce((acc, s) => acc + s.offers, 0);

  // Calculate Institute + Alumni network share
  const networkInterviews = sources
    .filter(s => s.source === 'Institute' || s.source === 'Alumni')
    .reduce((acc, s) => acc + s.interviews, 0);
  const networkShare = totalInterviews > 0 ? ((networkInterviews / totalInterviews) * 100).toFixed(1) : 0;

  container.innerHTML = `
    <div class="section-header">
      <div>
        <h2 class="section-title">Recruiting Sourcing Channels & Yield Analysis</h2>
        <p class="section-desc">Evaluate which discovery channels deliver the highest volume and greatest offer conversion efficiency</p>
      </div>
      <span class="badge badge-placed">${networkShare}% Sourced via Institute & Alumni Network</span>
    </div>

    <!-- Sourcing KPI Cards -->
    <div class="kpi-grid">
      <div class="kpi-card accent-red">
        <div class="kpi-label">Top Channel by Volume</div>
        <div class="kpi-value" style="font-size: 1.6rem;">${sources[0]?.source || 'Institute'}</div>
        <div class="kpi-subtext">${sources[0]?.interviews || 0} interviews conducted</div>
      </div>

      <div class="kpi-card accent-green">
        <div class="kpi-label">IAA Network Dominance</div>
        <div class="kpi-value">${networkShare}%</div>
        <div class="kpi-subtext">Combined Institute & Alumni discovery channels</div>
      </div>

      <div class="kpi-card accent-amber">
        <div class="kpi-label">Total Sourced Offers</div>
        <div class="kpi-value">${totalOffers}</div>
        <div class="kpi-subtext">Across ${sources.length} distinct recruiting channels</div>
      </div>

      <div class="kpi-card accent-blue">
        <div class="kpi-label">Avg Channel Conversion</div>
        <div class="kpi-value">
          ${totalInterviews > 0 ? ((totalOffers / totalInterviews) * 100).toFixed(1) : 0}%
        </div>
        <div class="kpi-subtext">Interviews resulting in formal job offers</div>
      </div>
    </div>

    <!-- Chart: Source Comparison -->
    <div class="card" style="margin-bottom: 2rem;">
      <div class="card-header">
        <div>
          <h3 class="card-title">Interviews vs Offers by Recruiting Source</h3>
          <p class="card-subtitle">Channel interview generation volume alongside formal job offer yields</p>
        </div>
      </div>
      <div class="chart-container" style="height: 340px;">
        <canvas id="source-yield-chart"></canvas>
      </div>
    </div>

    <!-- Detailed Channel Performance Table -->
    <div class="card">
      <div class="card-header">
        <div>
          <h3 class="card-title">Channel Conversion & ROI Analysis</h3>
          <p class="card-subtitle">Strategic recommendations for career services resource allocation</p>
        </div>
      </div>

      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Discovery Channel</th>
              <th>Interviews Generated</th>
              <th>Share of Total Volume</th>
              <th>Offers Extended</th>
              <th>Channel Yield Rate</th>
              <th>Strategic Career Services Recommendation</th>
            </tr>
          </thead>
          <tbody>
            ${sources.map(src => {
              const share = totalInterviews > 0 ? ((src.interviews / totalInterviews) * 100).toFixed(1) : 0;
              let recommendation = 'Monitor candidate submissions and support individual applications.';
              if (src.source === 'Institute') {
                recommendation = 'Primary institutional engine. Continue direct employer presentations and on-campus interviews.';
              } else if (src.source === 'Alumni') {
                recommendation = 'High-trust, high-yield channel. Deepen alumni mentoring programs and regional chapters.';
              } else if (src.source === 'LinkedIn') {
                recommendation = 'Offer targeted LinkedIn profile workshops and algorithmic search coaching.';
              } else if (src.source === 'Recruiter reached out') {
                recommendation = 'High-value inbound interest. Provide rapid interview turnaround prep.';
              } else if (src.source === 'Career fair') {
                recommendation = 'Prep students on rapid 60-second value proposition pitches before fair attendance.';
              }

              return `
                <tr>
                  <td><strong>${src.source}</strong></td>
                  <td>${src.interviews}</td>
                  <td>${share}%</td>
                  <td style="font-weight: 600; color: ${src.offers > 0 ? '#F59E0B' : 'inherit'};">${src.offers}</td>
                  <td><span class="badge ${parseFloat(src.yieldRate) > 12 ? 'badge-placed' : 'badge-interviewing'}">${src.yieldRate}%</span></td>
                  <td style="font-size: 0.8rem; color: var(--text-secondary); max-width: 320px;">${recommendation}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  requestAnimationFrame(() => {
    renderSourceYieldChart('source-yield-chart', sources);
  });
}
