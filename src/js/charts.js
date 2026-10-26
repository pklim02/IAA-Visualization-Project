import Chart from 'chart.js/auto';

// Global Chart.js light-theme defaults matching NC State IAA website
Chart.defaults.color = '#475569';
Chart.defaults.font.family = "'Inter', -apple-system, sans-serif";
Chart.defaults.font.size = 12;
Chart.defaults.plugins.tooltip.backgroundColor = '#1E293B';
Chart.defaults.plugins.tooltip.titleColor = '#FFFFFF';
Chart.defaults.plugins.tooltip.bodyColor = '#E2E8F0';
Chart.defaults.plugins.tooltip.borderColor = 'rgba(0, 0, 0, 0.1)';
Chart.defaults.plugins.tooltip.borderWidth = 1;
Chart.defaults.plugins.tooltip.padding = 10;
Chart.defaults.plugins.tooltip.cornerRadius = 6;
Chart.defaults.scale.grid.color = 'rgba(0, 0, 0, 0.06)';

const activeCharts = new Map();

function destroyChart(canvasId) {
  if (activeCharts.has(canvasId)) {
    activeCharts.get(canvasId).destroy();
    activeCharts.delete(canvasId);
  }
}

/**
 * Renders the recruitment funnel horizontal bar chart.
 */
export function renderFunnelChart(canvasId, funnelData) {
  destroyChart(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const labels = funnelData.map(d => d.stage);
  const counts = funnelData.map(d => d.count);
  const colors = funnelData.map(d => d.color);

  const chart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Candidate Activity',
        data: counts,
        backgroundColor: colors,
        borderRadius: 6,
        barThickness: 24
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.raw} reported events`
          }
        }
      },
      scales: {
        x: {
          grid: { display: true },
          ticks: { color: '#64748B' }
        },
        y: {
          grid: { display: false },
          ticks: { color: '#1E293B', font: { weight: 600 } }
        }
      }
    }
  });

  activeCharts.set(canvasId, chart);
  return chart;
}

/**
 * Renders the monthly cumulative placement line and interview volume chart.
 */
export function renderTimelineChart(canvasId, timelineData) {
  destroyChart(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const labels = timelineData.map(d => d.month);
  const interviews = timelineData.map(d => d.interviews);
  const cumulative = timelineData.map(d => d.cumulativePlaced);

  const chart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Cumulative Placed Students',
          data: cumulative,
          borderColor: '#10B981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.35,
          borderWidth: 3,
          yAxisID: 'y'
        },
        {
          label: 'Monthly Interviews',
          data: interviews,
          borderColor: '#CC0000',
          backgroundColor: '#CC0000',
          type: 'bar',
          borderRadius: 4,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { color: '#1E293B', font: { weight: 500 } } }
      },
      scales: {
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          title: { display: true, text: 'Students Placed', color: '#10B981' }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          grid: { drawOnChartArea: false },
          title: { display: true, text: 'Interviews Conducted', color: '#CC0000' }
        }
      }
    }
  });

  activeCharts.set(canvasId, chart);
  return chart;
}

/**
 * Renders source yield comparison (interviews vs offers).
 */
export function renderSourceYieldChart(canvasId, sourceData) {
  destroyChart(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const labels = sourceData.map(s => s.source);
  const interviews = sourceData.map(s => s.interviews);
  const offers = sourceData.map(s => s.offers);

  const chart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Interviews Generated',
          data: interviews,
          backgroundColor: '#3B82F6',
          borderRadius: 4
        },
        {
          label: 'Job Offers Resulted',
          data: offers,
          backgroundColor: '#F59E0B',
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { color: '#CBD5E1' } }
      },
      scales: {
        x: { ticks: { color: '#CBD5E1' } },
        y: { ticks: { color: '#64748B' } }
      }
    }
  });

  activeCharts.set(canvasId, chart);
  return chart;
}

/**
 * Renders salary histogram distribution.
 */
export function renderSalaryDistributionChart(canvasId, totalComps) {
  destroyChart(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  // Bucket amounts into $10k ranges
  const buckets = {
    '<$95k': 0,
    '$95k-$105k': 0,
    '$105k-$115k': 0,
    '$115k-$125k': 0,
    '$125k-$135k': 0,
    '>$135k': 0
  };

  totalComps.forEach(val => {
    const k = val / 1000;
    if (k < 95) buckets['<$95k']++;
    else if (k < 105) buckets['$95k-$105k']++;
    else if (k < 115) buckets['$105k-$115k']++;
    else if (k < 125) buckets['$115k-$125k']++;
    else if (k < 135) buckets['$125k-$135k']++;
    else buckets['>$135k']++;
  });

  const chart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: Object.keys(buckets),
      datasets: [{
        label: 'Accepted Offers',
        data: Object.values(buckets),
        backgroundColor: '#CC0000',
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.raw} accepted offers`
          }
        }
      },
      scales: {
        x: { ticks: { color: '#CBD5E1' } },
        y: { ticks: { stepSize: 2, color: '#64748B' } }
      }
    }
  });

  activeCharts.set(canvasId, chart);
  return chart;
}

/**
 * Renders employer leaderboard horizontal bar chart.
 */
export function renderEmployerChart(canvasId, topEmployers) {
  destroyChart(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const top10 = topEmployers.slice(0, 8);
  const labels = top10.map(e => e.company);
  const interviews = top10.map(e => e.interviews);
  const offers = top10.map(e => e.offers);

  const chart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Interviews',
          data: interviews,
          backgroundColor: 'rgba(59, 130, 246, 0.85)',
          borderRadius: 4
        },
        {
          label: 'Offers',
          data: offers,
          backgroundColor: '#F59E0B',
          borderRadius: 4
        }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { color: '#CBD5E1' } }
      },
      scales: {
        x: { ticks: { color: '#64748B' } },
        y: { ticks: { color: '#CBD5E1', font: { weight: 500 } } }
      }
    }
  });

  activeCharts.set(canvasId, chart);
  return chart;
}

/**
 * Renders average compensation by job role.
 */
export function renderRoleCompChart(canvasId, roleBreakdown) {
  destroyChart(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const labels = roleBreakdown.map(r => r.role);
  const values = roleBreakdown.map(r => r.avgComp);

  const chart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Average First-Year Comp ($)',
        data: values,
        backgroundColor: '#10B981',
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` $${ctx.raw.toLocaleString()}`
          }
        }
      },
      scales: {
        x: { ticks: { color: '#CBD5E1' } },
        y: {
          ticks: {
            color: '#64748B',
            callback: (val) => `$${val / 1000}k`
          }
        }
      }
    }
  });

  activeCharts.set(canvasId, chart);
  return chart;
}
