export type Role = 'owner' | 'admin' | 'operator' | 'viewer';
export type Product = {
  id: string; sku: string; name: string; unit: string; selling_price: number; reorder_level: number;
  active: boolean; category_id: string | null; stock: number; stock_value: number;
};
export type Supplier = { id: string; name: string; phone: string | null; active: boolean };
export type Category = { id: string; name: string; active: boolean };
export type Summary = {
  orders: number; units: number; gross_sales: number; discounts: number; net_revenue: number; cogs: number; selling_fees: number;
  shipping: number; gross_profit: number; expenses_total: number; net_profit: number; purchases_total: number;
};
export const CHANNELS = ['Website', 'Amazon', 'Flipkart', 'Meesho', 'Blinkit', 'Offline', 'Instagram / WhatsApp', 'Other'];
export const EXPENSE_CATEGORIES = ['Packaging', 'Shipping & courier', 'Marketing & ads', 'Rent', 'Salaries', 'Software & tools', 'Utilities', 'Travel', 'Taxes & fees', 'Other'];
