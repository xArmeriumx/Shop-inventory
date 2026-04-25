import {
    LayoutDashboard,
    FileText,
    ShoppingCart,
    Send,
    PackageCheck,
    RotateCcw,
    Receipt,
    Package,
    Truck,
    ArrowRightLeft,
    ClipboardCheck,
    ClipboardList,
    Users,
    Wallet,
    TrendingUp,
    CheckCircle2,
    Sparkles,
    BarChart3,
    Settings,
    HelpCircle,
    ShieldCheck,
    Library,
    Activity,
    Bell,
    Building2,
    Calculator,
    History,
    UserCircle,
    Shield,
    CreditCard,
    Key
} from 'lucide-react';
import { Permission } from '@prisma/client';

export interface NavItem {
    title: string;
    href: string;
    icon: any;
    permission?: Permission;
    id?: string;
    salesFlowMode?: 'ERP' | 'RETAIL';
    isDivider?: boolean;
}

export interface NavGroup {
    groupName: string;
    items: NavItem[];
}

// ==================== Main Sidebar Config (Daily Ops) ====================

export const mainNavGroups: NavGroup[] = [
    {
        groupName: '', // Top level items
        items: [
            { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, id: 'sidebar-dashboard' },
            { title: 'AI ผู้ช่วย', href: '/ai', icon: Sparkles, id: 'sidebar-ai' },
            { title: 'แจ้งเตือนระบบ', href: '/system/notifications', icon: Bell },
        ]
    },
    {
        groupName: 'Sales & CRM',
        items: [
        { title: 'ใบเสนอราคา', href: '/quotations', icon: FileText, permission: 'QUOTATION_VIEW' },
        { title: 'ใบสั่งขาย (Sales Orders)', href: '/sales?salesFlowMode=ERP', icon: ShoppingCart, permission: 'SALE_VIEW', id: 'sidebar-sales-orders', salesFlowMode: 'ERP' },
        { isDivider: true, title: '', href: '', icon: null },
        { title: 'จัดส่งสินค้า (Shipments)', href: '/shipments', icon: Send, permission: 'SHIPMENT_VIEW' },
        { title: 'ใบส่งของ (Deliveries)', href: '/deliveries', icon: PackageCheck, permission: 'DELIVERY_VIEW' },
        { title: 'ใบแจ้งหนี้ (Invoices)', href: '/invoices', icon: Receipt, permission: 'SALE_VIEW' },
        { isDivider: true, title: '', href: '', icon: null },
        { title: 'ประวัติการขาย (Retail)', href: '/sales?salesFlowMode=RETAIL', icon: History, permission: 'SALE_VIEW', id: 'sidebar-sales-history', salesFlowMode: 'RETAIL' },
        { title: 'คืนสินค้า (Returns)', href: '/returns', icon: RotateCcw, permission: 'RETURN_VIEW' },
        { title: 'ลูกค้า (Customers)', href: '/customers', icon: Users, permission: 'CUSTOMER_VIEW', id: 'sidebar-customers' },
        ]
    },
    {
        groupName: 'Inventory',
        items: [
            { title: 'สินค้า (Products)', href: '/products', icon: Package, permission: 'PRODUCT_VIEW', id: 'sidebar-products' },
            { title: 'คลังสินค้า (Warehouses)', href: '/inventory/warehouses', icon: Truck, permission: 'WAREHOUSE_MANAGE' },
            { title: 'จัดการตัวแทนจำหน่าย/รับเข้า', href: '/warehouse/receive', icon: PackageCheck, permission: 'WAREHOUSE_MANAGE' }, // Integration
            { title: 'ใบโอนสินค้า', href: '/inventory/transfers', icon: ArrowRightLeft, permission: 'PRODUCT_UPDATE' },
            { title: 'ตรวจนับสต็อก', href: '/inventory/stock-take', icon: ClipboardCheck, permission: 'STOCK_ADJUST' },
            { title: 'ปรับสต็อก (Manual Adjust)', href: '/warehouse/adjust', icon: Activity, permission: 'STOCK_ADJUST' }, // Integration
        ]
    },
    {
        groupName: 'Procurement',
        items: [
            { title: 'ขอซื้อสินค้า (PR)', href: '/order-requests', icon: ClipboardList, permission: 'ORDER_REQUEST_VIEW' },
            { title: 'สั่งซื้อสินค้า (PO)', href: '/purchases', icon: Receipt, permission: 'PURCHASE_VIEW' },
            { title: 'ผู้จำหน่าย (Suppliers)', href: '/suppliers', icon: Truck, permission: 'PURCHASE_VIEW' },
        ]
    },
    {
        groupName: 'Finance & Accounting',
        items: [
            { title: 'รายจ่าย (Expenses)', href: '/expenses', icon: Wallet, permission: 'EXPENSE_VIEW' },
            { title: 'รายได้อื่นๆ (Incomes)', href: '/incomes', icon: TrendingUp, permission: 'FINANCE_VIEW_LEDGER' },
            { title: 'บัญชีธนาคาร (Banks)', href: '/accounting/banks', icon: CreditCard, permission: 'SETTINGS_SHOP' },
            { title: 'กระทบยอด (Reconcile)', href: '/accounting/reconcile', icon: CheckCircle2, permission: 'SETTINGS_SHOP' },
            { title: 'รายงานภาษีซื้อ', href: '/tax/purchase-tax', icon: Calculator, permission: 'TAX_REPORT_VIEW' }, // Operations
            { title: 'รายงานภาษี/WHT', href: '/tax/reports', icon: FileText, permission: 'TAX_REPORT_VIEW' }, // Operations
            { title: 'รอบบัญชี (Periods)', href: '/accounting/periods', icon: History, permission: 'SETTINGS_SHOP' }, // Advanced
        ]
    },
    {
        groupName: 'System & Analytics',
        items: [
            { title: 'รออนุมัติ (Approvals)', href: '/approvals', icon: CheckCircle2, permission: 'APPROVAL_VIEW' },
            { title: 'รายงานสรุปผล (Reports)', href: '/reports', icon: BarChart3, permission: 'REPORT_VIEW_SALES' },
            { title: 'ประวัติการใช้งาน (Audit)', href: '/system/audit-logs', icon: ShieldCheck, permission: 'AUDIT_VIEW' },
            { title: 'สุขภาพระบบ (System)', href: '/system', icon: Activity, permission: 'SETTINGS_SHOP' },
            { title: 'คู่มือการใช้งาน (Docs)', href: '/help', icon: HelpCircle },
        ]
    }
];

// ==================== Settings Sidebar Config (Setup) ====================

export const settingsNavItems: NavItem[] = [
    { title: 'โปรไฟล์ผู้ใช้', href: '/settings/profile', icon: UserCircle },
    { title: 'ข้อมูลร้านค้า', href: '/settings/shop', icon: Building2, permission: 'SETTINGS_SHOP' },
    { title: 'ทีมงาน (Team)', href: '/settings/team', icon: Users, permission: 'SETTINGS_ROLES' },
    { title: 'สิทธิ์การใช้งาน (Roles)', href: '/settings/roles', icon: Shield, permission: 'SETTINGS_ROLES' },
    { title: 'ตั้งค่าภาษี (Tax Setup)', href: '/settings/tax', icon: Key, permission: 'TAX_SETTINGS_VIEW' },
    { title: 'บัญชีและการเงิน', href: '/settings/accounting', icon: Library, permission: 'SETTINGS_SHOP' },
    { title: 'หมวดหมู่พื้นฐาน (Global)', href: '/settings/categories', icon: LayoutDashboard, permission: 'SETTINGS_SHOP' },
    { title: 'ความปลอดภัย (Security)', href: '/settings/security', icon: Shield },
    { title: 'Setup Hub (Onboarding)', href: '/settings/onboarding', icon: Sparkles, permission: 'SETTINGS_SHOP' },
];
