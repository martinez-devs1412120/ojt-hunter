// Mobile layout condition — keep in sync with the CSS media queries.
// Touch devices get the mobile board up to 900px (some 720p-class phones
// report ~690-820px viewports and would otherwise fall in the gap).
const MOBILE_MQ = '(max-width: 768px), (max-width: 900px) and (pointer: coarse)';

const kanban = {
  apps: [],
  loaded: false,
  editingId: null,
  currentNotes: [],
  mobileStatus: 'to_apply',
  mq: null,

  async load() {
    kanban.apps = await fetchApplications();
    kanban.loaded = true;
    kanban.sync();
  },

  sync() {
    kanban.render();
    reminders.render(kanban.apps);
    app.renderStats(kanban.apps);
  },

  visible() {
    const q = document.getElementById('board-search').value.trim().toLowerCase();
    if (!q) return kanban.apps;
    return kanban.apps.filter(a =>
      a.company.toLowerCase().includes(q) || a.position.toLowerCase().includes(q));
  },

  render() {
    const board = document.getElementById('kanban');
    board.innerHTML = '';
    const list = kanban.visible();

    document.getElementById('board-loading').classList.toggle('hidden', kanban.loaded);
    document.getElementById('board-empty').classList.toggle(
      'hidden', !(list.length === 0));

    // Phones get a status tab strip + single-column list (HTML5 drag
    // doesn't exist on touch), desktop keeps the five-column board
    if (!kanban.mq) kanban.mq = window.matchMedia(MOBILE_MQ);
    if (kanban.mq.matches) {
      kanban.renderMobile(board, list);
      return;
    }

    for (const status of STATUSES) {
      const colApps = list.filter(a => a.status === status);
      const col = document.createElement('div');
      col.className = 'col';
      col.dataset.status = status;

      const head = document.createElement('div');
      head.className = 'col-head';
      head.innerHTML = `
        <span class="stat-dot"></span>
        <span class="col-title">${STATUS_LABELS[status]}</span>
        <span class="col-count">${colApps.length}</span>`;
      // Set via CSSOM — inline style attributes in innerHTML are blocked by CSP
      head.querySelector('.stat-dot').style.background = STATUS_COLORS[status];
      col.appendChild(head);

      const body = document.createElement('div');
      body.className = 'col-body';

      if (!colApps.length) {
        body.innerHTML = '<div class="col-empty">Drop here</div>';
      }
      for (const row of colApps) body.appendChild(kanban.card(row));

      col.appendChild(body);

      col.addEventListener('dragover', e => {
        e.preventDefault();
        col.classList.add('drag-over');
      });
      col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
      col.addEventListener('drop', async e => {
        e.preventDefault();
        col.classList.remove('drag-over');
        const id = e.dataTransfer.getData('text/plain');
        const row = kanban.apps.find(a => a.id === id);
        kanban.moveStatus(row, status);
      });

      board.appendChild(col);
    }
  },

  renderMobile(board, list) {
    const wrap = document.createElement('div');
    wrap.className = 'mboard';

    const chips = document.createElement('div');
    chips.className = 'mchips';
    for (const status of STATUSES) {
      const n = list.filter(a => a.status === status).length;
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'mchip' + (kanban.mobileStatus === status ? ' active' : '');
      chip.innerHTML = `<span class="mchip-dot"></span>${STATUS_LABELS[status]} <b>${n}</b>`;
      chip.querySelector('.mchip-dot').style.background = STATUS_COLORS[status];
      chip.onclick = () => { kanban.mobileStatus = status; kanban.render(); };
      chips.appendChild(chip);
    }
    wrap.appendChild(chips);

    const listEl = document.createElement('div');
    listEl.className = 'mlist';
    const cards = list.filter(a => a.status === kanban.mobileStatus);
    if (!cards.length) {
      const empty = document.createElement('div');
      empty.className = 'col-empty';
      empty.textContent = 'Nothing here yet';
      listEl.appendChild(empty);
    }
    for (const row of cards) {
      const card = kanban.card(row);
      const nav = document.createElement('div');
      nav.className = 'mcard-nav';
      const idx = STATUSES.indexOf(row.status);
      if (idx > 0) nav.appendChild(kanban.moveBtn(row, idx - 1, 'left'));
      if (idx < STATUSES.length - 1) nav.appendChild(kanban.moveBtn(row, idx + 1, 'right'));
      card.appendChild(nav);
      listEl.appendChild(card);
    }
    wrap.appendChild(listEl);
    board.appendChild(wrap);
  },

  moveBtn(row, targetIdx, dir) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'mmove';
    const label = 'Move to ' + STATUS_LABELS[STATUSES[targetIdx]];
    b.title = label;
    b.setAttribute('aria-label', label);
    b.innerHTML = dir === 'left'
      ? '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M10 3 5 8l5 5"/></svg>'
      : '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 3l5 5-5 5"/></svg>';
    b.onclick = e => { e.stopPropagation(); kanban.moveStatus(row, STATUSES[targetIdx]); };
    return b;
  },

  // Shared by desktop drag-drop and the mobile move buttons
  async moveStatus(row, status) {
    if (!row || row.status === status) return;
    const prevStatus = STATUS_LABELS[row.status];
    const newStatus = STATUS_LABELS[status];
    try {
      const fields = { status };
      const now = new Date().toISOString();
      if (['applied', 'interview', 'offer'].includes(status) && !row.applied_at) {
        fields.applied_at = now;
      }
      if (status === 'interview' && !row.interviewed_at) fields.interviewed_at = now;
      if (status === 'offer' && !row.offered_at) fields.offered_at = now;
      const updated = await updateApplication(row.id, fields);
      Object.assign(row, updated);
      kanban.sync();
      toast(`"${row.company}" moved ${prevStatus} → ${newStatus}`, 'ok');
    } catch (err) { toast(err.message, 'err'); }
  },

  card(row) {
    const el = document.createElement('article');
    el.className = `card pr-${row.priority}`;
    el.draggable = true;
    el.dataset.id = row.id;

    const pills = [];
    const dl = reminders.deadlineState(row);
    if (dl) {
      if (dl.days < 0) pills.push(`<span class="pill overdue">${-dl.days}d overdue</span>`);
      else if (dl.days === 0) pills.push('<span class="pill overdue">Due today</span>');
      else if (dl.days <= 7) pills.push(`<span class="pill due-soon">in ${dl.days}d</span>`);
      else pills.push(`<span class="pill">due ${new Date(row.deadline + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}</span>`);
    }
    if (row.ojt_hours) pills.push(`<span class="pill">${row.ojt_hours}h OJT</span>`);

    el.innerHTML = `
      <div class="card-company"></div>
      <div class="card-position"></div>
      <div class="card-meta">${pills.join('')}</div>`;
    el.querySelector('.card-company').textContent = row.company;
    el.querySelector('.card-position').textContent = row.position;

    el.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', row.id);
      e.dataTransfer.effectAllowed = 'move';
      el.classList.add('dragging');
    });
    el.addEventListener('dragend', () => el.classList.remove('dragging'));
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        kanban.openModal(row);
      }
    });
    el.onclick = () => kanban.openModal(row);

    return el;
  },

  openModal(app, prefill) {
    const m = document.getElementById('modal-application');
    kanban.editingId = app?.id || null;
    document.getElementById('app-modal-title').textContent =
      app ? `${app.company} — details` : 'New application';
    document.getElementById('btn-delete-app').classList.toggle('hidden', !app);

    setVal('f-company', app?.company);
    setVal('f-position', app?.position, 'OJT Intern');
    setVal('f-email', app?.hr_email);
    setVal('f-url', app?.source_url);
    setVal('f-status', app?.status, 'to_apply');
    setVal('f-priority', app?.priority, 'medium');
    setVal('f-deadline', app?.deadline);
    setVal('f-followup', toLocalInput(app?.follow_up_at));
    document.getElementById('f-hours').value = app?.ojt_hours ?? '';

    // Prefill from a captured job post (bookmarklet / ?add= link)
    if (!app && prefill) {
      const g = guessFromTitle(prefill.title);
      if (g.company) setVal('f-company', g.company);
      if (g.position) setVal('f-position', g.position);
      setVal('f-url', prefill.url);
      document.getElementById('app-modal-title').textContent = 'New application — from web';
    }

    kanban.currentNotes = [];
    if (app) kanban.loadNotes(app.id);
    else kanban.renderNotes();

    m.showModal();
  },

  async loadNotes(applicationId) {
    try {
      kanban.currentNotes = await fetchNotes(applicationId);
    } catch { kanban.currentNotes = []; }
    kanban.renderNotes();
  },

  renderNotes() {
    const listEl = document.getElementById('notes-list');
    listEl.innerHTML = '';
    for (const n of kanban.currentNotes) {
      const item = document.createElement('div');
      item.className = 'note-item';
      item.innerHTML = `
        <p></p>
        <span class="note-time">${new Date(n.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}</span>
        <button class="note-del" title="Delete note" aria-label="Delete note" type="button">${ICONS.x}</button>`;
      item.querySelector('p').textContent = n.content;
      item.querySelector('.note-del').onclick = async () => {
        try {
          await deleteNote(n.id);
          kanban.currentNotes = kanban.currentNotes.filter(x => x.id !== n.id);
          kanban.renderNotes();
          toast('Note deleted');
        } catch (err) { toast(err.message, 'err'); }
      };
      listEl.appendChild(item);
    }
  },

  init() {
    document.getElementById('btn-add-app').onclick = () => kanban.openModal(null);
    document.getElementById('board-search').oninput = () => kanban.render();

    // Re-render when crossing the mobile/desktop breakpoint
    kanban.mq = window.matchMedia(MOBILE_MQ);
    kanban.mq.addEventListener?.('change', () => kanban.render());

    // Save from anywhere: quick-add by URL + bookmarklet setup
    document.getElementById('btn-capture').onclick = () => {
      document.getElementById('c-url').value = '';
      document.getElementById('bm-code').textContent = buildBookmarklet();
      document.getElementById('modal-capture').showModal();
    };
    document.getElementById('form-capture').onsubmit = async e => {
      e.preventDefault();
      const btn = e.target.querySelector('button[type="submit"]');
      if (btn.disabled) return;
      btn.disabled = true;
      try {
        const safe = sanitizeUrl(val('c-url'));
        if (!safe) { toast('Paste a full URL starting with https://', 'err'); return; }
        const fields = {
          company: guessCompanyFromUrl(safe) || 'Untitled',
          position: 'OJT Intern',
          source_url: safe,
          status: 'to_apply'
        };
        try {
          const saved = await insertApplication(fields);
          kanban.apps.push(saved);
          kanban.sync();
          closeAllModals();
          toast(`"${saved.company}" captured — add details later`, 'ok');
        } catch (err) { toast(err.message, 'err'); }
      } finally {
        btn.disabled = false;
      }
    };
    document.getElementById('btn-copy-bm').onclick = async () => {
      try {
        await navigator.clipboard.writeText(buildBookmarklet());
        toast('Bookmarklet copied — paste it as a bookmark URL', 'ok');
      } catch { toast('Copy failed', 'err'); }
    };

    document.getElementById('form-application').onsubmit = async e => {
      e.preventDefault();
      const btn = e.target.querySelector('button[type="submit"]');
      if (btn.disabled) return;
      btn.disabled = true;
      try {
        const jobUrl = sanitizeUrl(val('f-url'));
        if (val('f-url') && !jobUrl) { toast('Job post URL must start with https:// or http://', 'err'); return; }
        const hours = Number(val('f-hours'));
        const fields = {
          company: val('f-company'),
          position: val('f-position') || 'OJT Intern',
          hr_email: val('f-email') || null,
          source_url: jobUrl,
          status: val('f-status'),
          priority: val('f-priority'),
          deadline: val('f-deadline') || null,
          follow_up_at: val('f-followup') ? new Date(val('f-followup')).toISOString() : null,
          ojt_hours: val('f-hours') !== '' && Number.isFinite(hours) ? Math.trunc(hours) : null
        };
        // Stamp funnel timestamps the first time an app reaches a stage
        const prev = kanban.editingId
          ? kanban.apps.find(a => a.id === kanban.editingId) : null;
        const now = new Date().toISOString();
        if (!prev?.applied_at && ['applied', 'interview', 'offer'].includes(fields.status)) {
          fields.applied_at = now;
        }
        if (!prev?.interviewed_at && fields.status === 'interview') fields.interviewed_at = now;
        if (!prev?.offered_at && fields.status === 'offer') fields.offered_at = now;
        try {
          let saved;
          if (kanban.editingId) saved = await updateApplication(kanban.editingId, fields);
          else saved = await insertApplication(fields);

          const existing = kanban.apps.findIndex(a => a.id === saved.id);
          if (existing >= 0) kanban.apps[existing] = saved;
          else kanban.apps.push(saved);

          closeAllModals();
          kanban.sync();
          toast(kanban.editingId ? 'Application updated' : `"${saved.company}" added`, 'ok');
        } catch (err) { toast(err.message, 'err'); }
      } finally {
        btn.disabled = false;
      }
    };

    document.getElementById('btn-add-note').onclick = async () => {
      const input = document.getElementById('note-input');
      const btn = document.getElementById('btn-add-note');
      const content = input.value.trim();
      if (!content || !kanban.editingId || btn.disabled) return;
      btn.disabled = true;
      try {
        const note = await insertNote(kanban.editingId, content);
        kanban.currentNotes.unshift(note);
        input.value = '';
        kanban.renderNotes();
        toast('Note saved', 'ok');
      } catch (err) { toast(err.message, 'err'); }
      finally { btn.disabled = false; }
    };

    document.getElementById('note-input').addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.ctrlKey) {
        e.preventDefault();
        document.getElementById('btn-add-note').click();
      }
    });

    document.getElementById('btn-delete-app').onclick = async () => {
      if (!kanban.editingId || !confirm('Delete this application and its notes?')) return;
      try {
        await deleteApplication(kanban.editingId);
        closeAllModals();
        await kanban.load();
        toast('Application deleted');
      } catch (err) { toast(err.message, 'err'); }
    };
  }
};

function val(id) { return document.getElementById(id).value.trim(); }
function setVal(id, v, fallback) {
  document.getElementById(id).value = v ?? fallback ?? '';
}
function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

// --- Save from anywhere (capture) helpers ---
// Title/URL guessing lives in js/logic.js; this just builds the bookmarklet.

function buildBookmarklet() {
  const appUrl = location.origin + location.pathname;
  return `javascript:(function(){window.open('${appUrl}?add='+encodeURIComponent(location.href)+'&t='+encodeURIComponent(document.title),'_blank');})();`;
}
