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
    <div class="card" style="margin-bottom: 1.5rem; border-color: rgba(16, 185, 129, 0.4); background: rgba(16, 185, 129, 0.05);">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
        <div>
          <span class="badge badge-placed" style="margin-bottom: 0.5rem;">Accepted Employment Offer</span>
          <h4 style="font-size: 1.15rem; font-weight: 700;">${student.acceptance.company}</h4>
          <p style="color: var(--text-secondary); font-size: 0.9rem;">${student.acceptance.role}</p>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 1.25rem; font-weight: 800; color: #10B981;">
            $${student.acceptance.compensation.total.toLocaleString()}
          </div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">First-Year Total Comp</div>
        </div>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; font-size: 0.8rem; color: var(--text-secondary); border-top: 1px solid var(--border-subtle); padding-top: 0.75rem;">
        <div>Base Salary: <strong style="color: var(--text-primary);">$${student.acceptance.compensation.base.toLocaleString()}</strong></div>
        <div>Bonus: <strong style="color: var(--text-primary);">$${student.acceptance.compensation.bonus.toLocaleString()}</strong></div>
        <div>Location: <strong style="color: var(--text-primary);">${student.acceptance.location || 'N/A'}</strong></div>
        <div>Work Mode: <strong style="color: var(--text-primary);">${student.acceptance.workingConditions || 'N/A'}</strong></div>
      </div>
    </div>
  ` : '';

  const flagsInfo = student.supportFlags.length > 0 ? `
    <div style="margin-bottom: 1.5rem; padding: 1rem; border-radius: var(--radius-md); background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3);">
      <div style="display: flex; align-items: center; gap: 0.5rem; color: #EF4444; font-weight: 700; font-size: 0.85rem; margin-bottom: 0.5rem;">
        <span>Career Services Coaching Notice</span>
      </div>
      ${student.supportFlags.map(f => `
        <div style="font-size: 0.8rem; margin-top: 0.35rem; color: #CBD5E1;">
          <strong>${f.label}:</strong> ${f.reason}
        </div>
      `).join('')}
    </div>
  ` : '';

  // Combine interviews and offers chronologically
  const allEvents = [...student.interviews, ...student.offers];
  if (student.acceptance) allEvents.push(student.acceptance);
  allEvents.sort((a, b) => (b.date || 0) - (a.date || 0));

  content.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem;">
      <div style="display: flex; align-items: center; gap: 1rem;">
        <img 
          src="${student.avatarUrl}" 
          alt="${student.name}" 
          class="student-avatar"
          style="width: 64px; height: 64px;"
          onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(student.name)}&background=1E293B&color=F8FAFC'"
        />
        <div>
          <h3 style="font-size: 1.35rem; font-weight: 700;">${student.name}</h3>
          <p style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted);">${student.email} • ${student.unityID}</p>
          <div style="margin-top: 0.35rem;">
            ${getStatusBadge(student.status)}
          </div>
        </div>
      </div>
      <button id="btn-close-drawer" class="modal-close-btn">&times;</button>
    </div>

    ${flagsInfo}
    ${acceptedInfo}

    <div style="margin-bottom: 1.5rem;">
      <h4 style="font-size: 0.95rem; font-weight: 600; margin-bottom: 0.75rem;">Recruitment Funnel Progress</h4>
      ${renderMiniFunnel(student)}
      <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted); margin-top: 0.35rem;">
        <span>Screen (${student.screensCount})</span>
        <span>Round 1 (${student.firstRoundsCount})</span>
        <span>Round 2 (${student.secondRoundsCount})</span>
        <span>Final (${student.finalRoundsCount})</span>
        <span>Offers (${student.offersCount})</span>
      </div>
    </div>

    <div>
      <h4 style="font-size: 0.95rem; font-weight: 600; margin-bottom: 0.5rem;">Activity History (${allEvents.length} Entries)</h4>
      ${allEvents.length === 0 ? `
        <p style="color: var(--text-muted); font-size: 0.85rem; padding: 1rem; background: var(--bg-secondary); border-radius: var(--radius-md);">
          No interviews or offers logged yet for this candidate.
        </p>
      ` : `
        <div class="timeline">
          ${allEvents.map(evt => {
            const isOffer = evt.reportType === 'Offer';
            const isAcceptance = evt.reportType === 'Acceptance';
            const dotClass = isAcceptance ? 'dot-placed' : (isOffer ? 'dot-offer' : '');

            return `
              <div class="timeline-item">
                <div class="timeline-dot ${dotClass}"></div>
                <div class="timeline-content">
                  <div class="timeline-header">
                    <span>${evt.timestamp || 'Recent'}</span>
                    <span class="badge ${isAcceptance ? 'badge-placed' : (isOffer ? 'badge-offer' : 'badge-interviewing')}">
                      ${evt.reportType} ${evt.stage ? `• ${evt.stage}` : ''}
                    </span>
                  </div>
                  <div class="timeline-title">${evt.company}</div>
                  <div class="timeline-desc">${evt.role || evt.department || 'Analytics Specialist'}</div>
                  ${evt.source && evt.source !== 'Unspecified' ? `
                    <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">
                      Source: <strong>${evt.source}</strong>
                    </div>
                  ` : ''}
                  ${evt.notes ? `
                    <div class="timeline-feedback">
                      <strong>Interview Notes:</strong> "${evt.notes}"
                    </div>
                  ` : ''}
                  ${evt.wantsMeeting ? `
                    <div style="margin-top: 0.5rem; font-size: 0.75rem; color: #EF4444; font-weight: 600;">
                      * Requested Career Services Meeting
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
}

export function closeStudentDrawer() {
  const drawer = document.getElementById('student-drawer');
  if (drawer) {
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
  }
}

/**
 * Main Student Directory Renderer
 */
export function renderStudentDirectory(container, data) {
  let searchTerm = '';
  let statusFilter = 'ALL';
  let stageFilter = 'ALL';

  function filterAndDisplay() {
    let filtered = data.students.filter(student => {
      const matchSearch = 
        student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.unityID.toLowerCase().includes(searchTerm.toLowerCase());

      const matchStatus = 
        statusFilter === 'ALL' ||
        (statusFilter === 'FLAGGED' ? student.supportFlags.length > 0 : student.status === statusFilter);

      const matchStage = 
        stageFilter === 'ALL' || student.highestStage.includes(stageFilter);

      return matchSearch && matchStatus && matchStage;
    });

    const grid = document.getElementById('students-card-grid');
    const countBadge = document.getElementById('students-filtered-count');
    if (countBadge) countBadge.textContent = `${filtered.length} students found`;

    if (!grid) return;

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; background: var(--bg-surface); border-radius: var(--radius-lg); border: 1px solid var(--border-subtle);">
          <p style="color: var(--text-secondary); font-size: 1rem;">No students matched the selected search and filter criteria.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = filtered.map(student => `
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
              ${student.supportFlags.length > 0 ? '<span class="badge badge-coaching">Coaching Flag</span>' : ''}
            </div>
          </div>
        </div>

        ${renderMiniFunnel(student)}

        <div class="student-card-meta">
          <span>${student.totalInterviews} interviews logged</span>
          <span style="font-weight: 600; color: ${student.offersCount > 0 ? '#F59E0B' : 'inherit'};">
            ${student.offersCount} ${student.offersCount === 1 ? 'offer' : 'offers'}
          </span>
        </div>
      </div>
    `).join('');

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
        <h2 class="section-title">Student Recruitment Directory</h2>
        <p class="section-desc">Search, filter, and review individual candidate pipeline progress and interview histories</p>
      </div>
      <span class="badge badge-placed" id="students-filtered-count">${data.students.length} students enrolled</span>
    </div>

    <!-- Filter & Search Toolbar -->
    <div class="filter-toolbar">
      <div class="search-box">
        <svg class="search-icon" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd" />
        </svg>
        <input type="text" id="student-search-input" class="search-input" placeholder="Search student name or UnityID...">
      </div>

      <div class="filter-group">
        <label for="filter-status-select" class="filter-label">Status:</label>
        <select id="filter-status-select" class="select-control">
          <option value="ALL">All Statuses</option>
          <option value="Placed">Placed (Offer Accepted)</option>
          <option value="Has Offer">Has Active Offer</option>
          <option value="Interviewing">Active in Interviews</option>
          <option value="Seeking">Seeking Opportunities</option>
          <option value="FLAGGED">Flagged for Coaching</option>
        </select>
      </div>

      <div class="filter-group">
        <label for="filter-stage-select" class="filter-label">Highest Stage:</label>
        <select id="filter-stage-select" class="select-control">
          <option value="ALL">All Stages</option>
          <option value="Offer Accepted">Offer Accepted</option>
          <option value="Job Offer">Job Offer Received</option>
          <option value="Final Round">Final Round</option>
          <option value="Second Round">Second Round</option>
          <option value="First Round">First Round</option>
          <option value="Recruiter Screen">Recruiter Screen</option>
        </select>
      </div>
    </div>

    <!-- Students Card Grid -->
    <div id="students-card-grid" class="students-grid"></div>
  `;

  // Bind filter events
  const searchInput = document.getElementById('student-search-input');
  const statusSelect = document.getElementById('filter-status-select');
  const stageSelect = document.getElementById('filter-stage-select');

  searchInput?.addEventListener('input', (e) => {
    searchTerm = e.target.value;
    filterAndDisplay();
  });

  statusSelect?.addEventListener('change', (e) => {
    statusFilter = e.target.value;
    filterAndDisplay();
  });

  stageSelect?.addEventListener('change', (e) => {
    stageFilter = e.target.value;
    filterAndDisplay();
  });

  filterAndDisplay();
}
