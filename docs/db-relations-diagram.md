# 📊 Shop-Inventory: Database Relations & Flow Diagrams

## 1. Full Entity-Relationship Diagram

```mermaid
erDiagram
    User {
        string id PK "cuid()"
        string email UK
        string name
        string password
        string image
        datetime lastActiveAt
    }

    Shop {
        string id PK "cuid()"
        string name "ชื่อร้าน"
        string address
        string phone
        string logo
        string taxId
        string invoicePrefix "default: INV"
        string userId UK,FK "เจ้าของ (Restrict)"
    }

    Role {
        string id PK "cuid()"
        string name "ชื่อ Role"
        string shopId FK
        string[] permissions "Permission enum array"
        boolean isDefault
    }

    ShopMember {
        string id PK "cuid()"
        string userId FK
        string shopId FK
        string roleId FK
    }

    LookupType {
        string id PK "cuid()"
        enum code "PRODUCT_CATEGORY etc"
        string label
    }

    LookupValue {
        string id PK "cuid()"
        string lookupTypeId FK
        string code
        string label
        int sortOrder
        string shopId FK
        string userId FK
    }

    Product {
        string id PK "cuid()"
        string name
        string sku UK
        string category
        string categoryRefId FK "→ LookupValue"
        decimal costPrice "Decimal(10,2)"
        decimal salePrice "Decimal(10,2)"
        int stock
        int minStock "default: 5"
        boolean isLowStock "cached flag"
        boolean isActive "soft delete flag"
        string supplierId FK
        string imageUrl
        int version "optimistic lock"
        string shopId FK
        string userId FK
        datetime deletedAt
    }

    Supplier {
        string id PK "cuid()"
        string name
        string code UK
        string contactName
        string phone
        string email
        string address
        string taxId
        string shopId FK
        string userId FK
        datetime deletedAt
    }

    Customer {
        string id PK "cuid()"
        string name
        string phone
        string email
        string address
        string taxId
        string notes
        string shopId FK
        string userId FK
        datetime deletedAt
    }

    CustomerAddress {
        string id PK "cuid()"
        string customerId FK
        string label
        string recipientName
        string phone
        string address
        string district
        string province
        string postalCode
        boolean isDefault
        string shopId FK
        datetime deletedAt
    }

    Purchase {
        string id PK "cuid()"
        string purchaseNumber UK "PUR-00001"
        datetime date
        string supplierId FK
        string supplierName "deprecated"
        decimal totalCost "Decimal(10,2)"
        string paymentMethod "CASH/TRANSFER/CREDIT"
        string receiptUrl
        string notes
        string status "ACTIVE/CANCELLED"
        string cancelReason
        string shopId FK
        string userId FK
        datetime deletedAt
    }

    PurchaseItem {
        string id PK "cuid()"
        string purchaseId FK "Cascade"
        string productId FK
        int quantity
        decimal costPrice "Decimal(10,2)"
        decimal subtotal "Decimal(10,2)"
    }

    Sale {
        string id PK "cuid()"
        string invoiceNumber UK "INV-00001"
        datetime date
        string customerId FK
        string customerName "deprecated"
        decimal totalAmount "Decimal(10,2)"
        decimal totalCost "Decimal(10,2)"
        decimal profit "Decimal(10,2)"
        string discountType "PERCENT/FIXED"
        decimal discountValue "Decimal(10,2)"
        decimal discountAmount "Decimal(10,2)"
        decimal netAmount "Decimal(10,2)"
        string paymentMethod "CASH/TRANSFER/CREDIT"
        string paymentStatus "PENDING/VERIFIED/REJECTED"
        string paymentProof
        string channel "WALK_IN/SHOPEE/etc"
        string status "ACTIVE/CANCELLED"
        string cancelReason
        string shopId FK
        string userId FK
    }

    SaleItem {
        string id PK "cuid()"
        string saleId FK "Cascade"
        string productId FK
        int quantity
        decimal salePrice "Decimal(10,2)"
        decimal costPrice "Decimal(10,2)"
        decimal subtotal "Decimal(10,2)"
        decimal profit "Decimal(10,2)"
        decimal discountPercent "G4 item discount"
        decimal discountAmount "G4"
        int returnedQty "G3 tracking"
    }

    Shipment {
        string id PK "cuid()"
        string shipmentNumber UK "SHP-00001"
        string saleId FK
        string recipientName
        string recipientPhone
        string shippingAddress
        string customerAddressId FK
        string trackingNumber
        string shippingProvider
        decimal shippingCost "Decimal(10,2)"
        string status "FSM: 5 states"
        string notes
        datetime shippedAt
        datetime deliveredAt
        string shopId FK
        string userId FK
    }

    Return {
        string id PK "cuid()"
        string returnNumber UK "RET-00001"
        string saleId FK
        decimal totalRefund "Decimal(10,2)"
        string reason
        string notes
        string status "COMPLETED/CANCELLED"
        string shopId FK
        string userId FK
    }

    ReturnItem {
        string id PK "cuid()"
        string returnId FK "Cascade"
        string saleItemId FK
        string productId FK
        int quantity
        decimal refundAmount "Decimal(10,2)"
        decimal costPrice "Decimal(10,2)"
    }

    StockLog {
        string id PK "cuid()"
        string productId FK
        string type "SALE/PURCHASE/RETURN/etc"
        int quantity
        int balanceAfter "snapshot"
        string note
        string referenceId "deprecated"
        string referenceType "deprecated"
        string saleId FK "SetNull"
        string purchaseId FK "SetNull"
        string returnId FK "SetNull"
        string shopId FK
        string userId FK
    }

    Expense {
        string id PK "cuid()"
        string category
        string categoryRefId FK "→ LookupValue"
        decimal amount "Decimal(10,2)"
        string description
        datetime date
        string shopId FK
        string userId FK
        datetime deletedAt
    }

    Income {
        string id PK "cuid()"
        string category
        string categoryRefId FK "→ LookupValue"
        decimal amount "Decimal(10,2)"
        string description
        datetime date
        string shopId FK
        string userId FK
        datetime deletedAt
    }

    Notification {
        string id PK "cuid()"
        string type "LOW_STOCK/NEW_SALE/etc"
        string severity "INFO/WARNING/CRITICAL"
        string title
        string message
        boolean isRead
        string link
        string shopId FK "Cascade"
    }

    User ||--o| Shop : "owns (Restrict)"
    User ||--o{ ShopMember : "memberships"
    Shop ||--o{ ShopMember : "members"
    Shop ||--o{ Role : "custom roles"
    ShopMember }o--|| Role : "assigned"

    Shop ||--o{ Product : "has"
    Shop ||--o{ Supplier : "has"
    Shop ||--o{ Customer : "has"
    Shop ||--o{ Purchase : "has"
    Shop ||--o{ Sale : "has"
    Shop ||--o{ Expense : "has"
    Shop ||--o{ Income : "has"
    Shop ||--o{ StockLog : "has"
    Shop ||--o{ Shipment : "has"
    Shop ||--o{ Return : "has"
    Shop ||--o{ Notification : "has"
    Shop ||--o{ CustomerAddress : "has"
    Shop ||--o{ LookupValue : "custom values"

    LookupType ||--o{ LookupValue : "defines"
    Product }o--o| LookupValue : "categoryRef"
    Product }o--o| Supplier : "primary supplier"

    Supplier ||--o{ Purchase : "supplies"
    Customer ||--o{ Sale : "buys"
    Customer ||--o{ CustomerAddress : "addresses"

    Purchase ||--o{ PurchaseItem : "items (Cascade)"
    PurchaseItem }o--|| Product : "product"

    Sale ||--o{ SaleItem : "items (Cascade)"
    SaleItem }o--|| Product : "product"
    Sale ||--o{ Shipment : "shipments"
    Sale ||--o{ Return : "returns"

    Return ||--o{ ReturnItem : "items (Cascade)"
    ReturnItem }o--|| SaleItem : "from sale item"
    ReturnItem }o--|| Product : "product"

    Shipment }o--o| CustomerAddress : "deliver to"

    StockLog }o--|| Product : "product"
    StockLog }o--o| Sale : "saleId (SetNull)"
    StockLog }o--o| Purchase : "purchaseId (SetNull)"
    StockLog }o--o| Return : "returnId (SetNull)"

    Expense }o--o| LookupValue : "categoryRef"
    Income }o--o| LookupValue : "categoryRef"
```

---

## 2. RBAC & Multi-Tenancy Model

```mermaid
flowchart TD
    subgraph Auth["🔐 Authentication"]
        U[User] -->|login| Session["NextAuth Session"]
    end

    subgraph RBAC["🛡️ Authorization Layer"]
        Session -->|getSessionContext| CTX["SessionContext\n{userId, shopId, role, permissions}"]
        CTX --> RQ{requirePermission?}
        RQ -->|OWNER| BYPASS["✅ Bypass All"]
        RQ -->|MEMBER| CHECK["Check role.permissions\nincludes required"]
        CHECK -->|Yes| ALLOW["✅ Proceed"]
        CHECK -->|No| DENY["❌ 403 Forbidden"]
    end

    subgraph Tenant["🏪 Multi-Tenancy Isolation"]
        ALLOW --> QUERY["Every DB Query\nWHERE shopId = ctx.shopId"]
        QUERY --> DATA["Isolated Data"]
    end

    style Auth fill:#1a1a2e,color:#e0e0e0
    style RBAC fill:#16213e,color:#e0e0e0
    style Tenant fill:#0f3460,color:#e0e0e0
```

**Permission List (35+):**

| Module    | VIEW | CREATE | EDIT | DELETE | Special         |
| --------- | ---- | ------ | ---- | ------ | --------------- |
| Product   | ✅   | ✅     | ✅   | ✅     | —               |
| Sale      | ✅   | ✅     | ✅   | ✅     | PAYMENT_VERIFY  |
| Purchase  | ✅   | ✅     | ✅   | ✅     | —               |
| Expense   | ✅   | ✅     | ✅   | ✅     | —               |
| Income    | ✅   | ✅     | ✅   | ✅     | —               |
| Customer  | ✅   | ✅     | ✅   | ✅     | —               |
| Supplier  | ✅   | ✅     | ✅   | ✅     | —               |
| Shipment  | ✅   | ✅     | ✅   | —      | SHIPMENT_CANCEL |
| Return    | ✅   | ✅     | —    | —      | —               |
| Dashboard | ✅   | —      | —    | —      | —               |
| Settings  | —    | —      | ✅   | —      | MEMBER_MANAGE   |

---

## 3. Business Flow Diagrams

### 3.1 🛒 Sale → Stock → Shipment → Return Flow

```mermaid
flowchart TD
    subgraph CREATE_SALE["สร้างรายการขาย"]
        S1["createSale()"] --> S2["Generate INV-00001\n(retry 5x)"]
        S2 --> S3["Validate Products"]
        S3 --> S4["atomicReserveStock()\nupdateMany WHERE stock >= qty"]
        S4 --> S5["Calculate with Decimal.js\n• Item subtotals\n• G4 Discounts\n• Net amount\n• Profit"]
        S5 --> S6["Create Sale + SaleItems"]
        S6 --> S7["StockService.recordMovement()\n→ StockLog + isLowStock flag"]
        S7 --> S8["NotificationService\n→ Low stock alert"]
    end

    subgraph PAYMENT["💳 Payment"]
        S6 --> P1{paymentMethod?}
        P1 -->|CASH| P2["paymentStatus = VERIFIED ✅"]
        P1 -->|TRANSFER| P3["paymentStatus = PENDING ⏳"]
        P3 --> P4["uploadPaymentProof()"]
        P4 --> P5["verifyPayment()\nPAYMENT_VERIFY permission"]
        P5 --> P6["VERIFIED / REJECTED"]
    end

    subgraph SHIPMENT["📦 Shipment"]
        S6 --> SH1["createShipment()"]
        SH1 --> SH2["Generate SHP-00001"]
        SH1 --> SH3["Auto-create Expense\nค่าจัดส่ง"]
        SH2 --> SH4["Status FSM"]
    end

    subgraph SHIPMENT_FSM["Status Machine"]
        PENDING["🔵 PENDING"] -->|ship| SHIPPED["🟡 SHIPPED"]
        SHIPPED -->|deliver| DELIVERED["🟢 DELIVERED"]
        SHIPPED -->|return| RETURNED["🔴 RETURNED"]
        RETURNED -->|re-ship| PENDING
        PENDING -->|cancel| CANCELLED["⚫ CANCELLED"]
        SHIPPED -->|cancel| CANCELLED
    end

    subgraph RETURN["🔄 Partial Return (G3)"]
        S6 --> R1["createReturn()"]
        R1 --> R2["Validate: returnQty ≤ originalQty - alreadyReturned"]
        R2 --> R3["Calculate refund\nincluding bill discount ratio"]
        R3 --> R4["Restore stock via StockService"]
        R4 --> R5["Adjust Sale financials\n• netAmount -= refund\n• totalCost -= cost\n• profit -= itemProfit"]
        R5 --> R6["Update SaleItem.returnedQty"]
    end

    subgraph CANCEL_SALE["❌ Cancel Sale"]
        S6 --> C1["cancelSale()"]
        C1 --> C2["Auto-cancel Shipments"]
        C2 --> C3["Restore stock\n(deduct already-returned qty)"]
        C3 --> C4["Delete auto-created expenses"]
        C4 --> C5["Sale.status = CANCELLED"]
    end

    style CREATE_SALE fill:#1a1a2e,color:#e0e0e0
    style PAYMENT fill:#16213e,color:#e0e0e0
    style SHIPMENT fill:#0f3460,color:#e0e0e0
    style SHIPMENT_FSM fill:#1a1a3e,color:#e0e0e0
    style RETURN fill:#2d1b3d,color:#e0e0e0
    style CANCEL_SALE fill:#3d1b1b,color:#e0e0e0
```

### 3.2 📦 Purchase Flow

```mermaid
flowchart TD
    subgraph CREATE["สร้างรายการซื้อ"]
        P1["createPurchase()"] --> P2["Generate PUR-00001\n(retry 5x)"]
        P2 --> P3["Calculate totalCost\nwith Decimal.js"]
        P3 --> P4["Create Purchase\n+ PurchaseItems"]
        P4 --> P5["Loop each item:"]
        P5 --> P6["StockService.recordMovement()\ntype: PURCHASE\nqty: +quantity"]
        P6 --> P7["Update Product.costPrice\nto latest purchase cost"]
    end

    subgraph CANCEL["ยกเลิกการซื้อ"]
        P4 --> C1["cancelPurchase()"]
        C1 --> C2{"stock >= purchasedQty?\n(ตรวจว่าสต็อกพอคืน)"}
        C2 -->|No| C3["❌ Error: สต็อกไม่พอยกเลิก"]
        C2 -->|Yes| C4["StockService.recordMovement()\ntype: PURCHASE_CANCEL\nqty: -quantity"]
        C4 --> C5["Revert costPrice\nto previous purchase"]
        C5 --> C6["Purchase.status = CANCELLED"]
    end

    style CREATE fill:#1a1a2e,color:#e0e0e0
    style CANCEL fill:#3d1b1b,color:#e0e0e0
```

### 3.3 📊 Stock Movement Audit Trail

```mermaid
flowchart LR
    subgraph Sources["Stock Movement Sources"]
        SALE["🛒 Sale\ntype: SALE\nqty: -N"]
        PURCHASE["📦 Purchase\ntype: PURCHASE\nqty: +N"]
        RETURN["🔄 Return\ntype: RETURN\nqty: +N"]
        ADJUST["🔧 Manual Adjust\ntype: ADJUSTMENT\nqty: ±N"]
        CANCEL_S["❌ Sale Cancel\ntype: SALE_CANCEL\nqty: +N"]
        CANCEL_P["❌ Purchase Cancel\ntype: PURCHASE_CANCEL\nqty: -N"]
    end

    subgraph Service["StockService.recordMovement()"]
        S1["Atomic: product.update\n{increment/decrement}"]
        S2["Create StockLog\n{balanceAfter snapshot}"]
        S3["Check isLowStock\nstock <= minStock?"]
        S4["Update Product.isLowStock"]
        S5["Trigger Notification\nif newly low"]
    end

    subgraph Result["Product State"]
        PRODUCT["Product\n• stock: current\n• isLowStock: cached\n• version: N"]
        LOG["StockLog[]\nComplete audit trail\nwith balance snapshots"]
    end

    SALE --> S1
    PURCHASE --> S1
    RETURN --> S1
    ADJUST --> S1
    CANCEL_S --> S1
    CANCEL_P --> S1

    S1 --> S2 --> S3 --> S4 --> S5
    S1 --> PRODUCT
    S2 --> LOG

    style Sources fill:#1a1a2e,color:#e0e0e0
    style Service fill:#16213e,color:#e0e0e0
    style Result fill:#0f3460,color:#e0e0e0
```

---

## 4. Financial Data Flow

```mermaid
flowchart TD
    subgraph SALE_CALC["Sale Calculation (Decimal.js)"]
        I1["SaleItem.subtotal = qty × salePrice"]
        I2["SaleItem.profit = subtotal - (qty × costPrice)"]
        I3["G4 Item Discount:\nsubtotal -= discountAmount"]
        I4["Sale.totalAmount = Σ item.subtotal"]
        I5["G4 Bill Discount:\ndiscountAmount = calc(totalAmount)"]
        I6["Sale.netAmount = totalAmount - billDiscount"]
        I7["Sale.totalCost = Σ (qty × costPrice)"]
        I8["Sale.profit = netAmount - totalCost"]
        I1 --> I2 --> I3 --> I4 --> I5 --> I6 --> I7 --> I8
    end

    subgraph RETURN_CALC["Return Refund Calculation"]
        R1["billDiscountRatio =\nSale.discountAmount / Sale.totalAmount"]
        R2["refundPerUnit =\nSaleItem.salePrice × (1 - billDiscountRatio)"]
        R3["ReturnItem.refundAmount =\nreturnQty × refundPerUnit"]
        R4["Adjust Sale:\n∆netAmount = -totalRefund\n∆totalCost = -(returnQty × costPrice)\n∆profit = -itemProfit"]
        R1 --> R2 --> R3 --> R4
    end

    subgraph DASHBOARD["Dashboard Aggregation"]
        D1["Revenue = Σ Sale.netAmount\n(ACTIVE only)"]
        D2["Expenses = Σ Expense.amount\n(not deleted)"]
        D3["Purchases = Σ Purchase.totalCost"]
        D4["Net Profit = Revenue - Expenses"]
        D5["All use toNumber() for\nPrisma Decimal → Number"]
    end

    style SALE_CALC fill:#1a1a2e,color:#e0e0e0
    style RETURN_CALC fill:#2d1b3d,color:#e0e0e0
    style DASHBOARD fill:#0f3460,color:#e0e0e0
```

---

## 5. Cascade & Deletion Strategy

```mermaid
flowchart TD
    subgraph HARD["onDelete: Cascade (Hard Delete Chain)"]
        DEL_SHOP["Delete Shop"] --> DEL_PRODUCTS["→ Products"]
        DEL_SHOP --> DEL_SALES["→ Sales"]
        DEL_SHOP --> DEL_PURCHASES["→ Purchases"]
        DEL_SHOP --> DEL_MEMBERS["→ ShopMembers"]
        DEL_SHOP --> DEL_ROLES["→ Roles"]
        DEL_SHOP --> DEL_NOTIF["→ Notifications"]

        DEL_SALES --> DEL_ITEMS["→ SaleItems"]
        DEL_PURCHASES --> DEL_PITEMS["→ PurchaseItems"]
    end

    subgraph RESTRICT["onDelete: Restrict (Protected)"]
        NO_DEL_USER["❌ Cannot Delete User\nif owns a Shop"]
        NO_DEL_PRODUCT["❌ Cannot Delete Product\nif has SaleItems/PurchaseItems"]
        NO_DEL_CUSTOMER["❌ Cannot Delete Customer\nif has Sales"]
        NO_DEL_SUPPLIER["❌ Cannot Delete Supplier\nif has Purchases"]
    end

    subgraph SOFT["Soft Delete (Application Layer)"]
        SOFT_PROD["Product.deletedAt\n+ isActive = false"]
        SOFT_CUST["Customer.deletedAt"]
        SOFT_SUPP["Supplier.deletedAt"]
        SOFT_EXP["Expense.deletedAt"]
        SOFT_INC["Income.deletedAt"]
        SOFT_ADDR["CustomerAddress.deletedAt"]
    end

    subgraph STATUS["Status-based Void"]
        SALE_CANCEL["Sale.status = CANCELLED\n+ cancelledAt, cancelledBy"]
        PUR_CANCEL["Purchase.status = CANCELLED\n+ cancelledAt, cancelledBy"]
    end

    style HARD fill:#3d1b1b,color:#e0e0e0
    style RESTRICT fill:#1b3d1b,color:#e0e0e0
    style SOFT fill:#1a1a2e,color:#e0e0e0
    style STATUS fill:#3d3d1b,color:#e0e0e0
```

---

## 6. Index Strategy Summary

| Model            | Indexes                         | Purpose                    |
| ---------------- | ------------------------------- | -------------------------- |
| **Product**      | `[shopId, isActive, deletedAt]` | Product list query         |
|                  | `[shopId, isLowStock]`          | Low stock dashboard        |
|                  | `[shopId, sku]` UK              | SKU uniqueness per shop    |
| **Sale**         | `[shopId, invoiceNumber]` UK    | Invoice uniqueness         |
|                  | `[shopId, date, status]`        | Date range + status filter |
|                  | `[shopId, paymentStatus]`       | Payment verification queue |
|                  | `[shopId, channel, date]`       | Channel analytics          |
| **Purchase**     | `[shopId, purchaseNumber]` UK   | PUR number uniqueness      |
|                  | `[shopId, date, status]`        | Date range + status filter |
| **Shipment**     | `[shopId, shipmentNumber]` UK   | SHP number uniqueness      |
|                  | `[shopId, saleId, status]`      | Active shipment check      |
| **StockLog**     | `[productId, createdAt]`        | Product history timeline   |
|                  | `[shopId, createdAt]`           | Shop-wide audit trail      |
| **Notification** | `[shopId, isRead, createdAt]`   | Unread notifications       |
