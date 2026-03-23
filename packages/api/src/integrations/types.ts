// ── Shared delivery platform integration types ─────────────────────────────

/** Supported delivery platforms */
export type PlatformKey = 'doordash' | 'uber_eats';

/** Menu item in platform-agnostic format for pushing to delivery services */
export interface PlatformMenuItem {
  externalId?: string;
  name: string;
  description?: string | null;
  price: number; // cents
  imageUrl?: string | null;
  active: boolean;
  categoryName: string;
  modifierGroups: PlatformModifierGroup[];
}

export interface PlatformModifierGroup {
  name: string;
  required: boolean;
  minSelections: number;
  maxSelections?: number | null;
  modifiers: PlatformModifier[];
}

export interface PlatformModifier {
  name: string;
  priceAdjustment: number; // cents
  active: boolean;
}

/** Full menu payload sent to a platform */
export interface PlatformMenuPayload {
  storeId: string;
  menuName: string;
  categories: PlatformCategory[];
}

export interface PlatformCategory {
  name: string;
  sortOrder: number;
  items: PlatformMenuItem[];
}

/** Result of a menu push operation */
export interface MenuPushResult {
  success: boolean;
  externalMenuId?: string;
  /** Platform-specific job/task ID for async operations */
  jobId?: string;
  error?: string;
}

/** Status of a previously submitted menu push */
export interface MenuPushStatus {
  status: 'pending' | 'processing' | 'success' | 'error';
  message?: string;
  completedAt?: string;
}

/** Credentials shape varies per platform, stored as JSON */
export interface DoorDashCredentials {
  developerId: string;
  keyId: string;
  signingSecret: string;
}

export interface UberEatsCredentials {
  clientId: string;
  clientSecret: string;
}

export type PlatformCredentials = DoorDashCredentials | UberEatsCredentials;

/**
 * Interface all delivery platform clients must implement.
 * Adding a new platform means implementing this interface
 * and registering it in the platform registry.
 */
export interface DeliveryPlatformClient {
  readonly platform: PlatformKey;

  /** Push a full menu to the platform. Returns a result with job tracking info. */
  pushMenu(payload: PlatformMenuPayload, credentials: PlatformCredentials): Promise<MenuPushResult>;

  /** Poll the status of a previously submitted menu push. */
  getMenuStatus(jobId: string, credentials: PlatformCredentials): Promise<MenuPushStatus>;

  /** Validate that the provided credentials are valid (e.g. test auth). */
  validateCredentials(
    credentials: PlatformCredentials,
    storeId: string,
  ): Promise<{ valid: boolean; error?: string }>;
}
