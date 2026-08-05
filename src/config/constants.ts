export const ORDER_STATUS = ['placed', 'preparing', 'ready', 'served'] as const;
export type OrderStatus = (typeof ORDER_STATUS)[number];

export const STAFF_ROLES = ['owner', 'branch_manager', 'manager', 'kitchen', 'editor'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const MODIFIER_GROUP_TYPES = ['variant', 'add_on'] as const;
export type ModifierGroupType = (typeof MODIFIER_GROUP_TYPES)[number];

export const DISCOUNT_TYPES = ['percentage', 'fixed'] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

export const PAYMENT_METHODS = ['cash', 'card', 'wallet'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const SUBSCRIPTION_STATUS = ['active', 'past_due', 'cancelled'] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUS)[number];

// Forward-only kitchen transitions
export const STATUS_FLOW: Record<string, string | null> = {
  placed: 'preparing',
  preparing: 'ready',
  ready: 'served',
  served: null,
};

export const ROUND_MERGE_WINDOW_MS = 5 * 60 * 1000; // ADR-05
export const SESSION_TTL_HOURS = 4; // matches join_table_session
