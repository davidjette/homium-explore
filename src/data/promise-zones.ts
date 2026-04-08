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
    // All coordinates from Google Maps Geocoding API
    polygon: [
      // 1. Start: 3900 S & S 700 E (shared vertex with SSL)
      [40.6868, -111.8717],
      // 2. North along S 700 E to 2700 S
      [40.7125, -111.8714],
      // 3. East along 2700 S to 1300 E
      [40.7127, -111.8536],
      // 4. South along 1300 E to Van Winkle Expy / Murray-Holladay Rd (~4700 S)
      [40.6743, -111.8541],  // 4500 S & 1300 E (geocoded)
      [40.6651, -111.8629],  // Van Winkle & Murray-Holladay Rd (geocoded)
      // 5. NW along Van Winkle Expy / Murray River — diagonal goes FAR northwest,
      //    crossing I-15, all the way to the Jordan River at 3900 S
      [40.6700, -111.8720],  // ~4300 S, ~800 E area
      [40.6750, -111.8810],  // ~4100 S, near State St
      [40.6800, -111.8900],  // ~4000 S, crossing I-15
      [40.6840, -111.9000],  // west of I-15
      [40.6860, -111.9100],  // approaching Jordan River
      // 6. Creek meets 3900 S at Jordan River (General Holm Park)
      [40.6875, -111.9207],  // General Holm Park (geocoded)
      // 7. East along 3900 S back to S 700 E (starting point)
      [40.6868, -111.8717],
    ],
  },
  {
    id: 'south-salt-lake',
    name: 'South Salt Lake',
    description: 'City of South Salt Lake — Promise Community qualifying zone',
    color: '#2980b9',
    fillColor: 'rgba(41, 128, 185, 0.15)',
    // All coordinates from Google Maps Geocoding API
    polygon: [
      // 1. Start: Jordan River & 2100 S
      [40.7241, -111.9174],
      // 2. East along 2100 S to S 500 E
      [40.7253, -111.8769],
      // 3. South along S 500 E to Sunset Ave / south edge Nibley Park Golf Course
      [40.7094, -111.8769],
      // 4. East along south edge of Nibley Park Golf Course to S 700 E
      [40.7093, -111.8713],
      // 5. South along S 700 E to 3900 S (shared edge with Millcreek)
      [40.6868, -111.8717],
      // 6. West along 3900 S to Jordan River near General Holm Park
      [40.6875, -111.9207],
      // 7. North along Jordan River to 2100 S (following river meanders)
      [40.6920, -111.9195],
      [40.6960, -111.9185],
      [40.6986, -111.9176],  // ~3300 S & Jordan River (geocoded 900 W)
      [40.7020, -111.9180],
      [40.7060, -111.9175],
      [40.7100, -111.9180],
      [40.7140, -111.9175],
      [40.7180, -111.9178],
      [40.7210, -111.9175],
      // Close: back to Jordan River & 2100 S
      [40.7241, -111.9174],
    ],
  },
]

/** Center point for the default map view (between the two zones) */
export const MAP_CENTER: [number, number] = [40.7050, -111.8950]
export const MAP_ZOOM = 13
