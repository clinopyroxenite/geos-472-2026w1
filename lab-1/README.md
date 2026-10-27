# Vancouver bikeways: which street gets which bikeway?

Interactive web map for the web cartography lab (Maputnik + MapLibre GL JS).

## Screenshot

![Downtown Vancouver and Stanley Park: protected lanes along the seawall, local street bikeways in the residential grid]


## Link to map

- Live map: https://clinopyroxenite.github.io/geos-472-2026w1/lab-1/index.html

## What is in this folder

| File | What it is |
|---|---|
| `index.html` | The page: loads MapLibre GL JS 5.24.0 and the style, adds a legend that shows or hides each bikeway type, hover/tap popups, and attribution |
| `<<style file name>>.json` | The style saved from Maputnik (copied to `style.json` on the live site) |
| `bikeways_clean.geojson` | The data layer, about 1.4 MB (see "Data" below) |
| `screenshot.png` | The screenshot above |

## Data

The bikeway data come from the City of Vancouver Open Data Portal (Open Government Licence – Vancouver). The original file had 3,774 line segments. I made these changes before publishing:

- Kept only segments with status `Active` (3,765), dropping 9 marked `Temporarily Removed`.
- Converted `year_of_construction` from text to a number.
- Kept only the fields the map uses: street name, route name, bikeway type, road class, all-ages-and-abilities (AAA) flag, surface, snow removal and year.
- Rounded coordinates to 5 decimal places (about 1 m), which cut the file to about 1.4 MB.

The context comes from the OpenFreeMap vector tiles (OpenMapTiles schema, starting from the Positron style), plus one external source I added: elevation tiles (Terrarium encoding, hosted on AWS) for the hillshade.

## Reflective analysis


**Audience, question and layer choices.** I designed this map for someone curious about how Vancouver's bikeway network is organised, such as a resident, a planning student, or a cyclist deciding where to ride. The question it tries to answer is "which kind of street gets which kind of bikeway?" Crossing bikeway type with the City's road classes showed a clear pattern: about 97% of local street bikeways are on residential streets, about 80% of painted lanes are on arterial or secondary arterial roads, and protected lanes are mostly off-street paths (about 44%) with a further 37% on arterials. That finding shaped the context layers, because each one had to help a reader see the pattern. I kept water and parks, because the seawall and off-street paths follow them; a muted road hierarchy, so painted lanes can be read against the arterials; a beige residential land-use fill, so local street bikeways read against the residential grid; and the city boundary, because the data stop at the city limit and a reader would otherwise wonder why the lines end in straight edges. I deleted buildings, rail, the airport, highway shields, piers, footpaths, road casings, reserve and island labels, and most place labels, because they did not help explain the pattern (selection and omission). Context colours are desaturated and low in contrast so that the four saturated line colours work as figure against ground, following the advice on muted base-map colour in Muehlenhaus (2014, ch. 5).

**Working at more than one zoom level.** At city scale the map shows only the network structure: bikeway lines are thin, only city and water names appear, and neighbourhood names start at zoom 12. Street names appear only from zoom 15, <<VERIFY: and minor roads from zoom 14>>, so detail arrives when a reader is looking at a block. Line width is a zoom-dependent expression that differs by type, so protected lanes are wider than painted lanes and local streets at every scale, and the lines grow from about 0.5–1 px at zoom 10 to 3–6 px at zoom 17. The residential fill fades from 0.9 to 0.4 opacity between zoom 10 and 17 so building-scale detail is not buried. <<VERIFY: The hillshade fades out completely by zoom 14 because at street scale it turned into noise rather than relief.>> These decisions are scale-dependent symbolisation and generalisation in the sense of Jones (2010, pp. 58–65). The page adds two interactions that serve the argument: a legend that shows or hides each type, which lets a reader isolate one type and see where it lives, and popups showing street, road class, year built and AAA status.

**Did it work, and what would I change?** The map achieves the quiet-context effect I wanted: the bikeway lines read first, and the pattern of local streets in residential grids with painted lanes on arterials is visible at zoom 13–14. It falls short in four ways. First, my original hypothesis that terrain shapes the network did not hold up inside the city; the relief mostly shows the North Shore mountains and Burnaby, outside the data, and at city scale the hillshade is heavier than I intended. I kept it as faint regional context and am reporting it as a hypothesis that tested weakly. Second, the data end at the city limit, but the basemap keeps drawing context beyond it, which can read as "no bikeways in Burnaby", when really they are missing from the dataset; masking or fading the area outside the city would fix that. Third, the residential fill comes from OpenStreetMap tagging, while the "97% on residential streets" figure comes from the City's own road classification. They are different sources, so the fill is slightly patchy and not a perfect match. Fourth, downtown looks dense partly because it has a fine street grid, so I would normalise bikeway length by street length before making any claim about density. This is a vector-tile map styled in the browser (type 3), with a client-side GeoJSON data layer and one raster elevation source for the hillshade, which is a mix of types, as the lab notes many real maps are.

## Credits and sources

- Bikeway data: City of Vancouver Open Data Portal, Open Government Licence – Vancouver.
- Basemap: OpenFreeMap, OpenMapTiles, data from OpenStreetMap.
- Terrain: Mapzen terrain tiles (Terrarium) hosted on AWS. 
- Tools: Maputnik (style editor), MapLibre GL JS 5.24.0.
- Readings engaged: Jones (2010), "Cartographic Theory and Principles"; Muehlenhaus (2014), *Web Cartography*, ch. 5 and 6. <<Add any other readings or design write-ups you used, such as the Amy Lee Mapbox guide.>>
