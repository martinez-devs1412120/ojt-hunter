// Inline SVG icon set — 16x16, stroke-based, inherits currentColor.
// Rendered via innerHTML with static strings only (no user input).
const ICONS = {
  resume: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true">' +
    '<path d="M3.5 2.5A1.5 1.5 0 0 1 5 1h4.4L12.5 4.1V13.5A1.5 1.5 0 0 1 11 15H5a1.5 1.5 0 0 1-1.5-1.5z"/>' +
    '<path d="M9.4 1v3.1h3.1"/>' +
    '<circle cx="6.9" cy="7.2" r="1.25"/>' +
    '<path d="M5.1 11.4c.4-1.2 1-1.8 1.8-1.8s1.4.6 1.8 1.8"/></svg>',
  tor: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true">' +
    '<path d="M3.5 2.5A1.5 1.5 0 0 1 5 1h4.4L12.5 4.1V13.5A1.5 1.5 0 0 1 11 15H5a1.5 1.5 0 0 1-1.5-1.5z"/>' +
    '<path d="M9.4 1v3.1h3.1"/>' +
    '<path d="M5.8 7.2h4.4M5.8 9.7h4.4M5.8 12.2h2.6"/></svg>',
  good_moral: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true">' +
    '<path d="M3.5 2.5A1.5 1.5 0 0 1 5 1h4.4L12.5 4.1V13.5A1.5 1.5 0 0 1 11 15H5a1.5 1.5 0 0 1-1.5-1.5z"/>' +
    '<path d="M9.4 1v3.1h3.1"/>' +
    '<circle cx="8" cy="9" r="2"/>' +
    '<path d="M6.9 10.6 6.1 14l1.9-1 1.9 1-.8-3.4"/></svg>',
  nda: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true">' +
    '<path d="M9.7 2.3l4 4L6.2 13.8 2 14.5l.7-4.2z"/>' +
    '<path d="M7.9 4.1l4 4M2.7 10.3l3 3"/></svg>',
  medical: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true">' +
    '<rect x="2" y="2" width="12" height="12" rx="2.2"/>' +
    '<path d="M8 5.4v5.2M5.4 8h5.2"/></svg>',
  other: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true">' +
    '<path d="M1.5 3.5A1.5 1.5 0 0 1 3 2h3l1.5 2h5A1.5 1.5 0 0 1 14 5.5v7a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 12.5z"/></svg>',
  x: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">' +
    '<path d="M4 4l8 8M12 4l-8 8"/></svg>',
  target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.75"/>' +
    '<circle cx="12" cy="12" r="1.25" fill="currentColor" stroke="none"/></svg>'
};
