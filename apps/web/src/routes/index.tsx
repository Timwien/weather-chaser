import { createRoute } from '@tanstack/react-router';
import { Route as rootRoute } from './__root.tsx';
import { MapContainer } from '../components/map/MapContainer.tsx';
import { EntryPanel } from '../components/entry/EntryPanel.tsx';
import { LoadingOverlay } from '../components/loading/LoadingOverlay.tsx';
import { useAppStore } from '../stores/appStore.ts';

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: IndexPage,
});

function IndexPage() {
  const { setSearchArea } = useAppStore();

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <MapContainer
        onDrawComplete={(polygon) => setSearchArea({ type: 'polygon', polygon })}
        onDrawClear={() => setSearchArea(null)}
      />
      <EntryPanel />
      <LoadingOverlay />
    </div>
  );
}
