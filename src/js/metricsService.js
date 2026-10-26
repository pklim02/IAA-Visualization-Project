/**
 * Helper to calculate median of a numeric array.
 */
function calculateMedian(arr) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Computes analytics and visualizations data across the entire dataset.
 */
export class MetricsService {
  /**
   * Executive Overview KPIs
   */
  static getExecutiveKPIs(data) {
    const totalStudents = data.totalStudents || 75;
    const placedStudents = data.placedCount;
    const placementRate = ((placedStudents / totalStudents) * 100).toFixed(1);

    const totalInterviews = data.rawTracker.filter(r => r['What are you reporting today?'] === 'Interview').length;
    const totalOffers = data.rawTracker.filter(r => r['What are you reporting today?'] === 'Offer').length;

    // Compensation metrics from placed students
    const compData = this.getCompensationMetrics(data);

    return {
      totalStudents,
      placedStudents,
      placementRate,
      totalInterviews,
      totalOffers,
      avgInterviewsPerStudent: (totalInterviews / totalStudents).toFixed(1),
      avgComp: compData.avgTotalComp,
      medianComp: compData.medianTotalComp,
      atRiskCount: data.flaggedStudents.length
    };
  }

  /**
   * Recruitment Funnel Data
   */
  static getRecruitingFunnel(data) {
    let screens = 0;
    let round1 = 0;
    let round2 = 0;
    let finals = 0;
    let offers = 0;
    let acceptances = 0;

    data.rawTracker.forEach(row => {
      const type = row['What are you reporting today?'];
      const stage = (row['Which interview was this? '] || '').trim();

      if (type === 'Interview') {
        if (stage === 'Recruiter Screening') screens++;
        else if (stage === 'First Round') round1++;
        else if (stage === 'Second Round') round2++;
        else if (stage === 'Final Round') finals++;
      } else if (type === 'Offer') {
        offers++;
      } else if (type === 'Acceptance') {
        acceptances++;
      }
    });

    return [
      { stage: 'Recruiter Screen', count: screens, color: '#3B82F6' },
      { stage: 'First Round', count: round1, color: '#6366F1' },
      { stage: 'Second Round', count: round2, color: '#8B5CF6' },
      { stage: 'Final Round', count: finals, color: '#EC4899' },
      { stage: 'Job Offer', count: offers, color: '#F59E0B' },
      { stage: 'Accepted Position', count: acceptances, color: '#10B981' }
    ];
  }

  /**
   * Employer Recruitment Trends
   */
  static getEmployerTrends(data) {
    const employerMap = new Map();

    data.rawTracker.forEach(row => {
      const type = row['What are you reporting today?'];
      const rawText = 
        row['Please list the company, position, department/division. '] ||
        row['Please list the company and job title'] ||
        row['Please list the company name and job title. '] ||
        '';

      const company = rawText.split(',')[0]?.trim();
      if (!company) return;

      if (!employerMap.has(company)) {
        employerMap.set(company, {
          company,
          interviews: 0,
          uniqueStudents: new Set(),
          offers: 0,
          acceptances: 0,
          roles: new Set()
        });
      }

      const entry = employerMap.get(company);
      const email = row['Email Address'];
      if (email) entry.uniqueStudents.add(email);

      const role = rawText.split(',')[1]?.trim();
      if (role) entry.roles.add(role);

      if (type === 'Interview') entry.interviews++;
      else if (type === 'Offer') entry.offers++;
      else if (type === 'Acceptance') entry.acceptances++;
    });

    return Array.from(employerMap.values())
      .map(e => ({
        ...e,
        studentCount: e.uniqueStudents.size,
        rolesList: Array.from(e.roles).slice(0, 3).join(', '),
        conversionRate: e.interviews > 0 ? ((e.offers / e.interviews) * 100).toFixed(1) : 0
      }))
      .sort((a, b) => (b.interviews + b.offers * 2) - (a.interviews + a.offers * 2));
  }

  /**
   * Recruiting Source Yield & Channel Performance
   */
  static getSourceYield(data) {
    const sourceMap = new Map();

    data.rawTracker.forEach(row => {
      const rawSource = (row['How did you hear about the job?'] || '').trim();
      if (!rawSource) return;

      if (!sourceMap.has(rawSource)) {
        sourceMap.set(rawSource, {
          source: rawSource,
          interviews: 0,
          offers: 0
        });
      }

      const entry = sourceMap.get(rawSource);
      const type = row['What are you reporting today?'];
      if (type === 'Interview') entry.interviews++;
      else if (type === 'Offer') entry.offers++;
    });

    return Array.from(sourceMap.values())
      .map(s => ({
        ...s,
        yieldRate: s.interviews > 0 ? ((s.offers / s.interviews) * 100).toFixed(1) : '0.0'
      }))
      .sort((a, b) => b.interviews - a.interviews);
  }

  /**
   * Salary & Compensation Analytics
   */
  static getCompensationMetrics(data) {
    const baseSalaries = [];
    const bonuses = [];
    const totalComps = [];
    const roleMap = new Map();
    const conditionMap = new Map();

    data.students.forEach(student => {
      if (!student.acceptance) return;
      const comp = student.acceptance.compensation;
      if (comp.base > 0) {
        baseSalaries.push(comp.base);
        if (comp.bonus > 0) bonuses.push(comp.bonus);
        totalComps.push(comp.total);

        // Group by role
        const role = student.acceptance.role || 'Other';
        if (!roleMap.has(role)) {
          roleMap.set(role, { role, total: 0, count: 0, salaries: [] });
        }
        const rEntry = roleMap.get(role);
        rEntry.count++;
        rEntry.salaries.push(comp.total);
        rEntry.total += comp.total;

        // Group by condition
        const cond = student.acceptance.workingConditions || 'Unspecified';
        if (!conditionMap.has(cond)) {
          conditionMap.set(cond, { cond, count: 0, salaries: [] });
        }
        const cEntry = conditionMap.get(cond);
        cEntry.count++;
        cEntry.salaries.push(comp.total);
      }
    });

    const avgBase = baseSalaries.length ? Math.round(baseSalaries.reduce((a, b) => a + b, 0) / baseSalaries.length) : 0;
    const medianBase = calculateMedian(baseSalaries);
    const avgTotal = totalComps.length ? Math.round(totalComps.reduce((a, b) => a + b, 0) / totalComps.length) : 0;
    const medianTotal = calculateMedian(totalComps);
    const avgBonus = bonuses.length ? Math.round(bonuses.reduce((a, b) => a + b, 0) / bonuses.length) : 0;
    const medianBonus = calculateMedian(bonuses);

    const roleBreakdown = Array.from(roleMap.values()).map(r => ({
      role: r.role,
      avgComp: Math.round(r.total / r.count),
      medianComp: calculateMedian(r.salaries),
      count: r.count
    })).sort((a, b) => b.count - a.count);

    const conditionBreakdown = Array.from(conditionMap.values()).map(c => ({
      condition: c.cond,
      avgComp: Math.round(c.salaries.reduce((a, b) => a + b, 0) / c.count),
      count: c.count
    })).sort((a, b) => b.count - a.count);

    return {
      count: totalComps.length,
      avgBaseSalary: avgBase,
      medianBaseSalary: medianBase,
      minBaseSalary: baseSalaries.length ? Math.min(...baseSalaries) : 0,
      maxBaseSalary: baseSalaries.length ? Math.max(...baseSalaries) : 0,
      avgBonus,
      medianBonus,
      bonusRecipientRate: totalComps.length ? ((bonuses.length / totalComps.length) * 100).toFixed(0) : 0,
      avgTotalComp: avgTotal,
      medianTotalComp: medianTotal,
      allTotals: totalComps,
      roleBreakdown,
      conditionBreakdown
    };
  }

  /**
   * Monthly Activity & Cumulative Placement Timeline
   */
  static getTimelineActivity(data) {
    const monthlyMap = new Map();

    data.rawTracker.forEach(row => {
      const ts = row['Timestamp'];
      if (!ts) return;
      const date = new Date(ts);
      if (isNaN(date.getTime())) return;

      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyMap.has(key)) {
        monthlyMap.set(key, { month: key, interviews: 0, offers: 0, acceptances: 0 });
      }
      const entry = monthlyMap.get(key);
      const type = row['What are you reporting today?'];
      if (type === 'Interview') entry.interviews++;
      else if (type === 'Offer') entry.offers++;
      else if (type === 'Acceptance') entry.acceptances++;
    });

    const sortedMonths = Array.from(monthlyMap.values()).sort((a, b) => a.month.localeCompare(b.month));

    let cumulativePlaced = 0;
    return sortedMonths.map(m => {
      cumulativePlaced += m.acceptances;
      return {
        ...m,
        cumulativePlaced
      };
    });
  }
}
