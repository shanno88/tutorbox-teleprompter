/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PADDLE_CLIENT_TOKEN: string;
  readonly VITE_PADDLE_ENVIRONMENT?: 'sandbox' | 'production';
  readonly VITE_DEEPSEEK_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  webkitAudioContext?: typeof AudioContext;
  Paddle?: any;
}

declare module './store/subscriptionSlice.js' {
  import { ActionCreatorWithoutPayload, ActionCreatorWithPayload } from '@reduxjs/toolkit';
  export const setSubscriptionStatus: ActionCreatorWithPayload<any>;
  export const incrementCreditsUsed: ActionCreatorWithoutPayload;
  export const resetDailyCredits: ActionCreatorWithoutPayload;
  export const setLoading: ActionCreatorWithPayload<boolean>;
  export const setError: ActionCreatorWithPayload<string | null>;
  const reducer: any;
  export default reducer;
}

declare module './store/index.js' {
  import { Store } from '@reduxjs/toolkit';
  const store: Store;
  export default store;
}

declare module './components/SubscriptionButton.jsx' {
  import { FunctionComponent } from 'react';
  interface SubscriptionButtonProps {
    subscription: any;
    onUpgrade: () => void;
  }
  const SubscriptionButton: FunctionComponent<SubscriptionButtonProps>;
  export default SubscriptionButton;
}

declare module './components/UpgradeModal.jsx' {
  import { FunctionComponent } from 'react';
  interface UpgradeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubscribe: (planId: string) => Promise<void>;
  }
  const UpgradeModal: FunctionComponent<UpgradeModalProps>;
  export default UpgradeModal;
}
