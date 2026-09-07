const vault = {
  docs: [],
  filter: 'all',
  editingId: null,

  DOC_META: {
    resume:     { label: 'Resume' },
    tor:        { label: 'TOR' },
    good_moral: { label: 'Good Moral' },
    nda:        { label: 'NDA' },
    medical:    { label: 'Medical' },
    other:      { label: 'Other' }
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
      const safeLink = d.storage_path ? null : sanitizeUrl(d.link);
      const openable = !!safeLink || !!d.storage_path;
      const card = document.createElement('div');
      card.className = 'doc-card';
      card.innerHTML = `
        <div class="doc-head">
          <span class="doc-icon"></span>
          <span class="doc-name"></span>
          <span class="doc-type-tag dt-${d.type}">${meta.label}</span>
        </div>
        ${d.storage_path ? '<span class="doc-stored">stored privately — links expire after 1 hour</span>' : ''}
        ${d.version ? '<span class="doc-version"></span>' : ''}
        ${d.notes ? '<span class="doc-notes"></span>' : ''}
        <div class="doc-actions">
          <button class="btn sm primary act-copy" type="button">Copy link</button>
          ${openable ? '<button class="btn sm act-open" type="button">Open</button>' : '<span class="pill overdue">invalid link</span>'}
          <button class="btn sm ghost act-edit" type="button">Edit</button>
        </div>`;
      card.querySelector('.doc-icon').innerHTML = ICONS[d.type] || ICONS.other;
      card.querySelector('.doc-name').textContent = d.name;
      if (d.version) card.querySelector('.doc-version').textContent = d.version;
      if (d.notes) card.querySelector('.doc-notes').textContent = d.notes;

      card.querySelector('.act-copy').onclick = async () => {
        try {
          // Copy = attachment URL so HR's email recipient gets a real download
          const url = d.storage_path
            ? await createSignedUrl(d.storage_path, 3600, 'attachment')
            : d.link;
          await navigator.clipboard.writeText(url);
          toast(d.storage_path ? 'Private link copied — expires in 1 hour' : 'Link copied — paste it into your email!', 'ok');
        } catch { toast('Copy failed', 'err'); }
      };
      const openBtn = card.querySelector('.act-open');
      if (openBtn) {
        openBtn.onclick = async () => {
          try {
            // Open = inline URL so the browser previews PDFs/images in-place
            const url = d.storage_path
              ? await createSignedUrl(d.storage_path, 3600, 'inline')
              : safeLink;
            window.open(url, '_blank', 'noopener,noreferrer');
          } catch (err) { toast(err.message, 'err'); }
        };
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
      const have = vault.docs.some(d =>
        d.type === type && (d.storage_path || sanitizeUrl(d.link)));
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
      row.tabIndex = 0;
      row.setAttribute('role', 'button');
      row.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          vault.openModal(null, type);
        }
      });
      row.onclick = () => vault.openModal(null, type);
      holder.appendChild(row);
    }
  },

  openModal(doc, presetType) {
    const m = document.getElementById('modal-document');
    vault.editingId = doc?.id || null;
    document.getElementById('doc-modal-title').textContent =
      doc ? 'Edit document' : 'Add document';
    document.getElementById('btn-delete-doc').classList.toggle('hidden', !doc);
    document.getElementById('d-name').value = doc?.name || '';
    document.getElementById('d-type').value = doc?.type || presetType || 'resume';
    document.getElementById('d-version').value = doc?.version || '';
    document.getElementById('d-notes').value = doc?.notes || '';
    const fileInput = document.getElementById('d-file');
    fileInput.value = null;
    const linkInput = document.getElementById('d-link');
    linkInput.value = '';
    linkInput.placeholder = doc?.storage_path
      ? 'Private file stored — upload a new file to replace it'
      : 'https://drive.google.com/…';
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
      const btn = e.target.querySelector('button[type="submit"]');
      if (btn.disabled) return;
      btn.disabled = true;
      const fileInput = document.getElementById('d-file');
      const file = fileInput.files[0];
      const prev = vault.editingId ? vault.docs.find(d => d.id === vault.editingId) : null;
      let uploadedPath = null;
      let replacedPath = null;
      try {
        const fields = {
          name: val('d-name'),
          type: val('d-type'),
          version: val('d-version') || null,
          notes: val('d-notes') || null
        };
        if (file) {
          const invalid = validateVaultFile(file);
          if (invalid) { toast(invalid, 'err'); return; }
          uploadedPath = await uploadVaultFile(file);
          fields.storage_path = uploadedPath;
          fields.link = null;
          replacedPath = prev?.storage_path || null;
        } else if (prev?.storage_path) {
          // Editing an uploaded doc without replacing the file
          fields.storage_path = prev.storage_path;
          fields.link = null;
        } else {
          const safeLink = sanitizeUrl(val('d-link'));
          if (!safeLink) { toast('Add a link or choose a file to upload', 'err'); return; }
          fields.link = safeLink;
          fields.storage_path = null;
        }
        let saved = false;
        try {
          if (vault.editingId) await updateDocument(vault.editingId, fields);
          else await insertDocument(fields);
          saved = true;
          closeAllModals();
          await vault.load();
          toast(vault.editingId ? 'Document updated' : 'Document added to vault', 'ok');
        } catch (err) { toast(err.message, 'err'); }
        // Clean up orphaned uploads: the replaced file on success, the new
        // upload if the row failed to save
        if (uploadedPath && !saved) { try { await deleteStorageObject(uploadedPath); } catch {} }
        if (replacedPath && saved) { try { await deleteStorageObject(replacedPath); } catch {} }
      } finally {
        btn.disabled = false;
      }
    };

    document.getElementById('btn-delete-doc').onclick = async () => {
      if (!vault.editingId || !confirm('Delete this document from the vault?')) return;
      const btn = document.getElementById('btn-delete-doc');
      if (btn.disabled) return;
      btn.disabled = true;
      const doc = vault.docs.find(d => d.id === vault.editingId);
      try {
        await deleteDocument(vault.editingId);
        closeAllModals();
        await vault.load();
        toast('Document deleted');
        if (doc?.storage_path) {
          try { await deleteStorageObject(doc.storage_path); } catch {}
        }
      } catch (err) { toast(err.message, 'err'); }
      finally { btn.disabled = false; }
    };
  }
};
