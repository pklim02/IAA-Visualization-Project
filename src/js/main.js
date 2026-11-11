import { dataService } from './dataService.js';
import { enhance, restoreFocus, captureFocus, initModalA11y } from './a11y.js';

let currentMode = 'overview'; // 'overview' | 'student-entry'
let selectedUnityID = null;
let entryUnityID = null;
let searchTerm = '';
let mobileShowDetail = false; // phones: show the candidate list OR the profile, not both
let attentionFilter = 'all'; // 'all' | 'interviewing' | 'needs_attention' | 'meeting' | 'screening_polish' | 'withdraw_check' | 'stalled'

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
    case 'withdraw_check':
      return 'Candidate accepted an offer but logged another interview afterward. Recommended: Remind candidate to formally and politely withdraw from other companies\' interview loops.';
    case 'meeting_wanted':
      return 'Candidate explicitly requested a meeting with Career Services in their latest submission.';
    case 'screening_polish':
      return 'Candidate has completed > 2 company screenings without advancing to second or final rounds. Recommended: Review 30-second pitch and resume alignment.';
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

function getNextSubmissionTimestamp(student) {
  const now = new Date();
  let maxTime = now.getTime();

  if (student && Array.isArray(student.history)) {
    for (const r of student.history) {
      const ts = r['Timestamp'] ? new Date(r['Timestamp']).getTime() : 0;
      if (!isNaN(ts) && ts > maxTime) {
        maxTime = ts;
      }
    }
  }

  const targetDate = maxTime > now.getTime() ? new Date(maxTime + (60 * 1000)) : now;
  return `${targetDate.getMonth() + 1}/${targetDate.getDate()}/${targetDate.getFullYear()} ${targetDate.getHours()}:${String(targetDate.getMinutes()).padStart(2, '0')}:${String(targetDate.getSeconds()).padStart(2, '0')}`;
}

/** ----------------------------------------------------
 *  MODE 1: CANDIDATE OVERVIEW (2-COLUMN MASTER-DETAIL)
 *  ---------------------------------------------------- */
function renderOverview(container, data) {
  const students = data.students || [];
  const attentionCounts = data.attention || {
    totalNeedsAttention: 0,
    meetingWanted: 0,
    screeningPolish: 0,
    withdrawCheck: 0,
    stalled: 0
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
    } else if (attentionFilter === 'interviewing') {
      return s.status === 'Interviewing';
    } else if (attentionFilter === 'withdraw_check') {
      return s.attentionFlags && s.attentionFlags.some(f => f.type === 'withdraw_check');
    } else if (attentionFilter === 'meeting') {
      return s.attentionFlags && s.attentionFlags.some(f => f.type === 'meeting_wanted');
    } else if (attentionFilter === 'screening_polish') {
      return s.attentionFlags && s.attentionFlags.some(f => f.type === 'screening_polish');
    } else if (attentionFilter === 'stalled') {
      return s.attentionFlags && s.attentionFlags.some(f => f.type === 'stalled');
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
        <h3 class="section-title">Accepted position</h3>
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
        <h3 class="section-title">Accepted position</h3>
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
    <div class="master-detail-layout ${mobileShowDetail ? 'show-detail' : ''}">
      <!-- Left Column: CANDIDATE LIST -->
      <aside class="candidates-sidebar">
        <div class="sidebar-header">
          <div class="sidebar-header-row">
            <h2 class="sidebar-title">Candidates</h2>
            <span class="sidebar-count">${filteredStudents.length} / ${students.length}</span>
          </div>
          <input 
            type="text" 
            id="search-input" 
            class="search-input" 
            aria-label="Filter candidates by name or Unity ID"
            placeholder="Filter candidates..." 
            value="${escapeHtml(searchTerm)}"
          />
          <div class="attention-filter-strip">
            <button class="filter-chip ${attentionFilter === 'all' ? 'active' : ''}" aria-pressed="${attentionFilter === 'all'}" data-filter="all">
              All (${students.length})
            </button>
            <button class="filter-chip ${attentionFilter === 'interviewing' ? 'active' : ''}" aria-pressed="${attentionFilter === 'interviewing'}" data-filter="interviewing">
              Interviewing (${students.filter(s => s.status === 'Interviewing').length})
            </button>
            <button class="filter-chip chip-attention ${attentionFilter === 'needs_attention' ? 'active' : ''}" aria-pressed="${attentionFilter === 'needs_attention'}" data-filter="needs_attention">
              Needs Attention (${attentionCounts.totalNeedsAttention || 0})
            </button>
            ${(attentionCounts.withdrawCheck || 0) > 0 ? `
              <button class="filter-chip chip-warning ${attentionFilter === 'withdraw_check' ? 'active' : ''}" aria-pressed="${attentionFilter === 'withdraw_check'}" data-filter="withdraw_check">
                Post-Acceptance (${attentionCounts.withdrawCheck})
              </button>
            ` : ''}
            ${(attentionCounts.meetingWanted || 0) > 0 ? `
              <button class="filter-chip chip-urgent ${attentionFilter === 'meeting' ? 'active' : ''}" aria-pressed="${attentionFilter === 'meeting'}" data-filter="meeting">
                Meetings (${attentionCounts.meetingWanted})
              </button>
            ` : ''}
            ${(attentionCounts.screeningPolish || 0) > 0 ? `
              <button class="filter-chip chip-warning ${attentionFilter === 'screening_polish' ? 'active' : ''}" aria-pressed="${attentionFilter === 'screening_polish'}" data-filter="screening_polish">
                Screening (${attentionCounts.screeningPolish})
              </button>
            ` : ''}
            ${(attentionCounts.stalled || 0) > 0 ? `
              <button class="filter-chip chip-muted ${attentionFilter === 'stalled' ? 'active' : ''}" aria-pressed="${attentionFilter === 'stalled'}" data-filter="stalled">
                Stalled (${attentionCounts.stalled})
              </button>
            ` : ''}
          </div>
        </div>

        <div class="candidates-scroll" tabindex="0" role="region" aria-label="Candidate list">
          ${filteredStudents.length === 0 ? `
            <div class="empty-candidates">No candidates match the selected filter.</div>
          ` : filteredStudents.map(s => `
            <button type="button"
              class="candidate-row ${s.unityID === selectedUnityID ? 'selected' : ''}" 
              data-id="${s.unityID}"
              ${s.unityID === selectedUnityID ? 'aria-current="true"' : ''}
            >
              <img 
                src="${s.avatarUrl}" 
                alt="" 
                class="candidate-avatar"
                onerror="this.src='/data/avatars/default.png'"
              />
              <span class="candidate-meta">
                <span class="candidate-name">${escapeHtml(s.name)}</span>
                <span class="candidate-sub">
                  <span class="candidate-unity">${escapeHtml(s.unityID)}</span>
                  <span class="status-badge ${getStatusBadgeClass(s.status)}">${s.status}</span>
                </span>
                ${s.attentionFlags && s.attentionFlags.length > 0 ? `
                  <span class="candidate-flags-stack">
                    ${s.attentionFlags.map(f => `
                      <span class="attention-badge ${getAttentionBadgeClass(f.level)}">
                        ${escapeHtml(f.label)}
                      </span>
                    `).join('')}
                  </span>
                ` : ''}
              </span>
            </button>
          `).join('')}
        </div>
      </aside>

      <!-- Right Column: CANDIDATE DETAILS -->
      <section class="candidate-detail-pane" tabindex="0" role="region" aria-label="Candidate profile">
        <button type="button" class="btn btn-secondary back-to-list" id="btn-back-to-list">&larr; All candidates</button>
        ${!selectedStudent ? `
          <div class="empty-selection">Select a candidate on the left to view dossier</div>
        ` : `
          <!-- Candidate Header -->
          <div class="dossier-header">
            <img 
              src="${selectedStudent.avatarUrl}" 
              alt="" 
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
                      <button class="btn-checkoff" data-student-id="${escapeHtml(selectedStudent.unityID)}" data-warning-type="${escapeHtml(f.type)}" data-event-ts="${escapeHtml(f.occurredAt || '')}" data-record-id="${escapeHtml(f.recordId || '')}" title="Mark as handled by Career Services">
                        ✓ Mark as Handled
                      </button>
                    </div>
                    <p class="alert-guidance">${escapeHtml(getAttentionGuidance(f))}</p>
                    ${f.occurredAt ? `<div style="font-size: 0.725rem; color: #64748B; margin-top: 0.25rem;">Triggered by event: <strong>${escapeHtml(f.occurredAt)}</strong></div>` : ''}
                  </div>
                `).join('')}
              </div>
            </div>
          ` : (selectedStudent && selectedStudent.handledFlags && selectedStudent.handledFlags.length > 0 ? `
            <div class="card handled-all-card">
              <div class="handled-all-header">
                <span class="handled-all-icon">✓</span>
                <strong>All Warnings Handled</strong>
                <span class="handled-all-sub">Career Services reviewed all alerts for this candidate.</span>
              </div>
            </div>
          ` : '')}

          <!-- Career Services Intervention & Coaching Log -->
          ${selectedStudent && selectedStudent.handledFlags && selectedStudent.handledFlags.length > 0 ? `
            <div class="card intervention-log-card">
              <div class="intervention-log-header">
                <span class="intervention-log-title">Career Services Intervention &amp; Coaching Log</span>
                <span class="intervention-log-count">${selectedStudent.handledFlags.length} record${selectedStudent.handledFlags.length > 1 ? 's' : ''}</span>
              </div>
              <div class="intervention-log-list">
                ${selectedStudent.handledFlags.map(hf => `
                  <div class="intervention-item" data-id="${hf.id}">
                    <div class="intervention-item-top">
                      <span class="attention-badge ${getAttentionBadgeClass('info')}">${escapeHtml(hf.label)}</span>
                      <div class="intervention-timestamps">
                        ${hf.eventTimestamp ? `<span class="ts-event" title="Event Trigger Date">Triggered: ${escapeHtml(hf.eventTimestamp)}</span>` : ''}
                        <span class="ts-handled" title="Advisor Handled Date">Handled: ${escapeHtml(new Date(hf.acknowledgedAt).toLocaleString())}</span>
                      </div>
                      <button class="btn-undo-ack" data-id="${hf.id}" title="Remove entry / restore warning">Undo</button>
                    </div>
                    <div class="intervention-note-row">
                      <div class="intervention-note-content" id="note-view-${hf.id}">
                        <span class="note-label">Coaching Note:</span>
                        <span class="note-text ${hf.adminNote ? '' : 'note-empty'}">${hf.adminNote ? escapeHtml(hf.adminNote) : 'No notes recorded. Click Edit to add coaching notes.'}</span>
                        <button class="btn-edit-note" data-id="${hf.id}">Edit Note</button>
                      </div>
                      <div class="intervention-note-editor hidden" id="note-edit-${hf.id}">
                        <input type="text" class="form-input note-input" value="${escapeHtml(hf.adminNote || '')}" placeholder="Add coaching notes, student feedback, or next steps..." />
                        <button class="btn-save-note" data-id="${hf.id}">Save</button>
                        <button class="btn-cancel-note" data-id="${hf.id}">Cancel</button>
                      </div>
                    </div>
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

          <!-- Accepted position -->
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

  container.querySelector('#btn-back-to-list')?.addEventListener('click', () => {
    mobileShowDetail = false;
    renderApp();
  });

  // Candidate selection click handler
  container.querySelectorAll('.candidate-row').forEach(row => {
    row.addEventListener('click', () => {
      selectedUnityID = row.getAttribute('data-id');
      mobileShowDetail = true;
      renderApp();
    });
  });

  // Warning Check-Off click handler (Approach A: One-Click Check-Off)
  container.querySelectorAll('.btn-checkoff').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const studentId = btn.getAttribute('data-student-id');
      const warningType = btn.getAttribute('data-warning-type');
      const eventTs = btn.getAttribute('data-event-ts') || '';
      const recordId = btn.getAttribute('data-record-id') || null;
      btn.disabled = true;
      btn.textContent = 'Saving...';
      try {
        await dataService.acknowledgeWarning(studentId, warningType, eventTs, '', recordId);
      } catch (err) {
        console.error('Failed to acknowledge warning:', err);
        btn.disabled = false;
        btn.textContent = '✓ Mark as Handled';
      }
    });
  });

  // Intervention Note: Toggle Edit Mode
  container.querySelectorAll('.btn-edit-note').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const viewEl = container.querySelector(`#note-view-${id}`);
      const editEl = container.querySelector(`#note-edit-${id}`);
      viewEl?.classList.add('hidden');
      editEl?.classList.remove('hidden');
    });
  });

  // Intervention Note: Cancel Edit
  container.querySelectorAll('.btn-cancel-note').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const viewEl = container.querySelector(`#note-view-${id}`);
      const editEl = container.querySelector(`#note-edit-${id}`);
      viewEl?.classList.remove('hidden');
      editEl?.classList.add('hidden');
    });
  });

  // Intervention Note: Save Note
  container.querySelectorAll('.btn-save-note').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const editEl = container.querySelector(`#note-edit-${id}`);
      const inputEl = editEl?.querySelector('.note-input');
      const newNote = inputEl?.value || '';
      btn.disabled = true;
      btn.textContent = 'Saving...';
      try {
        await dataService.updateAcknowledgmentNote(id, newNote);
      } catch (err) {
        console.error('Failed to save coaching note:', err);
        btn.disabled = false;
        btn.textContent = 'Save';
      }
    });
  });

  // Undo / Delete specific acknowledgment by id
  container.querySelectorAll('.btn-undo-ack').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      btn.disabled = true;
      btn.textContent = '...';
      try {
        await dataService.deleteAcknowledgment(id);
      } catch (err) {
        console.error('Failed to delete acknowledgment:', err);
        btn.disabled = false;
        btn.textContent = 'Undo';
      }
    });
  });
}

/** ----------------------------------------------------
 *  MODE 2: CLASS ANALYTICS (AGGREGATED COHORT VISUALS)
 *  ---------------------------------------------------- */
function renderAnalytics(container, data) {
  const total = data.totalStudents || 0;
  const placedCount = data.placedCount || 0;
  const offerCount = data.offerCount || 0;
  const interviewCount = data.interviewingCount || 0;
  const seekingCount = data.seekingCount || 0;
  const pct = (n) => (total > 0 ? Math.round((n / total) * 100) : 0);
  const placedPct = pct(placedCount);
  const stillSearching = total - placedCount;

  const funnel = data.funnel || { interviewing: 0, technical: 0, finalRound: 0, offer: 0, placed: 0 };
  const attention = data.attention || {};
  const queue = data.priorityQueue || [];
  const QUEUE_LIMIT = 8;
  const shown = queue.slice(0, QUEUE_LIMIT);

  const topCompanies = data.topCompanies || [];
  const topSources = data.topSources || [];
  const maxCompanyCount = topCompanies.length > 0 ? topCompanies[0].count : 1;
  const totalSourcesCount = topSources.reduce((acc, s) => acc + s.count, 0) || 1;

  const reasonText = (f) => {
    switch (f.type) {
      case 'meeting_wanted': return 'Asked to meet with Career Services';
      case 'screening_polish': return 'Several screenings, none advanced';
      case 'stalled': return f.occurredAt === 'Cohort Inception' ? 'Has not reported any activity yet' : 'No activity logged in 30+ days';
      default: return f.label;
    }
  };

  const stages = [
    { name: 'Interviewing', note: 'Logged at least one interview', n: funnel.interviewing },
    { name: 'Past screening', note: 'Reached a first or second round', n: funnel.technical },
    { name: 'Final round', note: 'Reached a final round or later', n: funnel.finalRound },
    { name: 'Offer in hand', note: 'Received at least one offer', n: funnel.offer },
    { name: 'Placed', note: 'Accepted an offer', n: funnel.placed }
  ];

  container.innerHTML = `
    <div class="analytics-page">
      <div class="analytics-header">
        <h2 class="analytics-title">Class of 2027 recruiting</h2>
        <div class="analytics-sub">${total} students &middot; ${data.totalSubmissions} submissions logged</div>
      </div>

      <section class="headline-band">
        <div class="headline-figure">
          <div class="headline-num">${placedPct}%</div>
          <div class="headline-label">placed</div>
        </div>
        <div class="headline-detail">
          <p class="headline-sentence"><strong>${placedCount} of ${total}</strong> students have accepted an offer. <strong>${stillSearching}</strong> are still searching${queue.length ? `, and <strong>${queue.length}</strong> of them could use a conversation with Career Services` : ''}.</p>
          <div class="status-bar" role="img" aria-label="${placedCount} placed, ${offerCount} holding offers, ${interviewCount} interviewing, ${seekingCount} not yet interviewing">
            <div class="status-seg seg-placed" style="width:${pct(placedCount)}%"></div>
            <div class="status-seg seg-offer" style="width:${pct(offerCount)}%"></div>
            <div class="status-seg seg-interview" style="width:${pct(interviewCount)}%"></div>
            <div class="status-seg seg-seeking" style="width:${Math.max(0, 100 - pct(placedCount) - pct(offerCount) - pct(interviewCount))}%"></div>
          </div>
          <ul class="status-key">
            <li><span class="key-swatch seg-placed"></span>Placed <strong>${placedCount}</strong></li>
            <li><span class="key-swatch seg-offer"></span>Holding offer <strong>${offerCount}</strong></li>
            <li><span class="key-swatch seg-interview"></span>Interviewing <strong>${interviewCount}</strong></li>
            <li><span class="key-swatch seg-seeking"></span>Not yet interviewing <strong>${seekingCount}</strong></li>
          </ul>
        </div>
      </section>

      <section class="analytics-card">
        <div class="card-header-clean">
          <h3 class="section-title">Who to contact first</h3>
          <span class="card-meta-tag">${queue.length} ${queue.length === 1 ? 'student' : 'students'} need coaching</span>
        </div>
        ${queue.length === 0 ? `<div class="empty-stream">No students need coaching right now.</div>` : `
          <ol class="priority-list">
            ${shown.map((q, i) => `
              <li class="priority-row">
                <span class="priority-rank">${i + 1}</span>
                <img class="priority-avatar" src="${escapeHtml(q.avatarUrl)}" alt="" onerror="this.style.visibility='hidden'">
                <div class="priority-who">
                  <div class="priority-name">${escapeHtml(q.name)}</div>
                  <div class="priority-reason">${q.flags.map(reasonText).map(escapeHtml).join(' &middot; ')}</div>
                </div>
                <span class="status-badge ${getStatusBadgeClass(q.status)}">${escapeHtml(q.status)}</span>
                <span class="priority-actions">
                  <button class="btn btn-secondary priority-open" data-student="${escapeHtml(q.unityID)}" aria-label="Open profile for ${escapeHtml(q.name)}">Open profile</button>
                  <button class="btn btn-secondary priority-handled" data-handled="${escapeHtml(q.unityID)}" aria-label="Mark ${escapeHtml(q.name)} as handled">Mark handled</button>
                </span>
              </li>`).join('')}
          </ol>
          ${queue.length > QUEUE_LIMIT ? `<div class="priority-more">Showing the top ${QUEUE_LIMIT} of ${queue.length}. <button class="link-btn" data-jump="needs_attention">See everyone flagged</button></div>` : ''}
        `}
        <div class="routine-row">
          <div>
            <div class="routine-title">Routine reminders</div>
            <div class="routine-desc">${attention.withdrawCheck || 0} placed ${attention.withdrawCheck === 1 ? 'student' : 'students'} logged an interview after accepting and are waiting on a reminder. A quick nudge to withdraw politely from other processes.</div>
          </div>
          <button class="btn btn-secondary" data-jump="withdraw_check">View ${attention.withdrawCheck || 0}</button>
        </div>
      </section>

      <section class="analytics-card">
        <h3 class="section-title">Where students are in the process</h3>
        <p class="card-intro">Unique students who reached each stage. Everyone counted in a stage is also counted in the stages before it.</p>
        <div class="stage-list">
          ${stages.map((s, i) => {
            const prev = i === 0 ? total : stages[i - 1].n;
            const lost = prev - s.n;
            return `
            <div class="stage-row">
              <div class="stage-label">
                <div class="stage-name">${s.name}</div>
                <div class="stage-note">${s.note}</div>
              </div>
              <div class="stage-track"><div class="stage-bar ${i === stages.length - 1 ? 'bar-final' : ''}" style="width:${pct(s.n)}%"></div></div>
              <div class="stage-figures">
                <span class="stage-n">${s.n}</span>
                <span class="stage-pct">${pct(s.n)}% of class</span>
              </div>
              <div class="stage-drop">${i === 0 ? (lost > 0 ? `${lost} not yet interviewing` : '') : (lost > 0 ? `${lost} did not advance` : '')}</div>
            </div>`;
          }).join('')}
        </div>
      </section>

      <div class="analytics-dual-row">
        <section class="analytics-card">
          <h3 class="section-title">Top employers by offers and acceptances</h3>
          ${topCompanies.length === 0 ? `<div class="empty-stream">No employer offers recorded yet.</div>` : `
            <div class="leaderboard-list">
              ${topCompanies.map(c => `
                <div class="leaderboard-row">
                  <div class="leaderboard-meta">
                    <span class="leaderboard-name">${escapeHtml(c.name)}</span>
                    <span class="leaderboard-count">${c.count}</span>
                  </div>
                  <div class="leaderboard-track"><div class="leaderboard-bar" style="width:${(c.count / maxCompanyCount) * 100}%"></div></div>
                </div>`).join('')}
            </div>`}
        </section>

        <section class="analytics-card">
          <h3 class="section-title">How students found their interviews</h3>
          ${topSources.length === 0 ? `<div class="empty-stream">No interview sources recorded yet.</div>` : `
            <div class="leaderboard-list">
              ${topSources.map(s => {
                const p = Math.round((s.count / totalSourcesCount) * 100);
                return `
                <div class="leaderboard-row">
                  <div class="leaderboard-meta">
                    <span class="leaderboard-name">${escapeHtml(s.name)}</span>
                    <span class="leaderboard-count">${s.count} (${p}%)</span>
                  </div>
                  <div class="leaderboard-track"><div class="leaderboard-bar bar-dark" style="width:${p}%"></div></div>
                </div>`;
              }).join('')}
            </div>`}
        </section>
      </div>
    </div>
  `;

  container.querySelectorAll('[data-jump]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      attentionFilter = btn.getAttribute('data-jump') || 'all';
      currentMode = 'overview';
      renderApp();
    });
  });
  container.querySelectorAll('[data-student]').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedUnityID = btn.getAttribute('data-student');
      attentionFilter = 'all';
      searchTerm = '';
      mobileShowDetail = true;
      currentMode = 'overview';
      renderApp();
    });
  });
  container.querySelectorAll('[data-handled]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-handled');
      const item = (dataService.getData().priorityQueue || []).find(q => q.unityID === id);
      if (!item) return;
      btn.disabled = true;
      btn.textContent = 'Saving...';
      try {
        for (const f of item.flags) {
          await dataService.acknowledgeWarning(id, f.type, f.occurredAt, '', f.recordId);
        }
      } catch (err) {
        console.error('Failed to mark handled:', err);
        btn.disabled = false;
        btn.textContent = 'Mark handled';
      }
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
  const suggestions = dataService.getCompanySuggestions(currentStudent?.unityID);

  container.innerHTML = `
    <div class="entry-page">
      <div class="entry-card">
        <div class="entry-header">
          <h2 class="entry-title">Student Self-Reporting Entry</h2>
          <p class="entry-sub">Select your profile from the dropdown to record a recruitment interview, offer, or acceptance</p>
        </div>

        <form id="student-submission-form">
          <!-- Autocomplete Company Suggestions -->
          <datalist id="entry-company-suggestions">
            ${suggestions.studentCompanies.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)} (Previously logged)</option>`).join('')}
            ${suggestions.globalCompanies.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}
          </datalist>

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
              <input type="text" id="f-interview-company" class="form-input" list="entry-company-suggestions" placeholder="e.g. Lumarion Health, Marketing Analytics Analyst, Risk Management" required>
            </div>

            <div class="form-grid-2">
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

            <div class="form-group" style="margin-bottom: 1.25rem;">
              <label class="form-label">Meet with Career Services to discuss this interview?</label>
              <select id="f-interview-meeting" class="form-input form-select">
                <option value="No">No</option>
                <option value="Yes">Yes, schedule a session</option>
              </select>
            </div>
          </div>

          <!-- Dynamic Branch 2: Offer -->
          <div id="branch-offer" class="form-branch" style="display: none;">
            <div class="form-group" style="margin-bottom: 1.25rem;">
              <label class="form-label">Company and Job Title *</label>
              <input type="text" id="f-offer-company" class="form-input" list="entry-company-suggestions" placeholder="e.g. Evernight Financial, Data Scientist">
            </div>
            <div class="form-group" style="margin-bottom: 1.25rem;">
              <label class="form-label">Meet with Career Services to discuss this offer? *</label>
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
              <input type="text" id="f-accept-company" class="form-input" list="entry-company-suggestions" placeholder="e.g. Ventrali Energy, Data Scientist I">
            </div>
            <div class="form-group" style="margin-bottom: 1.25rem;">
              <label class="form-label">Final Offer Breakdown (Salary &amp; Bonus) *</label>
              <input type="text" id="f-accept-comp" class="form-input" placeholder="e.g. $102,000 base salary, $5,000 signing bonus">
            </div>
            <div class="form-grid-2">
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
            <div class="form-group" style="margin-bottom: 1.25rem;">
              <label class="form-label">Meet with Career Services to discuss this acceptance?</label>
              <select id="f-accept-meeting" class="form-input form-select">
                <option value="No">No</option>
                <option value="Yes">Yes, schedule a session</option>
              </select>
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
    const formattedDate = getNextSubmissionTimestamp(stu);

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
      newRow['Do you want to meet with career services to discuss further?:'] = container.querySelector('#f-interview-meeting')?.value || 'No';
    } else if (repType === 'Offer') {
      newRow['Please list the company and job title'] = container.querySelector('#f-offer-company')?.value || '';
      newRow['Do you want to meet with career services to discuss further?:'] = container.querySelector('#f-offer-meeting')?.value || 'No';
    } else if (repType === 'Acceptance') {
      newRow['Please list the company name and job title. '] = container.querySelector('#f-accept-company')?.value || '';
      newRow['What is the final offer? Please break down by salary and bonuses.'] = container.querySelector('#f-accept-comp')?.value || '';
      newRow['Where is the job located (city/state)? '] = container.querySelector('#f-accept-location')?.value || '';
      newRow['What are the working conditions? '] = container.querySelector('#f-accept-conditions')?.value || 'Hybrid';
      newRow['Do you want to meet with career services to discuss further?:'] = container.querySelector('#f-accept-meeting')?.value || 'No';
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
 *  MODE 4: DATABASE RECORDS (CRUD FOR SUBMISSIONS & NOTES)
 *  ---------------------------------------------------- */
let dbCurrentTab = 'submissions'; // 'submissions' | 'notes'
let dbSearchTerm = '';
let dbTypeFilter = 'all';
let dbNotesSearch = '';

function renderDatabaseRecords(container, data) {
  const submissions = data.submissions || [];
  const acknowledgments = data.acknowledgments || [];
  const students = data.students || [];

  // Filter submissions
  const filteredSubmissions = submissions.filter(r => {
    if (dbTypeFilter !== 'all') {
      const type = (r['What are you reporting today?'] || '').trim();
      if (type.toLowerCase() !== dbTypeFilter.toLowerCase()) return false;
    }
    if (dbSearchTerm) {
      const q = dbSearchTerm.toLowerCase();
      const name = (r['Last, First Name'] || '').toLowerCase();
      const email = (r['Email Address'] || '').toLowerCase();
      const comp1 = (r['Please list the company, position, department/division. '] || r['Please list the company, position, department/division.'] || '').toLowerCase();
      const comp2 = (r['Please list the company and job title'] || '').toLowerCase();
      const comp3 = (r['Please list the company name and job title. '] || r['Please list the company name and job title.'] || '').toLowerCase();
      const loc = (r['Where is the job located (city/state)? '] || r['Where is the job located (city/state)?'] || '').toLowerCase();
      const cond = (r['What are the working conditions? '] || r['What are the working conditions?'] || '').toLowerCase();
      const notes = (r['Were there any technical concepts or questions that were challenging or new to you? '] || '').toLowerCase();
      return name.includes(q) || email.includes(q) || comp1.includes(q) || comp2.includes(q) || comp3.includes(q) || loc.includes(q) || cond.includes(q) || notes.includes(q);
    }
    return true;
  });

  // Filter coaching notes
  const filteredNotes = acknowledgments.filter(a => {
    if (dbNotesSearch) {
      const q = dbNotesSearch.toLowerCase();
      const unity = (a.unityID || '').toLowerCase();
      const type = (a.warningType || '').toLowerCase();
      const note = (a.adminNote || '').toLowerCase();
      return unity.includes(q) || type.includes(q) || note.includes(q);
    }
    return true;
  });

  container.innerHTML = `
    <div class="db-records-page">
      <div class="db-header-row">
        <div class="db-title-block">
          <h2>Database records</h2>
          <div class="db-title-sub">Direct access to live persistent database records and intervention logs</div>
        </div>

        <div class="db-subnav-strip">
          <button id="btn-tab-submissions" class="db-subnav-btn ${dbCurrentTab === 'submissions' ? 'active' : ''}">
            User Submissions (${submissions.length})
          </button>
          <button id="btn-tab-notes" class="db-subnav-btn ${dbCurrentTab === 'notes' ? 'active' : ''}">
            Intervention Notes (${acknowledgments.length})
          </button>
        </div>
      </div>

      ${dbCurrentTab === 'submissions' ? `
        <!-- Submissions Table View -->
        <div class="db-toolbar">
          <div class="db-search-group">
            <input 
              type="text" 
              id="db-search-input" 
              class="search-input" 
              aria-label="Search submissions by candidate, email or company"
              placeholder="Search candidate name, email, company..." 
              value="${escapeHtml(dbSearchTerm)}"
            />
            <select id="db-type-select" class="form-input form-select" aria-label="Filter by submission type" style="max-width: 160px;">
              <option value="all" ${dbTypeFilter === 'all' ? 'selected' : ''}>All Types</option>
              <option value="Interview" ${dbTypeFilter === 'Interview' ? 'selected' : ''}>Interview</option>
              <option value="Offer" ${dbTypeFilter === 'Offer' ? 'selected' : ''}>Offer</option>
              <option value="Acceptance" ${dbTypeFilter === 'Acceptance' ? 'selected' : ''}>Acceptance</option>
            </select>
          </div>
          <button id="btn-add-submission-modal" class="btn btn-primary">
            + Add New Submission
          </button>
        </div>

        <div class="db-table-container" tabindex="0" role="region" aria-label="Submissions table, scrolls horizontally">
          <table class="db-table">
            <thead>
              <tr>
                <th style="width: 50px;">ID</th>
                <th>Timestamp</th>
                <th>Candidate</th>
                <th>Type</th>
                <th>Company &amp; Role</th>
                <th>Stage / Details</th>
                <th>Location</th>
                <th>Conditions</th>
                <th>Source</th>
                <th>Technical Notes</th>
                <th>Wants Meeting</th>
                <th style="text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${filteredSubmissions.length === 0 ? `
                <tr><td colspan="12" style="text-align: center; padding: 2rem; color: #94A3B8;">No submission rows match your filters.</td></tr>
              ` : filteredSubmissions.map(r => {
                const type = (r['What are you reporting today?'] || 'Interview').trim();
                let compRole = '';
                let details = '';
                if (type === 'Acceptance') {
                  compRole = r['Please list the company name and job title. '] || r['Please list the company name and job title.'] || 'N/A';
                  details = r['What is the final offer? Please break down by salary and bonuses.'] || '';
                } else if (type === 'Offer') {
                  compRole = r['Please list the company and job title'] || 'N/A';
                  details = 'Offer Received';
                } else {
                  compRole = r['Please list the company, position, department/division. '] || r['Please list the company, position, department/division.'] || 'N/A';
                  details = r['Which interview was this? '] || r['Which interview was this?'] || '';
                }
                const wants = r['Do you want to meet with career services to discuss further?:'] || r['Do you want to meet with career services to discuss further?'] || 'No';
                const loc = r['Where is the job located (city/state)? '] || r['Where is the job located (city/state)?'] || '';
                const cond = r['What are the working conditions? '] || r['What are the working conditions?'] || '';
                const source = r['How did you hear about the job?'] || '';
                const notes = r['Were there any technical concepts or questions that were challenging or new to you? '] || r['Were there any technical concepts or questions that were challenging or new to you?'] || '';

                return `
                  <tr>
                    <td><strong>#${r._dbId || ''}</strong></td>
                    <td style="white-space: nowrap; color: #64748B;">${escapeHtml(r['Timestamp'] || '')}</td>
                    <td>
                      <strong>${escapeHtml(r['Last, First Name'] || '')}</strong>
                      <div style="font-size: 0.75rem; color: #64748B;">${escapeHtml(r['Email Address'] || '')}</div>
                    </td>
                    <td><span class="stream-tag tag-${type.toLowerCase()}">${escapeHtml(type)}</span></td>
                    <td>${escapeHtml(compRole)}</td>
                    <td>${escapeHtml(details)}</td>
                    <td>${loc ? `<span class="location-pill">${escapeHtml(loc)}</span>` : '<span style="color: #94A3B8;">-</span>'}</td>
                    <td>${cond ? `<span class="conditions-pill">${escapeHtml(cond)}</span>` : '<span style="color: #94A3B8;">-</span>'}</td>
                    <td>${source ? escapeHtml(source) : '<span style="color: #94A3B8;">-</span>'}</td>
                    <td>
                      <div style="max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(notes)}">
                        ${notes ? escapeHtml(notes) : '<span style="color: #94A3B8;">-</span>'}
                      </div>
                    </td>
                    <td>
                      ${wants.toLowerCase().startsWith('yes') ? `
                        <span class="attention-badge badge-attention-urgent">Yes</span>
                      ` : '<span style="color: #94A3B8;">No</span>'}
                    </td>
                    <td class="db-actions-cell" style="justify-content: flex-end;">
                      <button class="btn-action-edit btn-edit-sub" data-db-id="${r._dbId}">Edit</button>
                      <button class="btn-action-delete btn-delete-sub" data-db-id="${r._dbId}" data-name="${escapeHtml(r['Last, First Name'] || '')}">Delete</button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      ` : `
        <!-- Coaching Notes Table View -->
        <div class="db-toolbar">
          <div class="db-search-group">
            <input 
              type="text" 
              id="db-notes-search-input" 
              class="search-input" 
              placeholder="Search UnityID, alert type, or note..." 
              value="${escapeHtml(dbNotesSearch)}"
            />
          </div>
          <button id="btn-add-note-modal" class="btn btn-primary">
            + Log Coaching Note
          </button>
        </div>

        <div class="db-table-container" tabindex="0" role="region" aria-label="Submissions table, scrolls horizontally">
          <table class="db-table">
            <thead>
              <tr>
                <th style="width: 50px;">ID</th>
                <th>Candidate</th>
                <th>Alert Type</th>
                <th>Trigger Event</th>
                <th>Handled Date</th>
                <th>Coaching / Intervention Note</th>
                <th style="text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${filteredNotes.length === 0 ? `
                <tr><td colspan="7" style="text-align: center; padding: 2rem; color: #94A3B8;">No intervention notes logged yet.</td></tr>
              ` : filteredNotes.map(a => {
                const stu = students.find(s => s.unityID.toLowerCase() === (a.unityID || '').toLowerCase());
                const studentName = stu ? stu.name : a.unityID;

                return `
                  <tr>
                    <td><strong>#${a.id}</strong></td>
                    <td>
                      <strong>${escapeHtml(studentName)}</strong>
                      <div style="font-size: 0.75rem; color: #64748B;">${escapeHtml(a.unityID)}</div>
                    </td>
                    <td><span class="attention-badge badge-attention-info">${escapeHtml(a.warningType)}</span></td>
                    <td style="color: #B45309;">${escapeHtml(a.eventTimestamp || 'N/A')}</td>
                    <td style="color: #15803D;">${escapeHtml(a.acknowledgedAt ? new Date(a.acknowledgedAt).toLocaleString() : '')}</td>
                    <td>
                      <div style="max-width: 380px;">${escapeHtml(a.adminNote || 'No notes.')}</div>
                    </td>
                    <td class="db-actions-cell" style="justify-content: flex-end;">
                      <button class="btn-action-edit btn-edit-note-modal" data-id="${a.id}" data-note="${escapeHtml(a.adminNote || '')}">Edit Note</button>
                      <button class="btn-action-delete btn-delete-ack" data-id="${a.id}">Delete</button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `}
    </div>

    <!-- Modal Container -->
    <div id="db-modal-root"></div>
  `;

  // Tab switcher
  container.querySelector('#btn-tab-submissions')?.addEventListener('click', () => {
    dbCurrentTab = 'submissions';
    renderDatabaseRecords(container, data);
  });
  container.querySelector('#btn-tab-notes')?.addEventListener('click', () => {
    dbCurrentTab = 'notes';
    renderDatabaseRecords(container, data);
  });

  // Search and filter listeners for Submissions
  const subSearchInput = container.querySelector('#db-search-input');
  subSearchInput?.addEventListener('input', (e) => {
    dbSearchTerm = e.target.value;
    renderDatabaseRecords(container, data);
    const el = document.getElementById('db-search-input');
    if (el) {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
  });

  const subTypeSelect = container.querySelector('#db-type-select');
  subTypeSelect?.addEventListener('change', (e) => {
    dbTypeFilter = e.target.value;
    renderDatabaseRecords(container, data);
  });

  // Search listener for Notes
  const notesSearchInput = container.querySelector('#db-notes-search-input');
  notesSearchInput?.addEventListener('input', (e) => {
    dbNotesSearch = e.target.value;
    renderDatabaseRecords(container, data);
    const el = document.getElementById('db-notes-search-input');
    if (el) {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
  });

  // Delete submission
  container.querySelectorAll('.btn-delete-sub').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const dbId = btn.getAttribute('data-db-id');
      const name = btn.getAttribute('data-name');
      if (confirm(`Delete submission #${dbId} for ${name}? This cannot be undone.`)) {
        try {
          await dataService.deleteSubmission(dbId);
        } catch (err) {
          alert(`Failed to delete: ${err.message}`);
        }
      }
    });
  });

  // Delete note
  container.querySelectorAll('.btn-delete-ack').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      if (confirm(`Delete coaching note #${id}?`)) {
        try {
          await dataService.deleteAcknowledgment(id);
        } catch (err) {
          alert(`Failed to delete note: ${err.message}`);
        }
      }
    });
  });

  // Open Edit Note Modal
  container.querySelectorAll('.btn-edit-note-modal').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const currentNote = btn.getAttribute('data-note') || '';
      openEditNoteModal(id, currentNote);
    });
  });

  // Open Add Note Modal
  container.querySelector('#btn-add-note-modal')?.addEventListener('click', () => {
    openAddNoteModal(students);
  });

  // Open Add Submission Modal
  container.querySelector('#btn-add-submission-modal')?.addEventListener('click', () => {
    openSubmissionModal(null, students);
  });

  // Open Edit Submission Modal
  container.querySelectorAll('.btn-edit-sub').forEach(btn => {
    btn.addEventListener('click', () => {
      const dbId = parseInt(btn.getAttribute('data-db-id'), 10);
      const row = submissions.find(s => (s._dbId || s.id) === dbId);
      if (row) {
        openSubmissionModal(row, students);
      }
    });
  });
}

function openEditNoteModal(id, currentNote) {
  const root = document.getElementById('db-modal-root');
  if (!root) return;
  root.innerHTML = `
    <div class="db-modal-overlay">
      <div class="db-modal-content" style="max-width: 500px;">
        <div class="db-modal-header">
          <h3 class="db-modal-title">Edit Coaching Note #${id}</h3>
          <button class="db-modal-close">&times;</button>
        </div>
        <div class="db-modal-body">
          <div class="form-group">
            <label class="form-label">Coaching &amp; Intervention Note</label>
            <textarea id="modal-edit-note-text" class="form-input" rows="4">${escapeHtml(currentNote)}</textarea>
          </div>
        </div>
        <div class="db-modal-footer">
          <button class="btn btn-secondary db-modal-cancel">Cancel</button>
          <button id="modal-save-note-btn" class="btn btn-primary">Save Note</button>
        </div>
      </div>
    </div>
  `;

  root.querySelector('.db-modal-close')?.addEventListener('click', () => { root.innerHTML = ''; });
  root.querySelector('.db-modal-cancel')?.addEventListener('click', () => { root.innerHTML = ''; });
  root.querySelector('#modal-save-note-btn')?.addEventListener('click', async () => {
    const text = root.querySelector('#modal-edit-note-text')?.value || '';
    try {
      await dataService.updateAcknowledgmentNote(id, text);
      root.innerHTML = '';
    } catch (err) {
      alert(`Error saving note: ${err.message}`);
    }
  });
}

function openAddNoteModal(students) {
  const root = document.getElementById('db-modal-root');
  if (!root) return;
  root.innerHTML = `
    <div class="db-modal-overlay">
      <div class="db-modal-content" style="max-width: 540px;">
        <div class="db-modal-header">
          <h3 class="db-modal-title">Log New Career Services Coaching Note</h3>
          <button class="db-modal-close">&times;</button>
        </div>
        <div class="db-modal-body">
          <div class="form-group">
            <label class="form-label">Select Candidate *</label>
            <select id="modal-add-note-student" class="form-input form-select">
              ${students.map(s => `<option value="${escapeHtml(s.unityID)}">${escapeHtml(s.name)} (${escapeHtml(s.unityID)})</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Intervention Category *</label>
            <select id="modal-add-note-type" class="form-input form-select">
              <option value="meeting_wanted">Meeting Wanted</option>
              <option value="screening_polish">Screening Polish</option>
              <option value="withdraw_check">Withdrawal Check (Post-Acceptance)</option>
              <option value="stalled">Stalled Check-in</option>
              <option value="general_coaching">General Advising &amp; Coaching</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Coaching Notes &amp; Action Items</label>
            <textarea id="modal-add-note-text" class="form-input" rows="4" placeholder="Detail the student discussion, feedback, or coaching next steps..."></textarea>
          </div>
        </div>
        <div class="db-modal-footer">
          <button class="btn btn-secondary db-modal-cancel">Cancel</button>
          <button id="modal-create-note-btn" class="btn btn-primary">Log Note</button>
        </div>
      </div>
    </div>
  `;

  root.querySelector('.db-modal-close')?.addEventListener('click', () => { root.innerHTML = ''; });
  root.querySelector('.db-modal-cancel')?.addEventListener('click', () => { root.innerHTML = ''; });
  root.querySelector('#modal-create-note-btn')?.addEventListener('click', async () => {
    const unityID = root.querySelector('#modal-add-note-student')?.value;
    const warningType = root.querySelector('#modal-add-note-type')?.value;
    const text = root.querySelector('#modal-add-note-text')?.value || '';
    if (!unityID) return alert('Candidate required');
    try {
      await dataService.acknowledgeWarning(unityID, warningType, '', text);
      root.innerHTML = '';
    } catch (err) {
      alert(`Error creating note: ${err.message}`);
    }
  });
}

function openSubmissionModal(existingRow, students) {
  const root = document.getElementById('db-modal-root');
  if (!root) return;
  const isEdit = !!existingRow;
  const repType = isEdit ? (existingRow['What are you reporting today?'] || 'Interview') : 'Interview';
  const email = isEdit ? (existingRow['Email Address'] || '') : (students[0]?.email || '');
  const initialStudent = students.find(s => s.email.toLowerCase() === email.toLowerCase()) || students[0];
  const timestamp = isEdit ? (existingRow['Timestamp'] || '') : getNextSubmissionTimestamp(initialStudent);

  let comp = '';
  let stage = '';
  let notes = '';
  let location = '';
  let conditions = 'Hybrid';
  let source = 'Institute';
  let wants = isEdit ? (existingRow['Do you want to meet with career services to discuss further?:'] || existingRow['Do you want to meet with career services to discuss further?'] || 'No') : 'No';

  if (isEdit) {
    location = existingRow['Where is the job located (city/state)? '] || existingRow['Where is the job located (city/state)?'] || '';
    conditions = existingRow['What are the working conditions? '] || existingRow['What are the working conditions?'] || 'Hybrid';
    source = existingRow['How did you hear about the job?'] || 'Institute';

    if (repType === 'Acceptance') {
      comp = existingRow['Please list the company name and job title. '] || existingRow['Please list the company name and job title.'] || '';
      stage = existingRow['What is the final offer? Please break down by salary and bonuses.'] || '';
    } else if (repType === 'Offer') {
      comp = existingRow['Please list the company and job title'] || '';
      stage = 'Offer Received';
    } else {
      comp = existingRow['Please list the company, position, department/division. '] || existingRow['Please list the company, position, department/division.'] || '';
      stage = existingRow['Which interview was this? '] || existingRow['Which interview was this?'] || 'First Round';
      notes = existingRow['Were there any technical concepts or questions that were challenging or new to you? '] || existingRow['Were there any technical concepts or questions that were challenging or new to you?'] || '';
    }
  }

  const selectedStudentObj = students.find(s => s.email.toLowerCase() === email.toLowerCase()) || students[0];
  const initialSuggestions = dataService.getCompanySuggestions(selectedStudentObj?.unityID);

  root.innerHTML = `
    <div class="db-modal-overlay">
      <div class="db-modal-content">
        <div class="db-modal-header">
          <h3 class="db-modal-title">${isEdit ? `Edit Submission #${existingRow._dbId}` : 'Add New Submission Record'}</h3>
          <button class="db-modal-close">&times;</button>
        </div>
        <div class="db-modal-body">
          <datalist id="modal-sub-company-suggestions">
            ${initialSuggestions.studentCompanies.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)} (Previously logged)</option>`).join('')}
            ${initialSuggestions.globalCompanies.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}
          </datalist>

          <div class="form-group">
            <label class="form-label">Candidate *</label>
            <select id="modal-sub-student" class="form-input form-select" ${isEdit ? 'disabled' : ''}>
              ${students.map(s => `
                <option value="${escapeHtml(s.unityID)}" data-name="${escapeHtml(s.name)}" data-email="${escapeHtml(s.email)}" ${s.email.toLowerCase() === email.toLowerCase() ? 'selected' : ''}>
                  ${escapeHtml(s.name)} (${escapeHtml(s.unityID)})
                </option>
              `).join('')}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Reporting Type *</label>
            <select id="modal-sub-type" class="form-input form-select">
              <option value="Interview" ${repType === 'Interview' ? 'selected' : ''}>Interview</option>
              <option value="Offer" ${repType === 'Offer' ? 'selected' : ''}>Offer</option>
              <option value="Acceptance" ${repType === 'Acceptance' ? 'selected' : ''}>Acceptance</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Company &amp; Position *</label>
            <input type="text" id="modal-sub-comp" class="form-input" list="modal-sub-company-suggestions" value="${escapeHtml(comp)}" placeholder="e.g. Bank of America, Senior Data Scientist" />
          </div>

          <div class="form-group">
            <label class="form-label">Stage / Compensation Details</label>
            <input type="text" id="modal-sub-stage" class="form-input" value="${escapeHtml(stage)}" placeholder="e.g. Final Round or $115,000 + $10,000 bonus" />
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div class="form-group">
              <label class="form-label">Job Location (City/State)</label>
              <input type="text" id="modal-sub-location" class="form-input" value="${escapeHtml(location)}" placeholder="e.g. Philadelphia, PA or Raleigh, NC" />
            </div>

            <div class="form-group">
              <label class="form-label">Working Conditions</label>
              <select id="modal-sub-conditions" class="form-input form-select">
                <option value="Hybrid" ${conditions === 'Hybrid' ? 'selected' : ''}>Hybrid</option>
                <option value="Fully on-site" ${conditions === 'Fully on-site' ? 'selected' : ''}>Fully on-site</option>
                <option value="Remote" ${conditions === 'Remote' ? 'selected' : ''}>Remote</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Job Source</label>
            <select id="modal-sub-source" class="form-input form-select">
              <option value="Institute" ${source === 'Institute' ? 'selected' : ''}>Institute (Career Services)</option>
              <option value="Alumni" ${source === 'Alumni' ? 'selected' : ''}>Alumni</option>
              <option value="LinkedIn" ${source === 'LinkedIn' ? 'selected' : ''}>LinkedIn</option>
              <option value="Company website" ${source === 'Company website' ? 'selected' : ''}>Company website</option>
              <option value="Recruiter reached out" ${source === 'Recruiter reached out' ? 'selected' : ''}>Recruiter reached out</option>
              <option value="Referral from a friend" ${source === 'Referral from a friend' ? 'selected' : ''}>Referral from a friend</option>
              <option value="Career fair" ${source === 'Career fair' ? 'selected' : ''}>Career fair</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Technical Concepts / Notes</label>
            <textarea id="modal-sub-notes" class="form-input" rows="2" placeholder="Interview questions or notes">${escapeHtml(notes)}</textarea>
          </div>

          <div class="form-group">
            <label class="form-label">Meet with Career Services to discuss?</label>
            <select id="modal-sub-wants" class="form-input form-select">
              <option value="No" ${wants.toLowerCase().startsWith('no') ? 'selected' : ''}>No</option>
              <option value="Yes" ${wants.toLowerCase().startsWith('yes') ? 'selected' : ''}>Yes</option>
            </select>
          </div>
        </div>
        <div class="db-modal-footer">
          <button class="btn btn-secondary db-modal-cancel">Cancel</button>
          <button id="modal-save-sub-btn" class="btn btn-primary">${isEdit ? 'Save Changes' : 'Create Record'}</button>
        </div>
      </div>
    </div>
  `;

  root.querySelector('#modal-sub-student')?.addEventListener('change', (e) => {
    const unity = e.target.value;
    const suggs = dataService.getCompanySuggestions(unity);
    const dlist = root.querySelector('#modal-sub-company-suggestions');
    if (dlist) {
      dlist.innerHTML = `
        ${suggs.studentCompanies.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)} (Previously logged)</option>`).join('')}
        ${suggs.globalCompanies.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}
      `;
    }
  });

  root.querySelector('.db-modal-close')?.addEventListener('click', () => { root.innerHTML = ''; });
  root.querySelector('.db-modal-cancel')?.addEventListener('click', () => { root.innerHTML = ''; });
  root.querySelector('#modal-save-sub-btn')?.addEventListener('click', async () => {
    const studentSelect = root.querySelector('#modal-sub-student');
    const selectedOpt = studentSelect?.selectedOptions?.[0];
    const sName = selectedOpt?.getAttribute('data-name') || '';
    const sEmail = selectedOpt?.getAttribute('data-email') || '';

    const newType = root.querySelector('#modal-sub-type')?.value || 'Interview';
    const newComp = root.querySelector('#modal-sub-comp')?.value || '';
    const newStage = root.querySelector('#modal-sub-stage')?.value || '';
    const newLocation = root.querySelector('#modal-sub-location')?.value || '';
    const newConditions = root.querySelector('#modal-sub-conditions')?.value || 'Hybrid';
    const newSource = root.querySelector('#modal-sub-source')?.value || 'Institute';
    const newNotes = root.querySelector('#modal-sub-notes')?.value || '';
    const newWants = root.querySelector('#modal-sub-wants')?.value || 'No';

    const activeStudent = students.find(s => s.email.toLowerCase() === sEmail.toLowerCase()) || initialStudent;
    const finalTimestamp = isEdit ? timestamp : getNextSubmissionTimestamp(activeStudent);

    const rowPayload = {
      'Timestamp': finalTimestamp,
      'Email Address': sEmail,
      'Last, First Name': sName,
      'What are you reporting today?': newType,
      'Do you want to meet with career services to discuss further?:': newWants,
      'Where is the job located (city/state)? ': newLocation,
      'What are the working conditions? ': newConditions,
      'How did you hear about the job?': newSource,
      'Were there any technical concepts or questions that were challenging or new to you? ': newNotes
    };

    if (newType === 'Acceptance') {
      rowPayload['Please list the company name and job title. '] = newComp;
      rowPayload['What is the final offer? Please break down by salary and bonuses.'] = newStage;
    } else if (newType === 'Offer') {
      rowPayload['Please list the company and job title'] = newComp;
    } else {
      rowPayload['Please list the company, position, department/division. '] = newComp;
      rowPayload['Which interview was this? '] = newStage || 'First Round';
    }

    try {
      if (isEdit) {
        await dataService.updateSubmission(existingRow._dbId, rowPayload);
      } else {
        await dataService.addSubmission(rowPayload);
      }
      root.innerHTML = '';
    } catch (err) {
      alert(`Error saving submission: ${err.message}`);
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
  const focusKey = captureFocus();

  // Update navigation tab states
  document.querySelectorAll('.nav-tab').forEach(tab => {
    const mode = tab.getAttribute('data-mode');
    if (mode === currentMode) {
      tab.classList.add('active');
      tab.setAttribute('aria-current', 'page');
    } else {
      tab.classList.remove('active');
      tab.removeAttribute('aria-current');
    }
  });

  if (currentMode === 'overview') {
    renderOverview(container, data);
  } else if (currentMode === 'analytics') {
    renderAnalytics(container, data);
  } else if (currentMode === 'student-entry') {
    renderStudentEntry(container, data.students);
  } else if (currentMode === 'database-records') {
    renderDatabaseRecords(container, data);
  }

  enhance(container);
  restoreFocus(focusKey);
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

  initModalA11y();
  dataService.subscribe(() => renderApp());

  await dataService.init();
  renderApp();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start);
} else {
  start();
}
