/**
 * Promise Community Zone Boundaries
 *
 * These polygons define the qualifying geographic zones for the UDF Promise Community
 * sub-program. Addresses must fall within one of these zones to qualify.
 *
 * Source: "Utahs Promise Maps_ SSL & MC.pdf" — red dashed boundary lines
 * Zones: Millcreek (incorporated 2016) and South Salt Lake
 *
 * NOTE: Coordinates are traced from the program maps using street grid reference
 * points. Verify visually against the PDF maps and adjust vertices as needed.
 */

export interface PromiseZone {
  id: string
  name: string
  description: string
  polygon: [number, number][] // [lat, lng] pairs, closed ring
  color: string
  fillColor: string
}

export const PROMISE_ZONES: PromiseZone[] = [
  {
    id: 'millcreek',
    name: 'Millcreek',
    description: 'City of Millcreek — Promise Community qualifying zone',
    color: '#c0392b',
    fillColor: 'rgba(192, 57, 43, 0.15)',
    polygon: [
      // Traced clockwise from northwest corner
      // NW — near I-80 & State St / S 300 E
      [40.7275, -111.8883],
      // N — along ~2700 S eastward
      [40.7275, -111.8830],
      [40.7270, -111.8760], // 2700 S & 700 E
      [40.7265, -111.8690], // 2700 S & 1100 E
      // NE — curves north toward I-80 near Sugarhouse
      [40.7280, -111.8580],
      [40.7300, -111.8500], // near 2300 E / I-80
      // E — south along foothills / 2300 E corridor
      [40.7200, -111.8430],
      [40.7140, -111.8350], // near Grandeur Peak / I-215
      [40.7050, -111.8300],
      // SE — curves southwest along I-215 / Holladay border
      [40.6950, -111.8350],
      [40.6890, -111.8430],
      [40.6850, -111.8500],
      // S — along ~3900 S / ~4500 S westward
      [40.6870, -111.8600],
      [40.6890, -111.8690],
      [40.6900, -111.8760], // 3900 S & 700 E
      [40.6900, -111.8830], // 3900 S & 300 E
      // SW — back to State St / I-15 area
      [40.6900, -111.8883], // 3900 S & State
      // W — north along State St back to start
      [40.7000, -111.8883],
      [40.7100, -111.8883],
      [40.7200, -111.8883],
      [40.7275, -111.8883], // close the ring
    ],
  },
  {
    id: 'south-salt-lake',
    name: 'South Salt Lake',
    description: 'City of South Salt Lake — Promise Community qualifying zone',
    color: '#2980b9',
    fillColor: 'rgba(41, 128, 185, 0.15)',
    polygon: [
      // Traced clockwise from northwest corner
      // NW — near I-80 & I-15 junction
      [40.7400, -111.9050],
      // N — along I-80 eastward
      [40.7380, -111.8980],
      [40.7350, -111.8920],
      [40.7330, -111.8883], // I-80 & State St
      // NE — along State St / 500 E
      [40.7320, -111.8830],
      [40.7310, -111.8780], // near 500 E
      // E — south along ~700 E / 900 E
      [40.7280, -111.8760],
      [40.7275, -111.8740], // meets Millcreek border area
      // Jog — boundary follows 2700 S briefly
      [40.7275, -111.8883], // 2700 S & State — shared with Millcreek
      // SE — continues south along State to ~3300 S
      [40.7050, -111.8883], // 3300 S & State
      // S — west along ~3300 S / 3900 S
      [40.7050, -111.8920],
      [40.7000, -111.8970],
      [40.6960, -111.9000], // near I-15 & 3900 S
      // SW — along I-15 northward
      [40.7050, -111.9030],
      [40.7150, -111.9040],
      [40.7250, -111.9045],
      [40.7350, -111.9050],
      [40.7400, -111.9050], // close the ring
    ],
  },
]

/** Center point for the default map view (between the two zones) */
export const MAP_CENTER: [number, number] = [40.7100, -111.8850]
export const MAP_ZOOM = 12
