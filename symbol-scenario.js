const SCALE = 2; 

const WORLD_URL = "https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json";

const AVOID_RADIUS = 30;
const PUSH_DISTANCE = 40;
const EASING = 0.15;

let latBox, longBox, valBox, messageP, mapNoteP;
let points = [];
let world = null;     
let baseMap;           

function setup() {
  createCanvas(360 * SCALE, 180 * SCALE);
  baseMap = createGraphics(width, height);

  buildBaseMap();   

  loadJSON(WORLD_URL,
    function (data) {
      world = data;
      buildBaseMap();
      mapNoteP.html("Base map: Natural Earth-style country outlines (johan/world.geo.json), plate carrée projection.");
    },
    function (err) {
      mapNoteP.html("World outlines could not be downloaded, so only the lat/long grid is shown. Plotting still works.");
      console.log("World map download failed:", err);
    });

  let row = createDiv();
  row.style("margin", "8px 0");

  row.child(createSpan("Latitude (-90 to 90): "));
  latBox = createInput("");
  latBox.size(70);
  row.child(latBox);

  row.child(createSpan(" Longitude (-180 to 180): "));
  longBox = createInput("");
  longBox.size(70);
  row.child(longBox);

  row.child(createSpan(" Data value (0 or more): "));
  valBox = createInput("");
  valBox.size(70);
  row.child(valBox);

  let plotBtn = createButton("Plot");
  plotBtn.mousePressed(plotPoint);
  row.child(plotBtn);

  let clearBtn = createButton("Clear");
  clearBtn.mousePressed(function () { points = []; showMessage("Cleared.", false); });
  row.child(clearBtn);

  for (let box of [latBox, longBox, valBox]) {
    box.elt.addEventListener("keydown", function (e) {
      if (e.key === "Enter") plotPoint();
    });
  }

  messageP = createP("Enter three numbers and press Plot.");
  mapNoteP = createP("Loading world map...");
  mapNoteP.style("font-size", "11px");
  mapNoteP.style("color", "#666");
}

function projectX(long) { return (long + 180) * SCALE; }
function projectY(lat)  { return (90 - lat) * SCALE; }

function buildBaseMap() {
  let g = baseMap;
  g.background(200, 224, 240);          // ocean

  if (world) {
    g.fill(240, 236, 220);              // land
    g.stroke(150, 145, 125);
    g.strokeWeight(0.7);
    for (let f of world.features) {
      let geom = f.geometry;
      if (!geom) continue;
      if (geom.type === "Polygon") {
        drawPolygon(g, geom.coordinates);
      } else if (geom.type === "MultiPolygon") {
        for (let poly of geom.coordinates) drawPolygon(g, poly);
      }
    }
  }

  // lat/long grid on top
  g.textSize(9);
  g.textAlign(LEFT, TOP);
  for (let long = -180; long <= 180; long += 30) {
    let x = projectX(long);
    g.stroke(long === 0 ? color(110, 110, 110, 160) : color(90, 90, 90, 60));
    g.strokeWeight(1);
    g.line(x, 0, x, g.height);
    g.noStroke();
    g.fill(90);
    g.text(long, x + 2, 2);
  }
  for (let lat = -90; lat <= 90; lat += 30) {
    let y = projectY(lat);
    g.stroke(lat === 0 ? color(110, 110, 110, 160) : color(90, 90, 90, 60));
    g.strokeWeight(1);
    g.line(0, y, g.width, y);
    g.noStroke();
    g.fill(90);
    g.text(lat, 2, y + 2);
  }
  g.noFill();
  g.stroke(100);
  g.rect(0, 0, g.width - 1, g.height - 1);
}

function drawPolygon(g, rings) {
  g.beginShape();
  for (let c of rings[0]) g.vertex(projectX(c[0]), projectY(c[1]));
  for (let i = 1; i < rings.length; i++) {
    g.beginContour();
    for (let c of rings[i]) g.vertex(projectX(c[0]), projectY(c[1]));
    g.endContour();
  }
  g.endShape(CLOSE);
}

function plotPoint() {
  let lat = readNumber(latBox.value());
  let long = readNumber(longBox.value());
  let dataValue = readNumber(valBox.value());

  let problems = [];
  if (!isFinite(lat) || lat < -90 || lat > 90) {
    problems.push("latitude must be a number from -90 to 90");
  }
  if (!isFinite(long) || long < -180 || long > 180) {
    problems.push("longitude must be a number from -180 to 180");
  }
  if (!isFinite(dataValue)) {
    problems.push("data value must be a number");
  }

  if (problems.length > 0) {
    showMessage("Not plotted: " + problems.join("; ") + ".", true);
    return;
  }

  let x = projectX(long);
  let y = projectY(lat);
  points.push({ homeX: x, homeY: y, x: x, y: y, value: dataValue });

  if (dataValue < 0) {
    showMessage("Plotted a red X (negative data value).", false);
  } else {
    showMessage("Plotted a symbol of width " + symbolWidth(dataValue) + ".", false);
  }
}

function readNumber(text) {
  text = text.trim();
  if (text === "") return NaN;
  return Number(text);
}

function showMessage(msg, isError) {
  messageP.html(msg);
  messageP.style("color", isError ? "#c00000" : "#000000");
}

function symbolWidth(value) {
  if (value <= 100) {
    return 5;
  } else if (value <= 200) {
    return 10;
  } else {
    return 15;
  }
}

function drawSymbol(x, y, value) {
  if (value < 0) {
    stroke(220, 0, 0);
    strokeWeight(2);
    line(x - 5, y - 5, x + 5, y + 5);
    line(x - 5, y + 5, x + 5, y - 5);
  } else {
    stroke(255, 255, 255, 200);   // thin white edge so black stays visible on dark outlines
    strokeWeight(1);
    fill(0);
    circle(x, y, symbolWidth(value));
  }
}

// ---------- main loop ----------
function draw() {
  image(baseMap, 0, 0);

  for (let p of points) {
    let targetX = p.homeX;
    let targetY = p.homeY;
    let d = dist(mouseX, mouseY, p.homeX, p.homeY);
    if (d < AVOID_RADIUS) {
      let dx = p.homeX - mouseX;
      let dy = p.homeY - mouseY;
      if (d < 0.001) { dx = 0; dy = -1; d = 1; }
      targetX = p.homeX + (dx / d) * PUSH_DISTANCE;
      targetY = p.homeY + (dy / d) * PUSH_DISTANCE;
    }
    p.x = lerp(p.x, targetX, EASING);
    p.y = lerp(p.y, targetY, EASING);

    if (dist(p.x, p.y, p.homeX, p.homeY) > 1) {
      stroke(80);
      strokeWeight(1);
      line(p.homeX, p.homeY, p.x, p.y);
      noFill();
      circle(p.homeX, p.homeY, 3);
    }

    drawSymbol(p.x, p.y, p.value);
  }
}
