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
      // Clockwise from 3900 S & S 700 E
      // 1. Start: 3900 S & S 700 E
      [40.6968, -111.8766],
      // 2. North along S 700 E to 2700 S
      [40.7141, -111.8766],
      // 3. East along 2700 S to 1300 E
      [40.7141, -111.8635],
      // 4. South along 1300 E to Van Winkle Expressway (~3300 S level)
      [40.7058, -111.8635],
      // 5. Southwest along Van Winkle Expressway & Big Cottonwood Creek
      [40.7030, -111.8680],
      [40.7000, -111.8720],
      [40.6980, -111.8760],
      // 6. Van Winkle / creek meets 3900 S (west of 700 E, near 400-500 E)
      [40.6968, -111.8800],
      // 7. East along 3900 S back to S 700 E (starting point)
      [40.6968, -111.8766],
    ],
  },
  {
    id: 'south-salt-lake',
    name: 'South Salt Lake',
    description: 'City of South Salt Lake — Promise Community qualifying zone',
    color: '#2980b9',
    fillColor: 'rgba(41, 128, 185, 0.15)',
    polygon: [
      // Clockwise from Jordan River & 2100 S
      // 1. Start: Jordan River & 2100 S
      [40.7228, -111.9210],
      // 2. East along 2100 S to S 500 E
      [40.7228, -111.8800],
      // 3. South along S 500 E to Sunset Ave / south edge Nibley Park Golf Course (~2900 S)
      [40.7085, -111.8800],
      // 4. East along south edge of Nibley Park Golf Course to S 700 E
      [40.7085, -111.8766],
      // 5. South along S 700 E to 3900 S
      [40.6968, -111.8766],
      // 6. West along 3900 S to Jordan River near General Holm Park
      [40.6968, -111.9195],
      // 7. North along Jordan River to 2100 S (with river meanders)
      [40.7000, -111.9200],
      [40.7050, -111.9205],
      [40.7100, -111.9210],
      [40.7150, -111.9205],
      [40.7200, -111.9210],
      // Close: back to Jordan River & 2100 S
      [40.7228, -111.9210],
    ],
  },
]

/** Center point for the default map view (between the two zones) */
export const MAP_CENTER: [number, number] = [40.7100, -111.8950]
export const MAP_ZOOM = 13
