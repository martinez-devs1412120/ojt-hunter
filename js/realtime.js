// Supabase Realtime — board sync across tabs/devices
// Optimistic: local UI updates immediately; server confirms or rolls back

const realtime = {
  channel: null,
  pendingMoves: new Map(), // appId -> { fromStatus, toStatus, timestamp }

  init() {
    if (!isConfigured()) return;
    const ch = sb().channel('applications-changes', {
      config: { broadcast: { ack: true }, presence: { key: 'id' } }
    });

    ch.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'applications',
      filter: `user_id=eq.${app.currentUser}`
    }, payload => realtime.handleChange(payload));

    ch.subscribe(status => {
      if (status !== 'SUBSCRIBED') {
        console.warn('Realtime subscription failed:', status);
      }
    });

    realtime.channel = ch;

    // Cleanup on unload
    window.addEventListener('beforeunload', () => {
      if (realtime.channel) realtime.channel.unsubscribe();
    });
  },

  handleChange(payload) {
    const { eventType, new: newRow, old: oldRow } = payload;

    if (eventType === 'INSERT') {
      realtime.onInsert(newRow);
    } else if (eventType === 'UPDATE') {
      realtime.onUpdate(newRow, oldRow);
    } else if (eventType === 'DELETE') {
      realtime.onDelete(oldRow);
    }
  },

  onInsert(row) {
    // Check if we already have this (optimistic insert)
    if (kanban.apps.some(a => a.id === row.id)) return;
    kanban.apps.push(row);
    kanban.sync();
    toast(`"${row.company}" added on another device`, 'ok');
  },

  onUpdate(newRow, oldRow) {
    const idx = kanban.apps.findIndex(a => a.id === newRow.id);
    if (idx === -1) {
      // We don't have it — treat as insert
      kanban.apps.push(newRow);
      kanban.sync();
      return;
    }

    const pending = realtime.pendingMoves.get(newRow.id);
    const isOurMove = pending && pending.toStatus === newRow.status;

    if (isOurMove) {
      // Our optimistic update confirmed — clear pending
      realtime.pendingMoves.delete(newRow.id);
      // Server version is authoritative (has timestamps)
      kanban.apps[idx] = newRow;
      kanban.sync();
    } else {
      // Someone else moved it — apply server state
      const oldStatus = STATUS_LABELS[kanban.apps[idx].status] || kanban.apps[idx].status;
      const newStatus = STATUS_LABELS[newRow.status] || newRow.status;
      kanban.apps[idx] = newRow;
      kanban.sync();
      toast(`"${newRow.company}" moved ${oldStatus} → ${newStatus} on another device`, 'ok');
    }
  },

  onDelete(row) {
    kanban.apps = kanban.apps.filter(a => a.id !== row.id);
    kanban.sync();
    toast(`"${row.company}" deleted on another device`, 'ok');
  },

  // Called by kanban when user drags a card (optimistic)
  recordMove(appId, fromStatus, toStatus) {
    realtime.pendingMoves.set(appId, { fromStatus, toStatus, timestamp: Date.now() });
    // Auto-cleanup pending moves after 10s (server should have confirmed)
    setTimeout(() => {
      if (realtime.pendingMoves.has(appId)) {
        realtime.pendingMoves.delete(appId);
      }
    }, 10000);
  }
};