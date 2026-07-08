import { createRootRoute, Outlet } from '@tanstack/react-router';
import { FeedbackModal } from '../components/feedback/FeedbackModal.tsx';

export const Route = createRootRoute({
  // FeedbackModal is mounted once at the root so it can be opened from
  // anywhere (proactive prompt, entry footer).
  component: () => (
    <>
      <Outlet />
      <FeedbackModal />
    </>
  ),
});
