import { Source, Layer } from '@vis.gl/react-maplibre';
import type { Route } from '@weatherchaser/core';

interface RouteLayerProps { route: Route; }

function scoreColor(value: number): string {
  const hue = Math.round((Math.min(Math.max(value, 0), 100) / 100) * 120);
  return `hsl(${hue}, 65%, 45%)`;
}

export function RouteLayer({ route }: RouteLayerProps) {
  // Build one GeoJSON Feature per leg (stop[i] → stop[i+1])
  // Each leg colored by the destination stop's score
  const features = route.stops.slice(0, -1).map((stop, i) => {
    const next = route.stops[i + 1];
    return {
      type: 'Feature' as const,
      properties: { color: scoreColor(next.score.composite) },
      geometry: {
        type: 'LineString' as const,
        coordinates: [
          [stop.town.lng, stop.town.lat],
          [next.town.lng, next.town.lat],
        ],
      },
    };
  });

  const geojson = { type: 'FeatureCollection' as const, features };

  return (
    <Source id="route-segments" type="geojson" data={geojson}>
      <Layer
        id="route-line"
        type="line"
        paint={{
          'line-color': ['get', 'color'],
          'line-width': 4,
          'line-opacity': 0.85,
        }}
        layout={{ 'line-join': 'round', 'line-cap': 'round' }}
      />
    </Source>
  );
}
