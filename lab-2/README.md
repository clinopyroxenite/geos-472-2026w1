# Clinic Access Threshold Explorer

A MapLibre GL JS + Turf.js map for exploring how "access to care" changes when
the maximum acceptable travel distance is treated as a decision rather than a fact.

<img width="1439" height="810" alt="image" src="https://github.com/user-attachments/assets/aaec0f34-49a9-4653-9a7c-6e2a0b630f37" />

**Live map:** https://clinopyroxenite.github.io/geos-472-2026w1/lab-2/index.html

---

## What the map asks

A public-health planner has three clinics and a 0.5 km population grid. The
question is not "where are the clinics?" but **"how much of the population is
within reach, and how much does that answer depend on the standard I choose?"**

## Interactions and what each one is for

| Interaction | Understanding it produces |
|---|---|
| **Slider** (0.5–5.0 km threshold) | Recomputes nearest-clinic assignment and reclassifies every cell. Reveals that coverage is not a fixed property of the landscape — it collapses and expands non-linearly as the threshold moves. |
| **Click empty map** to add a clinic | Re-runs the assignment. Shows how one new facility captures a catchment and *takes population away from* an existing clinic, not just "adds coverage." |
| **Click a clinic** to remove it | Reveals which areas are dependent on a single facility, and which are redundantly served. |
| **Hover a cell** | Cell-level detail (population, nearest clinic, exact distance) on demand, without permanent labels cluttering the map. |
| **Live stat readout** | Quantifies what the colors show, so the visual and the numeric readings reinforce each other. |

## Data

**Synthetic, generated in code.** The population grid is produced from four
Gaussian density centers at 0.5 km resolution; the three starting clinics are
hand-placed. No real facilities, patients, or populations are represented.
The point of the map is the *analytical mechanism*, which is transferable to
real data.

To swap in real data: export two layers from QGIS as GeoJSON in EPSG:4326
(right-click layer → Export → Save Features As → GeoJSON, CRS = EPSG:4326),
then replace `TOWNS`/`buildGrid()` with your population polygons and
`INITIAL_FACILITIES` with your facility points.

## Collaborations, resources, and provenance

- **MapLibre initialization:** adapted from the MapLibre GL JS docs,
  "Display a map" example.
- **MapLibre version note:** The assignment mentioned version 6.15.0 (and 5.24.0 as acceptable). However, 6.15.0 is not currently available on the unpkg CDN. To ensure the map loaded successfully without requiring a complex build step, I used version 4.7.1, which is fully compatible with the Turf.js calculations and MapLibre features used here.
- **MapLibre initialization:** adapted from the MapLibre GL JS docs, "Display a map" example.
- **Basemap:** CARTO Positron GL style (keyless), chosen for its muted palette.
- **Turf.js:** `turf.distance` and `turf.polygon` per the Turf API docs.
- **Interaction pattern:** the "a control recomputes map state" idea is adapted
  from MapLibre's "Create a time slider" example, but here the control drives a
  spatial re-analysis (`setData`) rather than a simple `setFilter`.
- **Generative AI:** For this assignment, I use AI simply for translating the explanation regarding few features that widely available on the internet.
- Code provenance is also marked in comments at the relevant lines in `map.js`.

## Reflective analysis

I designed this map for a public-health planner who already knows where the
clinics are and is now being asked to defend a coverage standard. The question
the map raises is deliberately uncomfortable: a coverage figure is not a
finding about the world so much as a finding about the threshold that produced
it. In that respect the map succeeds — moving the slider from 5 km to 1 km
does not simply shrink the blue area proportionally; the served-population
readout falls unevenly, because the population surface is lumpy and because the
catchments reorganize as cells are reassigned. A single static map at 2 km
would have shown one defensible-looking picture and hidden the decision
entirely. That is the specific insight the interactivity is for: following
Roth's distinction between the interface and the experience, the slider is only
the interface control, but the experience of watching the classification
reorganize is what teaches that coverage is parameter-dependent.

The second interaction extends this from "one threshold" to "one facility."
Adding a clinic does not merely add blue cells; it steals population from a
neighbouring clinic's catchment, and removing a clinic exposes which cells were
dependent on it alone. That is a relationship between phenomena over space
that would require several static maps to convey, and would require the reader
to do the comparison in their head. The hover tooltip works in the opposite
direction — it resolves the aggregate back into a single cell, so the user can
check whether a large blue area is densely populated or merely large. Together
the slider, the click, and the tooltip let the user move between the aggregate
question and the individual case, which is where the actual judgement happens.

Cartographically, the binary blue/red classification is a deliberate choice
rather than a default: because the threshold is a policy in/out decision rather
than a smooth gradient, a two-class map matches the representation to the task,
and it makes the reclassification on each slider move immediately legible. The
muted Positron basemap is chosen for figure-ground contrast so the grid holds
visual hierarchy, and the clinics are the only white-filled, heavy-stroked
symbols on the map, which makes them read as the manipulable objects. The
obvious limitations are worth naming: distances are great-circle, not network
distances, so the map ignores barriers such as water and highways; facilities
are treated as having unlimited capacity; and the map contains no demographic
attributes, so it cannot answer the equity question that a planner would ask
next — *who* is beyond the threshold. It also cannot answer why coverage is
distributed as it is. Those are the questions this map deliberately does not
engage, and they are the natural next layer of the project.
