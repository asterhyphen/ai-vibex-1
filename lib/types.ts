// ============================================================
// SkipQ — TypeScript Types (mirrors DB schema exactly)
// ============================================================

export type UserRole = 'student' | 'faculty' | 'shopkeeper' | 'admin'
export type Counter = 'canteen' | 'print'
export type OrderSource = 'app' | 'guest'
export type OrderStatus =
  | 'placed'
  | 'awaiting_cash'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'collected'
  | 'cancelled'
  | 'rejected'
export type PaymentMethod = 'online' | 'cash'
export type PaymentStatus = 'pending' | 'paid' | 'refunded'
export type PrintStatus =
  | 'uploaded'
  | 'paid'
  | 'printing'
  | 'ready'
  | 'collected'
  | 'rejected'
export type PaperSize = 'A4' | 'A3'
export type NotificationKind = 'info' | 'success' | 'warning' | 'error'

export interface Profile {
  id: string
  user_id: string
  full_name: string | null
  role: UserRole
  phone: string | null
  phone_verified: boolean
  department: string | null
  is_blocked: boolean
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface StaffAccount {
  id: string
  user_id: string
  display_name: string | null
  counter: Counter
  active: boolean
  last_login_at: string | null
  created_at: string
  updated_at: string
}

export interface LoginAttempt {
  id: string
  email: string
  attempts: number
  locked_until: string | null
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  name: string
  sort_order: number
  icon: string | null
  created_at: string
  updated_at: string
}

export interface MenuItem {
  id: string
  category_id: string
  name: string
  description: string | null
  price_paise: number
  prep_seconds: number
  in_stock: boolean
  image_url: string | null
  tags: string[]
  is_active: boolean
  load_weight: number
  created_at: string
  updated_at: string
}

export interface PickupSlot {
  id: string
  slot_start: string
  slot_end: string
  capacity_units: number
  used_units: number
  created_at: string
  updated_at: string
}

export interface Order {
  id: string
  code: string
  user_id: string | null
  guest_name: string | null
  guest_token: string | null
  source: OrderSource
  status: OrderStatus
  payment_method: PaymentMethod | null
  payment_status: PaymentStatus
  total_paise: number | null
  cash_received_paise: number | null
  change_given_paise: number | null
  slot_id: string | null
  eta_minutes: number | null
  arrive_at: string | null
  priority_score: number | null
  is_faculty: boolean
  qr_token: string | null
  collected_at: string | null
  note: string | null
  rejected_reason: string | null
  no_show: boolean
  created_at: string
  updated_at: string
}

export interface OrderItem {
  id: string
  order_id: string
  menu_item_id: string | null
  name_snapshot: string
  qty: number
  unit_price_paise: number
  created_at: string
  updated_at: string
}

export interface PrintJob {
  id: string
  user_id: string | null
  guest_name: string | null
  file_path: string | null
  original_name: string | null
  pages: number | null
  color: boolean
  double_sided: boolean
  copies: number
  paper: PaperSize
  cost_paise: number | null
  status: PrintStatus
  payment_method: PaymentMethod | null
  payment_status: PaymentStatus
  qr_token: string | null
  sanitised: boolean
  created_at: string
  updated_at: string
}

export interface Notification {
  id: string
  user_id: string
  title: string
  body: string | null
  kind: NotificationKind
  read: boolean
  created_at: string
  updated_at: string
}

export interface SmsLog {
  id: string
  phone: string
  body: string
  kind: string
  created_at: string
  updated_at: string
}

export interface Setting {
  id: string
  key: string
  value: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface AuditLog {
  id: string
  actor_id: string | null
  action: string
  table_name: string | null
  row_id: string | null
  diff: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

// ── Joined / convenience types ─────────────────────────────

export interface MenuItemWithCategory extends MenuItem {
  category: Category
}

export interface OrderWithItems extends Order {
  order_items: OrderItem[]
  pickup_slot?: PickupSlot | null
}

export interface CartItem {
  menu_item: MenuItem
  qty: number
}
