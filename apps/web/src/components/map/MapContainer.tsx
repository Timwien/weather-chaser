import { Map } from '@vis.gl/react-maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { DrawingControls } from './DrawingControls.tsx';
import './MapContainer.css';

// OpenStreetMap-based free tile style from MapLibre demo
// Using MapLibre's demo tiles — no token required for development
// Production: point to self-hosted or tile provider (Phase 3)
const MAP_STYLE = 'https://demotiles.maplibre.org/style.json';

interface MapContainerProps {
  onDrawComplete?: (polygon: [number, number][]) => void;
  onDrawClear?: () => void;
}

export function MapContainer({ onDrawComplete, onDrawClear }: MapContainerProps) {
  return (
    <div className="map-root">
      <Map
        initialViewState={{
          longitude: 10.4515,
          latitude: 51.1657,
          zoom: 5.5,
        }}
        mapStyle={MAP_STYLE}
        style={{ width: '100%', height: '100%' }}
      >
        {/* DrawingControls must live inside <Map> so useMap() has a provider */}
        {onDrawComplete && onDrawClear && (
          <DrawingControls
            onPolygonComplete={onDrawComplete}
            onClear={onDrawClear}
          />
        )}
      </Map>
    </div>
  );
}
