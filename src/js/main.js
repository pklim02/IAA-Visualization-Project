import { dataService } from './dataService.js';

let currentMode = 'overview'; // 'overview' | 'student-entry'
let selectedUnityID = null;
let entryUnityID = null;
let searchTerm = '';
let attentionFilter = 'all'; // 'all' | 'needs_attention' | 'meeting' | 'offer_decision' | 'closing'

function getStatusBadgeClass(status) {
  switch (status) {
    case 'Placed': return 'badge-placed';
    case 'Has Offer': return 'badge-offer';
    case 'Interviewing': return 'badge-interviewing';
    default: return 'badge-seeking';
  }
}

function getAttentionBadgeClass(level) {
  switch (level) {
    case 'urgent': return 'badge-attention-urgent';
    case 'warning': return 'badge-attention-warning';
    case 'info': return 'badge-attention-info';
    default: return 'badge-attention-muted';
  }
}

function getAttentionGuidance(flag) {
  switch (flag.type) {
    case 'closing_support':
      return 'Candidate has reached > 2 final rounds with 0 offers. Recommended: Schedule 1-on-1 mock interview and final-round presentation coaching.';
    case 'offer_decision':
      return 'Candidate has held an unaccepted offer for > 4 days. Recommended: Confirm offer expiration timeline and assist with decision evaluation or negotiation.';
    case 'multi_offer':
      return 'Candidate is holding 2 or more concurrent active offers. Recommended: Decision matrix coaching to prioritize offers gracefully.';
    case 'meeting_wanted':
      return 'Candidate explicitly requested a meeting with Career Services in their latest submission.';
    case 'post_meeting':
      return 'Placed candidate requested a follow-up consultation regarding their accepted offer.';
    case 'withdraw_check':
      return 'Placed candidate has interviews logged after acceptance. Recommended: Remind candidate to formally withdraw from remaining interview loops.';
    case 'screening_polish':
      return 'Candidate has completed 4+ recruiter screenings without advancing to second or final rounds. Recommended: Review 30-second pitch and resume alignment.';
    case 'stalled':
      return 'Candidate has logged zero recruitment activity in the past 30 days. Recommended: Wellness and job search check-in.';
    default:
      return '';
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** ----------------------------------------------------
 *  MODE 1: CANDIDATE OVERVIEW (2-COLUMN MASTER-DETAIL)
 *  ---------------------------------------------------- */
function renderOverview(container, data) {
  const students = data.students || [];
  const attentionCounts = data.attention || {
    totalNeedsAttention: 0,
    meetingWanted: 0,
    offerImpending: 0,
    closingSupport: 0
  };

  // Filter candidates by search term AND attention filter
  const filteredStudents = students.filter(s => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matches = s.name.toLowerCase().includes(term) || s.unityID.toLowerCase().includes(term);
      if (!matches) return false;
    }

    if (attentionFilter === 'needs_attention') {
      return s.attentionFlag !== null;
    } else if (attentionFilter === 'meeting') {
      return s.attentionFlags && s.attentionFlags.some(f => f.type === 'meeting_wanted' || f.type === 'post_meeting');
    } else if (attentionFilter === 'offer_decision') {
      return s.attentionFlags && s.attentionFlags.some(f => f.type === 'offer_decision');
    } else if (attentionFilter === 'closing') {
      return s.attentionFlags && s.attentionFlags.some(f => f.type === 'closing_support');
    }
    return true;
  });

  // Ensure selected student exists
  if (!selectedUnityID && filteredStudents.length > 0) {
    selectedUnityID = filteredStudents[0].unityID;
  } else if (selectedUnityID && !students.some(s => s.unityID === selectedUnityID) && filteredStudents.length > 0) {
    selectedUnityID = filteredStudents[0].unityID;
  }

  const selectedStudent = students.find(s => s.unityID === selectedUnityID) || filteredStudents[0] || null;

  // Prepare accepted offer section markup
  let acceptedCard = '';
  if (selectedStudent && selectedStudent.isPlaced && selectedStudent.acceptanceRecord) {
    const acc = selectedStudent.acceptanceRecord;
    const compRole = acc['Please list the company name and job title. '] || acc['Please list the company name and job title.'] || 'N/A';
    const breakdown = acc['What is the final offer? Please break down by salary and bonuses.'] || 'N/A';
    const loc = acc['Where is the job located (city/state)? '] || acc['Where is the job located (city/state)?'] || 'N/A';
    const conditions = acc['What are the working conditions? '] || acc['What are the working conditions?'] || 'N/A';

    acceptedCard = `
      <div class="card accepted-card">
        <h3 class="section-title">ACCEPTED POSITION (Verbatim from CSV)</h3>
        <div class="accepted-grid">
          <div class="field-item">
            <span class="field-label">Company &amp; Role:</span>
            <span class="field-value highlight">${escapeHtml(compRole)}</span>
          </div>
          <div class="field-item">
            <span class="field-label">Offer Breakdown:</span>
            <span class="field-value">${escapeHtml(breakdown)}</span>
          </div>
          <div class="field-item">
            <span class="field-label">Location:</span>
            <span class="field-value">${escapeHtml(loc)}</span>
          </div>
          <div class="field-item">
            <span class="field-label">Conditions:</span>
            <span class="field-value">${escapeHtml(conditions)}</span>
          </div>
        </div>
      </div>
    `;
  } else if (selectedStudent) {
    acceptedCard = `
      <div class="card accepted-card neutral-state">
        <h3 class="section-title">ACCEPTED POSITION (Verbatim from CSV)</h3>
        <p class="neutral-text">No accepted offer recorded yet. Candidate is currently active in recruitment.</p>
      </div>
    `;
  }

  // Prepare raw activity stream (most recent first)
  let historyList = '<div class="empty-stream">No recruitment activities logged yet for this candidate.</div>';
  if (selectedStudent && selectedStudent.history && selectedStudent.history.length > 0) {
    historyList = selectedStudent.history.map(row => {
      const type = (row['What are you reporting today?'] || 'Submission').trim();
      const timestamp = row['Timestamp'] || '';

      if (type === 'Acceptance') {
        const title = row['Please list the company name and job title. '] || row['Please list the company name and job title.'] || 'Offer Accepted';
        const comp = row['What is the final offer? Please break down by salary and bonuses.'] || '';
        const loc = row['Where is the job located (city/state)? '] || row['Where is the job located (city/state)?'] || '';
        return `
          <div class="stream-item stream-acceptance">
            <div class="stream-meta">
              <span class="stream-tag tag-acceptance">[Acceptance]</span>
              <span class="stream-date">${escapeHtml(timestamp)}</span>
            </div>
            <div class="stream-title">${escapeHtml(title)}</div>
            ${comp ? `<div class="stream-detail"><strong>Offer:</strong> ${escapeHtml(comp)}</div>` : ''}
            ${loc ? `<div class="stream-sub">Location: ${escapeHtml(loc)}</div>` : ''}
          </div>
        `;
      } else if (type === 'Offer') {
        const title = row['Please list the company and job title'] || 'Job Offer';
        const meeting = row['Do you want to meet with career services to discuss further?:'] || row['Do you want to meet with career services to discuss further?'] || '';
        return `
          <div class="stream-item stream-offer">
            <div class="stream-meta">
              <span class="stream-tag tag-offer">[Offer]</span>
              <span class="stream-date">${escapeHtml(timestamp)}</span>
            </div>
            <div class="stream-title">${escapeHtml(title)}</div>
            ${meeting ? `<div class="stream-sub">Meet with Career Services: ${escapeHtml(meeting)}</div>` : ''}
          </div>
        `;
      } else {
        const title = row['Please list the company, position, department/division. '] || row['Please list the company, position, department/division.'] || 'Interview';
        const stage = row['Which interview was this? '] || row['Which interview was this?'] || '';
        const source = row['How did you hear about the job?'] || '';
        const notes = row['Were there any technical concepts or questions that were challenging or new to you? '] || row['Were there any technical concepts or questions that were challenging or new to you?'] || '';
        return `
          <div class="stream-item stream-interview">
            <div class="stream-meta">
              <span class="stream-tag tag-interview">[Interview${stage ? ` - ${escapeHtml(stage)}` : ''}]</span>
              <span class="stream-date">${escapeHtml(timestamp)}</span>
            </div>
            <div class="stream-title">${escapeHtml(title)}</div>
            ${source ? `<div class="stream-sub">Source: ${escapeHtml(source)}</div>` : ''}
            ${notes ? `<div class="stream-notes"><strong>Notes:</strong> ${escapeHtml(notes)}</div>` : ''}
          </div>
        `;
      }
    }).join('');
  }

  container.innerHTML = `
    <div class="master-detail-layout">
      <!-- Left Column: CANDIDATE LIST -->
      <aside class="candidates-sidebar">
        <div class="sidebar-header">
          <div class="sidebar-header-row">
            <span class="sidebar-title">CANDIDATE LIST</span>
            <span class="sidebar-count">${filteredStudents.length} / ${students.length}</span>
          </div>
          <input 
            type="text" 
            id="search-input" 
            class="search-input" 
            placeholder="Filter candidates..." 
            value="${escapeHtml(searchTerm)}"
          />
          <div class="attention-filter-strip">
            <button class="filter-chip ${attentionFilter === 'all' ? 'active' : ''}" data-filter="all">
              All (${students.length})
            </button>
            <button class="filter-chip chip-attention ${attentionFilter === 'needs_attention' ? 'active' : ''}" data-filter="needs_attention">
              Needs Attention (${attentionCounts.totalNeedsAttention || 0})
            </button>
            ${(attentionCounts.meetingWanted || 0) > 0 ? `
              <button class="filter-chip chip-urgent ${attentionFilter === 'meeting' ? 'active' : ''}" data-filter="meeting">
                Meetings (${attentionCounts.meetingWanted})
              </button>
            ` : ''}
            ${(attentionCounts.offerImpending || 0) > 0 ? `
              <button class="filter-chip chip-warning ${attentionFilter === 'offer_decision' ? 'active' : ''}" data-filter="offer_decision">
                Offers &gt; 4d (${attentionCounts.offerImpending})
              </button>
            ` : ''}
            ${(attentionCounts.closingSupport || 0) > 0 ? `
              <button class="filter-chip chip-urgent ${attentionFilter === 'closing' ? 'active' : ''}" data-filter="closing">
                Closing (${attentionCounts.closingSupport})
              </button>
            ` : ''}
          </div>
        </div>

        <div class="candidates-scroll">
          ${filteredStudents.length === 0 ? `
            <div class="empty-candidates">No candidates match the selected filter.</div>
          ` : filteredStudents.map(s => `
            <div 
              class="candidate-row ${s.unityID === selectedUnityID ? 'selected' : ''}" 
              data-id="${s.unityID}"
            >
              <img 
                src="${s.avatarUrl}" 
                alt="${escapeHtml(s.name)}" 
                class="candidate-avatar"
                onerror="this.src='/data/avatars/default.png'"
              />
              <div class="candidate-meta">
                <div class="candidate-name">${escapeHtml(s.name)}</div>
                <div class="candidate-sub">
                  <span class="candidate-unity">${escapeHtml(s.unityID)}</span>
                  <span class="status-badge ${getStatusBadgeClass(s.status)}">${s.status}</span>
                </div>
                ${s.attentionFlags && s.attentionFlags.length > 0 ? `
                  <div class="candidate-flags-stack">
                    ${s.attentionFlags.map(f => `
                      <span class="attention-badge ${getAttentionBadgeClass(f.level)}" title="${escapeHtml(f.label)}">
                        ${escapeHtml(f.label)}
                      </span>
                    `).join('')}
                  </div>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </aside>

      <!-- Right Column: CANDIDATE DETAILS -->
      <section class="candidate-detail-pane">
        ${!selectedStudent ? `
          <div class="empty-selection">Select a candidate on the left to view dossier</div>
        ` : `
          <!-- Candidate Header -->
          <div class="dossier-header">
            <img 
              src="${selectedStudent.avatarUrl}" 
              alt="${escapeHtml(selectedStudent.name)}" 
              class="dossier-avatar"
              onerror="this.src='/data/avatars/default.png'"
            />
            <div>
              <h2 class="dossier-name">${escapeHtml(selectedStudent.name)}</h2>
              <div class="dossier-sub">
                <span>${escapeHtml(selectedStudent.email)}</span>
                <span class="dot">&bull;</span>
                <span>Status: <span class="status-badge ${getStatusBadgeClass(selectedStudent.status)}">${selectedStudent.status}</span></span>
                ${selectedStudent.attentionFlags && selectedStudent.attentionFlags.length > 0 ? `
                  <span class="dot">&bull;</span>
                  <span class="dossier-flags-stack">
                    ${selectedStudent.attentionFlags.map(f => `
                      <span class="attention-badge ${getAttentionBadgeClass(f.level)}">${escapeHtml(f.label)}</span>
                    `).join(' ')}
                  </span>
                ` : ''}
              </div>
            </div>
          </div>

          <!-- Attention Alert Box (If Flagged - Stacks All Active Signals) -->
          ${selectedStudent.attentionFlags && selectedStudent.attentionFlags.length > 0 ? `
            <div class="card attention-alert-box alert-stacked">
              <div class="alert-title-row">
                <strong class="alert-title-text">
                  Career Services Action Recommended (${selectedStudent.attentionFlags.length} active flag${selectedStudent.attentionFlags.length > 1 ? 's' : ''})
                </strong>
              </div>
              <div class="alert-items-stack">
                ${selectedStudent.attentionFlags.map(f => `
                  <div class="alert-item alert-${f.level}">
                    <div class="alert-item-header">
                      <span class="attention-badge ${getAttentionBadgeClass(f.level)}">${escapeHtml(f.label)}</span>
                    </div>
                    <p class="alert-guidance">${escapeHtml(getAttentionGuidance(f))}</p>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- SUMMARY Section -->
          <div class="card summary-card">
            <h3 class="section-title">SUMMARY</h3>
            <div class="summary-grid">
              <div class="summary-metric">
                <span class="metric-num">${selectedStudent.interviewCount}</span>
                <span class="metric-label">Total Interviews</span>
              </div>
              <div class="summary-metric">
                <span class="metric-num">${selectedStudent.offerCount}</span>
                <span class="metric-label">Total Offers</span>
              </div>
              <div class="summary-metric">
                <span class="metric-num metric-status">${selectedStudent.status}</span>
                <span class="metric-label">Current Status</span>
              </div>
            </div>
          </div>

          <!-- ACCEPTED POSITION (Verbatim from CSV) -->
          ${acceptedCard}

          <!-- LOGGED SUBMISSIONS Stream -->
          <div class="card history-card">
            <h3 class="section-title">LOGGED SUBMISSIONS (${selectedStudent.history ? selectedStudent.history.length : 0} events)</h3>
            <div class="stream-container">
              ${historyList}
            </div>
          </div>
        `}
      </section>
    </div>
  `;

  // Search input handler
  const searchInputEl = container.querySelector('#search-input');
  searchInputEl?.addEventListener('input', (e) => {
    searchTerm = e.target.value;
    renderApp();
    const el = document.getElementById('search-input');
    if (el) {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
  });

  // Attention filter chips click handler
  container.querySelectorAll('.filter-chip').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      attentionFilter = btn.getAttribute('data-filter') || 'all';
      renderApp();
    });
  });

  // Candidate selection click handler
  container.querySelectorAll('.candidate-row').forEach(row => {
    row.addEventListener('click', () => {
      selectedUnityID = row.getAttribute('data-id');
      renderApp();
    });
  });
}

/** ----------------------------------------------------
 *  MODE 2: CLASS ANALYTICS (AGGREGATED COHORT VISUALS)
 *  ---------------------------------------------------- */
function renderAnalytics(container, data) {
  const total = data.totalStudents || 75;
  const placedCount = data.placedCount || 0;
  const offerCount = data.offerCount || 0;
  const interviewCount = data.interviewingCount || 0;
  const seekingCount = data.seekingCount || 0;

  const placedPct = total > 0 ? Math.round((placedCount / total) * 100) : 0;
  const offerPct = total > 0 ? Math.round((offerCount / total) * 100) : 0;
  const interviewPct = total > 0 ? Math.round((interviewCount / total) * 100) : 0;
  const seekingPct = Math.max(0, 100 - placedPct - offerPct - interviewPct);

  const funnel = data.funnel || { screening: 0, roundOneTwo: 0, finalRound: 0, offers: 0, acceptance: 0 };
  const attention = data.attention || {
    totalNeedsAttention: 0,
    meetingWanted: 0,
    offerImpending: 0,
    closingSupport: 0,
    multiOffer: 0,
    screeningPolish: 0,
    stalled: 0
  };

  const topCompanies = data.topCompanies || [];
  const topSources = data.topSources || [];
  const maxCompanyCount = topCompanies.length > 0 ? topCompanies[0].count : 1;
  const totalSourcesCount = topSources.reduce((acc, s) => acc + s.count, 0) || 1;

  container.innerHTML = `
    <div class="analytics-page">
      <div class="analytics-header">
        <div>
          <h2 class="analytics-title">Cohort Recruitment Analytics</h2>
          <div class="analytics-sub">Class of 2027 &bull; ${total} Total Candidates &bull; ${data.totalSubmissions} Logged Activity Records</div>
        </div>
      </div>

      <!-- VISUAL 1: COHORT PLACEMENT MILESTONE GAUGE -->
      <div class="card analytics-card">
        <div class="card-header-clean">
          <h3 class="section-title">1. Cohort Placement Progress (${placedPct}% Placed)</h3>
          <span class="card-meta-tag">${placedCount} of ${total} Candidates Placed</span>
        </div>

        <!-- Horizontal Segmented Progress Bar -->
        <div class="milestone-bar-container">
          <div class="milestone-segment seg-placed" style="width: ${placedPct}%;" title="Placed: ${placedCount} (${placedPct}%)"></div>
          <div class="milestone-segment seg-offer" style="width: ${offerPct}%;" title="Holding Offer: ${offerCount} (${offerPct}%)"></div>
          <div class="milestone-segment seg-interview" style="width: ${interviewPct}%;" title="Interviewing: ${interviewCount} (${interviewPct}%)"></div>
          <div class="milestone-segment seg-seeking" style="width: ${seekingPct}%;" title="Seeking: ${seekingCount} (${seekingPct}%)"></div>
        </div>

        <!-- Milestone Legend / Stats -->
        <div class="milestone-legend-grid">
          <div class="legend-box item-placed">
            <div class="legend-color-dot dot-placed"></div>
            <div>
              <div class="legend-val">${placedCount} <span class="legend-pct">(${placedPct}%)</span></div>
              <div class="legend-label">Placed (Accepted)</div>
            </div>
          </div>
          <div class="legend-box item-offer">
            <div class="legend-color-dot dot-offer"></div>
            <div>
              <div class="legend-val">${offerCount} <span class="legend-pct">(${offerPct}%)</span></div>
              <div class="legend-label">Holding Offers</div>
            </div>
          </div>
          <div class="legend-box item-interview">
            <div class="legend-color-dot dot-interview"></div>
            <div>
              <div class="legend-val">${interviewCount} <span class="legend-pct">(${interviewPct}%)</span></div>
              <div class="legend-label">Actively Interviewing</div>
            </div>
          </div>
          <div class="legend-box item-seeking">
            <div class="legend-color-dot dot-seeking"></div>
            <div>
              <div class="legend-val">${seekingCount} <span class="legend-pct">(${seekingPct}%)</span></div>
              <div class="legend-label">Seeking Opportunities</div>
            </div>
          </div>
        </div>
      </div>

      <!-- VISUAL 2: RECRUITMENT PIPELINE FUNNEL HEALTH -->
      <div class="card analytics-card">
        <h3 class="section-title">2. Recruitment Pipeline Conversion Funnel</h3>
        <div class="funnel-grid">
          <div class="funnel-step">
            <div class="funnel-step-num">${funnel.screening}</div>
            <div class="funnel-step-name">Recruiter Screenings</div>
            <div class="funnel-step-sub">Initial touches</div>
          </div>
          <div class="funnel-arrow">&rarr;</div>

          <div class="funnel-step">
            <div class="funnel-step-num">${funnel.roundOneTwo}</div>
            <div class="funnel-step-name">Technical / 1st &amp; 2nd</div>
            <div class="funnel-step-sub">In-depth evaluations</div>
          </div>
          <div class="funnel-arrow">&rarr;</div>

          <div class="funnel-step">
            <div class="funnel-step-num">${funnel.finalRound}</div>
            <div class="funnel-step-name">Final Rounds</div>
            <div class="funnel-step-sub">Superdays &amp; onsite</div>
          </div>
          <div class="funnel-arrow">&rarr;</div>

          <div class="funnel-step step-offer">
            <div class="funnel-step-num">${funnel.offers}</div>
            <div class="funnel-step-name">Offers Extended</div>
            <div class="funnel-step-sub">Formal job offers</div>
          </div>
          <div class="funnel-arrow">&rarr;</div>

          <div class="funnel-step step-placed">
            <div class="funnel-step-num">${funnel.acceptance}</div>
            <div class="funnel-step-name">Offers Accepted</div>
            <div class="funnel-step-sub">Secured placements</div>
          </div>
        </div>
      </div>

      <!-- VISUAL 3: COHORT ATTENTION & EARLY WARNING QUEUE -->
      <div class="card analytics-card">
        <div class="card-header-clean">
          <h3 class="section-title">3. Early Warning &amp; Candidate Intervention Queue</h3>
          <span class="card-meta-tag ${attention.totalNeedsAttention > 0 ? 'tag-warning' : 'tag-neutral'}">
            ${attention.totalNeedsAttention} Candidates Requiring Support
          </span>
        </div>

        <div class="attention-kpi-grid">
          <div class="attention-kpi-card kpi-urgent" data-jump="closing">
            <div class="kpi-card-header">
              <span class="kpi-card-badge badge-attention-urgent">Closing Support</span>
              <span class="kpi-card-count">${attention.closingSupport}</span>
            </div>
            <div class="kpi-card-desc">&gt; 2 Final Rounds and 0 Offers received. Needs 1-on-1 presentation / mock interview coaching.</div>
            <button class="kpi-jump-btn" data-jump="closing">View Candidates &rarr;</button>
          </div>

          <div class="attention-kpi-card kpi-warning" data-jump="offer_decision">
            <div class="kpi-card-header">
              <span class="kpi-card-badge badge-attention-warning">Decision Needed</span>
              <span class="kpi-card-count">${attention.offerImpending}</span>
            </div>
            <div class="kpi-card-desc">Holding an unaccepted offer for &gt; 4 days. Needs offer deadline check &amp; negotiation guidance.</div>
            <button class="kpi-jump-btn" data-jump="offer_decision">View Candidates &rarr;</button>
          </div>

          <div class="attention-kpi-card kpi-urgent" data-jump="meeting">
            <div class="kpi-card-header">
              <span class="kpi-card-badge badge-attention-urgent">Meeting Wanted</span>
              <span class="kpi-card-count">${attention.meetingWanted}</span>
            </div>
            <div class="kpi-card-desc">Candidate explicitly requested a 1-on-1 Career Services meeting in their latest submission.</div>
            <button class="kpi-jump-btn" data-jump="meeting">View Candidates &rarr;</button>
          </div>

          <div class="attention-kpi-card kpi-info" data-jump="needs_attention">
            <div class="kpi-card-header">
              <span class="kpi-card-badge badge-attention-info">Multi-Offer Review</span>
              <span class="kpi-card-count">${attention.multiOffer}</span>
            </div>
            <div class="kpi-card-desc">Candidate is holding 2 or more active concurrent offers. Needs decision prioritization.</div>
            <button class="kpi-jump-btn" data-jump="needs_attention">View Candidates &rarr;</button>
          </div>

          <div class="attention-kpi-card kpi-muted" data-jump="needs_attention">
            <div class="kpi-card-header">
              <span class="kpi-card-badge badge-attention-muted">Stalled (30+ Days)</span>
              <span class="kpi-card-count">${attention.stalled}</span>
            </div>
            <div class="kpi-card-desc">Active candidate has logged zero recruitment activity in the past 30 days. Needs check-in.</div>
            <button class="kpi-jump-btn" data-jump="needs_attention">View Candidates &rarr;</button>
          </div>
        </div>
      </div>

      <!-- VISUAL 4: TOP HIRING PARTNERS & CHANNEL YIELD -->
      <div class="analytics-dual-row">
        <!-- Top Employers -->
        <div class="card analytics-card">
          <h3 class="section-title">4A. Top Hiring &amp; Offer Partners</h3>
          ${topCompanies.length === 0 ? `
            <div class="empty-stream">No employer offers recorded yet.</div>
          ` : `
            <div class="leaderboard-list">
              ${topCompanies.map(c => `
                <div class="leaderboard-row">
                  <div class="leaderboard-meta">
                    <span class="leaderboard-name">${escapeHtml(c.name)}</span>
                    <span class="leaderboard-count">${c.count} ${c.count === 1 ? 'offer' : 'offers'}</span>
                  </div>
                  <div class="leaderboard-track">
                    <div class="leaderboard-bar" style="width: ${(c.count / maxCompanyCount) * 100}%;"></div>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <!-- Sourcing Channels -->
        <div class="card analytics-card">
          <h3 class="section-title">4B. Interview Sourcing Channels</h3>
          ${topSources.length === 0 ? `
            <div class="empty-stream">No interview sources recorded yet.</div>
          ` : `
            <div class="leaderboard-list">
              ${topSources.map(s => {
                const pct = Math.round((s.count / totalSourcesCount) * 100);
                return `
                  <div class="leaderboard-row">
                    <div class="leaderboard-meta">
                      <span class="leaderboard-name">${escapeHtml(s.name)}</span>
                      <span class="leaderboard-count">${s.count} (${pct}%)</span>
                    </div>
                    <div class="leaderboard-track">
                      <div class="leaderboard-bar bar-teal" style="width: ${pct}%;"></div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>
      </div>
    </div>
  `;

  // Bind Jump-to-Overview buttons from Attention cards
  container.querySelectorAll('.kpi-jump-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const jumpFilter = btn.getAttribute('data-jump') || 'all';
      attentionFilter = jumpFilter;
      currentMode = 'overview';
      renderApp();
    });
  });
}

/** ----------------------------------------------------
 *  MODE 3: STUDENT ENTRY VIEW (SINGLE PAGE FORM)
 *  ---------------------------------------------------- */
function renderStudentEntry(container, students) {
  if (!entryUnityID && students.length > 0) {
    entryUnityID = selectedUnityID || students[0].unityID;
  }
  const currentStudent = students.find(s => s.unityID === entryUnityID) || students[0];

  container.innerHTML = `
    <div class="entry-page">
      <div class="entry-card">
        <div class="entry-header">
          <h2 class="entry-title">Student Self-Reporting Entry</h2>
          <p class="entry-sub">Select your profile from the dropdown to record a recruitment interview, offer, or acceptance</p>
        </div>

        <form id="student-submission-form">
          <!-- Identity Dropdown -->
          <div class="form-group" style="margin-bottom: 1.5rem;">
            <label for="entry-student-select" class="form-label">Select Who You Are (Unity ID) *</label>
            <select id="entry-student-select" class="form-input form-select" required>
              ${students.map(s => `
                <option value="${s.unityID}" ${s.unityID === currentStudent?.unityID ? 'selected' : ''}>
                  ${escapeHtml(s.name)} (${escapeHtml(s.unityID)} &bull; ${escapeHtml(s.email)})
                </option>
              `).join('')}
            </select>
          </div>

          <!-- Selected Student Profile Pill -->
          ${currentStudent ? `
            <div class="entry-profile-pill">
              <img 
                src="${currentStudent.avatarUrl}" 
                alt="${escapeHtml(currentStudent.name)}" 
                class="entry-pill-avatar"
                onerror="this.src='/data/avatars/default.png'"
              />
              <div>
                <strong>${escapeHtml(currentStudent.name)}</strong>
                <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.15rem;">
                  ${escapeHtml(currentStudent.unityID)} &bull; Current Status: 
                  <span class="status-badge ${getStatusBadgeClass(currentStudent.status)}">${currentStudent.status}</span>
                </div>
              </div>
            </div>
          ` : ''}

          <!-- What are you reporting? -->
          <div class="form-group" style="margin-bottom: 1.5rem;">
            <label for="entry-report-type" class="form-label">What are you reporting today? *</label>
            <select id="entry-report-type" class="form-input form-select" required>
              <option value="Interview">Interview Round</option>
              <option value="Offer">Job Offer Received</option>
              <option value="Acceptance">Job Acceptance (Signed Offer)</option>
            </select>
          </div>

          <!-- Dynamic Branch 1: Interview -->
          <div id="branch-interview" class="form-branch">
            <div class="form-group" style="margin-bottom: 1.25rem;">
              <label class="form-label">Company, Position, Department/Division *</label>
              <input type="text" id="f-interview-company" class="form-input" placeholder="e.g. Lumarion Health, Marketing Analytics Analyst, Risk Management" required>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.25rem;">
              <div class="form-group">
                <label class="form-label">Interview Stage *</label>
                <select id="f-interview-stage" class="form-input form-select">
                  <option value="Recruiter Screening">Recruiter Screening</option>
                  <option value="First Round">First Round</option>
                  <option value="Second Round">Second Round</option>
                  <option value="Final Round">Final Round</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">How did you hear about the job?</label>
                <select id="f-interview-source" class="form-input form-select">
                  <option value="Institute">Institute (Career Services)</option>
                  <option value="Alumni">Alumni</option>
                  <option value="LinkedIn">LinkedIn</option>
                  <option value="Company website">Company website</option>
                  <option value="Recruiter reached out">Recruiter reached out</option>
                  <option value="Referral from a friend">Referral from a friend</option>
                  <option value="Career fair">Career fair</option>
                </select>
              </div>
            </div>

            <div class="form-group" style="margin-bottom: 1.25rem;">
              <label class="form-label">Technical Concepts or Questions (Notes)</label>
              <textarea id="f-interview-notes" class="form-input" rows="3" placeholder="e.g. SQL window functions, CTEs, machine learning case study"></textarea>
            </div>
          </div>

          <!-- Dynamic Branch 2: Offer -->
          <div id="branch-offer" class="form-branch" style="display: none;">
            <div class="form-group" style="margin-bottom: 1.25rem;">
              <label class="form-label">Company and Job Title *</label>
              <input type="text" id="f-offer-company" class="form-input" placeholder="e.g. Evernight Financial, Data Scientist">
            </div>
            <div class="form-group" style="margin-bottom: 1.25rem;">
              <label class="form-label">Meet with Career Services to discuss? *</label>
              <select id="f-offer-meeting" class="form-input form-select">
                <option value="No">No</option>
                <option value="Yes">Yes, schedule a session</option>
              </select>
            </div>
          </div>

          <!-- Dynamic Branch 3: Acceptance -->
          <div id="branch-acceptance" class="form-branch" style="display: none;">
            <div class="form-group" style="margin-bottom: 1.25rem;">
              <label class="form-label">Company Name and Job Title *</label>
              <input type="text" id="f-accept-company" class="form-input" placeholder="e.g. Ventrali Energy, Data Scientist I">
            </div>
            <div class="form-group" style="margin-bottom: 1.25rem;">
              <label class="form-label">Final Offer Breakdown (Salary &amp; Bonus) *</label>
              <input type="text" id="f-accept-comp" class="form-input" placeholder="e.g. $102,000 base salary, $5,000 signing bonus">
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.25rem;">
              <div class="form-group">
                <label class="form-label">Job Location (City/State)</label>
                <input type="text" id="f-accept-location" class="form-input" placeholder="e.g. Philadelphia, PA">
              </div>
              <div class="form-group">
                <label class="form-label">Working Conditions</label>
                <select id="f-accept-conditions" class="form-input form-select">
                  <option value="Hybrid">Hybrid</option>
                  <option value="Fully on-site">Fully on-site</option>
                  <option value="Remote">Remote</option>
                </select>
              </div>
            </div>
          </div>

          <div style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 1.75rem;">
            <button type="submit" class="btn btn-primary" style="padding: 0.65rem 1.6rem;">
              Save Row to Database
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  // Student selection dropdown
  container.querySelector('#entry-student-select')?.addEventListener('change', (e) => {
    entryUnityID = e.target.value;
    renderApp();
  });

  // Report type branch switcher
  const typeSelect = container.querySelector('#entry-report-type');
  const bInterview = container.querySelector('#branch-interview');
  const bOffer = container.querySelector('#branch-offer');
  const bAccept = container.querySelector('#branch-acceptance');

  typeSelect?.addEventListener('change', (e) => {
    const val = e.target.value;
    if (bInterview) {
      bInterview.style.display = val === 'Interview' ? 'block' : 'none';
      const req = bInterview.querySelector('#f-interview-company');
      if (req) req.required = (val === 'Interview');
    }
    if (bOffer) {
      bOffer.style.display = val === 'Offer' ? 'block' : 'none';
      const req = bOffer.querySelector('#f-offer-company');
      if (req) req.required = (val === 'Offer');
    }
    if (bAccept) {
      bAccept.style.display = val === 'Acceptance' ? 'block' : 'none';
      const req1 = bAccept.querySelector('#f-accept-company');
      const req2 = bAccept.querySelector('#f-accept-comp');
      if (req1) req1.required = (val === 'Acceptance');
      if (req2) req2.required = (val === 'Acceptance');
    }
  });

  // Handle Form Submission
  const form = container.querySelector('#student-submission-form');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const stu = currentStudent;
    if (!stu) return;

    const repType = typeSelect?.value || 'Interview';
    const now = new Date();
    const formattedDate = `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()} ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    const newRow = {
      'Timestamp': formattedDate,
      'Email Address': stu.email,
      'Last, First Name': stu.name,
      'What are you reporting today?': repType,
      'Please list the company, position, department/division. ': '',
      'Which interview was this? ': '',
      'How did you hear about the job?': '',
      'Were there any technical concepts or questions that were challenging or new to you? ': '',
      'Please list the company and job title': '',
      'Do you want to meet with career services to discuss further?:': '',
      'Please list the company name and job title. ': '',
      'What is the final offer? Please break down by salary and bonuses.': '',
      'Where is the job located (city/state)? ': '',
      'What are the working conditions? ': ''
    };

    if (repType === 'Interview') {
      newRow['Please list the company, position, department/division. '] = container.querySelector('#f-interview-company')?.value || '';
      newRow['Which interview was this? '] = container.querySelector('#f-interview-stage')?.value || 'First Round';
      newRow['How did you hear about the job?'] = container.querySelector('#f-interview-source')?.value || 'Institute';
      newRow['Were there any technical concepts or questions that were challenging or new to you? '] = container.querySelector('#f-interview-notes')?.value || '';
    } else if (repType === 'Offer') {
      newRow['Please list the company and job title'] = container.querySelector('#f-offer-company')?.value || '';
      newRow['Do you want to meet with career services to discuss further?:'] = container.querySelector('#f-offer-meeting')?.value || 'No';
    } else if (repType === 'Acceptance') {
      newRow['Please list the company name and job title. '] = container.querySelector('#f-accept-company')?.value || '';
      newRow['What is the final offer? Please break down by salary and bonuses.'] = container.querySelector('#f-accept-comp')?.value || '';
      newRow['Where is the job located (city/state)? '] = container.querySelector('#f-accept-location')?.value || '';
      newRow['What are the working conditions? '] = container.querySelector('#f-accept-conditions')?.value || 'Hybrid';
    }

    try {
      await dataService.addSubmission(newRow);
      alert(`Event saved into database for ${stu.name}!`);
      selectedUnityID = stu.unityID;
      currentMode = 'overview';
      renderApp();
    } catch (err) {
      alert(`Failed to save: ${err.message}`);
    }
  });
}

/** ----------------------------------------------------
 *  APPLICATION DISPATCHER
 *  ---------------------------------------------------- */
function renderApp() {
  const container = document.getElementById('app-body');
  if (!container) return;

  const data = dataService.getData();

  // Update navigation tab states
  document.querySelectorAll('.nav-tab').forEach(tab => {
    const mode = tab.getAttribute('data-mode');
    if (mode === currentMode) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  if (currentMode === 'overview') {
    renderOverview(container, data);
  } else if (currentMode === 'analytics') {
    renderAnalytics(container, data);
  } else {
    renderStudentEntry(container, data.students);
  }
}

// Global bootstrap
async function start() {
  const fileInput = document.getElementById('csv-file-input');
  const btnUpload = document.getElementById('btn-upload-csv');
  const btnClear = document.getElementById('btn-clear-data');

  // Navigation tabs click handler
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      currentMode = tab.getAttribute('data-mode') || 'overview';
      renderApp();
    });
  });

  btnUpload?.addEventListener('click', () => fileInput?.click());

  fileInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    fileInput.value = '';
    try {
      await dataService.importCSV(file);
      renderApp();
    } catch (err) {
      alert(`Import error: ${err.message}`);
    }
  });

  btnClear?.addEventListener('click', async () => {
    if (confirm('Clear all submissions and reset SQLite database to zero?')) {
      try {
        await dataService.clearAll();
        renderApp();
      } catch (err) {
        alert(`Reset error: ${err.message}`);
      }
    }
  });

  dataService.subscribe(() => renderApp());

  await dataService.init();
  renderApp();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start);
} else {
  start();
}
