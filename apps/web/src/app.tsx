import { createRouter, RouterProvider } from '@tanstack/react-router';
import { Route as rootRoute } from './routes/__root.tsx';
import { Route as indexRoute } from './routes/index.tsx';
import { Route as tripRoute } from './routes/trip.tsx';
import { Route as privacyRoute } from './routes/privacy.tsx';
import { Route as tosRoute } from './routes/tos.tsx';

const routeTree = rootRoute.addChildren([indexRoute, tripRoute, privacyRoute, tosRoute]);

const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

export function App() {
  return <RouterProvider router={router} />;
}
