import { createRoute, lazyRouteComponent } from '@tanstack/react-router';
import { Route as rootRoute } from './__root.tsx';

// The share-link view (map + itinerary) is split into its own chunk; the router
// suspends the match while it loads.
export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/trip',
  component: lazyRouteComponent(() => import('./TripPage.tsx'), 'TripPage'),
});
