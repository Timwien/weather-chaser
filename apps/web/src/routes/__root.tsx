import { lazy, Suspense } from 'react';
import { createRootRoute, Outlet } from '@tanstack/react-router';
import { ConsentBanner } from '../components/consent/ConsentBanner.tsx';
import { useFeedbackStore } from '../stores/feedbackStore.ts';

// Only fetched the first time the modal is opened (named export → default for React.lazy).
const FeedbackModal = lazy(() =>
  import('../components/feedback/FeedbackModal.tsx').then((m) => ({ default: m.FeedbackModal })),
);

function RootLayout() {
  const modalOpen = useFeedbackStore((s) => s.modalOpen);
  return (
    <>
      <Outlet />
      <ConsentBanner />
      {/* Mounted at the root so it can be opened from anywhere (proactive
          prompt, entry footer). */}
      {modalOpen && (
        <Suspense fallback={null}>
          <FeedbackModal />
        </Suspense>
      )}
    </>
  );
}

export const Route = createRootRoute({
  component: RootLayout,
});
