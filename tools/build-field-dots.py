# Regenerates FIELD_DOTS in assets/js/map-dots.js: dotted land for the two field-map panels.
# Usage: python3 tools/build-field-dots.py path/to/ne_10m_land.geojson
# Data: Natural Earth 1:10m land (public domain). Panels must match FIELD_PANELS in assets/js/main.js.
import json, math, re, sys

PANELS = {
    'eu': dict(lon=(-5, 21), lat=(42, 52), x=0, y=0, w=600),
    'tw': dict(lon=(117.2, 123.8), lat=(21.6, 26.6), x=320, y=372, w=280),
}
STEP = 6.2

def rings(geom):
    polys = geom['coordinates'] if geom['type'] == 'MultiPolygon' else [geom['coordinates']]
    for poly in polys:
        yield poly[0], poly[1:]

def inside(pt, ring):
    x, y = pt; c = False; j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]; xj, yj = ring[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi: c = not c
        j = i
    return c

def bbox(r):
    xs = [p[0] for p in r]; ys = [p[1] for p in r]
    return min(xs), min(ys), max(xs), max(ys)

land = json.load(open(sys.argv[1]))
polys = [(outer, holes, bbox(outer)) for f in land['features'] for outer, holes in rings(f['geometry'])]
out = {}
for key, p in PANELS.items():
    (l0, l1), (b0, b1) = p['lon'], p['lat']
    k = p['w'] / ((l1 - l0) * math.cos(math.radians((b0 + b1) / 2)))  # units per degree of latitude
    h = (b1 - b0) * k
    cand = [q for q in polys if q[2][0] < l1 and q[2][2] > l0 and q[2][1] < b1 and q[2][3] > b0]
    d = []
    y = STEP / 2
    while y < h:
        x = STEP / 2
        while x < p['w']:
            lon = l0 + x / p['w'] * (l1 - l0); lat = b1 - y / k
            for outer, holes, bb in cand:
                if bb[0] <= lon <= bb[2] and bb[1] <= lat <= bb[3] and inside((lon, lat), outer) and not any(inside((lon, lat), hl) for hl in holes):
                    d.append(f"M{p['x'] + x:.1f} {p['y'] + y:.1f}h0"); break
            x += STEP
        y += STEP
    out[key] = ''.join(d)
    print(key, len(d), 'dots, panel height', round(h, 1))

path = 'assets/js/map-dots.js'
src = open(path).read()
src = re.sub(r'\n// Field map panels.*', '', src, flags=re.S).rstrip('\n')
src += '\n// Field map panels (tools/build-field-dots.py, Natural Earth 1:10m land, public domain).\n'
src += 'export const FIELD_DOTS = ' + json.dumps(out) + ';\n'
open(path, 'w').write(src)
