import { useEffect, useState } from "react"
import { Globe, Compass, MapPin, Navigation } from "lucide-react"

import { useMapStore, type MapStatus } from "@/store/use-map-store"
import { Button } from "@/components/ui/button"
import { Breadcrumb, BreadcrumbEllipsis, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

export function SpatialContext() {
    const { setFlyToTarget } = useMapStore()

    const [spatialLocation, setSpatialLocation] = useState<{
        continent: string | null
        country: string | null
        city: string | null
        zoom: number
        lat: number
        lng: number
    } | null>(null)

    useEffect(() => {
        let debounceTimer: ReturnType<typeof setTimeout> | null = null

        const updateLocation = (status: MapStatus) => {
            const { lat, lng, zoom } = status

            if (zoom < 3.0) {
                if (debounceTimer) {
                    clearTimeout(debounceTimer)
                }
                setSpatialLocation(null)
                return
            }

            setSpatialLocation(prev => ({
                continent: prev ? prev.continent : null,
                country: prev ? prev.country : null,
                city: prev ? prev.city : null,
                zoom,
                lat,
                lng,
            }))

            if (debounceTimer) {
                clearTimeout(debounceTimer)
            }

            debounceTimer = setTimeout(async () => {
                try {
                    const response = await fetch(
                        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
                    )
                    if (response.ok) {
                        const data = await response.json()
                        setSpatialLocation({
                            continent: data.continent || null,
                            country: data.countryName || null,
                            city: data.city || data.locality || data.principalSubdivision || null,
                            zoom,
                            lat,
                            lng,
                        })
                    }
                } catch (error) {
                    console.error("Error geocoding:", error)
                }
            }, 600)
        }

        updateLocation(useMapStore.getState().mapStatus)

        const unsubscribe = useMapStore.subscribe(
            (s) => s.mapStatus,
            (status) => {
                updateLocation(status)
            }
        )

        return () => {
            if (debounceTimer) {
                clearTimeout(debounceTimer)
            }
            unsubscribe()
        }
    }, [])

    // These move the camera and nothing else. The breadcrumb is orientation, not a data
    // scope: zooming out to the world is allowed, it just shows no data outside Bulgaria.
    const handleWorldClick = () => {
        setFlyToTarget({ lat: 20.0, lng: 0.0, zoom: 2.2 })
    }

    const handleContinentClick = () => {
        if (spatialLocation) {
            setFlyToTarget({ lat: spatialLocation.lat, lng: spatialLocation.lng, zoom: 4.0 })
        }
    }

    const handleCountryClick = () => {
        if (spatialLocation) {
            setFlyToTarget({ lat: spatialLocation.lat, lng: spatialLocation.lng, zoom: 7.0 })
        }
    }

    const handleLeafClick = () => {
        if (spatialLocation) {
            setFlyToTarget({
                lat: spatialLocation.lat,
                lng: spatialLocation.lng,
                zoom: Math.min(12, spatialLocation.zoom + 1),
            })
        }
    }

    return (
        <div className="w-fit relative pointer-events-auto bg-background/60 backdrop-blur-xl shadow-lg rounded-full border border-white/10 border-t-white/20 border-l-white/20 flex items-center h-10 px-3 transition-all duration-300 ease-in-out hover:bg-background/80">
            <div className="absolute inset-0 rounded-full bg-linear-to-br from-white/5 to-transparent pointer-events-none" />
            <Breadcrumb>
                <BreadcrumbList className="flex items-center gap-1 sm:gap-1.5 text-xs text-muted-foreground font-medium">
                    <BreadcrumbItem>
                        {spatialLocation ? (
                            <BreadcrumbLink asChild>
                                <button
                                    onClick={handleWorldClick}
                                    className="cursor-pointer flex items-center gap-1 hover:text-foreground transition-colors"
                                >
                                    <Globe className="h-3.5 w-3.5 transition-transform hover:scale-110" />
                                    <span>World</span>
                                </button>
                            </BreadcrumbLink>
                        ) : (
                            <BreadcrumbPage className="flex items-center gap-1.5 font-semibold text-foreground">
                                <Globe className="h-3.5 w-3.5 text-destructive" />
                                <span>World</span>
                            </BreadcrumbPage>
                        )}
                    </BreadcrumbItem>

                    {spatialLocation && spatialLocation.continent && spatialLocation.zoom < 9.5 && (
                        <>
                            <BreadcrumbSeparator />
                            <BreadcrumbItem>
                                {spatialLocation.zoom < 6.0 ? (
                                    <BreadcrumbPage className="flex items-center gap-1.5 font-semibold text-foreground">
                                        <Compass className="h-3.5 w-3.5 text-destructive" />
                                        <span>{spatialLocation.continent}</span>
                                    </BreadcrumbPage>
                                ) : (
                                    <BreadcrumbLink asChild>
                                        <button
                                            onClick={handleContinentClick}
                                            className="cursor-pointer flex items-center gap-1 hover:text-foreground transition-colors"
                                        >
                                            <Compass className="h-3.5 w-3.5 transition-transform hover:scale-110" />
                                            <span>{spatialLocation.continent}</span>
                                        </button>
                                    </BreadcrumbLink>
                                )}
                            </BreadcrumbItem>
                        </>
                    )}

                    {spatialLocation && spatialLocation.country && spatialLocation.zoom >= 6.0 && spatialLocation.zoom < 9.5 && (
                        <>
                            <BreadcrumbSeparator />
                            <BreadcrumbItem>
                                <BreadcrumbPage className="flex items-center gap-1.5 font-semibold text-foreground">
                                    <MapPin className="h-3.5 w-3.5 text-destructive" />
                                    <span>{spatialLocation.country}</span>
                                </BreadcrumbPage>
                            </BreadcrumbItem>
                        </>
                    )}

                    {spatialLocation && spatialLocation.zoom >= 9.5 && (
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
                                            {spatialLocation.continent && (
                                                <DropdownMenuItem onClick={handleContinentClick} className="cursor-pointer">
                                                    {spatialLocation.continent}
                                                </DropdownMenuItem>
                                            )}
                                            {spatialLocation.country && (
                                                <DropdownMenuItem onClick={handleCountryClick} className="cursor-pointer">
                                                    {spatialLocation.country}
                                                </DropdownMenuItem>
                                            )}
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
                                        {spatialLocation.city
                                            ? spatialLocation.city
                                            : `${spatialLocation.lat.toFixed(2)}°N, ${spatialLocation.lng.toFixed(2)}°E`}
                                    </button>
                                </BreadcrumbPage>
                            </BreadcrumbItem>
                        </>
                    )}
                </BreadcrumbList>
            </Breadcrumb>
        </div>
    )
}