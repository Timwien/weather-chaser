import { createRouter, RouterProvider } from '@tanstack/react-router';
import { Route as rootRoute } from './routes/__root.tsx';
import { Route as indexRoute } from './routes/index.tsx';
import { Route as tripRoute } from './routes/trip.tsx';

const routeTree = rootRoute.addChildren([indexRoute, tripRoute]);

const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

export function App() {
  return <RouterProvider router={router} />;
}
