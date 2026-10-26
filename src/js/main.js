import { dataService } from './dataService.js';
import { authService } from './authService.js';
import { renderOverview } from './components/overviewView.js';
import { renderStudentDirectory } from './components/studentDirectory.js';
import { renderReplicationGuide } from './components/replicationView.js';
import { renderStudentPortal } from './components/studentPortalView.js';
import { initFormModal, showToast } from './components/formModal.js';
import { initAccountModal, updateHeaderAccountBadge } from './components/accountModal.js';

let activeTab = 'overview';

function renderNavTabs() {
  const navList = document.getElementById('nav-tabs-list');
  if (!navList) return;

  const isAdmin = authService.isAdmin();
  const data = dataService.getData();
  const supportCount = data.flaggedStudents?.length || 0;

  if (isAdmin) {
    if (activeTab === 'student-portal') activeTab = 'overview';
    navList.innerHTML = `
      <li class="nav-item">
        <button class="nav-link ${activeTab === 'overview' ? 'active' : ''}" data-tab="overview" role="tab">
          <svg class="tab-icon" viewBox="0 0 20 20" fill="currentColor">
            <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" />
            <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" />
          </svg>
          1. Executive & Placement Outcomes
        </button>
      </li>
      <li class="nav-item">
        <button class="nav-link ${activeTab === 'students' ? 'active' : ''}" data-tab="students" role="tab">
          <svg class="tab-icon" viewBox="0 0 20 20" fill="currentColor">
            <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
          </svg>
          2. Student Pipeline & Coaching Radar
          <span class="badge-alert" id="nav-support-count">${supportCount}</span>
        </button>
      </li>
      <li class="nav-item">
        <button class="nav-link ${activeTab === 'replication' ? 'active' : ''}" data-tab="replication" role="tab">
          <svg class="tab-icon" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clip-rule="evenodd" />
          </svg>
          3. Data Dictionary & Replication Guide
        </button>
      </li>
    `;
  } else {
    // Student role
    if (activeTab === 'students' || activeTab === 'replication') activeTab = 'student-portal';
    navList.innerHTML = `
      <li class="nav-item">
        <button class="nav-link ${activeTab === 'student-portal' ? 'active' : ''}" data-tab="student-portal" role="tab">
          <svg class="tab-icon" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" />
          </svg>
          My Recruitment Portal
        </button>
      </li>
      <li class="nav-item">
        <button class="nav-link ${activeTab === 'overview' ? 'active' : ''}" data-tab="overview" role="tab">
          <svg class="tab-icon" viewBox="0 0 20 20" fill="currentColor">
            <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" />
            <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" />
          </svg>
          Class Placement & Benchmarks
        </button>
      </li>
    `;
  }

  // Bind tab navigation click events
  navList.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      const tab = e.currentTarget.getAttribute('data-tab');
      if (!tab) return;
      activeTab = tab;
      renderNavTabs();
      renderActiveView();
    });
  });
}

function renderActiveView() {
  const data = dataService.getData();
  if (!dataService.isLoaded) return;

  // Hide all view panels
  document.querySelectorAll('.view-panel').forEach(panel => {
    panel.classList.remove('active');
  });

  const activePanel = document.getElementById(`view-${activeTab}`);
  if (!activePanel) return;
  activePanel.classList.add('active');

  // Dispatch rendering based on active tab
  switch (activeTab) {
    case 'overview':
      renderOverview(activePanel, data);
      break;
    case 'students':
      renderStudentDirectory(activePanel, data);
      break;
    case 'replication':
      renderReplicationGuide(activePanel, data);
      break;
    case 'student-portal':
      renderStudentPortal(activePanel, data);
      break;
    default:
      renderOverview(activePanel, data);
  }
}

async function startApp() {
  initFormModal();
  initAccountModal();
  updateHeaderAccountBadge();

  // Reset Demo Data Handler
  document.getElementById('btn-reset-data')?.addEventListener('click', async () => {
    if (confirm('Reset all changes and reload the pristine default synthetic dataset?')) {
      await dataService.resetToDefaultData();
      showToast('Reset complete: Reloaded original pristine synthetic dataset');
    }
  });

  // Listen to role changes
  authService.subscribe(() => {
    updateHeaderAccountBadge();
    renderNavTabs();
    renderActiveView();
  });

  try {
    await dataService.init();
    renderNavTabs();
    renderActiveView();

    // Auto update views on data changes
    dataService.subscribe(() => {
      renderNavTabs();
      renderActiveView();
    });
  } catch (err) {
    console.error('Failed to initialize recruitment dashboard:', err);
    const main = document.querySelector('.app-main');
    if (main) {
      main.innerHTML = `
        <div style="padding: 3rem; text-align: center; color: var(--ncstate-red);">
          <h2>Failed to load dataset</h2>
          <p style="color: var(--text-secondary); margin-top: 0.5rem;">${err.message}</p>
        </div>
      `;
    }
  }
}

// Boot on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}
