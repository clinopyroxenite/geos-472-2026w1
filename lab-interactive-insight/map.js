const START_CENTER = [-122.335, 47.605];   
const START_ZOOM   = 12.2;

const CELL_KM = 0.5;    
const COLS    = 26;     
const ROWS    = 20;     

const KM_PER_DEG_LAT = 110.574;
const KM_PER_DEG_LON = 111.320 * Math.cos(START_CENTER[1] * Math.PI / 180);

const TOWNS = [
  { lon: -122.352, lat: 47.615, amp: 2600, sig: 1.5 },
  { lon: -122.315, lat: 47.598, amp: 3100, sig: 1.8 },
  { lon: -122.352, lat: 47.585, amp: 1500, sig: 1.2 },
  { lon: -122.305, lat: 47.622, amp:  900, sig: 1.0 }
];

const INITIAL_FACILITIES = [
  { name: 'Clinic A', lon: -122.348, lat: 47.612 },
  { name: 'Clinic B', lon: -122.318, lat: 47.600 },
  { name: 'Clinic C', lon: -122.335, lat: 47.588 }
];

let facilities      = INITIAL_FACILITIES.map(f => ({ ...f }));
let GRID            = [];    // built once on load
let facilityCounter = 0;     // names clinics the user adds

function buildGrid() {
  const stepLon = CELL_KM / KM_PER_DEG_LON;
  const stepLat = CELL_KM / KM_PER_DEG_LAT;
  const lon0    = START_CENTER[0] - (COLS * stepLon) / 2;
  const lat0    = START_CENTER[1] - (ROWS * stepLat) / 2;

  const feats = [];

  for (let i = 0; i < COLS; i++) {
    for (let j = 0; j < ROWS; j++) {
      const x0 = lon0 + i * stepLon, y0 = lat0 + j * stepLat;
      const x1 = x0 + stepLon,       y1 = y0 + stepLat;
      const cx = (x0 + x1) / 2,      cy = (y0 + y1) / 2;

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

const map = new maplibregl.Map({
  container: 'map',
  style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  center: START_CENTER,
  zoom: START_ZOOM
});

map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

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


function update() {
  const gridSource = map.getSource('grid');
  if (!gridSource) return;

  const threshold = parseFloat(document.getElementById('threshold').value);
  document.getElementById('thVal').textContent = threshold.toFixed(1);

  let totalPop = 0, servedPop = 0;

  const features = GRID.map(f => {
    const p = f.properties;

    let best = Infinity, bestName = 'no clinic';
    for (const fac of facilities) {
      const d = turf.distance([p.cx, p.cy], [fac.lon, fac.lat], { units: 'kilometers' });
      if (d < best) { best = d; bestName = fac.name; }
    }

    const served = best <= threshold;
    totalPop += p.pop;
    if (served) servedPop += p.pop;

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

  gridSource.setData({ type: 'FeatureCollection', features: features });
  map.getSource('facilities').setData(facilityFC());

  document.getElementById('servedPct').textContent =
    Math.round(100 * servedPop / Math.max(totalPop, 1)) + '%';
  document.getElementById('unservedPop').textContent =
    Math.round(totalPop - servedPop).toLocaleString();
  document.getElementById('facCount').textContent = facilities.length;
}
map.on('load', () => {
  GRID = buildGrid();
  map.addSource('grid', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: GRID }
  });

  map.addLayer({
    id: 'grid-fill',
    type: 'fill',
    source: 'grid',
    paint: {
      'fill-color': [
        'case',
        ['==', ['get', 'served'], 1], '#2b8cbe',   
        '#d7301f'                                   
      ],
      'fill-opacity': 0.72,
      'fill-outline-color': 'rgba(255,255,255,0.35)'
    }
  });

  map.addSource('facilities', { type: 'geojson', data: facilityFC() });

  map.addLayer({
    id: 'facilities',
    type: 'circle',
    source: 'facilities',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 4, 14, 8],
      'circle-color': '#ffffff',
      'circle-stroke-color': '#08306b',
      'circle-stroke-width': 2
    }
  });

  update();
});

map.on('click', (e) => {
  const hits = map.queryRenderedFeatures(e.point, { layers: ['facilities'] });

  if (hits.length) {
    const idx = hits[0].properties.idx;
    const removed = facilities.splice(idx, 1)[0];
    update();
    new maplibregl.Popup()
      .setLngLat(e.lngLat)
      .setHTML('Removed <strong>' + removed.name + '</strong>')
      .addTo(map);
  } else {
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

map.on('mouseenter', 'facilities', () => { map.getCanvas().style.cursor = 'pointer'; });
map.on('mouseleave', 'facilities', () => { map.getCanvas().style.cursor = ''; });

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

document.getElementById('threshold').addEventListener('input', update);

document.getElementById('reset').addEventListener('click', () => {
  facilities = INITIAL_FACILITIES.map(f => ({ ...f }));
  facilityCounter = 0;
  update();
});
