const kanban = {
  apps: [],
  editingId: null,
  currentNotes: [],

  async load() {
    kanban.apps = await fetchApplications();
    kanban.render();
    reminders.render(kanban.apps);
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

    for (const status of STATUSES) {
      const colApps = list.filter(a => a.status === status);
      const col = document.createElement('div');
      col.className = 'col';
      col.dataset.status = status;

      const head = document.createElement('div');
      head.className = 'col-head';
      head.innerHTML = `
        <span class="stat-dot" style="background:${STATUS_COLORS[status]}"></span>
        <span class="col-title">${STATUS_LABELS[status]}</span>
        <span class="col-count">${colApps.length}</span>`;
      col.appendChild(head);

      const body = document.createElement('div');
      body.className = 'col-body';

      if (!colApps.length) {
        body.innerHTML = '<div class="col-empty">Drop here</div>';
      }
      for (const app of colApps) body.appendChild(kanban.card(app));

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
        const app = kanban.apps.find(a => a.id === id);
        if (!app || app.status === status) return;
        const prevStatus = STATUS_LABELS[app.status];
        const newStatus = STATUS_LABELS[status];
        try {
          const fields = { status };
          if (status === 'applied' && !app.applied_at) fields.applied_at = new Date().toISOString();
          const updated = await updateApplication(id, fields);
          Object.assign(app, updated);
          kanban.render();
          reminders.render(kanban.apps);
          toast(`"${app.company}" moved ${prevStatus} → ${newStatus}`, 'ok');
        } catch (err) { toast(err.message, 'err'); }
      });

      board.appendChild(col);
    }

    document.getElementById('board-empty').classList.toggle(
      'hidden', !(list.length === 0));
  },

  card(app) {
    const el = document.createElement('article');
    el.className = `card pr-${app.priority}`;
    el.draggable = true;
    el.dataset.id = app.id;

    const pills = [];
    const dl = reminders.deadlineState(app);
    if (dl) {
      if (dl.days < 0) pills.push(`<span class="pill overdue">⚠ ${-dl.days}d overdue</span>`);
      else if (dl.days === 0) pills.push('<span class="pill overdue">Due today</span>');
      else if (dl.days <= 7) pills.push(`<span class="pill due-soon">⏰ in ${dl.days}d</span>`);
      else pills.push(`<span class="pill">📅 ${new Date(app.deadline + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}</span>`);
    }
    if (app.ojt_hours) pills.push(`<span class="pill">${app.ojt_hours}h OJT</span>`);

    el.innerHTML = `
      <div class="card-company"></div>
      <div class="card-position"></div>
      <div class="card-meta">${pills.join('')}</div>`;
    el.querySelector('.card-company').textContent = app.company;
    el.querySelector('.card-position').textContent = app.position;

    el.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', app.id);
      e.dataTransfer.effectAllowed = 'move';
      el.classList.add('dragging');
    });
    el.addEventListener('dragend', () => el.classList.remove('dragging'));
    el.onclick = () => kanban.openModal(app);

    return el;
  },

  openModal(app) {
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
        <button class="note-del" title="Delete note" type="button">✕</button>`;
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

    document.getElementById('form-application').onsubmit = async e => {
      e.preventDefault();
      const jobUrl = sanitizeUrl(val('f-url'));
      if (val('f-url') && !jobUrl) { toast('Job post URL must start with https:// or http://', 'err'); return; }
      const fields = {
        company: val('f-company'),
        position: val('f-position') || 'OJT Intern',
        hr_email: val('f-email') || null,
        source_url: jobUrl,
        status: val('f-status'),
        priority: val('f-priority'),
        deadline: val('f-deadline') || null,
        follow_up_at: val('f-followup') ? new Date(val('f-followup')).toISOString() : null,
        ojt_hours: val('f-hours') ? parseInt(val('f-hours'), 10) : null
      };
      if (fields.status === 'applied' && !kanban.editingId) {
        fields.applied_at = new Date().toISOString();
      }
      try {
        let saved;
        if (kanban.editingId) saved = await updateApplication(kanban.editingId, fields);
        else saved = await insertApplication(fields);

        const existing = kanban.apps.findIndex(a => a.id === saved.id);
        if (existing >= 0) kanban.apps[existing] = saved;
        else kanban.apps.push(saved);

        closeAllModals();
        kanban.render();
        reminders.render(kanban.apps);
        toast(kanban.editingId ? 'Application updated' : `"${saved.company}" added`, 'ok');
      } catch (err) { toast(err.message, 'err'); }
    };

    document.getElementById('btn-add-note').onclick = async () => {
      const input = document.getElementById('note-input');
      const content = input.value.trim();
      if (!content || !kanban.editingId) return;
      try {
        const note = await insertNote(kanban.editingId, content);
        kanban.currentNotes.unshift(note);
        input.value = '';
        kanban.renderNotes();
        toast('Note saved', 'ok');
      } catch (err) { toast(err.message, 'err'); }
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
