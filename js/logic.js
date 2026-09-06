// Pure logic — no DOM, no network, no timers. Loaded before the UI modules
// and run directly under Node by tests/logic.test.js.

const STATUSES = ['to_apply', 'applied', 'interview', 'offer', 'rejected'];
const STATUS_LABELS = {
  to_apply: 'To Apply',
  applied: 'Applied',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected'
};
const STATUS_COLORS = {
  to_apply: '#8b98ab',
  applied: '#4f8cff',
  interview: '#e2b93d',
  offer: '#3fb96f',
  rejected: '#ef5350'
};

function sanitizeUrl(raw) {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return (u.protocol === 'https:' || u.protocol === 'http:') ? u.href : null;
  } catch (e) { return null; }
}

// "Frontend Dev at Acme | JobStreet" → position + company guesses.
// Splits at the rightmost separator first (site names trail the title);
// if an "at Something" segment sits before it, that's the real employer.
function guessFromTitle(title) {
  const t = (title || '').replace(/\s+/g, ' ').trim();
  if (!t) return { position: '', company: '' };
  const lower = t.toLowerCase();
  let best = -1, bestSep = '';
  for (const sep of [' at ', ' – ', ' - ', ' | ']) {
    const i = lower.lastIndexOf(sep);
    if (i > best) { best = i; bestSep = sep; }
  }
  if (best <= 2 || t.length - best - bestSep.length <= 1) {
    return { position: t.slice(0, 120), company: '' };
  }
  const at = lower.lastIndexOf(' at ');
  if (at > 0 && at < best && bestSep !== ' at ') {
    const mid = t.slice(at + 4, best).trim();
    // Mid segment must look like a name, not "least 200"
    if (/^[A-Z]/.test(mid) && !/\d/.test(mid)) {
      return {
        position: t.slice(0, at).trim().slice(0, 120),
        company: mid.slice(0, 120)
      };
    }
  }
  return {
    position: t.slice(0, best).trim().slice(0, 120),
    company: t.slice(best + bestSep.length).trim().slice(0, 120)
  };
}

function guessCompanyFromUrl(u) {
  try {
    const h = new URL(u).hostname.replace(/^www\./, '');
    const skip = ['jobs', 'careers', 'boards', 'apply', 'job', 'www'];
    const label = h.split('.').find(l => !skip.includes(l)) || h.split('.')[0];
    return label ? label.charAt(0).toUpperCase() + label.slice(1) : '';
  } catch { return ''; }
}

// Local calendar date — toISOString() would shift a day in UTC+ timezones
function toISODate(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const DAY_MS = 86400000;

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function computeDeadlineState(app, today) {
  if (!app.deadline || ['offer', 'rejected'].includes(app.status)) return null;
  const due = new Date(app.deadline + 'T00:00:00');
  return { days: Math.round((due - today) / DAY_MS), date: app.deadline };
}

function computeFollowUpState(app, now) {
  if (!app.follow_up_at) return null;
  const when = new Date(app.follow_up_at);
  return { days: Math.floor((when - now) / DAY_MS), date: when };
}

function computeAlerts(apps, today, now) {
  const out = [];
  for (const a of apps) {
    const dl = computeDeadlineState(a, today);
    if (dl && dl.days < 0) out.push({ type: 'overdue', app: a, ...dl });
    else if (dl && dl.days <= 7) out.push({ type: 'due_soon', app: a, ...dl });
    const fu = computeFollowUpState(a, now);
    if (fu && fu.days <= 1) out.push({ type: 'followup', app: a, ...fu });
  }
  return out.sort((x, y) => new Date(x.date) - new Date(y.date));
}

function computeFunnelCounts(apps) {
  const counts = {};
  for (const key of STATUSES) counts[key] = apps.filter(a => a.status === key).length;
  return counts;
}

// Conversion rates + average stage durations. Timestamps are exact once
// interviewed_at/offered_at exist; rows from before that fall back to
// updated_at as the stage date.
function computeStats(apps) {
  const applied = apps.filter(a => a.applied_at || a.status !== 'to_apply').length;
  const interviewed = apps.filter(a =>
    a.interviewed_at || ['interview', 'offer'].includes(a.status)).length;
  const offered = apps.filter(a => a.offered_at || a.status === 'offer').length;

  const rateAI = applied ? Math.round((interviewed / applied) * 100) : 0;
  const rateIO = interviewed ? Math.round((offered / interviewed) * 100) : 0;

  const stageDate = (a, col, activeStatuses) =>
    a[col] ? new Date(a[col])
      : (activeStatuses.includes(a.status) && a.updated_at ? new Date(a.updated_at) : null);

  let sumDI = 0, cntDI = 0;
  for (const a of apps) {
    const from = a.applied_at ? new Date(a.applied_at) : null;
    const to = stageDate(a, 'interviewed_at', ['interview', 'offer']);
    if (from && to && to >= from) { sumDI += (to - from) / DAY_MS; cntDI++; }
  }
  let sumDO = 0, cntDO = 0;
  for (const a of apps) {
    const from = stageDate(a, 'interviewed_at', ['interview', 'offer']);
    const to = stageDate(a, 'offered_at', ['offer']);
    if (from && to && to >= from) { sumDO += (to - from) / DAY_MS; cntDO++; }
  }
  return {
    applied, interviewed, offered, rateAI, rateIO,
    avgDaysToInterview: cntDI ? Math.round(sumDI / cntDI) : null,
    avgDaysToOffer: cntDO ? Math.round(sumDO / cntDO) : null
  };
}
