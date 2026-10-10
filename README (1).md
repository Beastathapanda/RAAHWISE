# RAAHWISE
Find your way. Feel safer. Safety-aware route comparison using OpenStreetMap, OSRM, Nominatim and Overpass.

## Run
Serve the folder (needed for geolocation): `python3 -m http.server 8000`, then open http://localhost:8000
(GitHub Pages also works: Settings > Pages > deploy from main branch.)

## Configure
Edit `CFG` at the top of `app.js` to point to your own OSRM, Nominatim and Overpass endpoints. The public demo servers are for light use only.

## Limits
Reports and contacts are stored in the browser (localStorage). No backend, admin dashboard, SMS provider, crime data, OpenCity, Delhi PWD or Google Maps integration yet. Safety scores use only mapped OpenStreetMap data and never guarantee safety.
