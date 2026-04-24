export type PermissionModule = 'PRODUCT' | 'STOCK' | 'SALE' | 'INVOICE' | 'FINANCE' | 'PURCHASE' | 'TEAM' | 'SYSTEM' | 'REPORT' | 'CUSTOMER' | 'EXPENSE' | 'RETURN' | 'SUPPLIER';

export interface PermissionDefinition {
    code: string;
    module: PermissionModule;
    label: string;
    description: string;
    risk: 'low' | 'medium' | 'high';
    defaultRoles?: string[]; // Starter template suggestions
}

/** Group definition for UI display */
export interface PermissionGroup {
    label: string;
    permissions: { key: string; label: string }[];
}

export const PERMISSION_REGISTRY: PermissionDefinition[] = [
    // --- PRODUCT ---
    { code: 'PRODUCT_VIEW', module: 'PRODUCT', label: 'ดูสินค้า', description: 'ดูรายการสินค้าและรายละเอียดทั่วไป', risk: 'low', defaultRoles: ['MARKETING', 'SALE', 'WAREHOUSE'] },
    { code: 'PRODUCT_CREATE', module: 'PRODUCT', label: 'เพิ่มสินค้า', description: 'สร้างรายการสินค้าใหม่', risk: 'medium', defaultRoles: ['ADMIN', 'MANAGER'] },
    { code: 'PRODUCT_UPDATE', module: 'PRODUCT', label: 'แก้ไขสินค้า', description: 'แก้ไขข้อมูลสินค้าเดิม', risk: 'medium', defaultRoles: ['ADMIN', 'MANAGER'] },
    { code: 'PRODUCT_DELETE', module: 'PRODUCT', label: 'ลบสินค้า', description: 'ลบสินค้าออกจากระบบ', risk: 'high', defaultRoles: ['ADMIN'] },
    { code: 'PRODUCT_VIEW_COST', module: 'PRODUCT', label: 'ดูต้นทุน', description: 'ดูราคาต้นทุนสินค้า (ข้อมูลอ่อนไหว)', risk: 'high', defaultRoles: ['ADMIN', 'ACCOUNTANT'] },

    // --- SALE ---
    { code: 'SALE_VIEW', module: 'SALE', label: 'ดูใบขาย', description: 'ดูรายการขายและสถานะ', risk: 'low', defaultRoles: ['SALE', 'ACCOUNTANT'] },
    { code: 'SALE_CREATE', module: 'SALE', label: 'สร้างใบขาย', description: 'เปิดออเดอร์ใหม่', risk: 'medium', defaultRoles: ['SALE'] },
    { code: 'SALE_UPDATE', module: 'SALE', label: 'แก้ไขใบขาย', description: 'แก้ไขรายละเอียดการขายที่ยังไม่ถูก Billed', risk: 'medium', defaultRoles: ['SALE', 'MANAGER'] },
    { code: 'SALE_CANCEL', module: 'SALE', label: 'ยกเลิกใบขาย', description: 'ยกเลิกรายการขายก่อนการประมวลผล', risk: 'medium', defaultRoles: ['SALE', 'MANAGER'] },
    { code: 'SALE_VOID', module: 'SALE', label: 'Void รายการขาย', description: 'ลบประวัติการขายที่ผิดพลาด (ต้องระวัง)', risk: 'high', defaultRoles: ['ADMIN'] },
    { code: 'SALE_VIEW_PROFIT', module: 'SALE', label: 'ดูกำไร', description: 'ดูตัวเลขกำไรในแต่ละรายการขาย', risk: 'high', defaultRoles: ['ADMIN', 'MANAGER'] },
    { code: 'SALE_UPDATE_LOCKED', module: 'SALE', label: 'แก้ไขรายการที่ล็อกแล้ว', description: 'แก้ไขใบขายที่ถูก Billed หรือล็อกโดยระบบ', risk: 'high', defaultRoles: ['ADMIN'] },

    // --- INVOICE ---
    { code: 'INVOICE_VIEW', module: 'INVOICE', label: 'ดูใบแจ้งหนี้', description: 'ดูรายละเอียดใบแจ้งหนี้และใบกำกับภาษี', risk: 'low', defaultRoles: ['ACCOUNTANT', 'SALE'] },
    { code: 'INVOICE_CREATE', module: 'INVOICE', label: 'สร้างใบแจ้งหนี้', description: 'ออกเอกสารเรียกเก็บเงินจากใบขาย', risk: 'medium', defaultRoles: ['ACCOUNTANT', 'SALE'] },
    { code: 'INVOICE_POST', module: 'INVOICE', label: 'Post บัญชี', description: 'ยืนยันรายการลงสมุดบัญชี (ล็อกข้อมูล)', risk: 'medium', defaultRoles: ['ACCOUNTANT'] },
    { code: 'INVOICE_CANCEL', module: 'INVOICE', label: 'ยกเลิกใบแจ้งหนี้', description: 'ยกเลิกเอกสารการเรียกเก็บเงิน', risk: 'medium', defaultRoles: ['ACCOUNTANT', 'MANAGER'] },
    { code: 'INVOICE_MANAGE', module: 'INVOICE', label: 'จัดการขั้นสูง', description: 'แก้ไขเลขรัน หรือตั้งค่าพิเศษในใบแจ้งหนี้', risk: 'high', defaultRoles: ['ADMIN'] },

    // --- FINANCE ---
    { code: 'FINANCE_VIEW_LEDGER', module: 'FINANCE', label: 'ดูสมุดบัญชีเงินสด', description: 'ดูความเคลื่อนไหวของเงินเข้า-ออก', risk: 'medium', defaultRoles: ['ACCOUNTANT'] },
    { code: 'FINANCE_PAYMENT_VOID', module: 'FINANCE', label: 'Void การชำระเงิน', description: 'ยกเลิกรายการรับเงินที่บันทึกไปแล้ว', risk: 'high', defaultRoles: ['ADMIN', 'ACCOUNTANT'] },
    { code: 'FINANCE_MANAGE_CREDIT', module: 'FINANCE', label: 'จัดการวงเงินเครดิต', description: 'อนุมัติหรือปรับวงเงินเครดิตลูกค้า', risk: 'high', defaultRoles: ['ADMIN', 'MANAGER'] },

    // --- STOCK ---
    { code: 'STOCK_VIEW_HISTORY', module: 'STOCK', label: 'ดูประวัติสต็อก', description: 'ดู Movement ย้อนหลังของสินค้า', risk: 'low', defaultRoles: ['WAREHOUSE', 'ACCOUNTANT'] },
    { code: 'STOCK_ADJUST', module: 'STOCK', label: 'ปรับปรุงสต็อก', description: 'ปรับจำนวนสินค้าด้วยมือ (Manual Adjustment)', risk: 'high', defaultRoles: ['ADMIN', 'WAREHOUSE_MANAGER'] },
    { code: 'STOCK_TAKE_APPROVE', module: 'STOCK', label: 'อนุมัติ Stock Take', description: 'ยืนยันผลการนับสต็อกจริงลงระบบ', risk: 'high', defaultRoles: ['ADMIN', 'MANAGER'] },
    { code: 'WAREHOUSE_MANAGE', module: 'STOCK', label: 'จัดการคลังสินค้า', description: 'สร้าง/แก้ไข Warehouse และ Location', risk: 'high', defaultRoles: ['ADMIN'] },

    // --- SYSTEM & AUDIT ---
    { code: 'SETTINGS_SHOP', module: 'SYSTEM', label: 'ตั้งค่าร้านค้า', description: 'แก้ไขข้อมูลบริษัท ภาษี และธนาคาร', risk: 'high', defaultRoles: ['ADMIN'] },
    { code: 'SETTINGS_ROLES', module: 'SYSTEM', label: 'จัดการสิทธิ์', description: 'สร้างและแก้ไขบทบาทในระบบ', risk: 'high', defaultRoles: ['ADMIN'] },
    { code: 'AUDIT_VIEW', module: 'SYSTEM', label: 'ดูประวัติ Audit', description: 'ตรวจสอบ Log การทำงานของพนักงาน', risk: 'medium', defaultRoles: ['ADMIN'] },

    // --- REPORTS ---
    { code: 'REPORT_VIEW_SALES', module: 'REPORT', label: 'ดูรายงานขาย', description: 'เข้าถึง Dashboard และรายงานยอดขาย', risk: 'low', defaultRoles: ['ADMIN', 'MANAGER', 'SALE'] },
    { code: 'REPORT_EXPORT', module: 'REPORT', label: 'ส่งออกข้อมูล', description: 'ดาวน์โหลดรายงานเป็น Excel/CSV', risk: 'medium', defaultRoles: ['ADMIN', 'MANAGER', 'ACCOUNTANT'] },

    { code: 'PURCHASE_VOID', module: 'PURCHASE', label: 'ยกเลิกใบซื้อ', description: 'ยกเลิกรายการซื้อสินค้า', risk: 'high', defaultRoles: ['ADMIN'] },

    // --- SUPPLIER ---
    { code: 'SUPPLIER_VIEW', module: 'SUPPLIER', label: 'ดูผู้จำหน่าย', description: 'ดูรายชื่อและข้อมูลผู้ผลิต/ผู้จำหน่าย', risk: 'low', defaultRoles: ['ADMIN', 'MANAGER', 'ACCOUNTANT'] },
    { code: 'SUPPLIER_CREATE', module: 'SUPPLIER', label: 'เพิ่มผู้จำหน่าย', description: 'ลงทะเบียนผู้จำหน่ายใหม่', risk: 'medium', defaultRoles: ['ADMIN', 'MANAGER'] },
    { code: 'SUPPLIER_UPDATE', module: 'SUPPLIER', label: 'แก้ไขผู้จำหน่าย', description: 'อัปเดตข้อมูลผู้จำหน่ายเดิม', risk: 'medium', defaultRoles: ['ADMIN', 'MANAGER'] },
    { code: 'SUPPLIER_DELETE', module: 'SUPPLIER', label: 'ลบผู้จำหน่าย', description: 'ลบฐานข้อมูลผู้จำหน่าย (ควรใช้ความระมัดระวัง)', risk: 'high', defaultRoles: ['ADMIN'] },

    // --- CUSTOMER ---
    { code: 'CUSTOMER_VIEW', module: 'CUSTOMER', label: 'ดูลูกค้า', description: 'ดูรายชื่อและข้อมูลติดต่อลูกค้า', risk: 'low', defaultRoles: ['SALE', 'MARKETING'] },
    { code: 'CUSTOMER_CREATE', module: 'CUSTOMER', label: 'เพิ่มลูกค้า', description: 'ลงทะเบียนลูกค้าใหม่', risk: 'medium', defaultRoles: ['SALE', 'MARKETING'] },
    { code: 'CUSTOMER_UPDATE', module: 'CUSTOMER', label: 'แก้ไขลูกค้า', description: 'อัปเดตข้อมูลลูกค้าเดิม', risk: 'medium', defaultRoles: ['SALE', 'MANAGER'] },
    { code: 'CUSTOMER_DELETE', module: 'CUSTOMER', label: 'ลบลูกค้า', description: 'ลบฐานข้อมูลลูกค้า (ควรใช้ความระมัดระวัง)', risk: 'high', defaultRoles: ['ADMIN'] },

    // --- EXPENSE ---
    { code: 'EXPENSE_VIEW', module: 'EXPENSE', label: 'ดูค่าใช้จ่าย', description: 'ดูรายการค่าใช้จ่ายของร้าน', risk: 'low', defaultRoles: ['ACCOUNTANT', 'MANAGER'] },
    { code: 'EXPENSE_CREATE', module: 'EXPENSE', label: 'เพิ่มค่าใช้จ่าย', description: 'บันทึกรายจ่ายใหม่ลงระบบ', risk: 'medium', defaultRoles: ['ACCOUNTANT', 'MANAGER'] },
    { code: 'EXPENSE_UPDATE', module: 'EXPENSE', label: 'แก้ไขค่าใช้จ่าย', description: 'แก้ไขข้อมูลรายจ่ายย้อนหลัง', risk: 'medium', defaultRoles: ['ACCOUNTANT', 'MANAGER'] },
    { code: 'EXPENSE_DELETE', module: 'EXPENSE', label: 'ลบค่าใช้จ่าย', description: 'ลบรายการรายจ่ายออกจากระบบ', risk: 'high', defaultRoles: ['ADMIN'] },

    // --- RETURN ---
    { code: 'RETURN_VIEW', module: 'RETURN', label: 'ดูใบคืนสินค้า', description: 'ดูประวัติการคืนสินค้าจากลูกค้า', risk: 'low', defaultRoles: ['SALE', 'ACCOUNTANT'] },
    { code: 'RETURN_CREATE', module: 'RETURN', label: 'สร้างใบคืนสินค้า', description: 'ทำรายการรับคืนสินค้าและคืนเงิน', risk: 'medium', defaultRoles: ['SALE', 'MANAGER'] },
];

/**
 * Mapping for UI display groups
 */
export const MAP_GROUPS: Record<string, PermissionGroup> = {
    products: {
        label: 'สินค้าและบริการ',
        permissions: PERMISSION_REGISTRY.filter(p => p.module === 'PRODUCT').map(p => ({ key: p.code, label: p.label })),
    },
    sales: {
        label: 'งานขายและลูกค้า',
        permissions: PERMISSION_REGISTRY.filter(p => p.module === 'SALE').map(p => ({ key: p.code, label: p.label })),
    },
    invoices: {
        label: 'ใบแจ้งหนี้และการเงิน',
        permissions: [
            ...PERMISSION_REGISTRY.filter(p => p.module === 'INVOICE').map(p => ({ key: p.code, label: p.label })),
            ...PERMISSION_REGISTRY.filter(p => p.module === 'FINANCE').map(p => ({ key: p.code, label: p.label })),
        ],
    },
    stock: {
        label: 'คลังสินค้าและสต็อก',
        permissions: PERMISSION_REGISTRY.filter(p => p.module === 'STOCK').map(p => ({ key: p.code, label: p.label })),
    },
    reports: {
        label: 'รายงานและสถิติ',
        permissions: PERMISSION_REGISTRY.filter(p => p.module === 'REPORT').map(p => ({ key: p.code, label: p.label })),
    },
    system: {
        label: 'ระบบและการจัดการทีม',
        permissions: [
            ...PERMISSION_REGISTRY.filter(p => p.module === 'SYSTEM').map(p => ({ key: p.code, label: p.label })),
            ...PERMISSION_REGISTRY.filter(p => p.module === 'TEAM').map(p => ({ key: p.code, label: p.label })),
        ]
    },
    purchasing: {
        label: 'งานจัดซื้อและ Supplier',
        permissions: [
            ...PERMISSION_REGISTRY.filter(p => p.module === 'PURCHASE').map(p => ({ key: p.code, label: p.label })),
            ...PERMISSION_REGISTRY.filter(p => p.module === 'SUPPLIER').map(p => ({ key: p.code, label: p.label })),
        ]
    },
    crm: {
        label: 'CRM และบริหารลูกค้า',
        permissions: PERMISSION_REGISTRY.filter(p => p.module === 'CUSTOMER').map(p => ({ key: p.code, label: p.label })),
    },
    finance_extra: {
        label: 'รายจ่ายและจัดการคืนสินค้า',
        permissions: [
            ...PERMISSION_REGISTRY.filter(p => p.module === 'EXPENSE').map(p => ({ key: p.code, label: p.label })),
            ...PERMISSION_REGISTRY.filter(p => p.module === 'RETURN').map(p => ({ key: p.code, label: p.label })),
        ],
    },
};

/**
 * Gets all permissions grouped by module for UI display
 */
export function getPermissionsByModule() {
    const groups: Record<PermissionModule, PermissionDefinition[]> = {} as any;
    PERMISSION_REGISTRY.forEach(p => {
        if (!groups[p.module]) groups[p.module] = [];
        groups[p.module].push(p);
    });
    return groups;
}

/**
 * Helper to get a permission by code
 */
export function getPermission(code: string) {
    return PERMISSION_REGISTRY.find(p => p.code === code);
}
