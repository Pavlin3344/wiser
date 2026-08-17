import { render, screen } from "@testing-library/react"
import { vi } from "vitest"

import { AirQualityPanel } from "@/pages/phase2/AirQualityPanel"
import { fetchAirQualityHistory, fetchLatestAirQuality } from "@/services/airQualityService"
import { useMapStore } from "@/store/use-map-store"

vi.mock("@/services/airQualityService", () => ({
  fetchLatestAirQuality: vi.fn(),
  fetchAirQualityHistory: vi.fn(),
}))

const reading = (lat: number, lon: number, pm25: number, pm10: number, no2: number, co: number) => ({
  time: "2026-08-17T12:00:00Z",
  lat,
  lon,
  source: "open-meteo-cams",
  pm25,
  pm10,
  no2,
  co,
})

describe("AirQualityPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fetchAirQualityHistory).mockResolvedValue([])
  })

  it("averages the sampling points and bands the worst pollutant", async () => {
    vi.mocked(fetchLatestAirQuality).mockResolvedValue([
      reading(41.6, 23.0, 10, 30, 10, 200),
      reading(43.0, 25.0, 20, 50, 20, 100),
    ])

    render(<AirQualityPanel />)

    // PM2.5 and NO2 both average to 15.0; PM10 averages to 40.0 and CO to 150.
    expect(await screen.findByText("40.0")).toBeInTheDocument()
    expect(screen.getAllByText("15.0")).toHaveLength(2)
    expect(screen.getByText("150")).toBeInTheDocument()

    // PM10 at 40 is Moderate while the other two are Good/Fair, and the European
    // index reports the worst sub-index rather than an average of them.
    expect(screen.getByText("Moderate")).toBeInTheDocument()
    expect(screen.getByText(/Country-wide mean of 2 sampling points/)).toBeInTheDocument()
  })

  it("offers the worst point as a map destination", async () => {
    vi.mocked(fetchLatestAirQuality).mockResolvedValue([
      reading(41.6, 23.0, 12, 30, 10, 200),
      reading(43.0, 25.0, 48, 50, 20, 100),
    ])

    render(<AirQualityPanel />)

    const hotspot = await screen.findByRole("button", { name: /Highest PM2.5/ })
    hotspot.click()

    expect(useMapStore.getState().flyToTarget).toEqual({ lat: 43.0, lng: 25.0, zoom: 9 })
  })

  it("reports a missing pollutant instead of showing it as zero", async () => {
    vi.mocked(fetchLatestAirQuality).mockResolvedValue([
      { time: "2026-08-17T12:00:00Z", lat: 41.6, lon: 23.0, source: "open-meteo-cams", pm25: 12, pm10: 30, no2: null, co: null },
    ])

    render(<AirQualityPanel />)

    expect(await screen.findByText("12.0")).toBeInTheDocument()
    expect(screen.getAllByText("—")).toHaveLength(2)
  })

  it("says the feed is unavailable when the backend does not respond", async () => {
    vi.mocked(fetchLatestAirQuality).mockRejectedValue(new Error("HTTP error 503"))
    vi.spyOn(console, "warn").mockImplementation(() => {})

    render(<AirQualityPanel />)

    expect(await screen.findByText("Air quality feed unavailable")).toBeInTheDocument()
  })

  it("distinguishes an empty feed from a broken one", async () => {
    vi.mocked(fetchLatestAirQuality).mockResolvedValue([])

    render(<AirQualityPanel />)

    expect(await screen.findByText("No readings in the last 24 hours")).toBeInTheDocument()
  })
})
