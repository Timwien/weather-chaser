import { lazy, Suspense } from 'react';
import { createRoute } from '@tanstack/react-router';
import { Route as rootRoute } from './__root.tsx';
import { loadLegalNamespace } from '../i18n/index.ts';
// Legal pages are rarely visited — keep them and their texts out of the main bundle.
const LegalPage = lazy(() =>
  Promise.all([import('../components/legal/LegalPage.tsx'), loadLegalNamespace()]).then(([m]) => ({
    default: m.LegalPage,
  })),
);

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tos',
  component: TosPage,
});

function TosPage() {
  return (
    <Suspense fallback={null}>
      <LegalPage doc="tos" />
    </Suspense>
  );
}
