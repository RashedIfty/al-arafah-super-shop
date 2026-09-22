/**
 * Inline SVG icon set.
 *
 * Replaces emoji throughout the interface: emoji render differently on
 * every platform, cannot be styled, and are read aloud awkwardly by
 * screen readers. These inherit currentColor and scale with font size.
 */

const PATHS = {
  search:   'M11 3a8 8 0 1 0 4.9 14.32l4.39 4.39 1.42-1.42-4.39-4.39A8 8 0 0 0 11 3m0 2a6 6 0 1 1 0 12 6 6 0 0 1 0-12',
  phone:    'M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.24 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11.4 11.4 0 0 0 .57 3.6 1 1 0 0 1-.25 1z',
  pin:      'M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7m0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5',
  clock:    'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20m0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16m.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z',
  lock:     'M18 8h-1V6a5 5 0 0 0-10 0v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2M9 6a3 3 0 0 1 6 0v2H9zm3 12a2 2 0 1 1 0-4 2 2 0 0 1 0 4',
  user:     'M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10m0 2c-3.34 0-10 1.67-10 5v3h20v-3c0-3.33-6.66-5-10-5',
  cart:     'M7 18a2 2 0 1 0 0 4 2 2 0 0 0 0-4m10 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4M7.16 14h9.45a2 2 0 0 0 1.9-1.37l2.4-7.26A1 1 0 0 0 20 4H6.21l-.94-2H2v2h2l3.6 7.59-1.35 2.44A2 2 0 0 0 8 17h12v-2H8.42a.25.25 0 0 1-.22-.37z',
  check:    'M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z',
  plus:     'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z',
  close:    'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
  edit:     'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75z',
  archive:  'M20 2H4a2 2 0 0 0-2 2v3h20V4a2 2 0 0 0-2-2M3 9v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9zm11 5H10v-2h4z',
  trash:    'M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6zM19 4h-3.5l-1-1h-5l-1 1H5v2h14z',
  restore:  'M13 3a9 9 0 0 0-9 9H1l4 4 4-4H6a7 7 0 1 1 7 7 6.9 6.9 0 0 1-4.9-2L6.7 18.4A9 9 0 1 0 13 3',
  up:       'M7.4 15.4 12 10.8l4.6 4.6L18 14l-6-6-6 6z',
  down:     'M7.4 8.6 12 13.2l4.6-4.6L18 10l-6 6-6-6z',
  arrow:    'M12 4l-1.4 1.4L16.2 11H4v2h12.2l-5.6 5.6L12 20l8-8z',
  camera:   'M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4M9 2 7.17 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3.17L15 2zm3 15a5 5 0 1 1 0-10 5 5 0 0 1 0 10',
  star:     'm12 17.27 6.18 3.73-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z',
  fire:     'M13.5 1s.5 2.5-1.5 4.5-3 3.5-3 6a4.5 4.5 0 0 0 9 0c0-2-1-3.5-2-4.5 0 1-1 2-2 2 1-2 .5-6-.5-8M8 13a3 3 0 0 0 6 0c0 3-6 3-6 0',
  box:      'M20 6h-3V4a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v2H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2M9 4h6v2H9z',
  warn:     'M1 21h22L12 2zm12-3h-2v-2h2zm0-4h-2v-4h2z',
  send:     'M2.01 21 23 12 2.01 3 2 10l15 2-15 2z',
  eye:      'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5m0 12a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9m0-7.2a2.7 2.7 0 1 0 0 5.4 2.7 2.7 0 0 0 0-5.4',
  cash:     'M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2m0 12H4v-2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2zm0-6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2V8h16zM12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6',
  grid:     'M3 3h8v8H3zm10 0h8v8h-8zM3 13h8v8H3zm10 0h8v8h-8z',
  bulb:     'M9 21a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-1H9zm3-19A7 7 0 0 0 5 9c0 2.38 1.19 4.47 3 5.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7'
};

/**
 * Inline SVG markup for `name`.
 * Decorative by default; pass a label when the icon carries meaning.
 */
export function icon(name, { size = 20, label = "", cls = "" } = {}){
  const d = PATHS[name];
  if (!d) return "";

  const a11y = label
    ? `role="img" aria-label="${label}"`
    : 'aria-hidden="true" focusable="false"';

  return `<svg class="icon${cls ? " " + cls : ""}" width="${size}" height="${size}" ` +
         `viewBox="0 0 24 24" fill="currentColor" ${a11y}><path d="${d}"/></svg>`;
}
