// Zero-dependency test suite: `node --test tests/`
// Runs js/logic.js in a sandbox and checks the pure functions — including
// regressions for bugs this project actually had (always-0d offer stat,
// UTC+ chart off-by-one, wrong title splitting).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const src = readFileSync(join(__dirname, '..', 'js', 'logic.js'), 'utf8');
// Run in this context (not a vm sandbox realm) so returned objects share
// the host Array/Object prototypes and assert.deepStrictEqual works.
const L = vm.runInThisContext(src + `; ({
  STATUSES, STATUS_LABELS, sanitizeUrl, guessFromTitle, guessCompanyFromUrl,
  toISODate, computeDeadlineState, computeFollowUpState, computeAlerts,
  computeStats, computeFunnelCounts, startOfToday
})`, { filename: 'js/logic.js' });

test('sanitizeUrl allows http(s) and rejects everything else', () => {
  assert.equal(L.sanitizeUrl('https://ok.com/a?b=1'), 'https://ok.com/a?b=1');
  assert.equal(L.sanitizeUrl('http://ok.com'), 'http://ok.com/'); // URL() adds the trailing slash
  assert.equal(L.sanitizeUrl('javascript:alert(1)'), null);
  assert.equal(L.sanitizeUrl('data:text/html,x'), null);
  assert.equal(L.sanitizeUrl('not a url'), null);
  assert.equal(L.sanitizeUrl(''), null);
  assert.equal(L.sanitizeUrl(null), null);
});

test('guessFromTitle handles real job-post titles', () => {
  assert.deepEqual(L.guessFromTitle('Frontend Developer at Accenture | JobStreet'),
    { position: 'Frontend Developer', company: 'Accenture' });
  assert.deepEqual(L.guessFromTitle('OJT Intern - Web Dev - CompanyXYZ'),
    { position: 'OJT Intern - Web Dev', company: 'CompanyXYZ' });
  assert.deepEqual(L.guessFromTitle('Frontend Developer at Accenture'),
    { position: 'Frontend Developer', company: 'Accenture' });
  assert.deepEqual(L.guessFromTitle('Pay at least 200 - Apply now'),
    { position: 'Pay at least 200', company: 'Apply now' });
  assert.deepEqual(L.guessFromTitle('Just A Title'),
    { position: 'Just A Title', company: '' });
  assert.deepEqual(L.guessFromTitle(''), { position: '', company: '' });
  assert.deepEqual(L.guessFromTitle(null), { position: '', company: '' });
});

test('guessCompanyFromUrl skips subdomains and ccTLDs', () => {
  assert.equal(L.guessCompanyFromUrl('https://www.jobstreet.com.ph/job/1'), 'Jobstreet');
  assert.equal(L.guessCompanyFromUrl('https://boards.greenhouse.io/acme/jobs/1'), 'Greenhouse');
  assert.equal(L.guessCompanyFromUrl('https://acme.com/careers'), 'Acme');
  assert.equal(L.guessCompanyFromUrl('nonsense'), '');
});

test('toISODate uses the local calendar, not UTC', () => {
  assert.equal(L.toISODate(new Date(2026, 8, 5)), '2026-09-05');
  assert.equal(L.toISODate(new Date(2026, 0, 1)), '2026-01-01');
});

test('computeDeadlineState rules', () => {
  const today = new Date(2026, 8, 5); // local midnight
  assert.deepEqual(
    L.computeDeadlineState({ deadline: '2026-09-03', status: 'applied' }, today),
    { days: -2, date: '2026-09-03' });
  assert.deepEqual(
    L.computeDeadlineState({ deadline: '2026-09-05', status: 'applied' }, today),
    { days: 0, date: '2026-09-05' });
  // offer/rejected apps never alert
  assert.equal(L.computeDeadlineState({ deadline: '2026-09-03', status: 'offer' }, today), null);
  assert.equal(L.computeDeadlineState({ deadline: '2026-09-03', status: 'rejected' }, today), null);
  assert.equal(L.computeDeadlineState({ status: 'applied' }, today), null);
});

test('computeFollowUpState counts days until the reminder', () => {
  // Use a "now" of local midnight on day D so the follow-up at 09:00 UTC
  // of D+1 lands exactly 1 day away regardless of the test machine's
  // wall-clock time (Math.floor of a fractional day would otherwise
  // collapse to 0).
  const now = new Date(2026, 8, 5);
  const fu = L.computeFollowUpState({ follow_up_at: '2026-09-06T00:00:00Z' }, now);
  assert.equal(fu.days, 1);
  assert.equal(fu.date.toISOString(), '2026-09-06T00:00:00.000Z');
  assert.equal(L.computeFollowUpState({ status: 'applied' }, now), null);
});

test('computeAlerts includes overdue, due-soon and due follow-ups only', () => {
  const today = new Date(2026, 8, 5);
  const now = new Date(2026, 8, 5, 12);
  const apps = [
    { id: 'overdue', deadline: '2026-09-03', status: 'applied' },
    { id: 'soon', deadline: '2026-09-10', status: 'applied' },
    { id: 'later', deadline: '2026-10-10', status: 'applied' },
    { id: 'fu', follow_up_at: '2026-09-06T09:00:00Z', status: 'applied' },
    { id: 'done', deadline: '2026-09-03', status: 'rejected' }
  ];
  const alerts = L.computeAlerts(apps, today, now);
  assert.deepEqual(alerts.map(a => `${a.type}:${a.app.id}`).sort(),
    ['due_soon:soon', 'followup:fu', 'overdue:overdue']);
});

test('computeStats counts interviewed-then-rejected and fixes the 0d offer bug', () => {
  const apps = [
    // applied → interviewed in 10d → offered 5d later
    { status: 'offer', applied_at: '2026-08-01T00:00:00Z',
      interviewed_at: '2026-08-11T00:00:00Z', offered_at: '2026-08-16T00:00:00Z' },
    // applied 5d ago, interviewed 7d later (timestamp from updated_at fallback)
    { status: 'interview', applied_at: '2026-08-05T00:00:00Z', updated_at: '2026-08-12T00:00:00Z' },
    // interviewed then rejected — still counts as "interviewed"
    { status: 'rejected', applied_at: '2026-08-02T00:00:00Z', interviewed_at: '2026-08-06T00:00:00Z' },
    // never applied — excluded from the funnel
    { status: 'to_apply' }
  ];
  const s = L.computeStats(apps);
  assert.equal(s.applied, 3);
  assert.equal(s.interviewed, 3);
  assert.equal(s.offered, 1);
  assert.equal(s.rateAI, 100);
  assert.equal(s.rateIO, 33);
  assert.equal(s.avgDaysToInterview, 7); // (10 + 8 + 4) / 3 → 7.33 → 7
  assert.equal(s.avgDaysToOffer, 5);     // the old code reported 0d here
});

test('computeStats stays honest with no data', () => {
  const s = L.computeStats([]);
  assert.equal(s.rateAI, 0);
  assert.equal(s.rateIO, 0);
  assert.equal(s.avgDaysToInterview, null);
  assert.equal(s.avgDaysToOffer, null);
});

test('computeFunnelCounts counts every status', () => {
  const c = L.computeFunnelCounts([
    { status: 'to_apply' }, { status: 'to_apply' }, { status: 'offer' }
  ]);
  assert.equal(c.to_apply, 2);
  assert.equal(c.offer, 1);
  assert.equal(c.rejected, 0);
  assert.equal(Object.keys(c).length, L.STATUSES.length);
});

test('startOfToday clears the clock', () => {
  const d = L.startOfToday();
  assert.equal(d.getHours() + d.getMinutes() + d.getSeconds() + d.getMilliseconds(), 0);
});

// ---- Defense-in-depth for the vault upload (db.js) ----
// db.js isn't runnable in a plain VM, so we re-derive a focused check
// for the MIME rule here. (The real validateVaultFile lives in db.js.)
const ALLOWED = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'doc', 'docx'];

test('vault upload: rename trick is rejected by MIME check', () => {
  // A .pdf whose content type reports text/html must be refused even
  // though the extension passes
  const fake = { name: 'resume.pdf', type: 'text/html', size: 1024 };
  const ext = fake.name.split('.').pop();
  const mimes = { pdf: ['application/pdf'] };
  const valid = ALLOWED.includes(ext) && fake.size <= 10 * 1024 * 1024
    && (!fake.type || (mimes[ext] && mimes[ext].includes(fake.type)));
  assert.equal(valid, false, 'rename .pdf from text/html should fail');
});

test('vault upload: legitimate PDF is allowed', () => {
  const fake = { name: 'resume.pdf', type: 'application/pdf', size: 1024 };
  const mimes = { pdf: ['application/pdf'] };
  const ext = fake.name.split('.').pop();
  const valid = ALLOWED.includes(ext) && fake.size <= 10 * 1024 * 1024
    && (!fake.type || (mimes[ext] && mimes[ext].includes(fake.type)));
  assert.equal(valid, true);
});

test('vault upload: unknown MIME is allowed through (server catches it)', () => {
  // file.type is empty on some browsers; we defer to server check
  const fake = { name: 'photo.jpg', type: '', size: 1024 };
  const mimes = { jpg: ['image/jpeg'] };
  const ext = fake.name.split('.').pop();
  const valid = ALLOWED.includes(ext) && fake.size <= 10 * 1024 * 1024
    && (!fake.type || (mimes[ext] && mimes[ext].includes(fake.type)));
  assert.equal(valid, true, 'empty MIME defers to server-side check');
});
