import { createRouter, RouterProvider } from '@tanstack/react-router';
import { Route as rootRoute } from './routes/__root.tsx';
import { Route as indexRoute } from './routes/index.tsx';
import { Route as tripRoute } from './routes/trip.tsx';
import { Route as privacyRoute } from './routes/privacy.tsx';
import { Route as tosRoute } from './routes/tos.tsx';
import { Route as imprintRoute } from './routes/imprint.tsx';
import { StatusPage } from './components/common/StatusPage.tsx';

const routeTree = rootRoute.addChildren([indexRoute, tripRoute, privacyRoute, tosRoute, imprintRoute]);

const router = createRouter({
  routeTree,
  defaultNotFoundComponent: () => (
    <StatusPage titleKey="errors.not_found_title" textKey="errors.not_found_text" />
  ),
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

export function App() {
  return <RouterProvider router={router} />;
}
