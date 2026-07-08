import { createRoute } from '@tanstack/react-router';
import { Route as rootRoute } from './__root.tsx';
import { LegalPage } from '../components/legal/LegalPage.tsx';

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tos',
  component: TosPage,
});

function TosPage() {
  return (
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
  );
}
