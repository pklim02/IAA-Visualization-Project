import { dataService } from './dataService.js';

let currentMode = 'overview'; // 'overview' | 'student-entry'
let selectedUnityID = null;
let entryUnityID = null;
let searchTerm = '';

function getStatusBadgeClass(status) {
  switch (status) {
    case 'Placed': return 'badge-placed';
    case 'Has Offer': return 'badge-offer';
    case 'Interviewing': return 'badge-interviewing';
    default: return 'badge-seeking';
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
function renderOverview(container, students) {
  // Filter candidates by name or unityID
  const filteredStudents = students.filter(s => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return s.name.toLowerCase().includes(term) || s.unityID.toLowerCase().includes(term);
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
        </div>

        <div class="candidates-scroll">
          ${filteredStudents.length === 0 ? `
            <div class="empty-candidates">No candidates match your search.</div>
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
              </div>
            </div>
          </div>

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

  // Candidate selection click handler
  container.querySelectorAll('.candidate-row').forEach(row => {
    row.addEventListener('click', () => {
      selectedUnityID = row.getAttribute('data-id');
      renderApp();
    });
  });
}

/** ----------------------------------------------------
 *  MODE 2: STUDENT ENTRY VIEW (SINGLE PAGE FORM)
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
  const btnToggle = document.getElementById('btn-toggle-view');
  if (!container) return;

  const data = dataService.getData();

  if (btnToggle) {
    if (currentMode === 'overview') {
      btnToggle.innerHTML = 'Student Entry Form &rarr;';
      btnToggle.classList.remove('btn-active-mode');
    } else {
      btnToggle.innerHTML = '&larr; Candidate Overview';
      btnToggle.classList.add('btn-active-mode');
    }
  }

  if (currentMode === 'overview') {
    renderOverview(container, data.students);
  } else {
    renderStudentEntry(container, data.students);
  }
}

// Global bootstrap
async function start() {
  const fileInput = document.getElementById('csv-file-input');
  const btnUpload = document.getElementById('btn-upload-csv');
  const btnClear = document.getElementById('btn-clear-data');
  const btnToggle = document.getElementById('btn-toggle-view');

  btnToggle?.addEventListener('click', () => {
    currentMode = currentMode === 'overview' ? 'student-entry' : 'overview';
    renderApp();
  });

  btnUpload?.addEventListener('click', () => fileInput?.click());

  fileInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    fileInput.value = '';
    try {
      await dataService.importCSV(file);
      currentMode = 'overview';
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
