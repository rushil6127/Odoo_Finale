export interface PosTable {
  id: number;
  table_number: string;
  name: string | null;
  capacity: number;
  status: "AVAILABLE" | "OCCUPIED" | "RESERVED" | "OUT_OF_SERVICE";
  is_active: boolean;
  current_tab: PosTab | null;
}

export interface PosMenuCategory {
  id: number;
  name: string;
  slug: string;
  display_order: number;
  is_active: boolean;
}

export interface PosMenuItem {
  id: number;
  category_id: number;
  category_name: string | null;
  category_slug: string | null;
  code: string;
  name: string;
  description: string | null;
  price: number;
  tax_rate: number;
  is_available: boolean;
  is_active: boolean;
  preparation_time_minutes: number;
}

export interface PosTabItem {
  id: number;
  tab_id: number;
  menu_item_id: number;
  item_name: string;
  unit_price: number;
  quantity: number;
  discount_pct: number;
  discount_amount: number;
  tax_rate: number;
  tax_amount: number;
  subtotal_amount: number;
  total_amount: number;
  kitchen_status: "PENDING" | "QUEUED" | "PREPARING" | "READY" | "SERVED" | "CANCELLED";
  notes: string | null;
}

export interface PosTab {
  id: number;
  tab_reference: string;
  table_id: number;
  table_number: string | null;
  shift_id: number;
  shift_reference: string | null;
  opened_by_user_id: number;
  opened_by_name: string | null;
  member_id: number | null;
  customer_name: string | null;
  status: "OPEN" | "PAID" | "CLOSED" | "VOIDED";
  subtotal_amount: number;
  discount_amount: number;
  discount_pct: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  payment_status: "UNPAID" | "PARTIALLY_PAID" | "PAID" | "REFUNDED";
  payment_method: string | null;
  items?: PosTabItem[];
}

export interface CartItem extends PosMenuItem {
  qty: number;
}
