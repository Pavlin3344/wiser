import { useEffect, useState } from "react"
import { Globe, Compass, MapPin, Navigation } from "lucide-react"

import { useFilterStore } from "@/store/use-filter-store"
import { useMapStore, type MapStatus } from "@/store/use-map-store"
import { Button } from "@/components/ui/button"
import { Breadcrumb, BreadcrumbEllipsis, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

const BULGARIAN_CITIES = [
    { name: "Sofia", lat: 42.6977, lng: 23.3219 },
    { name: "Plovdiv", lat: 42.1354, lng: 24.7453 },
    { name: "Varna", lat: 43.2141, lng: 27.9147 },
    { name: "Burgas", lat: 42.5048, lng: 27.4626 },
    { name: "Ruse", lat: 43.8356, lng: 25.9657 },
    { name: "Stara Zagora", lat: 42.4258, lng: 25.6345 },
    { name: "Pleven", lat: 43.4170, lng: 24.6067 },
    { name: "Veliko Tarnovo", lat: 43.0757, lng: 25.6172 },
]

export function SpatialContext() {
    const { region, setRegion } = useFilterStore()
    const { setFlyToTarget } = useMapStore()

    const [dynamicLocation, setDynamicLocation] = useState<{
        city: string | null
        zoom: number
        lat: number
        lng: number
    } | null>(null)

    useEffect(() => {
        const updateDynamicLocation = (status: MapStatus) => {
            const { lat, lng, zoom } = status

            let detectedRegion: "world" | "europe" | "bulgaria" = "world"
            if (zoom >= 6.0 && lat >= 41.0 && lat <= 44.5 && lng >= 22.0 && lng <= 29.0) {
                detectedRegion = "bulgaria"
            } else if (zoom >= 3.5 && lat >= 34.0 && lat <= 71.0 && lng >= -15.0 && lng <= 45.0) {
                detectedRegion = "europe"
            }

            if (useFilterStore.getState().region !== detectedRegion) {
                setRegion(detectedRegion)
            }

            if (zoom >= 9.5) {
                let closestCity = null
                let minDistance = 0.4
                for (const city of BULGARIAN_CITIES) {
                    const dist = Math.sqrt(Math.pow(lat - city.lat, 2) + Math.pow(lng - city.lng, 2))
                    if (dist < minDistance) {
                        minDistance = dist
                        closestCity = city
                    }
                }
                setDynamicLocation({
                    city: closestCity ? closestCity.name : null,
                    zoom,
                    lat,
                    lng,
                })
            } else {
                setDynamicLocation(null)
            }
        }

        updateDynamicLocation(useMapStore.getState().mapStatus)

        return useMapStore.subscribe(
            (s) => s.mapStatus,
            (status) => {
                updateDynamicLocation(status)
            }
        )
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const handleWorldClick = () => {
        setRegion("world")
        setFlyToTarget({ lat: 20.0, lng: 0.0, zoom: 2.2 })
    }

    const handleEuropeClick = () => {
        setRegion("europe")
        setFlyToTarget({ lat: 48.0, lng: 15.0, zoom: 4.0 })
    }

    const handleBulgariaClick = () => {
        setRegion("bulgaria")
        setFlyToTarget({ lat: 42.7, lng: 25.3, zoom: 7.3 })
    }

    const handleLeafClick = () => {
        if (dynamicLocation) {
            setFlyToTarget({
                lat: dynamicLocation.lat,
                lng: dynamicLocation.lng,
                zoom: Math.min(12, dynamicLocation.zoom + 1),
            })
        }
    }

    return (
        <div className="w-fit relative pointer-events-auto bg-background/60 backdrop-blur-xl shadow-lg rounded-full border border-white/10 border-t-white/20 border-l-white/20 flex items-center h-10 px-3 transition-all duration-300 ease-in-out hover:bg-background/80">
            <div className="absolute inset-0 rounded-full bg-linear-to-br from-white/5 to-transparent pointer-events-none" />
            <Breadcrumb>
                <BreadcrumbList className="flex items-center gap-1 sm:gap-1.5 text-xs text-muted-foreground font-medium">
                    <BreadcrumbItem>
                        <BreadcrumbLink asChild>
                            <button
                                onClick={handleWorldClick}
                                className="cursor-pointer flex items-center gap-1 hover:text-foreground transition-colors"
                            >
                                <Globe className="h-3.5 w-3.5 transition-transform hover:scale-110" />
                                <span>World</span>
                            </button>
                        </BreadcrumbLink>
                    </BreadcrumbItem>
                    {dynamicLocation ? (
                        <>
                            <BreadcrumbSeparator />
                            <BreadcrumbItem>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button size="icon-sm" variant="ghost">
                                            <BreadcrumbEllipsis />
                                            <span className="sr-only">Toggle menu</span>
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" sideOffset={14} className="bg-background/60 backdrop-blur-xl shadow-lg rounded-2xl border border-white/10 border-t-white/20 border-l-white/20">
                                        <DropdownMenuGroup>
                                            <DropdownMenuItem onClick={handleEuropeClick} className="cursor-pointer">
                                                Europe
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={handleBulgariaClick} className="cursor-pointer">
                                                Bulgaria
                                            </DropdownMenuItem>
                                        </DropdownMenuGroup>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </BreadcrumbItem>
                            <BreadcrumbSeparator />
                            <BreadcrumbItem>
                                <BreadcrumbPage className="flex items-center gap-1.5 font-semibold text-foreground select-none">
                                    <Navigation
                                        className="h-3.5 w-3.5 text-destructive animate-pulse cursor-pointer"
                                        onClick={handleLeafClick}
                                    />
                                    <button
                                        onClick={handleLeafClick}
                                        className="cursor-pointer hover:text-destructive transition-colors text-left"
                                    >
                                        {dynamicLocation.city
                                            ? `${dynamicLocation.city}`
                                            : `${dynamicLocation.lat.toFixed(2)}°N, ${dynamicLocation.lng.toFixed(2)}°E`}
                                    </button>
                                </BreadcrumbPage>
                            </BreadcrumbItem>
                        </>
                    ) : (
                        <>
                            {(region === "europe" || region === "bulgaria") && (
                                <>
                                    <BreadcrumbSeparator />
                                    <BreadcrumbItem>
                                        {region === "europe" ? (
                                            <BreadcrumbPage className="flex items-center gap-1.5 font-semibold text-foreground">
                                                <Compass className="h-3.5 w-3.5 text-destructive" />
                                                <span>Europe</span>
                                            </BreadcrumbPage>
                                        ) : (
                                            <BreadcrumbLink asChild>
                                                <button
                                                    onClick={handleEuropeClick}
                                                    className="cursor-pointer flex items-center gap-1 hover:text-foreground transition-colors"
                                                >
                                                    <Compass className="h-3.5 w-3.5 transition-transform hover:scale-110" />
                                                    <span>Europe</span>
                                                </button>
                                            </BreadcrumbLink>
                                        )}
                                    </BreadcrumbItem>
                                </>
                            )}
                            {region === "bulgaria" && (
                                <>
                                    <BreadcrumbSeparator />
                                    <BreadcrumbItem>
                                        <BreadcrumbPage className="flex items-center gap-1.5 font-semibold text-foreground">
                                            <MapPin className="h-3.5 w-3.5 text-destructive" />
                                            <span>Bulgaria</span>
                                        </BreadcrumbPage>
                                    </BreadcrumbItem>
                                </>
                            )}
                        </>
                    )}
                </BreadcrumbList>
            </Breadcrumb>
        </div>
    )
}