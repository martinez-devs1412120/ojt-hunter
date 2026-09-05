const reminders = {
  DAY_MS: 86400000,
  notified: new Set(),

  deadlineState(app) {
    if (!app.deadline || ['offer', 'rejected'].includes(app.status)) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const due = new Date(app.deadline + 'T00:00:00');
    const days = Math.round((due - today) / reminders.DAY_MS);
    return { days, date: app.deadline };
  },

  followUpState(app) {
    if (!app.follow_up_at) return null;
    const when = new Date(app.follow_up_at);
    const now = new Date();
    const days = Math.floor((when - now) / reminders.DAY_MS);
    return { days, date: when };
  },

  allAlerts(apps) {
    const out = [];
    for (const a of apps) {
      const dl = reminders.deadlineState(a);
      if (dl && dl.days < 0) out.push({ type: 'overdue', app: a, ...dl });
      else if (dl && dl.days <= 7) out.push({ type: 'due_soon', app: a, ...dl });
      const fu = reminders.followUpState(a);
      if (fu && fu.days <= 1) out.push({ type: 'followup', app: a, ...fu });
    }
    return out.sort((x, y) => new Date(x.date) - new Date(y.date));
  },

  render(apps) {
    const alerts = reminders.allAlerts(apps);
    const badge = document.getElementById('deadline-badge');
    badge.classList.toggle('hidden', alerts.length === 0);
    badge.textContent = alerts.length;
    setNum('dl-count', alerts.length);
    reminders.chart(apps);

    const wrap = document.getElementById('deadlines-wrap');
    const groups = {
      overdue: { title: 'Overdue — act now', rows: [] },
      week: { title: 'Due within 7 days', rows: [] },
      followup: { title: 'Follow-up reminders', rows: [] },
      upcoming: { title: 'Later', rows: [] }
    };

    for (const a of apps) {
      const dl = reminders.deadlineState(a);
      if (dl) {
        if (dl.days < 0) groups.overdue.rows.push(reminders.row(a, dl, 'deadline'));
        else if (dl.days <= 7) groups.week.rows.push(reminders.row(a, dl, 'deadline'));
        else groups.upcoming.rows.push(reminders.row(a, dl, 'deadline'));
      }
      const fu = reminders.followUpState(a);
      if (fu && fu.days <= 14) groups.followup.rows.push(reminders.row(a, fu, 'followup'));
    }

    wrap.innerHTML = '';
    let any = false;
    for (const [key, g] of Object.entries(groups)) {
      if (!g.rows.length) continue;
      any = true;
      const sec = document.createElement('div');
      sec.className = `dl-group g-${key}`;
      sec.innerHTML = `<h3>${g.title}</h3>`;
      g.rows.forEach(r => sec.appendChild(r.el));
      wrap.appendChild(sec);
    }
    document.getElementById('deadlines-empty').classList.toggle('hidden', any);
    wrap.classList.toggle('hidden', !any);
  },

  chart(apps) {
    const holder = document.getElementById('dl-chart');
    if (!holder) return;
    holder.innerHTML = '';
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const days = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(today); d.setDate(d.getDate() + i);
      days.push(d);
    }
    // Local date string — toISOString() would shift a day in UTC+ timezones
    const pad = n => String(n).padStart(2, '0');
    const localISO = d =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const counts = days.map(d => apps.filter(a => a.deadline === localISO(d)).length);
    const max = Math.max(1, ...counts);
    const letters = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    days.forEach((d, i) => {
      const col = document.createElement('div');
      col.className = 'dl-bar-col';
      const bar = document.createElement('span');
      bar.className = 'dl-bar' + (counts[i] > 0 ? ' has' : '') + (i === 0 ? ' today' : '');
      bar.style.height = (10 + (counts[i] / max) * 70) + 'px';
      const label = document.createElement('span');
      label.className = 'dl-day';
      label.textContent = letters[d.getDay()];
      col.title = d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) +
        (counts[i] ? ` — ${counts[i]} due` : ' — nothing due');
      col.appendChild(bar);
      col.appendChild(label);
      holder.appendChild(col);
    });
  },

  row(row, state, kind) {
    const el = document.createElement('div');
    el.className = 'dl-row';
    const d = kind === 'followup' ? new Date(state.date) : new Date(state.date + 'T00:00:00');
    const dateStr = d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
    const label = kind === 'followup'
      ? 'Follow up with HR'
      : (state.days === 0 ? 'Due TODAY' :
         state.days < 0 ? `${Math.abs(state.days)} day${-state.days > 1 ? 's' : ''} overdue` :
         `in ${state.days} day${state.days > 1 ? 's' : ''}`);
    el.innerHTML = `
      <span class="dl-date">${dateStr}</span>
      <span class="dl-main">
        <span class="dl-company"></span>
        <span class="dl-sub">${label} · ${STATUS_LABELS[row.status]}</span>
      </span>
      <span class="dl-status st-${row.status}">${STATUS_LABELS[row.status]}</span>`;
    el.querySelector('.dl-company').textContent = `${row.company} — ${row.position}`;
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        kanban.openModal(row);
      }
    });
    el.onclick = () => kanban.openModal(row);
    return { el };
  },

  notifyDaily(apps) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const key = new Date().toDateString();
    for (const alert of reminders.allAlerts(apps)) {
      const id = `${alert.app.id}:${alert.type}`;
      if (reminders.notified.has(id)) continue;
      const urgent = alert.type === 'overdue' ||
        (alert.type === 'due_soon' && alert.days <= 1);
      if (!urgent) continue;
      reminders.notified.add(id);
      try {
        new Notification('OJT Hunter', {
          body: `${alert.app.company}: ${alert.type === 'followup'
            ? 'time to send your follow-up email!'
            : `application deadline ${alert.days < 0 ? 'passed ' + (-alert.days) + 'd ago' : 'is today'}!`}`
        });
      } catch {}
    }
  },

  init() {
    if ('Notification' in window && Notification.permission === 'default') {
      document.addEventListener('click', function askOnce() {
        Notification.requestPermission();
        document.removeEventListener('click', askOnce);
      }, { once: true });
    }
  }
};
