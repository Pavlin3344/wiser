import { MapContainer } from "@/components/map/map-container";
import { useMapStore } from "@/store/use-map-store";

function App() {
  const { mapView, basemap, showFires } = useMapStore();

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Wildfire Project</p>
      <div className="absolute inset-0 z-0">
        <MapContainer
          basemap={basemap}
          mapView={mapView}
          showFires={showFires}
        />
      </div>
    </div>
  );
}

export default App;
