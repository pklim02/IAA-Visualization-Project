/**
 * Accessibility + responsive helpers.
 * The app re-renders whole views via innerHTML, so these run after every render.
 */

/** Remember which control has keyboard focus so a re-render doesn't drop it. */
export function captureFocus() {
  const el = document.activeElement;
  if (!el || el === document.body) return null;
  if (el.id) return `#${CSS.escape(el.id)}`;
  for (const attr of ['data-id', 'data-filter', 'data-jump', 'data-student', 'data-handled']) {
    const v = el.getAttribute?.(attr);
    if (v !== null && v !== undefined) return `[${attr}="${CSS.escape(v)}"]`;
  }
  return null;
}

export function restoreFocus(selector) {
  if (!selector) return;
  const el = document.querySelector(`#app-body ${selector}`) || document.querySelector(selector);
  if (el && el !== document.activeElement) el.focus({ preventScroll: true });
}

/** Run after every render. */
export function enhance(root) {
  // 1. Every .form-group label points at its control (fixes unnamed selects/inputs).
  let n = 0;
  root.querySelectorAll('.form-group').forEach(group => {
    const label = group.querySelector('label');
    const control = group.querySelector('input, select, textarea');
    if (!label || !control) return;
    if (!control.id) control.id = `field-${Date.now().toString(36)}-${n++}`;
    if (!label.getAttribute('for')) label.setAttribute('for', control.id);
    if (/\*\s*$/.test(label.textContent)) control.setAttribute('aria-required', 'true');
  });
  // Standalone required controls (e.g. modal fields) keep their native state.

  // 2. Data tables: add header scope and per-cell labels so rows can collapse to cards on phones.
  root.querySelectorAll('table.db-table').forEach(table => {
    const heads = [...table.querySelectorAll('thead th')];
    heads.forEach(th => th.setAttribute('scope', 'col'));
    table.querySelectorAll('tbody tr').forEach(tr => {
      [...tr.children].forEach((td, i) => {
        if (td.tagName === 'TD' && heads[i]) td.setAttribute('data-label', heads[i].textContent.trim());
      });
    });
  });

  // 3. Icon-only or symbol-only buttons need names.
  root.querySelectorAll('button').forEach(btn => {
    if (!btn.textContent.trim() && !btn.getAttribute('aria-label')) btn.setAttribute('aria-label', btn.title || 'Action');
  });
}

/** Modals: dialog semantics, focus trap, Escape to close, return focus to the opener. */
export function initModalA11y() {
  let opener = null;
  const observer = new MutationObserver(() => {
    const overlay = document.querySelector('.db-modal-overlay');
    if (overlay && !overlay.dataset.a11y) {
      overlay.dataset.a11y = '1';
      opener = document.activeElement;
      const dialog = overlay.querySelector('.db-modal-content');
      const title = overlay.querySelector('.db-modal-title');
      if (title && !title.id) title.id = 'db-modal-title';
      dialog?.setAttribute('role', 'dialog');
      dialog?.setAttribute('aria-modal', 'true');
      if (title) dialog?.setAttribute('aria-labelledby', title.id);
      const close = overlay.querySelector('.db-modal-close');
      close?.setAttribute('aria-label', 'Close dialog');
      enhance(overlay);
      (overlay.querySelector('input, select, textarea') || close)?.focus();
    } else if (!overlay && opener) {
      const target = opener;
      opener = null;
      if (target.isConnected) target.focus();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  document.addEventListener('keydown', (e) => {
    const overlay = document.querySelector('.db-modal-overlay');
    if (!overlay) return;
    if (e.key === 'Escape') {
      overlay.querySelector('.db-modal-close')?.click();
      return;
    }
    if (e.key !== 'Tab') return;
    const focusable = [...overlay.querySelectorAll('button, input, select, textarea, [href], [tabindex]:not([tabindex="-1"])')].filter(el => !el.disabled && el.offsetParent !== null);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
}
