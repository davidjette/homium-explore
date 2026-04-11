import { useState, useRef, useCallback } from 'react'
import { MapContainer, TileLayer, Polygon, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import { point, polygon } from '@turf/helpers'
import { Container } from '../../design-system/Layout'
import { H1, H2, Body, Caption } from '../../design-system/Typography'
import { Button } from '../../design-system/Button'
import { PROMISE_ZONES, MAP_CENTER, MAP_ZOOM, type PromiseZone } from '../../data/promise-zones'
import 'leaflet/dist/leaflet.css'

// Fix Leaflet default marker icons (broken by bundlers)
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

const greenIcon = new L.Icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
  className: 'leaflet-marker-green',
})

const redIcon = new L.Icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
  className: 'leaflet-marker-red',
})

interface CheckResult {
  address: string
  lat: number
  lng: number
  inZone: boolean
  zoneName: string | null
  formattedAddress: string
}

function checkPointInZones(lat: number, lng: number): { inZone: boolean; zone: PromiseZone | null } {
  const pt = point([lng, lat]) // turf uses [lng, lat]
  for (const zone of PROMISE_ZONES) {
    const poly = polygon([zone.polygon.map(([la, ln]) => [ln, la])]) // convert to [lng, lat]
    if (booleanPointInPolygon(pt, poly)) {
      return { inZone: true, zone }
    }
  }
  return { inZone: false, zone: null }
}

/**
 * Expand abbreviated directionals in Utah grid-style addresses so Google
 * Maps doesn't transpose them. "2963 S 500 E" → "2963 South 500 East"
 */
function normalizeUtahAddress(address: string): string {
  const directionals: Record<string, string> = { N: 'North', S: 'South', E: 'East', W: 'West' }
  // Match: number + space + single directional letter + space + number + space + single directional letter
  // e.g. "2963 S 500 E" but not "500 State St"
  return address.replace(
    /(\d+)\s+([NSEW])\b\s+(\d+)\s+([NSEW])\b/gi,
    (_match, num1, dir1, num2, dir2) =>
      `${num1} ${directionals[dir1.toUpperCase()] ?? dir1} ${num2} ${directionals[dir2.toUpperCase()] ?? dir2}`,
  )
}

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number; formatted: string } | null> {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    throw new Error('Google Maps API key not configured. Add VITE_GOOGLE_MAPS_API_KEY to .env')
  }
  const normalized = normalizeUtahAddress(address)
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(normalized)}&key=${apiKey}`
  const resp = await fetch(url)
  const data = await resp.json()
  if (data.status === 'OK' && data.results.length > 0) {
    const result = data.results[0]
    return {
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      formatted: result.formatted_address,
    }
  }
  return null
}

/** Adjusts map bounds to fit all markers + zones */
function FitBounds({ results }: { results: CheckResult[] }) {
  const map = useMap()
  const prevCount = useRef(0)

  if (results.length > 0 && results.length !== prevCount.current) {
    prevCount.current = results.length
    const bounds = L.latLngBounds(results.map(r => [r.lat, r.lng]))
    // Also include zone polygons
    PROMISE_ZONES.forEach(z => z.polygon.forEach(([lat, lng]) => bounds.extend([lat, lng])))
    map.fitBounds(bounds, { padding: [40, 40] })
  }

  return null
}

export default function CheckAddress({ headline = 'UDF: Check Address' }: { headline?: string }) {
  const [mode, setMode] = useState<'single' | 'batch'>('single')
  const [address, setAddress] = useState('')
  const [batchText, setBatchText] = useState('')
  const [results, setResults] = useState<CheckResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSingleCheck = useCallback(async () => {
    if (!address.trim()) return
    setLoading(true)
    setError(null)
    try {
      const geo = await geocodeAddress(address.trim())
      if (!geo) {
        setError(`Could not geocode: "${address}"`)
        return
      }
      const { inZone, zone } = checkPointInZones(geo.lat, geo.lng)
      setResults([{
        address: address.trim(),
        lat: geo.lat,
        lng: geo.lng,
        inZone,
        zoneName: zone?.name ?? null,
        formattedAddress: geo.formatted,
      }])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Geocoding failed')
    } finally {
      setLoading(false)
    }
  }, [address])

  const handleBatchCheck = useCallback(async () => {
    const addresses = batchText.split('\n').map(a => a.trim()).filter(Boolean)
    if (addresses.length === 0) return
    setLoading(true)
    setError(null)
    const batchResults: CheckResult[] = []
    const errors: string[] = []

    for (const addr of addresses) {
      try {
        const geo = await geocodeAddress(addr)
        if (!geo) {
          errors.push(`Could not geocode: "${addr}"`)
          continue
        }
        const { inZone, zone } = checkPointInZones(geo.lat, geo.lng)
        batchResults.push({
          address: addr,
          lat: geo.lat,
          lng: geo.lng,
          inZone,
          zoneName: zone?.name ?? null,
          formattedAddress: geo.formatted,
        })
      } catch (e) {
        errors.push(`Error for "${addr}": ${e instanceof Error ? e.message : 'unknown'}`)
      }
    }

    setResults(batchResults)
    if (errors.length > 0) {
      setError(errors.join('\n'))
    }
    setLoading(false)
  }, [batchText])

  const handleExportCSV = useCallback(() => {
    if (results.length === 0) return
    const header = 'Address,Status,Zone,Latitude,Longitude,Formatted Address'
    const rows = results.map(r =>
      `"${r.address}","${r.inZone ? 'IN ZONE' : 'NOT IN ZONE'}","${r.zoneName ?? ''}",${r.lat},${r.lng},"${r.formattedAddress}"`
    )
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `promise-zone-check-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [results])

  const inCount = results.filter(r => r.inZone).length
  const outCount = results.filter(r => !r.inZone).length

  return (
    <div className="py-12">
      <Container>
        <div className="mb-8">
          <H1>{headline}</H1>
          <Body className="mt-2 text-lightGray">
            Verify whether addresses fall within Promise Community qualifying zones (Millcreek &amp; South Salt Lake).
          </Body>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-1 mb-6 bg-sectionAlt rounded-lg p-1 w-fit">
          <button
            onClick={() => { setMode('single'); setResults([]); setError(null) }}
            className={`px-4 py-2 rounded-md font-body text-sm font-medium transition-colors cursor-pointer ${
              mode === 'single' ? 'bg-white text-dark shadow-sm' : 'text-gray hover:text-dark'
            }`}
          >
            Single Address
          </button>
          <button
            onClick={() => { setMode('batch'); setResults([]); setError(null) }}
            className={`px-4 py-2 rounded-md font-body text-sm font-medium transition-colors cursor-pointer ${
              mode === 'batch' ? 'bg-white text-dark shadow-sm' : 'text-gray hover:text-dark'
            }`}
          >
            Batch Check
          </button>
        </div>

        {/* Input section */}
        <div className="bg-white border border-border rounded-lg p-6 mb-6">
          {mode === 'single' ? (
            <div className="flex gap-3">
              <input
                type="text"
                value={address}
                onChange={e => setAddress(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSingleCheck()}
                placeholder="Enter address (e.g., 3300 S 900 E, Millcreek, UT)"
                className="flex-1 px-4 py-3 border border-border rounded-lg font-body text-sm focus:outline-none focus:ring-2 focus:ring-green/30 focus:border-green"
              />
              <Button onClick={handleSingleCheck} disabled={loading || !address.trim()}>
                {loading ? 'Checking...' : 'Check'}
              </Button>
            </div>
          ) : (
            <div>
              <Caption className="mb-2 block text-lightGray">Paste addresses, one per line:</Caption>
              <textarea
                value={batchText}
                onChange={e => setBatchText(e.target.value)}
                placeholder={"3300 S 900 E, Millcreek, UT\n100 S Main St, Salt Lake City, UT\n2500 S State St, South Salt Lake, UT"}
                rows={6}
                className="w-full px-4 py-3 border border-border rounded-lg font-body text-sm focus:outline-none focus:ring-2 focus:ring-green/30 focus:border-green resize-y"
              />
              <div className="flex items-center gap-3 mt-3">
                <Button onClick={handleBatchCheck} disabled={loading || !batchText.trim()}>
                  {loading ? 'Checking...' : `Check ${batchText.split('\n').filter(a => a.trim()).length} Addresses`}
                </Button>
                {results.length > 0 && (
                  <button
                    onClick={handleExportCSV}
                    className="font-body text-sm text-green hover:text-greenDark transition-colors cursor-pointer underline"
                  >
                    Export CSV
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Error display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <pre className="font-body text-sm text-red-700 whitespace-pre-wrap">{error}</pre>
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div className="mb-6">
            {mode === 'single' && results.length === 1 && (
              <div className={`rounded-lg p-6 border-2 ${
                results[0].inZone
                  ? 'bg-green/5 border-green'
                  : 'bg-red-50 border-red-400'
              }`}>
                <div className="flex items-center gap-3 mb-2">
                  <span className={`inline-block px-3 py-1 rounded-full font-body text-sm font-bold text-white ${
                    results[0].inZone ? 'bg-green' : 'bg-red-500'
                  }`}>
                    {results[0].inZone ? 'IN ZONE' : 'NOT IN ZONE'}
                  </span>
                  {results[0].zoneName && (
                    <span className="font-body text-sm text-gray">{results[0].zoneName}</span>
                  )}
                </div>
                <Body className="text-dark font-medium">{results[0].formattedAddress}</Body>
                <Caption className="mt-1 text-lightGray">
                  {results[0].lat.toFixed(6)}, {results[0].lng.toFixed(6)}
                </Caption>
              </div>
            )}

            {mode === 'batch' && (
              <div>
                <div className="flex items-center gap-4 mb-3">
                  <H2 className="!text-lg">Results</H2>
                  <span className="font-body text-sm text-green font-medium">{inCount} in zone</span>
                  <span className="font-body text-sm text-red-500 font-medium">{outCount} not in zone</span>
                </div>
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-sectionAlt">
                        <th className="text-left px-4 py-2 font-body text-xs uppercase tracking-wider text-gray">Status</th>
                        <th className="text-left px-4 py-2 font-body text-xs uppercase tracking-wider text-gray">Address</th>
                        <th className="text-left px-4 py-2 font-body text-xs uppercase tracking-wider text-gray">Zone</th>
                        <th className="text-left px-4 py-2 font-body text-xs uppercase tracking-wider text-gray">Coordinates</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((r, i) => (
                        <tr key={i} className="border-t border-border">
                          <td className="px-4 py-3">
                            <span className={`inline-block px-2 py-0.5 rounded-full font-body text-xs font-bold text-white ${
                              r.inZone ? 'bg-green' : 'bg-red-500'
                            }`}>
                              {r.inZone ? 'IN' : 'OUT'}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-body text-sm text-dark">{r.formattedAddress}</td>
                          <td className="px-4 py-3 font-body text-sm text-gray">{r.zoneName ?? '—'}</td>
                          <td className="px-4 py-3 font-body text-xs text-lightGray">{r.lat.toFixed(5)}, {r.lng.toFixed(5)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Map */}
        <div className="border border-border rounded-lg overflow-hidden" style={{ height: 500 }}>
          <MapContainer
            center={MAP_CENTER}
            zoom={MAP_ZOOM}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {/* Zone polygons */}
            {PROMISE_ZONES.map(zone => (
              <Polygon
                key={zone.id}
                positions={zone.polygon}
                pathOptions={{
                  color: zone.color,
                  fillColor: zone.fillColor,
                  fillOpacity: 0.2,
                  weight: 3,
                  dashArray: '8, 6',
                }}
              >
                <Popup>
                  <strong>{zone.name}</strong><br />
                  {zone.description}
                </Popup>
              </Polygon>
            ))}
            {/* Result markers */}
            {results.map((r, i) => (
              <Marker
                key={i}
                position={[r.lat, r.lng]}
                icon={r.inZone ? greenIcon : redIcon}
              >
                <Popup>
                  <strong>{r.inZone ? 'IN ZONE' : 'NOT IN ZONE'}</strong>
                  {r.zoneName && <> — {r.zoneName}</>}<br />
                  {r.formattedAddress}
                </Popup>
              </Marker>
            ))}
            <FitBounds results={results} />
          </MapContainer>
        </div>

        {/* Zone legend */}
        <div className="mt-4 flex items-center gap-6">
          {PROMISE_ZONES.map(zone => (
            <div key={zone.id} className="flex items-center gap-2">
              <div className="w-4 h-3 rounded-sm border-2" style={{ borderColor: zone.color, backgroundColor: zone.fillColor }} />
              <Caption>{zone.name}</Caption>
            </div>
          ))}
        </div>
      </Container>

      {/* Marker color styles */}
      <style>{`
        .leaflet-marker-green { filter: hue-rotate(90deg); }
        .leaflet-marker-red { filter: hue-rotate(-30deg) saturate(2); }
      `}</style>
    </div>
  )
}
