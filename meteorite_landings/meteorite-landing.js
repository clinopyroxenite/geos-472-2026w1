// p5.js canvas over a MapLibre map: meteorites, sized by mass.
// Needs a web server (loadTable reads a CSV) and Meteorite_Landings.csv in the same folder.

const UBC = [-123.246, 49.2606]; // [lng, lat]
const STYLE = 'https://tiles.openfreemap.org/styles/dark'; // OpenFreeMap: no key needed

let myMap, table;
let meteorites = [];
let school = null;   // {lat, lng}
let nearest = [];
let hovered = null;

function preload() {
  table = loadTable('Meteorite_Landings.csv', 'csv', 'header');
}

function setup() {
  const canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent('canvas-holder');
  noLoop();

  // Parse rows, dropping records with no usable location.
  for (let i = 0; i < table.getRowCount(); i++) {
    const r = table.getRow(i);
    const lat = parseFloat(r.getString('reclat'));
    const lng = parseFloat(r.getString('reclong'));
    if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) continue;
    const mass = parseFloat(r.getString('mass (g)'));
    meteorites.push({
      name: r.getString('name'),
      fell: r.getString('fall') === 'Fell',
      year: r.getString('year'),
      mass: isNaN(mass) ? 1 : mass,
      lat, lng
    });
  }
  meteorites.sort((a, b) => b.mass - a.mass); // big ones drawn first, small on top

  myMap = new maplibregl.Map({
    container: 'map',
    style: STYLE,
    center: UBC,
    zoom: startZoom(),
    attributionControl: { compact: true }
  });

  myMap.on('move', () => redraw());
  myMap.on('load', () => redraw());
  myMap.on('click', (e) => setSchool(e.lngLat.lat, e.lngLat.lng));
  myMap.on('mousemove', (e) => updateHover(e.point.x, e.point.y, e.originalEvent));
  myMap.on('mouseout', () => { hovered = null; document.getElementById('tip').style.display = 'none'; });
}

// Zoom so North America fits around UBC with only slivers of other continents.
function startZoom() {
  const zWidth = Math.log2(windowWidth / 2 / 156);   // ~110 degrees east of UBC to Iceland
  const zHeight = Math.log2(windowHeight / 2 / 70);  // ~72N to the north
  return constrain(Math.min(zWidth, zHeight), 1, 4);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  myMap.resize();
  redraw();
}

// The two bridge functions between map coordinates and canvas pixels
function latLngToPixel(lat, lng) {
  const p = myMap.project([lng, lat]);
  return { x: p.x, y: p.y };
}
function pixelToLatLng(x, y) {
  const ll = myMap.unproject([x, y]);
  return { lat: ll.lat, lng: ll.lng };
}

function diameter(mass) {
  return constrain(0.06 * Math.sqrt(mass), 2.5, 40); // area follows mass
}

function draw() {
  clear();
  noStroke();

  // Additive blending: overlapping symbols glow brighter, showing density on the dark map.
  blendMode(ADD);
  for (const m of meteorites) {
    const p = latLngToPixel(m.lat, m.lng);
    if (p.x < -50 || p.x > width + 50 || p.y < -50 || p.y > height + 50) continue;
    fill(m.fell ? color(255, 179, 71, 70) : color(79, 209, 255, 60));
    ellipse(p.x, p.y, diameter(m.mass));
  }
  blendMode(BLEND);

  // Nearest-5 lines and school marker
  if (school) {
    const s = latLngToPixel(school.lat, school.lng);
    stroke(255, 255, 255, 170);
    strokeWeight(1);
    for (const n of nearest) {
      const p = latLngToPixel(n.m.lat, n.m.lng);
      line(s.x, s.y, p.x, p.y);
    }
    noStroke();
    for (const n of nearest) {
      const p = latLngToPixel(n.m.lat, n.m.lng);
      noFill(); stroke(255); strokeWeight(1.5);
      ellipse(p.x, p.y, diameter(n.m.mass) + 6);
    }
    fill(255, 80, 120); stroke(255); strokeWeight(2);
    triangle(s.x, s.y - 12, s.x - 8, s.y + 5, s.x + 8, s.y + 5);
  }

  if (hovered) {
    const p = latLngToPixel(hovered.lat, hovered.lng);
    noFill(); stroke(255, 255, 0); strokeWeight(2);
    ellipse(p.x, p.y, diameter(hovered.mass) + 8);
  }
}

// Great-circle distance in km
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function setSchool(lat, lng) {
  school = { lat, lng };
  nearest = meteorites
    .map(m => ({ m, km: haversine(lat, lng, m.lat, m.lng) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, 5);

  const items = nearest.map(n =>
    `<li><b>${n.m.name}</b> (${n.m.fell ? 'fell' : 'found'}${n.m.year ? ', ' + n.m.year : ''})<br>` +
    `${n.km.toFixed(0)} km away, ${formatMass(n.m.mass)}</li>`).join('');
  document.getElementById('results').innerHTML = `<p><b>Closest to your school:</b></p><ol>${items}</ol>`;
  redraw();
}

function formatMass(g) {
  return g >= 1000 ? (g / 1000).toFixed(1) + ' kg' : g.toFixed(0) + ' g';
}

function updateHover(x, y, evt) {
  let best = null, bestD = 12;
  for (const m of meteorites) {
    const p = latLngToPixel(m.lat, m.lng);
    const d = dist(x, y, p.x, p.y);
    if (d < bestD) { bestD = d; best = m; }
  }
  const tip = document.getElementById('tip');
  if (best !== hovered) { hovered = best; redraw(); }
  if (best) {
    tip.style.display = 'block';
    tip.style.left = (evt.clientX + 12) + 'px';
    tip.style.top = (evt.clientY + 12) + 'px';
    tip.textContent = `${best.name}: ${best.fell ? 'fell' : 'found'}${best.year ? ' ' + best.year : ''}, ${formatMass(best.mass)}`;
  } else {
    tip.style.display = 'none';
  }
}
