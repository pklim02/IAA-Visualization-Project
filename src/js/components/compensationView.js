import { MetricsService } from '../metricsService.js';
import { renderSalaryDistributionChart, renderRoleCompChart } from '../charts.js';

export function renderCompensation(container, data) {
  const comp = MetricsService.getCompensationMetrics(data);

  // Placed students with verified comp
  const placedOffers = data.students
    .filter(s => s.acceptance && s.acceptance.compensation.base > 0)
    .map(s => ({
      name: s.name,
      unityID: s.unityID,
      avatarUrl: s.avatarUrl,
      company: s.acceptance.company,
      role: s.acceptance.role,
      base: s.acceptance.compensation.base,
      bonus: s.acceptance.compensation.bonus,
      total: s.acceptance.compensation.total,
      location: s.acceptance.location || 'Raleigh, NC',
      conditions: s.acceptance.workingConditions || 'Hybrid'
    }))
    .sort((a, b) => b.total - a.total);

  container.innerHTML = `
    <div class="section-header">
      <div>
        <h2 class="section-title">Salary & First-Year Compensation Analytics</h2>
        <p class="section-desc">Reported base salaries, signing bonuses, and total compensation packages for the Class of 2027</p>
      </div>
      <span class="badge badge-placed">${comp.count} Offers Verified</span>
    </div>

    <!-- Compensation KPI Cards -->
    <div class="kpi-grid">
      <div class="kpi-card accent-green">
        <div class="kpi-label">Median Total First-Year Comp</div>
        <div class="kpi-value">$${comp.medianTotalComp.toLocaleString()}</div>
        <div class="kpi-subtext">Average: $${comp.avgTotalComp.toLocaleString()}</div>
      </div>

      <div class="kpi-card accent-blue">
        <div class="kpi-label">Median Base Salary</div>
        <div class="kpi-value">$${comp.medianBaseSalary.toLocaleString()}</div>
        <div class="kpi-subtext">Range: $${comp.minBaseSalary.toLocaleString()} - $${comp.maxBaseSalary.toLocaleString()}</div>
      </div>

      <div class="kpi-card accent-amber">
        <div class="kpi-label">Average Signing Bonus</div>
        <div class="kpi-value">$${comp.avgBonus.toLocaleString()}</div>
        <div class="kpi-subtext">${comp.bonusRecipientRate}% of candidates received bonus</div>
      </div>

      <div class="kpi-card accent-red">
        <div class="kpi-label">Highest Package Logged</div>
        <div class="kpi-value">$${placedOffers[0]?.total.toLocaleString() || '0'}</div>
        <div class="kpi-subtext">${placedOffers[0]?.company || 'N/A'} • ${placedOffers[0]?.role || 'Data Scientist'}</div>
      </div>
    </div>

    <!-- Charts Row: Distribution & Role Comparison -->
    <div class="charts-grid-2col">
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">First-Year Compensation Distribution</h3>
            <p class="card-subtitle">Frequency of total compensation packages across $10k salary bands</p>
          </div>
        </div>
        <div class="chart-container">
          <canvas id="comp-dist-chart"></canvas>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Average Compensation by Job Title</h3>
            <p class="card-subtitle">Comparative earnings across common analytics roles</p>
          </div>
        </div>
        <div class="chart-container">
          <canvas id="comp-role-chart"></canvas>
        </div>
      </div>
    </div>

    <!-- Two-column tables: Working Conditions & Roles -->
    <div class="charts-grid-2col" style="margin-bottom: 2rem;">
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Compensation by Working Mode</h3>
            <p class="card-subtitle">Hybrid, on-site, and remote compensation comparison</p>
          </div>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Working Condition</th>
                <th>Placements</th>
                <th>Average First-Year Comp</th>
              </tr>
            </thead>
            <tbody>
              ${comp.conditionBreakdown.map(c => `
                <tr>
                  <td><strong>${c.condition}</strong></td>
                  <td>${c.count} students</td>
                  <td style="font-weight: 600; color: #10B981;">$${c.avgComp.toLocaleString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Role Compensation Summary</h3>
            <p class="card-subtitle">Median and average compensation by functional title</p>
          </div>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Job Title</th>
                <th>Count</th>
                <th>Median Comp</th>
                <th>Average Comp</th>
              </tr>
            </thead>
            <tbody>
              ${comp.roleBreakdown.map(r => `
                <tr>
                  <td><strong>${r.role}</strong></td>
                  <td>${r.count}</td>
                  <td style="font-weight: 600;">$${r.medianComp.toLocaleString()}</td>
                  <td style="color: var(--text-secondary);">$${r.avgComp.toLocaleString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Full Placed Offers Ledger -->
    <div class="card">
      <div class="card-header">
        <div>
          <h3 class="card-title">Verified Acceptance Compensation Ledger</h3>
          <p class="card-subtitle">Individual reported employment packages for the Class of 2027</p>
        </div>
        <div class="search-box" style="max-width: 260px;">
          <input type="text" id="comp-ledger-search" class="search-input" placeholder="Search student or company...">
        </div>
      </div>

      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Employer</th>
              <th>Role</th>
              <th>Location</th>
              <th>Working Mode</th>
              <th>Base Salary</th>
              <th>Bonus</th>
              <th>Total First-Year</th>
            </tr>
          </thead>
          <tbody id="comp-ledger-body"></tbody>
        </table>
      </div>
    </div>
  `;

  function renderLedger(filter = '') {
    const tbody = document.getElementById('comp-ledger-body');
    if (!tbody) return;

    const filtered = placedOffers.filter(p => 
      p.name.toLowerCase().includes(filter.toLowerCase()) ||
      p.company.toLowerCase().includes(filter.toLowerCase()) ||
      p.role.toLowerCase().includes(filter.toLowerCase())
    );

    tbody.innerHTML = filtered.map(item => `
      <tr>
        <td>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <img 
              src="${item.avatarUrl}" 
              alt="${item.name}" 
              class="student-avatar" 
              style="width: 28px; height: 28px;"
              onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}&background=1E293B&color=F8FAFC'"
            />
            <span>${item.name}</span>
          </div>
        </td>
        <td><strong>${item.company}</strong></td>
        <td>${item.role}</td>
        <td>${item.location}</td>
        <td><span class="badge ${item.conditions.includes('Remote') ? 'badge-interviewing' : 'badge-placed'}">${item.conditions}</span></td>
        <td>$${item.base.toLocaleString()}</td>
        <td>${item.bonus > 0 ? `$${item.bonus.toLocaleString()}` : '<span style="color: var(--text-muted);">-</span>'}</td>
        <td style="font-weight: 700; color: #10B981;">$${item.total.toLocaleString()}</td>
      </tr>
    `).join('');
  }

  const searchInput = document.getElementById('comp-ledger-search');
  searchInput?.addEventListener('input', (e) => {
    renderLedger(e.target.value);
  });

  renderLedger();

  requestAnimationFrame(() => {
    renderSalaryDistributionChart('comp-dist-chart', comp.allTotals);
    renderRoleCompChart('comp-role-chart', comp.roleBreakdown);
  });
}
