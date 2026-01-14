import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Receipt, 
  Users, 
  Wallet, 
  BarChart3, 
  Settings,
  HelpCircle,
  ArrowRight
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

const guides = [
  {
    icon: LayoutDashboard,
    title: 'Dashboard',
    description: 'หน้าภาพรวมของร้าน',
    steps: [
      'ดูยอดขายวันนี้และเดือนนี้',
      'ดูจำนวนสินค้าคงเหลือ',
      'ดูค่าใช้จ่ายประจำเดือน',
      'ดูกราฟยอดขาย 7 วันย้อนหลัง',
      'ดูรายการขายล่าสุด',
    ],
  },
  {
    icon: ShoppingCart,
    title: 'ขายสินค้า',
    description: 'บันทึกการขายสินค้าให้ลูกค้า',
    steps: [
      'คลิก "บันทึกการขาย"',
      'เลือกสินค้าที่ต้องการขาย',
      'ระบุจำนวน (ราคาจะคำนวณอัตโนมัติ)',
      'เลือกลูกค้า (ถ้ามี)',
      'เลือกวิธีชำระเงิน',
      'กด "บันทึก" เพื่อสร้างใบเสร็จ',
    ],
  },
  {
    icon: Package,
    title: 'สินค้า',
    description: 'จัดการสินค้าและสต็อก',
    steps: [
      'คลิก "เพิ่มสินค้า" เพื่อสร้างสินค้าใหม่',
      'กรอกชื่อ, หมวดหมู่, ราคาทุน, ราคาขาย',
      'ระบุจำนวนขั้นต่ำ (แจ้งเตือนเมื่อใกล้หมด)',
      'คลิกที่สินค้าเพื่อแก้ไขข้อมูล',
      'สต็อกจะเพิ่ม/ลดอัตโนมัติเมื่อซื้อ/ขาย',
    ],
  },
  {
    icon: Receipt,
    title: 'ซื้อสินค้า',
    description: 'บันทึกการสั่งซื้อสินค้าเข้าร้าน',
    steps: [
      'คลิก "บันทึกการซื้อ"',
      'เลือกผู้จำหน่าย (Supplier)',
      'เลือกสินค้าที่ซื้อและระบุจำนวน',
      'ระบุราคาทุนต่อชิ้น',
      'กด "บันทึก" → สต็อกจะเพิ่มอัตโนมัติ',
    ],
  },
  {
    icon: Users,
    title: 'ลูกค้า',
    description: 'จัดการข้อมูลลูกค้า',
    steps: [
      'คลิก "เพิ่มลูกค้า" เพื่อบันทึกลูกค้าใหม่',
      'กรอกชื่อ, เบอร์โทร, ที่อยู่',
      'เมื่อขายสินค้า สามารถเลือกลูกค้าได้',
      'ดูประวัติการซื้อของลูกค้าแต่ละคน',
    ],
  },
  {
    icon: Wallet,
    title: 'ค่าใช้จ่าย',
    description: 'บันทึกค่าใช้จ่ายของร้าน',
    steps: [
      'คลิก "เพิ่มค่าใช้จ่าย"',
      'เลือกหมวดหมู่ (ค่าเช่า, ค่าน้ำไฟ, อื่นๆ)',
      'ระบุจำนวนเงินและรายละเอียด',
      'ค่าใช้จ่ายจะแสดงในรายงาน',
    ],
  },
  {
    icon: BarChart3,
    title: 'รายงาน',
    description: 'ดูสรุปยอดขายและกำไร',
    steps: [
      'เลือกช่วงเวลาที่ต้องการดู',
      'ดูยอดขาย, กำไร, ค่าใช้จ่ายรวม',
      'ดูกราฟแนวโน้มยอดขาย',
      'ดูสินค้าขายดี',
    ],
  },
  {
    icon: Settings,
    title: 'ตั้งค่า',
    description: 'ตั้งค่าข้อมูลร้านค้า',
    steps: [
      'แก้ไขชื่อผู้ใช้',
      'แก้ไขชื่อร้าน, ที่อยู่, เบอร์โทร',
      'ระบุเลขประจำตัวผู้เสียภาษี (ถ้ามี)',
      'ข้อมูลเหล่านี้จะแสดงในใบเสร็จ',
    ],
  },
];

export default function HelpPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <HelpCircle className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">คู่มือการใช้งาน</h1>
          <p className="text-muted-foreground">เรียนรู้วิธีใช้งานระบบ Shop Inventory</p>
        </div>
      </div>

      <Separator />

      <div className="grid gap-6 md:grid-cols-2">
        {guides.map((guide) => (
          <Card key={guide.title}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <guide.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">{guide.title}</CardTitle>
                  <CardDescription>{guide.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {guide.steps.map((step, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <ArrowRight className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <div className="text-center space-y-2">
            <p className="font-medium">ต้องการความช่วยเหลือเพิ่มเติม?</p>
            <p className="text-sm text-muted-foreground">
              ติดต่อผู้ดูแลระบบหรือส่งข้อความหาทีมงาน
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
