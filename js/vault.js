const vault = {
  docs: [],
  filter: 'all',
  editingId: null,

  DOC_META: {
    resume:     { label: 'Resume',    icon: '📄' },
    tor:        { label: 'TOR',       icon: '🎓' },
    good_moral: { label: 'Good Moral', icon: '🤝' },
    nda:        { label: 'NDA',       icon: '✍️' },
    medical:    { label: 'Medical',   icon: '🩺' },
    other:      { label: 'Other',     icon: '📁' }
  },

  REQUIRED: ['resume', 'tor', 'good_moral', 'nda', 'medical'],

  async load() {
    vault.docs = await fetchDocuments();
    vault.render();
  },

  render() {
    const grid = document.getElementById('doc-grid');
    const list = vault.filter === 'all'
      ? vault.docs
      : vault.docs.filter(d => d.type === vault.filter);

    setNum('vault-count', vault.docs.length);
    vault.renderCoverage();
    grid.innerHTML = '';
    document.getElementById('doc-empty').classList.toggle('hidden', list.length > 0);
    grid.classList.toggle('hidden', list.length === 0);

    for (const d of list) {
      const meta = vault.DOC_META[d.type] || vault.DOC_META.other;
      const safeLink = sanitizeUrl(d.link);
      const card = document.createElement('div');
      card.className = 'doc-card';
      card.innerHTML = `
        <div class="doc-head">
          <span class="doc-icon">${meta.icon}</span>
          <span class="doc-name"></span>
          <span class="doc-type-tag dt-${d.type}">${meta.label}</span>
        </div>
        ${d.version ? '<span class="doc-version"></span>' : ''}
        ${d.notes ? '<span class="doc-notes"></span>' : ''}
        <div class="doc-actions">
          <button class="btn sm primary act-copy" type="button">Copy link</button>
          ${safeLink ? '<a class="btn sm" target="_blank" rel="noopener noreferrer">Open</a>' : '<span class="pill overdue">invalid link</span>'}
          <button class="btn sm ghost act-edit" type="button">Edit</button>
        </div>`;
      card.querySelector('.doc-name').textContent = d.name;
      if (d.version) card.querySelector('.doc-version').textContent = d.version;
      if (d.notes) card.querySelector('.doc-notes').textContent = d.notes;

      card.querySelector('.act-copy').onclick = () => {
        navigator.clipboard.writeText(d.link)
          .then(() => toast('Link copied — paste it into your email!', 'ok'))
          .catch(() => toast('Copy failed', 'err'));
      };
      if (safeLink) {
        const open = card.querySelector('.doc-actions a');
        open.href = safeLink;
      }
      card.querySelector('.act-edit').onclick = () => vault.openModal(d);

      grid.appendChild(card);
    }
  },

  renderCoverage() {
    const holder = document.getElementById('doc-coverage');
    if (!holder) return;
    holder.innerHTML = '';
    for (const type of vault.REQUIRED) {
      const meta = vault.DOC_META[type];
      const have = vault.docs.some(d => d.type === type && sanitizeUrl(d.link));
      const row = document.createElement('div');
      row.className = 'cov-row ' + (have ? 'have' : 'miss');
      row.innerHTML = `
        <span class="cov-label">${meta.label}</span>
        <span class="cov-track"><span class="cov-fill"></span></span>
        <span class="cov-state"></span>`;
      row.querySelector('.cov-fill').style.width = have ? '100%' : '8%';
      row.querySelector('.cov-state').textContent = have ? 'Ready' : 'Missing';
      row.title = have
        ? `${meta.label} is in your vault — click to add another version`
        : `No ${meta.label} yet — click to add it`;
      row.onclick = () => vault.openModal(null, type);
      holder.appendChild(row);
    }
  },

  openModal(doc, presetType) {
    const m = document.getElementById('modal-document');
    vault.editingId = doc?.id || null;
    document.getElementById('doc-modal-title').textContent =
      doc ? 'Edit document' : 'Add document link';
    document.getElementById('btn-delete-doc').classList.toggle('hidden', !doc);
    document.getElementById('d-name').value = doc?.name || '';
    document.getElementById('d-type').value = doc?.type || presetType || 'resume';
    document.getElementById('d-version').value = doc?.version || '';
    document.getElementById('d-link').value = doc?.link || '';
    document.getElementById('d-notes').value = doc?.notes || '';
    m.showModal();
  },

  init() {
    document.getElementById('btn-add-doc').onclick = () => vault.openModal(null);

    document.querySelectorAll('#doc-filters .chip').forEach(chip => {
      chip.onclick = () => {
        document.querySelectorAll('#doc-filters .chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        vault.filter = chip.dataset.filter;
        vault.render();
      };
    });

    document.getElementById('form-document').onsubmit = async e => {
      e.preventDefault();
      const safeLink = sanitizeUrl(val('d-link'));
      if (!safeLink) { toast('Link must start with https:// or http://', 'err'); return; }
      const fields = {
        name: val('d-name'),
        type: val('d-type'),
        version: val('d-version') || null,
        link: safeLink,
        notes: val('d-notes') || null
      };
      try {
        if (vault.editingId) await updateDocument(vault.editingId, fields);
        else await insertDocument(fields);
        closeAllModals();
        await vault.load();
        toast(vault.editingId ? 'Document updated' : 'Document added to vault', 'ok');
      } catch (err) { toast(err.message, 'err'); }
    };

    document.getElementById('btn-delete-doc').onclick = async () => {
      if (!vault.editingId || !confirm('Delete this document from the vault?')) return;
      try {
        await deleteDocument(vault.editingId);
        closeAllModals();
        await vault.load();
        toast('Document deleted');
      } catch (err) { toast(err.message, 'err'); }
    };
  }
};
