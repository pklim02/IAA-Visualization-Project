import { openInspector } from './replicationView.js';

/**
 * Renders the mini funnel progress indicator on a student card.
 */
function renderMiniFunnel(student) {
  const stages = ['Screen', 'Round 1', 'Round 2', 'Final', 'Offer', 'Placed'];
  let filledCount = 0;

  if (student.status === 'Placed') filledCount = 6;
  else if (student.offersCount > 0) filledCount = 5;
  else if (student.finalRoundsCount > 0) filledCount = 4;
  else if (student.secondRoundsCount > 0) filledCount = 3;
  else if (student.firstRoundsCount > 0) filledCount = 2;
  else if (student.screensCount > 0) filledCount = 1;

  return `
    <div class="mini-funnel" title="Progression: ${student.highestStage}">
      ${stages.map((st, i) => `
        <div class="funnel-step ${i < filledCount ? (filledCount === 6 ? 'filled-green' : 'filled') : ''}" title="${st}"></div>
      `).join('')}
    </div>
  `;
}

/**
 * Returns HTML badge for student status.
 */
function getStatusBadge(status) {
  switch (status) {
    case 'Placed':
      return '<span class="badge badge-placed">Placed</span>';
    case 'Has Offer':
      return '<span class="badge badge-offer">Has Offer</span>';
    case 'Interviewing':
      return '<span class="badge badge-interviewing">Interviewing</span>';
    default:
      return '<span class="badge badge-seeking">Seeking</span>';
  }
}

/**
 * Opens the slide-over student detail drawer.
 */
export function openStudentDrawer(student) {
  const drawer = document.getElementById('student-drawer');
  const content = document.getElementById('drawer-content');
  if (!drawer || !content) return;

  const acceptedInfo = student.acceptance ? `
    <div class="card" style="margin-bottom: 1.5rem; border-color: var(--status-placed-border); background: var(--status-placed-bg);">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
        <div>
          <span class="badge badge-placed" style="margin-bottom: 0.5rem;">Accepted Employment Offer (Col 11)</span>
          <h4 style="font-size: 1.15rem; font-weight: 700; color: #065F46;">${student.acceptance.company}</h4>
          <p style="color: #047857; font-size: 0.9rem;">${student.acceptance.role}</p>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 1.35rem; font-weight: 800; color: #047857;">
            $${student.acceptance.compensation.total.toLocaleString()}
          </div>
          <div style="font-size: 0.75rem; color: #065F46;">First-Year Total Comp</div>
        </div>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; font-size: 0.825rem; color: #065F46; border-top: 1px solid rgba(5, 150, 105, 0.2); padding-top: 0.75rem;">
        <div>Base Salary: <strong style="color: #064E3B;">$${student.acceptance.compensation.base.toLocaleString()}</strong></div>
        <div>Bonus: <strong style="color: #064E3B;">${student.acceptance.compensation.bonusLabel || `$${student.acceptance.compensation.bonus.toLocaleString()}`}</strong></div>
        <div>Location (Col 13): <strong style="color: #064E3B;">${student.acceptance.location || 'N/A'}</strong></div>
        <div>Work Mode (Col 14): <strong style="color: #064E3B;">${student.acceptance.workingConditions || 'N/A'}</strong></div>
        <div style="grid-column: 1 / -1; margin-top: 0.35rem; font-size: 0.775rem; color: #047857; background: rgba(5, 150, 105, 0.08); padding: 0.4rem 0.65rem; border-radius: var(--radius-sm);">
          Reported Text (Col 12): &ldquo;${student.acceptance.compensation.raw}&rdquo;
        </div>
      </div>
    </div>
  ` : '';

  const flagsInfo = student.supportFlags.length > 0 ? `
    <div style="margin-bottom: 1.5rem; padding: 1.15rem; border-radius: var(--radius-md); background: var(--status-alert-bg); border: 1px solid var(--status-alert-border);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
        <span style="color: var(--status-alert); font-weight: 700; font-size: 0.85rem;">Career Services Coaching Radar Notice</span>
        <button class="info-pill btn-inspect-flag" style="font-size: 0.7rem;">Inspect Flag Logic</button>
      </div>
      ${student.supportFlags.map(f => `
        <div style="font-size: 0.825rem; margin-top: 0.35rem; color: #991B1B;">
          <strong>${f.label}:</strong> ${f.reason}
        </div>
      `).join('')}
    </div>
  ` : '';

  // Combine interviews and offers chronologically
  const allEvents = [...student.interviews, ...student.offers];
  if (student.acceptance) allEvents.push(student.acceptance);
  allEvents.sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));

  content.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.75rem;">
      <div style="display: flex; align-items: center; gap: 1.15rem;">
        <img 
          src="${student.avatarUrl}" 
          alt="${student.name}" 
          class="student-avatar"
          style="width: 68px; height: 68px;"
          onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(student.name)}&background=1E293B&color=F8FAFC'"
        />
        <div>
          <h3 style="font-size: 1.35rem; font-weight: 700;">${student.name}</h3>
          <p style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted);">${student.email} • ${student.unityID}</p>
          <div style="margin-top: 0.4rem; display: flex; gap: 0.4rem; align-items: center;">
            ${getStatusBadge(student.status)}
            ${student.supportFlags.length > 0 ? '<span class="badge badge-coaching">Needs Coaching</span>' : ''}
          </div>
        </div>
      </div>
      <button id="btn-close-drawer" class="modal-close-btn">&times;</button>
    </div>

    ${flagsInfo}
    ${acceptedInfo}

    <div style="margin-bottom: 1.75rem;">
      <h4 style="font-size: 0.95rem; font-weight: 600; margin-bottom: 0.75rem;">Recruitment Funnel Progress</h4>
      ${renderMiniFunnel(student)}
      <div style="display: flex; justify-content: space-between; font-size: 0.775rem; color: var(--text-muted); margin-top: 0.4rem;">
        <span>Screen (${student.screensCount})</span>
        <span>Round 1 (${student.firstRoundsCount})</span>
        <span>Round 2 (${student.secondRoundsCount})</span>
        <span>Final (${student.finalRoundsCount})</span>
        <span>Offers (${student.offersCount})</span>
      </div>
    </div>

    <div>
      <h4 style="font-size: 0.95rem; font-weight: 600; margin-bottom: 0.75rem;">Activity History (${allEvents.length} Entries • Newest First)</h4>
      ${allEvents.length === 0 ? `
        <p style="color: var(--text-muted); font-size: 0.85rem; padding: 1.25rem; background: var(--bg-secondary); border-radius: var(--radius-md);">
          No interviews or offers logged yet for this candidate.
        </p>
      ` : `
        <div class="timeline">
          ${allEvents.map((evt, idx) => {
            const isOffer = evt.reportType === 'Offer';
            const isAcceptance = evt.reportType === 'Acceptance';
            const dotClass = isAcceptance ? 'dot-placed' : (isOffer ? 'dot-offer' : '');

            return `
              <div class="timeline-item">
                <div class="timeline-dot ${dotClass}"></div>
                <div class="timeline-content">
                  <div class="timeline-header">
                    <span>${evt.timestamp || 'Recent'}</span>
                    <div style="display: flex; gap: 0.35rem; align-items: center;">
                      ${idx === 0 ? '<span class="badge badge-placed" style="font-size: 0.65rem; padding: 0.1rem 0.4rem;">Most Recent</span>' : ''}
                      <span class="badge ${isAcceptance ? 'badge-placed' : (isOffer ? 'badge-offer' : 'badge-interviewing')}">
                        ${evt.reportType} ${evt.stage ? `• ${evt.stage}` : ''}
                      </span>
                    </div>
                  </div>
                  <div class="timeline-title">${evt.company}</div>
                  <div class="timeline-desc">${evt.role || evt.department || 'Analytics Specialist'}</div>
                  ${evt.source && evt.source !== 'Unspecified' ? `
                    <div style="font-size: 0.775rem; color: var(--text-muted); margin-top: 0.25rem;">
                      Source (Col 7): <strong>${evt.source}</strong>
                    </div>
                  ` : ''}
                  ${evt.notes ? `
                    <div class="timeline-feedback">
                      <strong>Interview Notes (Col 8):</strong> "${evt.notes}"
                    </div>
                  ` : ''}
                  ${evt.wantsMeeting ? `
                    <div style="margin-top: 0.5rem; font-size: 0.775rem; color: #EF4444; font-weight: 600;">
                      * Requested Career Services Meeting (Col 10)
                    </div>
                  ` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `}
    </div>
  `;

  drawer.classList.add('open');
  drawer.setAttribute('aria-hidden', 'false');

  document.getElementById('btn-close-drawer')?.addEventListener('click', closeStudentDrawer);
  document.getElementById('drawer-overlay')?.addEventListener('click', closeStudentDrawer);

  content.querySelector('.btn-inspect-flag')?.addEventListener('click', () => {
    openInspector('stalled_early_flag');
  });
}

export function closeStudentDrawer() {
  const drawer = document.getElementById('student-drawer');
  if (drawer) {
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
  }
}

/**
 * Main Student Directory & Coaching Radar View
 */
export function renderStudentDirectory(container, data) {
  let searchTerm = '';
  let activeFilter = 'ALL';

  const flaggedCount = data.flaggedStudents.length;

  function filterAndDisplay() {
    let filtered = data.students.filter(student => {
      const matchSearch = 
        student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.unityID.toLowerCase().includes(searchTerm.toLowerCase());

      let matchFilter = true;
      if (activeFilter === 'COACHING') {
        matchFilter = student.supportFlags.length > 0;
      } else if (activeFilter === 'PLACED') {
        matchFilter = student.status === 'Placed';
      } else if (activeFilter === 'INTERVIEWING') {
        matchFilter = student.status === 'Interviewing';
      } else if (activeFilter === 'SEEKING') {
        matchFilter = student.status === 'Seeking';
      }

      return matchSearch && matchFilter;
    });

    const grid = document.getElementById('students-card-grid');
    const countBadge = document.getElementById('students-filtered-count');
    if (countBadge) countBadge.textContent = `${filtered.length} students shown`;

    if (!grid) return;

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 4rem; background: var(--bg-surface); border-radius: var(--radius-lg); border: 1px solid var(--border-subtle);">
          <p style="color: var(--text-secondary); font-size: 1.05rem;">No candidates matched your search and filter criteria.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = filtered.map(student => {
      const latest = student.latestActivity;
      const latestColor = latest?.reportType === 'Acceptance' ? '#10B981' : (latest?.reportType === 'Offer' ? '#F59E0B' : '#3B82F6');

      return `
        <div class="student-card" data-unity="${student.unityID}">
          <div class="student-card-header">
            <img 
              src="${student.avatarUrl}" 
              alt="${student.name}" 
              class="student-avatar"
              onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(student.name)}&background=1E293B&color=F8FAFC'"
            />
            <div class="student-info">
              <h4 class="student-name" title="${student.name}">${student.name}</h4>
              <div class="student-unity">${student.unityID}</div>
              <div style="margin-top: 0.35rem; display: flex; gap: 0.35rem; align-items: center; flex-wrap: wrap;">
                ${getStatusBadge(student.status)}
                ${student.supportFlags.length > 0 ? `<span class="badge badge-coaching">${student.supportFlags[0].label}</span>` : ''}
              </div>
            </div>
          </div>

          ${renderMiniFunnel(student)}

          <!-- Most Recent Activity Callout -->
          <div style="margin: 0.65rem 0; padding: 0.55rem 0.75rem; background: rgba(255,255,255,0.03); border-radius: var(--radius-sm); border-left: 3px solid ${latestColor}; font-size: 0.775rem;">
            <div style="font-weight: 600; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${latest ? `${latest.reportType}${latest.stage ? `: ${latest.stage}` : ''} • ${latest.company}` : 'No activity logged yet'}
            </div>
            <div style="color: var(--text-muted); font-size: 0.725rem; margin-top: 0.2rem;">
              ${latest ? `Updated: ${latest.timestamp}` : 'Awaiting first response'}
            </div>
          </div>

          <div class="student-card-meta">
            <span>${student.totalInterviews} interviews logged</span>
            <span style="font-weight: 600; color: ${student.offersCount > 0 ? '#F59E0B' : 'inherit'};">
              ${student.offersCount} ${student.offersCount === 1 ? 'offer' : 'offers'}
            </span>
          </div>
        </div>
      `;
    }).join('');

    // Attach click listeners to cards
    grid.querySelectorAll('.student-card').forEach(card => {
      card.addEventListener('click', () => {
        const unity = card.getAttribute('data-unity');
        const student = data.students.find(s => s.unityID === unity);
        if (student) openStudentDrawer(student);
      });
    });
  }

  container.innerHTML = `
    <div class="section-header">
      <div>
        <h2 class="section-title">Student Pipeline & Coaching Radar</h2>
        <p class="section-desc">Search candidate progress, inspect interview histories, and triage candidates needing targeted interview preparation</p>
      </div>
      <div style="display: flex; gap: 0.75rem; align-items: center;">
        <button class="info-pill btn-inspect-kpi" data-key="stalled_early_flag">Inspect Coaching Flag Rules</button>
        <span class="badge badge-placed" id="students-filtered-count">${data.students.length} students</span>
      </div>
    </div>

    <!-- Filter & Category Pill Toolbar -->
    <div class="filter-toolbar">
      <div class="search-box">
        <svg class="search-icon" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd" />
        </svg>
        <input type="text" id="student-search-input" class="search-input" placeholder="Search by name or UnityID...">
      </div>

      <div class="filter-pills">
        <button class="pill-btn active" data-filter="ALL">All Enrolled (75)</button>
        <button class="pill-btn pill-alert" data-filter="COACHING">Needs Coaching Radar (${flaggedCount})</button>
        <button class="pill-btn" data-filter="PLACED">Placed (${data.placedCount})</button>
        <button class="pill-btn" data-filter="INTERVIEWING">Active Interviews (${data.interviewingCount})</button>
        <button class="pill-btn" data-filter="SEEKING">Seeking (${data.seekingCount})</button>
      </div>
    </div>

    <!-- Students Card Grid -->
    <div id="students-card-grid" class="students-grid"></div>
  `;

  // Bind filter events
  const searchInput = document.getElementById('student-search-input');
  searchInput?.addEventListener('input', (e) => {
    searchTerm = e.target.value;
    filterAndDisplay();
  });

  const pillButtons = container.querySelectorAll('.pill-btn');
  pillButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      pillButtons.forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      activeFilter = e.currentTarget.getAttribute('data-filter');
      filterAndDisplay();
    });
  });

  container.querySelector('.btn-inspect-kpi')?.addEventListener('click', () => {
    openInspector('stalled_early_flag');
  });

  filterAndDisplay();
}
