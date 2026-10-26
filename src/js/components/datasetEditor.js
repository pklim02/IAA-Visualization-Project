import { dataService } from '../dataService.js';
import { showToast } from './formModal.js';

let editorState = {
  searchTerm: '',
  filterType: 'all',
  currentPage: 1,
  pageSize: 12
};

let isModalInitialized = false;

/**
 * Initializes the edit submission record modal event handlers.
 */
export function initEditRecordModal() {
  if (isModalInitialized) return;

  const modal = document.getElementById('edit-submission-modal');
  const btnClose = document.getElementById('btn-close-edit-modal');
  const btnCancel = document.getElementById('btn-cancel-edit-modal');
  const form = document.getElementById('edit-submission-form');

  if (!modal || !form) return;

  const closeModal = () => {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  };

  btnClose?.addEventListener('click', closeModal);
  btnCancel?.addEventListener('click', closeModal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-submission-id').value;
    const reportType = document.getElementById('edit-report-type').value;
    const companyRole = document.getElementById('edit-company-role').value.trim();
    const stage = document.getElementById('edit-interview-stage').value;
    const source = document.getElementById('edit-source').value.trim();
    const comp = document.getElementById('edit-compensation').value.trim();
    const location = document.getElementById('edit-location').value.trim();
    const workConditions = document.getElementById('edit-work-conditions').value;
    const notes = document.getElementById('edit-notes').value.trim();

    const updatedFields = {
      'What are you reporting today?': reportType
    };

    if (reportType === 'Interview') {
      updatedFields['Please list the company, position, department/division. '] = companyRole;
      updatedFields['Which interview was this? '] = stage;
      updatedFields['How did you hear about the job?'] = source;
      updatedFields['Were there any technical concepts or questions that were challenging or new to you? '] = notes;
    } else if (reportType === 'Offer') {
      updatedFields['Please list the company and job title'] = companyRole;
    } else if (reportType === 'Acceptance') {
      updatedFields['Please list the company name and job title. '] = companyRole;
      updatedFields['What is the final offer? Please break down by salary and bonuses.'] = comp;
      updatedFields['Where is the job located (city/state)? '] = location;
      updatedFields['What are the working conditions? '] = workConditions;
    }

    const success = dataService.updateSubmissionById(id, updatedFields);
    closeModal();

    if (success) {
      showToast('Record updated successfully and synchronized across dashboard');
    } else {
      showToast('Failed to update record', true);
    }
  });

  isModalInitialized = true;
}

/**
 * Opens the edit record modal and populates it with row data.
 */
export function openEditRecordModal(row) {
  initEditRecordModal();

  const modal = document.getElementById('edit-submission-modal');
  if (!modal) return;

  const companyRole = 
    row['Please list the company, position, department/division. '] ||
    row['Please list the company and job title'] ||
    row['Please list the company name and job title. '] || '';

  document.getElementById('edit-submission-id').value = row._id || '';
  document.getElementById('edit-student-display').value = `${row['Last, First Name'] || 'Candidate'} (${row['Email Address'] || ''})`;
  document.getElementById('edit-report-type').value = row['What are you reporting today?'] || 'Interview';
  document.getElementById('edit-company-role').value = companyRole;
  document.getElementById('edit-interview-stage').value = (row['Which interview was this? '] || '').trim();
  document.getElementById('edit-source').value = (row['How did you hear about the job?'] || '').trim();
  document.getElementById('edit-compensation').value = (row['What is the final offer? Please break down by salary and bonuses.'] || '').trim();
  document.getElementById('edit-location').value = (row['Where is the job located (city/state)? '] || '').trim();
  document.getElementById('edit-work-conditions').value = (row['What are the working conditions? '] || '').trim();
  document.getElementById('edit-notes').value = (row['Were there any technical concepts or questions that were challenging or new to you? '] || '').trim();

  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
}

/**
 * Renders the Live Dataset Manager & Spreadsheet Editor inside container.
 */
export function renderDatasetEditor(container, data) {
  initEditRecordModal();

  const rawRows = data.rawTracker || [];
  const interviewCount = rawRows.filter(r => r['What are you reporting today?'] === 'Interview').length;
  const offerCount = rawRows.filter(r => r['What are you reporting today?'] === 'Offer').length;
  const acceptanceCount = rawRows.filter(r => r['What are you reporting today?'] === 'Acceptance').length;

  function filterAndPaginate() {
    let filtered = rawRows;

    // Filter by report type
    if (editorState.filterType !== 'all') {
      filtered = filtered.filter(r => r['What are you reporting today?'] === editorState.filterType);
    }

    // Filter by search query
    if (editorState.searchTerm) {
      const q = editorState.searchTerm.toLowerCase();
      filtered = filtered.filter(r => {
        const name = (r['Last, First Name'] || '').toLowerCase();
        const email = (r['Email Address'] || '').toLowerCase();
        const comp = (
          r['Please list the company, position, department/division. '] ||
          r['Please list the company and job title'] ||
          r['Please list the company name and job title. '] || ''
        ).toLowerCase();
        const stage = (r['Which interview was this? '] || '').toLowerCase();
        return name.includes(q) || email.includes(q) || comp.includes(q) || stage.includes(q);
      });
    }

    const totalRecords = filtered.length;
    const totalPages = Math.ceil(totalRecords / editorState.pageSize) || 1;
    if (editorState.currentPage > totalPages) editorState.currentPage = totalPages;
    if (editorState.currentPage < 1) editorState.currentPage = 1;

    const startIdx = (editorState.currentPage - 1) * editorState.pageSize;
    const pageRows = filtered.slice(startIdx, startIdx + editorState.pageSize);

    return { pageRows, totalRecords, totalPages, startIdx };
  }

  function renderView() {
    const { pageRows, totalRecords, totalPages, startIdx } = filterAndPaginate();

    container.innerHTML = `
      <div class="card" style="box-shadow: var(--shadow-md);">
        <div class="card-header" style="flex-wrap: wrap; gap: 1rem;">
          <div>
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <h3 class="card-title">Live Dataset Manager & Spreadsheet Editor</h3>
              <span class="badge badge-placed" style="font-size: 0.75rem;">Staff Admin Control</span>
            </div>
            <p class="card-subtitle">Directly edit employer names, correct typos, adjust stages, or update compensation across all submissions</p>
          </div>
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <button id="btn-editor-add-entry" class="btn btn-primary" style="font-size: 0.8rem; padding: 0.45rem 0.85rem;">
              <svg class="btn-icon" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
              </svg>
              Add New Record
            </button>
          </div>
        </div>

        <!-- Filter & Search Toolbar -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.25rem; padding-bottom: 1.25rem; border-bottom: 1px solid var(--border-subtle);">
          <div class="search-box" style="max-width: 380px;">
            <svg class="search-icon" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd" />
            </svg>
            <input 
              type="text" 
              id="editor-search-input" 
              class="search-input" 
              placeholder="Search by candidate, company, role, or stage..."
              value="${editorState.searchTerm}"
            />
          </div>

          <div class="filter-pills">
            <button class="pill-btn ${editorState.filterType === 'all' ? 'active' : ''}" data-editor-filter="all">
              All (${rawRows.length})
            </button>
            <button class="pill-btn ${editorState.filterType === 'Interview' ? 'active' : ''}" data-editor-filter="Interview">
              Interviews (${interviewCount})
            </button>
            <button class="pill-btn ${editorState.filterType === 'Offer' ? 'active' : ''}" data-editor-filter="Offer">
              Offers (${offerCount})
            </button>
            <button class="pill-btn ${editorState.filterType === 'Acceptance' ? 'active' : ''}" data-editor-filter="Acceptance">
              Acceptances (${acceptanceCount})
            </button>
          </div>
        </div>

        <!-- Spreadsheet Table -->
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 140px;">Timestamp</th>
                <th>Candidate</th>
                <th style="width: 110px;">Branch Type</th>
                <th>Company & Position</th>
                <th>Stage / Details</th>
                <th>Compensation / Notes</th>
                <th style="width: 120px; text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${pageRows.length === 0 ? `
                <tr>
                  <td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
                    No submission records match your search or filter criteria.
                  </td>
                </tr>
              ` : pageRows.map((row) => {
                const reportType = row['What are you reporting today?'] || 'Interview';
                const companyRole = 
                  row['Please list the company, position, department/division. '] ||
                  row['Please list the company and job title'] ||
                  row['Please list the company name and job title. '] || '-';
                const stage = row['Which interview was this? '] || row['What are the working conditions? '] || '-';
                const notes = row['What is the final offer? Please break down by salary and bonuses.'] || row['Were there any technical concepts or questions that were challenging or new to you? '] || '-';
                
                return `
                  <tr data-row-id="${row._id}">
                    <td style="font-size: 0.75rem; color: var(--text-muted); font-family: var(--font-mono); white-space: nowrap;">
                      ${row['Timestamp'] || '-'}
                    </td>
                    <td>
                      <strong>${row['Last, First Name'] || 'Candidate'}</strong>
                      <div style="font-size: 0.725rem; color: var(--text-muted); font-family: var(--font-mono);">${row['Email Address'] || ''}</div>
                    </td>
                    <td>
                      <span class="badge ${reportType === 'Acceptance' ? 'badge-placed' : (reportType === 'Offer' ? 'badge-offer' : 'badge-interviewing')}">
                        ${reportType}
                      </span>
                    </td>
                    <td style="font-size: 0.825rem; font-weight: 600; color: var(--text-primary); max-width: 260px;">
                      ${companyRole}
                    </td>
                    <td style="font-size: 0.8rem; color: var(--text-secondary);">
                      ${stage}
                    </td>
                    <td style="font-size: 0.75rem; color: var(--text-muted); max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${notes}">
                      ${notes}
                    </td>
                    <td style="text-align: right; white-space: nowrap;">
                      <button class="btn btn-secondary btn-edit-submission" data-id="${row._id}" style="padding: 0.3rem 0.65rem; font-size: 0.75rem;" title="Edit record or fix company name typo">
                        Edit
                      </button>
                      <button class="btn btn-ghost btn-delete-submission" data-id="${row._id}" style="padding: 0.3rem 0.5rem; font-size: 0.75rem; color: var(--status-alert);" title="Delete record">
                        &times;
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

        <!-- Pagination Controls -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--border-subtle); font-size: 0.85rem; color: var(--text-secondary);">
          <div>
            Showing <strong>${totalRecords > 0 ? startIdx + 1 : 0}</strong> to <strong>${Math.min(startIdx + editorState.pageSize, totalRecords)}</strong> of <strong>${totalRecords}</strong> records
          </div>
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <button id="btn-editor-prev" class="btn btn-secondary" style="padding: 0.35rem 0.75rem; font-size: 0.8rem;" ${editorState.currentPage <= 1 ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
              &larr; Prev
            </button>
            <span>Page <strong>${editorState.currentPage}</strong> of <strong>${totalPages}</strong></span>
            <button id="btn-editor-next" class="btn btn-secondary" style="padding: 0.35rem 0.75rem; font-size: 0.8rem;" ${editorState.currentPage >= totalPages ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
              Next &rarr;
            </button>
          </div>
        </div>
      </div>
    `;

    // Attach search event
    const searchInput = container.querySelector('#editor-search-input');
    searchInput?.addEventListener('input', (e) => {
      editorState.searchTerm = e.target.value;
      editorState.currentPage = 1;
      renderView();
      const newInput = container.querySelector('#editor-search-input');
      if (newInput) {
        newInput.focus();
        newInput.setSelectionRange(newInput.value.length, newInput.value.length);
      }
    });

    // Attach filter pill events
    container.querySelectorAll('[data-editor-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        editorState.filterType = btn.getAttribute('data-editor-filter');
        editorState.currentPage = 1;
        renderView();
      });
    });

    // Attach pagination events
    container.querySelector('#btn-editor-prev')?.addEventListener('click', () => {
      if (editorState.currentPage > 1) {
        editorState.currentPage--;
        renderView();
      }
    });

    container.querySelector('#btn-editor-next')?.addEventListener('click', () => {
      if (editorState.currentPage < totalPages) {
        editorState.currentPage++;
        renderView();
      }
    });

    // Attach edit button clicks
    container.querySelectorAll('.btn-edit-submission').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const row = rawRows.find(r => r._id === id);
        if (row) {
          openEditRecordModal(row);
        }
      });
    });

    // Attach delete button clicks
    container.querySelectorAll('.btn-delete-submission').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const row = rawRows.find(r => r._id === id);
        if (!row) return;

        const candidate = row['Last, First Name'] || 'Candidate';
        const type = row['What are you reporting today?'] || 'record';
        const confirmed = window.confirm(`Are you sure you want to delete this ${type} record for ${candidate}? This will instantly update all KPIs and persistent storage.`);
        
        if (confirmed) {
          const success = dataService.deleteSubmissionById(id);
          if (success) {
            showToast(`Deleted ${type} record for ${candidate}`);
          }
        }
      });
    });

    // Attach "+ Add New Record" button to open Google Form Simulator
    container.querySelector('#btn-editor-add-entry')?.addEventListener('click', () => {
      const btnOpenForm = document.getElementById('btn-open-form');
      if (btnOpenForm) btnOpenForm.click();
    });
  }

  renderView();
}
