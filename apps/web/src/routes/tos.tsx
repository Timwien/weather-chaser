import { lazy, Suspense } from 'react';
import { createRoute } from '@tanstack/react-router';
import { Route as rootRoute } from './__root.tsx';
// Legal pages are rarely visited — keep them out of the main bundle.
const LegalPage = lazy(() =>
  import('../components/legal/LegalPage.tsx').then((m) => ({ default: m.LegalPage })),
);

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tos',
  component: TosPage,
});

function TosPage() {
  return (
    <Suspense fallback={null}>
      <LegalPage
        titleKey="legal.tos_title"
        updatedKey="legal.updated"
        introKey="legal.tos_intro"
        sections={[
          { h: 'legal.tos_use_h', b: 'legal.tos_use_b' },
          { h: 'legal.tos_weather_h', b: 'legal.tos_weather_b' },
          { h: 'legal.tos_account_h', b: 'legal.tos_account_b' },
          { h: 'legal.tos_liability_h', b: 'legal.tos_liability_b' },
          { h: 'legal.tos_changes_h', b: 'legal.tos_changes_b' },
        ]}
      />
    </Suspense>
  );
}
