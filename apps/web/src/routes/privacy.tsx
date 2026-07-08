import { createRoute } from '@tanstack/react-router';
import { Route as rootRoute } from './__root.tsx';
import { LegalPage } from '../components/legal/LegalPage.tsx';

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/privacy',
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
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
  );
}
