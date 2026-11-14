/* ============================================================================
   Clinic Access Threshold Explorer
   ----------------------------------------------------------------------------
   WHAT THIS MAP DOES
   A 0.5 km population grid is assigned to its nearest clinic using Turf's
   great-circle distance. A slider sets the maximum acceptable distance; cells
   beyond it are reclassified as "beyond threshold" and the served-population
   total is recomputed live. Clinics can be added (click empty map) or removed
   (click a clinic), and every change re-runs the assignment.

   WHY: a single static map fixes the threshold and hides the fact that
   "access" is a decision. Recomputing nearest-clinic assignment and coverage
   on every slider move exposes threshold effects and catchment shifts.

   PROVENANCE -- see README.md for the full discussion
   - MapLibre map initialization adapted from the MapLibre GL JS docs,
     "Display a map" example: https://maplibre.org/maplibre-gl-js/docs/examples/
   - Basemap style: CARTO Positron GL (keyless style JSON), chosen for its muted
     palette so the thematic layers hold figure-ground contrast:
     https://github.com/CartoDB/basemap-styles
   - Turf distance: https://turfjs.org/docs/api/distance
   - Turf polygon constructor used to build grid cells:
     https://turfjs.org/docs/api/polygon
   - The "a control recomputes map state" interaction pattern is adapted from
     MapLibre's "Create a time slider" example, but here the control drives a
     spatial re-analysis (setData) rather than a simple setFilter.
   - Data: SYNTHETIC. Population grid generated from four Gaussian density
     centers; clinic locations hand-placed. Written for this lab. No real
     patients, facilities, or populations are represented.
   - Generative AI: used to help author explain logic of the features in author's 
     mother language. Documented as required by syllabus.
   ========================================================================== */

/* ---------------------------------------------------------------------------
   1. Study area and grid definition
   --------------------------------------------------------------------------- */

const START_CENTER = [-122.335, 47.605];   // Seattle-ish; any city works
const START_ZOOM   = 12.2;

const CELL_KM = 0.5;    // grid cell edge length in km
const COLS    = 26;     // ~13 km east-west
const ROWS    = 20;     // ~10 km north-south

// Degree-per-km conversion at this latitude (keeps cells roughly square)
const KM_PER_DEG_LAT = 110.574;
const KM_PER_DEG_LON = 111.320 * Math.cos(START_CENTER[1] * Math.PI / 180);

/* Four Gaussian "density centers" so the population surface is lumpy and
   uneven, which is what makes catchment shifts interesting to watch. */
const TOWNS = [
  { lon: -122.352, lat: 47.615, amp: 2600, sig: 1.5 },
  { lon: -122.315, lat: 47.598, amp: 3100, sig: 1.8 },
  { lon: -122.352, lat: 47.585, amp: 1500, sig: 1.2 },
  { lon: -122.305, lat: 47.622, amp:  900, sig: 1.0 }
];

/* Starting clinic network. Deliberately clustered and lopsided so that the
   initial map is NOT fully covered -- the user has something to fix. */
const INITIAL_FACILITIES = [
  { name: 'Clinic A', lon: -122.348, lat: 47.612 },
  { name: 'Clinic B', lon: -122.318, lat: 47.600 },
  { name: 'Clinic C', lon: -122.335, lat: 47.588 }
];

/* ---------------------------------------------------------------------------
   2. Mutable state
   --------------------------------------------------------------------------- */

let facilities      = INITIAL_FACILITIES.map(f => ({ ...f }));
let GRID            = [];    // built once on load
let facilityCounter = 0;     // names clinics the user adds

/* ---------------------------------------------------------------------------
   3. Build the population grid (runs once)
   Each cell stores: pop (people), cx/cy (centroid, used for distance calcs)
   --------------------------------------------------------------------------- */

function buildGrid() {
  const stepLon = CELL_KM / KM_PER_DEG_LON;
  const stepLat = CELL_KM / KM_PER_DEG_LAT;
  const lon0    = START_CENTER[0] - (COLS * stepLon) / 2;
  const lat0    = START_CENTER[1] - (ROWS * stepLat) / 2;

  const feats = [];

  // Nested loops build one square polygon per cell
  for (let i = 0; i < COLS; i++) {
    for (let j = 0; j < ROWS; j++) {
      const x0 = lon0 + i * stepLon, y0 = lat0 + j * stepLat;
      const x1 = x0 + stepLon,       y1 = y0 + stepLat;
      const cx = (x0 + x1) / 2,      cy = (y0 + y1) / 2;

      // Sum the Gaussian bumps to get this cell's population
      let pop = 0;
      for (const t of TOWNS) {
        const d = turf.distance([cx, cy], [t.lon, t.lat], { units: 'kilometers' });
        pop += t.amp * Math.exp(-(d * d) / (2 * t.sig * t.sig));
      }
      pop = Math.round(pop);

      feats.push(
        turf.polygon(
          [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]],
          { pop: pop, cx: cx, cy: cy }
        )
      );
    }
  }
  return feats;
}

/* ---------------------------------------------------------------------------
   4. Map initialization
   --------------------------------------------------------------------------- */

const map = new maplibregl.Map({
  container: 'map',
  // CARTO Positron: light, low-saturation basemap -> thematic layers pop
  style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  center: START_CENTER,
  zoom: START_ZOOM
});

map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

/* Convert the facilities array into a GeoJSON FeatureCollection */
function facilityFC() {
  return {
    type: 'FeatureCollection',
    features: facilities.map((f, i) => ({
      type: 'Feature',
      properties: { name: f.name, idx: i },
      geometry: { type: 'Point', coordinates: [f.lon, f.lat] }
    }))
  };
}

/* ---------------------------------------------------------------------------
   5. THE CORE: recompute nearest clinic + coverage for the current threshold
   Called on slider input, on click (add/remove), and on reset.
   --------------------------------------------------------------------------- */

function update() {
  // Guard: don't run before the style has loaded and sources exist
  const gridSource = map.getSource('grid');
  if (!gridSource) return;

  const threshold = parseFloat(document.getElementById('threshold').value);
  document.getElementById('thVal').textContent = threshold.toFixed(1);

  let totalPop = 0, servedPop = 0;

  const features = GRID.map(f => {
    const p = f.properties;

    // Find nearest clinic by great-circle distance
    let best = Infinity, bestName = 'no clinic';
    for (const fac of facilities) {
      const d = turf.distance([p.cx, p.cy], [fac.lon, fac.lat], { units: 'kilometers' });
      if (d < best) { best = d; bestName = fac.name; }
    }

    const served = best <= threshold;
    totalPop += p.pop;
    if (served) servedPop += p.pop;

    // served stored as 1/0 so the paint expression can compare with == 1
    return {
      type: 'Feature',
      geometry: f.geometry,
      properties: Object.assign({}, p, {
        dist:   isFinite(best) ? best : null,
        nearest: bestName,
        served: served ? 1 : 0
      })
    };
  });

  // Re-render both layers. This is what makes the map respond live.
  gridSource.setData({ type: 'FeatureCollection', features: features });
  map.getSource('facilities').setData(facilityFC());

  // Live readout
  document.getElementById('servedPct').textContent =
    Math.round(100 * servedPop / Math.max(totalPop, 1)) + '%';
  document.getElementById('unservedPop').textContent =
    Math.round(totalPop - servedPop).toLocaleString();
  document.getElementById('facCount').textContent = facilities.length;
}

/* ---------------------------------------------------------------------------
   6. Add layers once the style is ready
   --------------------------------------------------------------------------- */

map.on('load', () => {
  GRID = buildGrid();

  // --- Population grid ---
  map.addSource('grid', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: GRID }
  });

  map.addLayer({
    id: 'grid-fill',
    type: 'fill',
    source: 'grid',
    paint: {
      // Binary classification is deliberate: the threshold is a policy
      // decision (in/out), not a smooth gradient. See README reflection.
      'fill-color': [
        'case',
        ['==', ['get', 'served'], 1], '#2b8cbe',   // within threshold
        '#d7301f'                                   // beyond threshold
      ],
      'fill-opacity': 0.72,
      'fill-outline-color': 'rgba(255,255,255,0.35)'
    }
  });

  // --- Clinics ---
  map.addSource('facilities', { type: 'geojson', data: facilityFC() });

  map.addLayer({
    id: 'facilities',
    type: 'circle',
    source: 'facilities',
    paint: {
      // Radius grows with zoom so clinics stay legible at all scales
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 4, 14, 8],
      'circle-color': '#ffffff',
      'circle-stroke-color': '#08306b',
      'circle-stroke-width': 2
    }
  });

  update();
});

/* ---------------------------------------------------------------------------
   7. Interaction: click to add or remove a clinic
   One handler handles both cases so a facility click never also adds a point.
   --------------------------------------------------------------------------- */

map.on('click', (e) => {
  const hits = map.queryRenderedFeatures(e.point, { layers: ['facilities'] });

  if (hits.length) {
    // --- Remove the clicked clinic ---
    const idx = hits[0].properties.idx;
    const removed = facilities.splice(idx, 1)[0];
    update();
    new maplibregl.Popup()
      .setLngLat(e.lngLat)
      .setHTML('Removed <strong>' + removed.name + '</strong>')
      .addTo(map);
  } else {
    // --- Add a candidate clinic at the clicked location ---
    facilityCounter += 1;
    const name = 'Added clinic ' + facilityCounter;
    facilities.push({ name: name, lon: e.lngLat.lng, lat: e.lngLat.lat });
    update();
    new maplibregl.Popup()
      .setLngLat(e.lngLat)
      .setHTML('Added <strong>' + name + '</strong>')
      .addTo(map);
  }
});

/* Cursor affordance: signals that clinics are clickable */
map.on('mouseenter', 'facilities', () => { map.getCanvas().style.cursor = 'pointer'; });
map.on('mouseleave', 'facilities', () => { map.getCanvas().style.cursor = ''; });

/* ---------------------------------------------------------------------------
   8. Hover tooltip: cell-level detail on demand
   The tooltip answers "who lives here and how far is their clinic?"
   without cluttering the map with permanent labels.
   --------------------------------------------------------------------------- */

const tip = document.getElementById('tip');

map.on('mousemove', 'grid-fill', (e) => {
  if (!e.features.length) return;
  const p = e.features[0].properties;

  const distTxt = (p.dist === null || p.dist === undefined)
    ? 'no clinic'
    : (+p.dist).toFixed(2) + ' km';

  tip.style.display = 'block';
  tip.style.left = (e.originalEvent.clientX + 14) + 'px';
  tip.style.top  = (e.originalEvent.clientY + 14) + 'px';
  tip.innerHTML =
    '<strong>' + p.pop + ' people</strong><br>' +
    'nearest: ' + p.nearest + '<br>' +
    distTxt + (p.served == 1 ? ' &middot; <em>within threshold</em>'
                             : ' &middot; <em>beyond threshold</em>');
});

map.on('mouseleave', 'grid-fill', () => { tip.style.display = 'none'; });

/* ---------------------------------------------------------------------------
   9. Controls
   --------------------------------------------------------------------------- */

document.getElementById('threshold').addEventListener('input', update);

document.getElementById('reset').addEventListener('click', () => {
  facilities = INITIAL_FACILITIES.map(f => ({ ...f }));
  facilityCounter = 0;
  update();
});
