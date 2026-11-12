/** ----------------------------------------------------
 *  MODE 5: EMPLOYER INSIGHTS
 *  Interview rounds, sourcing channels and candidate-reported
 *  notes, broken down by employer.
 *  ---------------------------------------------------- */

let selectedEmployer = null;

const ROUNDS = [
  { key: 'screening', label: 'Screening', cls: 'seg-screen' },
  { key: 'first', label: '1st Round', cls: 'seg-first' },
  { key: 'second', label: '2nd Round', cls: 'seg-second' },
  { key: 'final', label: 'Final Round', cls: 'seg-final' },
  { key: 'other', label: 'Other', cls: 'seg-other' }
];

// Themes mined from the free-text "challenging or new" notes
const THEMES = [
  { label: 'SQL', re: /\bsql\b|case when|\bjoins?\b|window function/i },
  { label: 'Python / R', re: /python|\bpandas\b|ifelse|\bR\b/i },
  { label: 'Case study', re: /case study|case interview|business case/i },
  { label: 'Probability & stats', re: /probabilit|expected value|bayes|hypothesis|regression|statistic|distribution/i },
  { label: 'Machine learning', re: /machine learning|\bml\b|\bmodels?\b|overfit|random forest|gradient|classification/i },
  { label: 'Coding / algorithms', re: /\bcod(e|ing)\b|leetcode|algorithm|live coding|whiteboard/i },
  { label: 'Behavioral / fit', re: /behavio|background|resume|tell me about|culture|motivation/i },
  { label: 'Visualization / BI', re: /tableau|power ?bi|dashboard|visuali|excel/i }
];

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const field = (r, a, b) => (r[a] || (b ? r[b] : '') || '').trim();
const companyOf = (txt) => (txt || '').split(',')[0].trim();

/** "Last, First" -> "First Last" */
function displayName(raw) {
  const t = (raw || '').trim();
  const i = t.indexOf(',');
  return i === -1 ? t : `${t.slice(i + 1).trim()} ${t.slice(0, i).trim()}`.trim();
}

function roundKey(stageRaw) {
  const s = (stageRaw || '').toLowerCase();
  if (s.includes('screen')) return 'screening';
  if (s.includes('first')) return 'first';
  if (s.includes('second')) return 'second';
  if (s.includes('final')) return 'final';
  return 'other';
}

/** Notes that say nothing ("no", "nothing challenging") are not useful to show. */
function isSubstantive(note) {
  const n = note.trim();
  if (n.length < 25) return false;
  return !/^(no\b|nope|nothing|n\/a|none)/i.test(n);
}

function buildEmployerIndex(submissions) {
  const map = new Map();
  const get = (name) => {
    if (!map.has(name)) {
      map.set(name, {
        name,
        interviews: 0,
        rounds: { screening: 0, first: 0, second: 0, final: 0, other: 0 },
        candidates: new Set(),
        sources: {},
        unreportedSource: 0,
        notes: [],
        offers: 0,
        acceptances: 0,
        people: new Map(),     // email -> { name, rounds } for everyone who interviewed here
        offerEmails: new Set(),
        accepted: new Map()    // email -> { name, role }
      });
    }
    return map.get(name);
  };

  for (const r of submissions) {
    const type = (r['What are you reporting today?'] || '').trim();
    if (type === 'Interview') {
      const name = companyOf(field(r, 'Please list the company, position, department/division. ', 'Please list the company, position, department/division.'));
      if (!name) continue;
      const e = get(name);
      e.interviews++;
      e.rounds[roundKey(field(r, 'Which interview was this? ', 'Which interview was this?'))]++;
      const email = (r['Email Address'] || '').toLowerCase().trim();
      e.candidates.add(email);
      if (!e.people.has(email)) {
        e.people.set(email, { name: displayName(r['Last, First Name']), rounds: { screening: 0, first: 0, second: 0, final: 0, other: 0 } });
      }
      e.people.get(email).rounds[roundKey(field(r, 'Which interview was this? ', 'Which interview was this?'))]++;
      const src = (r['How did you hear about the job?'] || '').trim();
      if (src) e.sources[src] = (e.sources[src] || 0) + 1;
      else e.unreportedSource++;
      const note = field(r, 'Were there any technical concepts or questions that were challenging or new to you? ', 'Were there any technical concepts or questions that were challenging or new to you?');
      if (note) {
        e.notes.push({
          text: note,
          round: roundKey(field(r, 'Which interview was this? ', 'Which interview was this?')),
          when: r['Timestamp'] || ''
        });
      }
    } else if (type === 'Offer') {
      const name = companyOf(r['Please list the company and job title']);
      if (name) {
        const e = get(name);
        e.offers++;
        e.offerEmails.add((r['Email Address'] || '').toLowerCase().trim());
      }
    } else if (type === 'Acceptance') {
      const name = companyOf(field(r, 'Please list the company name and job title. ', 'Please list the company name and job title.'));
      if (name) {
        const e = get(name);
        e.acceptances++;
        const jobTitle = field(r, 'Please list the company name and job title. ', 'Please list the company name and job title.').split(',').slice(1).join(',').trim();
        e.accepted.set((r['Email Address'] || '').toLowerCase().trim(), { name: displayName(r['Last, First Name']), role: jobTitle });
      }
    }
  }
  return [...map.values()];
}

function sumSources(list) {
  const total = {};
  let reported = 0;
  for (const e of list) {
    for (const [k, v] of Object.entries(e.sources)) {
      total[k] = (total[k] || 0) + v;
      reported += v;
    }
  }
  return { total, reported };
}

export function renderEmployers(container, data, rerender) {
  const employers = buildEmployerIndex(data.submissions || []);

  if (employers.length === 0) {
    container.innerHTML = `
      <div class="analytics-page">
        <div class="card analytics-card"><div class="empty-stream">No interview data recorded yet.</div></div>
      </div>`;
    return;
  }

  const byInterviews = [...employers].sort((a, b) => b.interviews - a.interviews || a.name.localeCompare(b.name));
  if (!selectedEmployer || !employers.some(e => e.name === selectedEmployer)) {
    selectedEmployer = byInterviews[0].name;
  }
  const emp = employers.find(e => e.name === selectedEmployer);

  // Cohort-level totals for context
  const totalInterviews = employers.reduce((n, e) => n + e.interviews, 0);
  const { total: allSources, reported: allReported } = sumSources(employers);

  // Selected employer: sourcing
  const empReported = Object.values(emp.sources).reduce((a, b) => a + b, 0);
  const sourceRows = Object.entries(emp.sources).sort((a, b) => b[1] - a[1]);

  // Selected employer: themes + notes
  const substantive = emp.notes.filter(n => isSubstantive(n.text));
  const themeRows = THEMES
    .map(t => ({ label: t.label, count: substantive.filter(n => t.re.test(n.text)).length }))
    .filter(t => t.count > 0)
    .sort((a, b) => b.count - a.count);
  // People who interviewed here and accepted
  const acceptedPeople = [...emp.accepted.values()];
  const maxTheme = themeRows.length ? themeRows[0].count : 1;
  const roundLabel = (k) => ROUNDS.find(r => r.key === k)?.label || 'Other';

  const finalPct = emp.interviews ? Math.round((emp.rounds.final / emp.interviews) * 100) : 0;

  container.innerHTML = `
    <div class="analytics-page">
      <div class="card analytics-card">
        <div class="emp-toolbar">
          <div>
            <h3 class="section-title" style="margin-bottom:0.2rem;">EMPLOYER INSIGHTS</h3>
            <div class="emp-sub">${employers.length} employers &middot; ${totalInterviews} interviews logged</div>
          </div>
          <label class="filter-select-label emp-picker">
            <span>Employer</span>
            <select id="employer-select" class="filter-select">
              ${byInterviews.map(e => `<option value="${esc(e.name)}" ${e.name === selectedEmployer ? 'selected' : ''}>${esc(e.name)} (${e.interviews})</option>`).join('')}
            </select>
          </label>
        </div>
      </div>

      <!-- Selected employer KPIs -->
      <div class="emp-kpis">
        <div class="emp-kpi"><span class="emp-kpi-num">${emp.interviews}</span><span class="emp-kpi-label">Interviews</span></div>
        <div class="emp-kpi"><span class="emp-kpi-num">${emp.candidates.size}</span><span class="emp-kpi-label">Candidates</span></div>
        <div class="emp-kpi"><span class="emp-kpi-num">${finalPct}%</span><span class="emp-kpi-label">Reached final round</span></div>
        <div class="emp-kpi kpi-offer"><span class="emp-kpi-num">${emp.offers}</span><span class="emp-kpi-label">Offers</span></div>
        <div class="emp-kpi kpi-placed"><span class="emp-kpi-num">${emp.acceptances}</span><span class="emp-kpi-label">Acceptances</span></div>
      </div>

      <div class="analytics-dual-row">
        <!-- Rounds -->
        <div class="card analytics-card">
          <h3 class="section-title">Interview Rounds</h3>
          <div class="leaderboard-list">
            ${ROUNDS.filter(r => r.key !== 'other' || emp.rounds.other > 0).map(r => `
              <div class="leaderboard-row">
                <div class="leaderboard-meta">
                  <span class="leaderboard-name">${r.label}</span>
                  <span class="leaderboard-count">${emp.rounds[r.key]}</span>
                </div>
                <div class="leaderboard-track">
                  <div class="leaderboard-bar ${r.cls}" style="width: ${emp.interviews ? (emp.rounds[r.key] / emp.interviews) * 100 : 0}%;"></div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Sourcing -->
        <div class="card analytics-card">
          <h3 class="section-title">Sourcing Channels</h3>
          ${sourceRows.length === 0 ? `
            <div class="empty-stream">No sourcing channel reported for this employer.</div>
          ` : `
            <div class="leaderboard-list">
              ${sourceRows.map(([name, n]) => {
                const pct = Math.round((n / empReported) * 100);
                const allPct = allReported ? Math.round(((allSources[name] || 0) / allReported) * 100) : 0;
                return `
                  <div class="leaderboard-row">
                    <div class="leaderboard-meta">
                      <span class="leaderboard-name">${esc(name)}</span>
                      <span class="leaderboard-count">${n} (${pct}%) <span class="emp-vs">all employers ${allPct}%</span></span>
                    </div>
                    <div class="leaderboard-track">
                      <div class="leaderboard-bar bar-teal" style="width: ${pct}%;"></div>
                      <div class="emp-avg-marker" style="left: ${allPct}%;" title="All employers: ${allPct}%"></div>
                    </div>
                  </div>`;
              }).join('')}
            </div>
            <p class="emp-footnote">Marker = share across all employers.${emp.unreportedSource ? ` ${emp.unreportedSource} interview${emp.unreportedSource > 1 ? 's' : ''} had no channel reported and are excluded.` : ''}</p>
          `}
        </div>
      </div>

      <!-- Notes -->
      <div class="analytics-dual-row">
        <div class="card analytics-card">
          <h3 class="section-title">What Candidates Found Challenging</h3>
          ${themeRows.length === 0 ? `
            <div class="empty-stream">No substantive notes for this employer yet.</div>
          ` : `
            <div class="leaderboard-list">
              ${themeRows.map(t => `
                <div class="leaderboard-row">
                  <div class="leaderboard-meta">
                    <span class="leaderboard-name">${t.label}</span>
                    <span class="leaderboard-count">${t.count} ${t.count === 1 ? 'note' : 'notes'}</span>
                  </div>
                  <div class="leaderboard-track"><div class="leaderboard-bar" style="width: ${(t.count / maxTheme) * 100}%;"></div></div>
                </div>`).join('')}
            </div>
            <p class="emp-footnote">Themes are matched by keyword from ${substantive.length} substantive note${substantive.length === 1 ? '' : 's'} (of ${emp.notes.length} written). A note can count toward several themes.</p>
          `}
        </div>

        <div class="card analytics-card">
          <h3 class="section-title">Candidate Notes (verbatim)</h3>
          ${substantive.length === 0 ? `
            <div class="empty-stream">No substantive notes for this employer yet.</div>
          ` : `
            <div class="emp-notes leaderboard-scroll" tabindex="0" role="region" aria-label="Candidate notes, scrollable">
              ${substantive.map(n => `
                <div class="emp-note">
                  <div class="emp-note-meta"><span class="stream-tag tag-interview">${roundLabel(n.round)}</span><span class="stream-date">${esc(n.when)}</span></div>
                  <div class="emp-note-text">${esc(n.text)}</div>
                </div>`).join('')}
            </div>
          `}
        </div>
      </div>

      <!-- Who interviewed and accepted -->
      <div class="card analytics-card">
        <h3 class="section-title">Who Interviewed &amp; Accepted</h3>
        ${acceptedPeople.length === 0 ? `
          <div class="empty-stream">No one has logged an acceptance at this employer yet.</div>
        ` : `
          <div class="emp-notes leaderboard-scroll" tabindex="0" role="region" aria-label="People who accepted, scrollable">
            ${acceptedPeople.map(a => `
              <div class="emp-note">
                <div class="emp-note-meta"><strong>${esc(a.name)}</strong><span class="stream-date">${esc(a.role || 'Role not recorded')}</span></div>
              </div>`).join('')}
          </div>
        `}
      </div>

    </div>
  `;

  container.querySelector('#employer-select')?.addEventListener('change', (e) => {
    selectedEmployer = e.target.value;
    rerender();
  });
}
