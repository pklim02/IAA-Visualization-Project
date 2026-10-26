import { dataService } from './dataService.js';
import { renderOverview } from './components/overviewView.js';
import { renderStudentDirectory } from './components/studentDirectory.js';
import { renderReplicationGuide } from './components/replicationView.js';
import { initFormModal } from './components/formModal.js';

let activeTab = 'overview';

function updateBadgeCounts(data) {
  const supportCountEl = document.getElementById('nav-support-count');
  if (supportCountEl) {
    const count = data.flaggedStudents.length;
    supportCountEl.textContent = count;
    supportCountEl.style.display = count > 0 ? 'inline-block' : 'none';
  }
}

function renderActiveView() {
  const data = dataService.getData();
  if (!dataService.isLoaded) return;

  updateBadgeCounts(data);

  // Hide all views
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
    default:
      renderOverview(activePanel, data);
  }
}

function initNavigation() {
  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      const tab = e.currentTarget.getAttribute('data-tab');
      if (!tab || tab === activeTab) return;

      navLinks.forEach(l => {
        l.classList.remove('active');
        l.setAttribute('aria-selected', 'false');
      });

      e.currentTarget.classList.add('active');
      e.currentTarget.setAttribute('aria-selected', 'true');
      activeTab = tab;

      renderActiveView();
    });
  });
}

async function startApp() {
  initFormModal();
  initNavigation();

  try {
    await dataService.init();
    renderActiveView();

    // Re-render automatically on form submission or CSV import
    dataService.subscribe(() => {
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
