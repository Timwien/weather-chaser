import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/authStore.ts';
import { useModalA11y } from '../../hooks/useModalA11y.ts';
import { AccountTab } from './AccountTab.tsx';
import { SavedTab } from './SavedTab.tsx';
import { SettingsTab } from './SettingsTab.tsx';
import { FeedbackForm } from '../feedback/FeedbackForm.tsx';
import './AccountModal.css';

type TabId = 'account' | 'saved' | 'settings' | 'feedback';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: TabId;
}

export function AccountModal({ isOpen, onClose, initialTab = 'account' }: AccountModalProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const user = useAuthStore((s) => s.user);
  const prevUserRef = useRef<typeof user>(user); // current user: mounting while signed in must not count as a sign-in

  const TABS: { id: TabId; label: string }[] = [
    { id: 'account', label: t('account.tab_account') },
    { id: 'saved', label: t('account.tab_saved') },
    { id: 'settings', label: t('account.tab_settings') },
    { id: 'feedback', label: t('account.tab_feedback') },
  ];

  // Close modal after successful sign-in (user goes from null to truthy)
  useEffect(() => {
    if (prevUserRef.current === null && user !== null) {
      onClose();
    }
    prevUserRef.current = user;
  }, [user, onClose]);

  // Reset tab when re-opened with initialTab
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  const dialogRef = useModalA11y(onClose, isOpen);

  if (!isOpen) return null;

  // Portal to <body>: inside the search panel an ancestor's transform/backdrop-filter
  // would make `position: fixed` relative to the panel instead of the viewport.
  return createPortal(
    <div
      className="account-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div ref={dialogRef} className="account-modal-panel" role="dialog" aria-modal="true" aria-label={t('account.tab_account')}>
        {/* Header row */}
        <div className="account-modal-header">
          <button
            type="button"
            className="account-modal-close"
            onClick={onClose}
            aria-label={t('account.close')}
          >
            ×
          </button>
        </div>

        {/* Tab bar */}
        <div className="account-modal-tabs" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`account-modal-tab${activeTab === tab.id ? ' account-modal-tab--active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="account-modal-content">
          {activeTab === 'account' && <AccountTab />}
          {activeTab === 'saved' && <SavedTab onClose={onClose} />}
          {activeTab === 'settings' && <SettingsTab onClose={onClose} />}
          {activeTab === 'feedback' && <FeedbackForm source="account_tab" />}
        </div>
      </div>
    </div>,
    document.body,
  );
}
