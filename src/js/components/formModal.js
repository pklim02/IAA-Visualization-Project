import { dataService } from '../dataService.js';
import { authService } from '../authService.js';
import Papa from 'papaparse';

/**
 * Shows an ephemeral toast notification.
 */
export function showToast(message, isError = false) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${isError ? 'toast-error' : ''}`;
  toast.innerHTML = `
    <svg style="width: 18px; height: 18px; flex-shrink: 0;" viewBox="0 0 20 20" fill="currentColor">
      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
    </svg>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease-out';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

/**
 * Initializes the Google Form submission simulator modal and CSV import/export.
 */
export function initFormModal() {
  const modal = document.getElementById('form-modal');
  const btnOpen = document.getElementById('btn-open-form');
  const btnClose = document.getElementById('btn-close-form');
  const btnCancel = document.getElementById('btn-cancel-form');
  const form = document.getElementById('submission-form');
  const studentSelect = document.getElementById('form-student-select');
  const reportTypeSelect = document.getElementById('form-report-type');

  const interviewFields = document.getElementById('form-interview-fields');
  const offerFields = document.getElementById('form-offer-fields');
  const acceptanceFields = document.getElementById('form-acceptance-fields');

  const btnUpload = document.getElementById('btn-upload-csv');
  const fileInput = document.getElementById('csv-file-input');
  const btnExport = document.getElementById('btn-export-data');

  function openModal() {
    if (authService.isStudent()) {
      const user = authService.getUser();
      if (studentSelect) {
        studentSelect.value = user.unityID;
        studentSelect.disabled = true;
      }
    } else {
      if (studentSelect) {
        studentSelect.disabled = false;
      }
    }
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeModal() {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    form.reset();
    if (studentSelect) studentSelect.disabled = false;
    updateFieldVisibility('Interview');
  }

  function updateFieldVisibility(type) {
    if (type === 'Interview') {
      interviewFields.style.display = 'block';
      offerFields.style.display = 'none';
      acceptanceFields.style.display = 'none';
    } else if (type === 'Offer') {
      interviewFields.style.display = 'none';
      offerFields.style.display = 'block';
      acceptanceFields.style.display = 'none';
    } else if (type === 'Acceptance') {
      interviewFields.style.display = 'none';
      offerFields.style.display = 'none';
      acceptanceFields.style.display = 'block';
    }
  }

  btnOpen?.addEventListener('click', openModal);
  btnClose?.addEventListener('click', closeModal);
  btnCancel?.addEventListener('click', closeModal);

  reportTypeSelect?.addEventListener('change', (e) => {
    updateFieldVisibility(e.target.value);
  });

  // Populate student select dropdown once data is loaded
  dataService.subscribe((data) => {
    if (studentSelect && studentSelect.children.length === 0) {
      const sorted = [...data.students].sort((a, b) => a.name.localeCompare(b.name));
      studentSelect.innerHTML = sorted.map(s => `
        <option value="${s.unityID}">${s.name} (${s.unityID})</option>
      `).join('');
    }
  });

  // Handle Form Submission
  form?.addEventListener('submit', (e) => {
    e.preventDefault();

    const unityID = studentSelect.value;
    const student = dataService.students.get(unityID);
    const reportType = reportTypeSelect.value;
    const now = new Date();
    const formattedDate = `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()} ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    const newRecord = {
      'Timestamp': formattedDate,
      'Email Address': student ? student.email : `${unityID}@ncsu.edu`,
      'Last, First Name': student ? student.name : unityID,
      'What are you reporting today?': reportType,
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

    if (reportType === 'Interview') {
      newRecord['Please list the company, position, department/division. '] = document.getElementById('form-company-interview').value || 'Target Employer, Analytics Specialist, Insights';
      newRecord['Which interview was this? '] = document.getElementById('form-interview-stage').value;
      newRecord['How did you hear about the job?'] = document.getElementById('form-source').value;
      newRecord['Were there any technical concepts or questions that were challenging or new to you? '] = document.getElementById('form-notes').value;
    } else if (reportType === 'Offer') {
      newRecord['Please list the company and job title'] = document.getElementById('form-company-offer').value || 'Target Employer, Data Scientist';
      newRecord['Do you want to meet with career services to discuss further?:'] = document.getElementById('form-meet-services').value;
    } else if (reportType === 'Acceptance') {
      newRecord['Please list the company name and job title. '] = document.getElementById('form-company-acceptance').value || 'Target Employer, Analytics Associate';
      newRecord['What is the final offer? Please break down by salary and bonuses.'] = document.getElementById('form-compensation').value || '$110,000 base salary, $5,000 bonus';
      newRecord['Where is the job located (city/state)? '] = document.getElementById('form-location').value || 'Raleigh, NC';
      newRecord['What are the working conditions? '] = document.getElementById('form-work-conditions').value;
    }

    dataService.addSubmission(newRecord);
    closeModal();
    showToast(`Google Form response recorded for ${student?.name || unityID}! Real-time metrics updated.`);
  });

  // Handle CSV Import
  btnUpload?.addEventListener('click', () => {
    fileInput?.click();
  });

  fileInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await dataService.importTrackerCSV(file);
      showToast(`Successfully imported ${data.rawTracker.length} submissions from ${file.name}`);
    } catch (err) {
      showToast(`Error parsing CSV file: ${err.message}`, true);
    }
  });

  // Handle CSV Export
  btnExport?.addEventListener('click', () => {
    const data = dataService.getData();
    const csvStr = Papa.unparse(data.rawTracker);
    const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `iaa_recruitment_tracker_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported latest recruitment tracker dataset to CSV');
  });
}
