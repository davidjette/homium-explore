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
      [40.6955, -111.8747],
      // 2. North along S 700 E to 2700 S
      [40.7135, -111.8747],
      // 3. East along 2700 S to 1300 E
      [40.7135, -111.8613],
      // 4. South along 1300 E to Van Winkle Expressway (~3350 S)
      [40.7020, -111.8613],
      // 5. Southwest along Van Winkle Expressway & Big Cottonwood Creek
      [40.6995, -111.8655],
      [40.6975, -111.8695],
      [40.6960, -111.8725],
      // 6. Van Winkle / creek meets 3900 S (~S 500 E area)
      [40.6955, -111.8770],
      // 7. East along 3900 S back to start
      [40.6955, -111.8747],
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
      [40.7225, -111.9030],
      // 2. East along 2100 S to S 500 E
      [40.7225, -111.8790],
      // 3. South along S 500 E to Sunset Ave / south edge Nibley Park Golf Course
      [40.7085, -111.8790],
      // 4. East along south edge of Nibley Park Golf Course to S 700 E
      [40.7085, -111.8747],
      // 5. South along S 700 E to 3900 S
      [40.6955, -111.8747],
      // 6. West along 3900 S to Jordan River (General Holm Park)
      [40.6955, -111.9025],
      // 7. North along Jordan River to 2100 S (with river meanders)
      [40.6990, -111.9035],
      [40.7030, -111.9040],
      [40.7070, -111.9035],
      [40.7110, -111.9030],
      [40.7150, -111.9035],
      [40.7190, -111.9030],
      // Close: back to Jordan River & 2100 S
      [40.7225, -111.9030],
    ],
  },
]

/** Center point for the default map view (between the two zones) */
export const MAP_CENTER: [number, number] = [40.7050, -111.8880]
export const MAP_ZOOM = 13
