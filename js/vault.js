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

  async load() {
    vault.docs = await fetchDocuments();
    vault.render();
  },

  render() {
    const grid = document.getElementById('doc-grid');
    const list = vault.filter === 'all'
      ? vault.docs
      : vault.docs.filter(d => d.type === vault.filter);

    grid.innerHTML = '';
    document.getElementById('doc-empty').classList.toggle('hidden', list.length > 0);
    grid.classList.toggle('hidden', list.length === 0);

    for (const d of list) {
      const meta = vault.DOC_META[d.type] || vault.DOC_META.other;
      const card = document.createElement('div');
      card.className = 'doc-card';
      card.innerHTML = `
        <div class="doc-head">
          <span class="doc-icon">${meta.icon}</span>
          <span class="doc-name"></span>
          <span class="doc-type-tag dt-${d.type}">${meta.label}</span>
        </div>
        ${d.version ? `<span class="doc-version">${d.version}</span>` : ''}
        ${d.notes ? `<span class="doc-notes">${d.notes}</span>` : ''}
        <div class="doc-actions">
          <button class="btn sm primary act-copy" type="button">Copy link</button>
          <a class="btn sm" href="${d.link}" target="_blank" rel="noopener">Open</a>
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
      card.querySelector('.act-edit').onclick = () => vault.openModal(d);

      grid.appendChild(card);
    }
  },

  openModal(doc) {
    const m = document.getElementById('modal-document');
    vault.editingId = doc?.id || null;
    document.getElementById('doc-modal-title').textContent =
      doc ? 'Edit document' : 'Add document link';
    document.getElementById('btn-delete-doc').classList.toggle('hidden', !doc);
    document.getElementById('d-name').value = doc?.name || '';
    document.getElementById('d-type').value = doc?.type || 'resume';
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
      const fields = {
        name: val('d-name'),
        type: val('d-type'),
        version: val('d-version') || null,
        link: val('d-link'),
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
