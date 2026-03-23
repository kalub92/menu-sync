export { buildMenuSnapshot, computeChecksum } from './snapshot.js';
export type { MenuSnapshot, CategorySnapshot, ItemSnapshot } from './snapshot.js';

export { diffMenuSnapshots } from './diff.js';
export type { MenuDiff, EntityChange, FieldChange, ChangeType } from './diff.js';

export {
  syncMenuToConnection,
  syncMenuToAllPlatforms,
  enqueueSyncJob,
  processJobQueue,
} from './orchestrator.js';
export type { SyncRequest, SyncResult, BulkSyncResult, SyncTrigger } from './orchestrator.js';
