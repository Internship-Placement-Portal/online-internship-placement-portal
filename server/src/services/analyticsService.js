const analyticsRepository = require('../repositories/analyticsRepository');
const { resolveRange, months } = require('../utils/dateRange');

const round1 = (n) => Math.round(n * 10) / 10;
const countMap = (rows, field = 'count') => new Map(rows.map((r) => [r._id, r[field]]));

// ── IPP-F-019 / IPP-F-020: placement officer analytics ─────────────────────
async function placement(query = {}) {
  const range = resolveRange(query);
  const company = query.company || undefined;
  const [facets, tests, counts, companies] = await Promise.all([
    analyticsRepository.placementFacets({ ...range, company }),
    analyticsRepository.monthlyTests(range),
    analyticsRepository.platformCounts(),
    analyticsRepository.companies(),
  ]);

  const statusMap = countMap(facets.status);
  const statusBreakdown = ['Applied', 'Shortlisted', 'Selected', 'Rejected'].map((status) => ({ status, count: statusMap.get(status) || 0 }));
  const applications = statusBreakdown.reduce((s, x) => s + x.count, 0);
  const selections = statusMap.get('Selected') || 0;
  const placedStudents = facets.placed[0]?.n || 0;
  const applicants = facets.applicants[0]?.n || 0;

  const appsByMonth = countMap(facets.monthlyApplications);
  const selByMonth = countMap(facets.monthlySelections);
  const testsByMonth = new Map(tests.map((t) => [t._id, t]));
  // One entry per calendar month in the range; months without data are zero (accuracy is null = a visible gap).
  const monthly = months(range.from, range.to).map(({ key, label }) => ({
    month: key,
    label,
    applications: appsByMonth.get(key) || 0,
    selections: selByMonth.get(key) || 0,
    testAttempts: testsByMonth.get(key)?.attempts || 0,
    avgAccuracy: testsByMonth.has(key) ? round1(testsByMonth.get(key).avgAccuracy) : null,
  }));

  const attempts = tests.reduce((s, t) => s + t.attempts, 0);
  const weightedAccuracy = tests.reduce((s, t) => s + t.avgAccuracy * t.attempts, 0);

  return {
    filters: {
      from: range.from.toISOString().slice(0, 10),
      to: range.to.toISOString().slice(0, 10),
      company: company || '',
      companies: companies.sort((a, b) => a.localeCompare(b)),
    },
    kpis: {
      totalStudents: counts.students,
      applicants,
      placedStudents,
      placementRate: counts.students ? round1((placedStudents / counts.students) * 100) : 0, // placed / registered students
      applications,
      selections,
      conversionRate: applications ? round1((selections / applications) * 100) : 0, // selected / applications
      shortlisted: statusMap.get('Shortlisted') || 0,
      activeListings: counts.activeListings,
      recruiters: counts.recruiters,
      testAttempts: attempts,
      avgTestAccuracy: attempts ? round1(weightedAccuracy / attempts) : 0,
    },
    statusBreakdown,
    companyWise: facets.company.map((c) => ({ company: c._id, applications: c.applications, shortlisted: c.shortlisted, selected: c.selected })),
    domainBreakdown: facets.domain.map((d) => ({ domain: d._id, count: d.count })),
    monthly,
  };
}

// ── IPP-F-018: student progress dashboard ───────────────────────────────────
async function student(user) {
  const [apps, attempts] = await Promise.all([analyticsRepository.studentApplications(user._id), analyticsRepository.studentAttempts(user._id)]);

  const byStatus = { Applied: 0, Shortlisted: 0, Selected: 0, Rejected: 0 };
  apps.forEach((a) => {
    byStatus[a.status] += 1;
  });
  const now = new Date();
  const interviews = apps
    .filter((a) => a.interview && a.interview.date)
    .map((a) => ({
      applicationId: String(a._id),
      title: a.listing?.title,
      company: a.listing?.company,
      date: a.interview.date,
      mode: a.interview.mode,
      upcoming: new Date(a.interview.date) >= now,
    }))
    .sort((x, y) => new Date(x.date) - new Date(y.date));

  const scored = attempts.filter((a) => a.accuracy != null);
  const categories = {};
  scored.forEach((a) =>
    Object.entries(a.categoryBreakdown || {}).forEach(([name, v]) => {
      categories[name] = categories[name] || { correct: 0, total: 0 };
      categories[name].correct += v.correct;
      categories[name].total += v.total;
    })
  );

  return {
    applications: {
      total: apps.length,
      byStatus,
      recent: apps.slice(0, 5).map((a) => ({ id: String(a._id), status: a.status, title: a.listing?.title, company: a.listing?.company, appliedAt: a.createdAt })),
    },
    interviews: {
      scheduled: interviews.length,
      upcoming: interviews.filter((i) => i.upcoming),
    },
    tests: {
      attempts: attempts.length,
      avgAccuracy: scored.length ? round1(scored.reduce((s, a) => s + a.accuracy, 0) / scored.length) : 0,
      bestAccuracy: scored.length ? Math.max(...scored.map((a) => a.accuracy)) : 0,
      recent: attempts.slice(0, 5).map((a) => ({ id: String(a._id), test: a.test?.title, score: a.score, maxScore: a.maxScore, accuracy: a.accuracy, submittedAt: a.submittedAt })),
      trend: [...scored].reverse().slice(-10).map((a) => ({ label: a.test?.title, accuracy: a.accuracy, submittedAt: a.submittedAt })),
      categoryAccuracy: Object.entries(categories).map(([category, v]) => ({ category, accuracy: v.total ? round1((v.correct / v.total) * 100) : 0, total: v.total })),
    },
  };
}

async function exportData(query = {}) {
  const range = resolveRange(query);
  const company = query.company || undefined;
  const [summary, rows] = await Promise.all([placement(query), analyticsRepository.exportRows({ ...range, company })]);
  return { summary, rows };
}

module.exports = { placement, student, exportData };
