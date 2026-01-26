// Context and Provider
export { UpdateProvider, useUpdate } from './UpdateProvider';

// Components
export { UpdatePrompt } from './UpdatePrompt';
export { StoreUpdateModal } from './StoreUpdateModal';

// Hooks (for advanced usage)
export { useOtaUpdate } from './hooks/useOtaUpdate';
export { useStoreUpdate } from './hooks/useStoreUpdate';

// Utils (for testing)
export { compareVersions, isVersionLessThan } from './utils/version';
