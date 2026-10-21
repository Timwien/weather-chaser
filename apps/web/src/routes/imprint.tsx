import { lazy, Suspense } from 'react';
import { createRoute } from '@tanstack/react-router';
import { Route as rootRoute } from './__root.tsx';
// Legal pages are rarely visited — keep them out of the main bundle.
const LegalPage = lazy(() =>
  import('../components/legal/LegalPage.tsx').then((m) => ({ default: m.LegalPage })),
);

// German "Impressum" (§ 5 DDG, § 18 MStV) — required for the DE market.
export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/impressum',
  component: ImprintPage,
});

function ImprintPage() {
  return (
    <Suspense fallback={null}>
      <LegalPage
        titleKey="legal.imprint_title"
        updatedKey="legal.updated"
        introKey="legal.imprint_intro"
        sections={[
          { h: 'legal.imprint_operator_h', b: 'legal.imprint_operator_b' },
          { h: 'legal.imprint_contact_h', b: 'legal.imprint_contact_b' },
          { h: 'legal.imprint_responsible_h', b: 'legal.imprint_responsible_b' },
          { h: 'legal.imprint_dispute_h', b: 'legal.imprint_dispute_b' },
          { h: 'legal.imprint_sources_h', b: 'legal.imprint_sources_b' },
        ]}
      />
    </Suspense>
  );
}
