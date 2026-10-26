import { authService } from '../authService.js';
import { dataService } from '../dataService.js';
import { showToast } from './formModal.js';

export function initAccountModal() {
  const modal = document.getElementById('account-modal');
  const btnOpen = document.getElementById('btn-account-pill');
  const btnClose = document.getElementById('btn-close-account');
  const btnAdmin = document.getElementById('btn-login-admin');
  const btnStudent = document.getElementById('btn-login-student');
  const studentSelect = document.getElementById('account-student-select');

  function openModal() {
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeModal() {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }

  btnOpen?.addEventListener('click', openModal);
  btnClose?.addEventListener('click', closeModal);

  // Populate student select list
  dataService.subscribe((data) => {
    if (studentSelect && studentSelect.children.length === 0) {
      const sorted = [...data.students].sort((a, b) => a.name.localeCompare(b.name));
      studentSelect.innerHTML = sorted.map(s => `
        <option value="${s.unityID}">${s.name} (${s.unityID}) - ${s.status}</option>
      `).join('');
    }
  });

  // Login as Admin
  btnAdmin?.addEventListener('click', () => {
    authService.loginAsAdmin();
    closeModal();
    showToast('Switched to Career Services Administrator account');
  });

  // Login as Student
  btnStudent?.addEventListener('click', () => {
    const unityID = studentSelect.value;
    const student = dataService.students.get(unityID);
    if (student) {
      authService.loginAsStudent(student);
      closeModal();
      showToast(`Logged in as student: ${student.name} (${student.unityID})`);
    }
  });
}

/**
 * Updates the header account indicator badge.
 */
export function updateHeaderAccountBadge() {
  const pill = document.getElementById('btn-account-pill');
  if (!pill) return;

  const user = authService.getUser();
  if (user.role === 'admin') {
    pill.innerHTML = `
      <span class="user-role-badge">Admin</span>
      <span class="user-name">Career Services Staff</span>
      <svg style="width: 14px; height: 14px; margin-left: 2px;" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
      </svg>
    `;
  } else {
    pill.innerHTML = `
      <img 
        src="${user.avatarUrl || `/data/avatars/${user.unityID}.png`}" 
        alt="${user.name}" 
        style="width: 22px; height: 22px; border-radius: 50%; object-fit: cover;"
        onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=1E293B&color=F8FAFC'"
      />
      <span class="user-role-badge" style="background: rgba(16, 185, 129, 0.2); color: #10B981;">Student</span>
      <span class="user-name">${user.name.split(',')[0]}</span>
      <svg style="width: 14px; height: 14px; margin-left: 2px;" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
      </svg>
    `;
  }
}
