import { createRoute } from '@tanstack/react-router';
import { Route as rootRoute } from './__root.tsx';
import { MapContainer } from '../components/map/MapContainer.tsx';

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: IndexPage,
});

function IndexPage() {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <MapContainer />
    </div>
  );
}
