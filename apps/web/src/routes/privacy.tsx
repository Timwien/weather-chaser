import { lazy, Suspense } from 'react';
import { createRoute } from '@tanstack/react-router';
import { Route as rootRoute } from './__root.tsx';
// Legal pages are rarely visited — keep them out of the main bundle.
const LegalPage = lazy(() =>
  import('../components/legal/LegalPage.tsx').then((m) => ({ default: m.LegalPage })),
);

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/privacy',
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <Suspense fallback={null}>
      <LegalPage
        titleKey="legal.privacy_title"
        updatedKey="legal.updated"
        introKey="legal.privacy_intro"
        sections={[
          { h: 'legal.privacy_controller_h', b: 'legal.privacy_controller_b' },
          { h: 'legal.privacy_hosting_h', b: 'legal.privacy_hosting_b' },
          { h: 'legal.privacy_account_h', b: 'legal.privacy_account_b' },
          { h: 'legal.privacy_analytics_h', b: 'legal.privacy_analytics_b' },
          { h: 'legal.privacy_apis_h', b: 'legal.privacy_apis_b' },
          { h: 'legal.privacy_storage_h', b: 'legal.privacy_storage_b' },
          { h: 'legal.privacy_rights_h', b: 'legal.privacy_rights_b' },
        ]}
      />
    </Suspense>
  );
}
