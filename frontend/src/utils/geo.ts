import bulgariaBorderData from "@/mocks/bulgaria-border.json"

export const bulgariaBorder = bulgariaBorderData.geometry.coordinates as number[][][];

/**
 * Checks if a point [lng, lat] is inside a GeoJSON Polygon coordinates array.
 * Uses the ray-casting algorithm, accounting for holes (interior rings).
 */
export function isPointInPolygon(point: [number, number], polygon: number[][][]): boolean {
  const [lng, lat] = point;
  let inside = false;

  // Check if inside the exterior ring (index 0)
  const exterior = polygon[0];
  if (!exterior) return false;
  for (let i = 0, j = exterior.length - 1; i < exterior.length; j = i++) {
    const xi = exterior[i][0];
    const yi = exterior[i][1];
    const xj = exterior[j][0];
    const yj = exterior[j][1];

    const intersect = ((yi > lat) !== (yj > lat)) &&
      (lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }

  if (!inside) return false;

  // Check if the point falls inside any holes (indices 1+)
  for (let h = 1; h < polygon.length; h++) {
    const hole = polygon[h];
    let insideHole = false;
    for (let i = 0, j = hole.length - 1; i < hole.length; j = i++) {
      const xi = hole[i][0];
      const yi = hole[i][1];
      const xj = hole[j][0];
      const yj = hole[j][1];

      const intersect = ((yi > lat) !== (yj > lat)) &&
        (lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi);
      if (intersect) insideHole = !insideHole;
    }
    if (insideHole) return false; // If inside a hole, it is outside the polygon
  }

  return true;
}

/**
 * Converts WGS84 [lng, lat] to EPSG:3857 Web Mercator [x, y].
 */
export function lngLatToMercator(lng: number, lat: number): [number, number] {
  const x = (lng * 20037508.34) / 180;
  let y = Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180);
  y = (y * 20037508.34) / 180;
  return [x, y];
}

// Pre-project Bulgaria's border coordinates to Web Mercator (EPSG:3857)
export const bulgariaMercatorCoordinates = bulgariaBorder.map((ring) => {
  return ring.map(([lng, lat]) => lngLatToMercator(lng, lat));
});

// Calculate Web Mercator Bounding Box for Bulgaria
let minX = Infinity;
let maxX = -Infinity;
let minY = Infinity;
let maxY = -Infinity;

for (const ring of bulgariaMercatorCoordinates) {
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
}

export const bulgariaBBoxMercator = { minX, minY, maxX, maxY };
