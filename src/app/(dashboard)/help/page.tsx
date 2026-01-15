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
  ArrowRight,
  CheckCircle2,
  Circle,
  UserPlus,
  Store,
  PackagePlus,
  TrendingUp
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

// User Journey Steps
const userJourneySteps = [
  {
    step: 1,
    title: 'สมัครสมาชิก',
    description: 'สร้างบัญชีด้วยอีเมลและรหัสผ่าน',
    icon: UserPlus,
    details: [
      'ไปที่หน้า "สมัครใช้งาน"',
      'กรอกอีเมลและตั้งรหัสผ่าน',
      'ระบบจะสร้างร้านค้าให้อัตโนมัติ',
    ],
  },
  {
    step: 2,
    title: 'ตั้งค่าร้านค้า',
    description: 'กรอกข้อมูลร้านเพื่อแสดงในใบเสร็จ',
    icon: Store,
    details: [
      'ไปที่เมนู "ตั้งค่า"',
      'กรอกชื่อร้าน, ที่อยู่, เบอร์โทร',
      'ข้อมูลนี้จะแสดงในใบเสร็จทุกใบ',
    ],
  },
  {
    step: 3,
    title: 'เพิ่มสินค้า',
    description: 'สร้างรายการสินค้าที่จะขาย',
    icon: PackagePlus,
    details: [
      'ไปที่เมนู "สินค้า" → "เพิ่มสินค้า"',
      'กรอกชื่อ, หมวดหมู่, ราคาทุน, ราคาขาย',
      'ระบุจำนวน Stock เริ่มต้น (ถ้ามี)',
    ],
  },
  {
    step: 4,
    title: 'เริ่มขายสินค้า',
    description: 'บันทึกการขายและออกใบเสร็จ',
    icon: ShoppingCart,
    details: [
      'ไปที่เมนู "ขายสินค้า" → "บันทึกการขาย"',
      'เลือกสินค้า, ระบุจำนวน',
      'เลือกวิธีชำระเงิน แล้วกด "บันทึก"',
      'Stock จะลดอัตโนมัติ + สร้างใบเสร็จ',
    ],
  },
  {
    step: 5,
    title: 'ติดตามผลประกอบการ',
    description: 'ดูยอดขาย กำไร และรายงาน',
    icon: TrendingUp,
    details: [
      'Dashboard แสดงภาพรวมวันนี้/เดือนนี้',
      'เมนู "รายงาน" แสดงสรุปแบบละเอียด',
      'ดูกราฟแนวโน้มและสินค้าขายดี',
    ],
  },
];

const featureGuides = [
  {
    icon: LayoutDashboard,
    title: 'Dashboard',
    description: 'หน้าแรกที่แสดงภาพรวมร้านค้าของคุณ',
    sections: [
      {
        subtitle: 'ข้อมูลที่แสดง',
        items: [
          'ยอดขายวันนี้ - รายได้ที่ได้รับในวันนี้',
          'ยอดขายเดือนนี้ - รายได้รวมของเดือน',
          'จำนวนสินค้า - สินค้าทั้งหมดในระบบ',
          'ค่าใช้จ่าย - ค่าใช้จ่ายเดือนนี้',
          'กำไร - คำนวณจาก (ราคาขาย - ต้นทุน) * จำนวนที่ขาย',
        ],
      },
      {
        subtitle: 'กราฟและรายงาน',
        items: [
          'กราฟยอดขาย 7 วันย้อนหลัง',
          'รายการขายล่าสุด 5 รายการ',
          'สินค้าใกล้หมด (Stock น้อยกว่า Min)',
        ],
      },
    ],
  },
  {
    icon: ShoppingCart,
    title: 'ระบบ POS และการขาย',
    description: 'บันทึกการขายสินค้าหน้าเคาน์เตอร์',
    sections: [
      {
        subtitle: 'POS (Point of Sale)',
        items: [
          'หน้าจอแบบเต็ม (Fullscreen) ใช้งานง่าย',
          'รองรับการยิง Barcode (โหมด Keyboard)',
          'ค้นหาสินค้าได้รวดเร็ว',
          'ตัดสต็อกทันทีที่ขาย',
        ],
      },
      {
        subtitle: 'ใบเสร็จและภาษี',
        items: [
          'ออกใบเสร็จรับเงินอย่างย่อได้ทันที',
          'ออกใบกำกับภาษีเต็มรูป (Tax Invoice)',
          'รองรับการพิมพ์ผ่านเครื่องพิมพ์ Thermal',
        ],
      },
      {
        subtitle: 'การยกเลิก',
        items: [
          'ยกเลิกรายการขายได้ (ต้องระบุเหตุผล)',
          'Stock จะคืนกลับเข้าระบบอัตโนมัติ',
          'ระบบจะเก็บ Log ว่าใครเป็นคนยกเลิก',
        ],
      },
    ],
  },
  {
    icon: Package,
    title: 'สินค้า',
    description: 'จัดการสินค้าและติดตาม Stock',
    sections: [
      {
        subtitle: 'เพิ่มสินค้าใหม่',
        items: [
          'ชื่อสินค้า - ชื่อที่แสดงในระบบ',
          'หมวดหมู่ - จัดกลุ่มสินค้า',
          'SKU - รหัสสินค้า (สำหรับสแกน)',
          'ราคาทุน - ต้นทุนต่อชิ้น (สำคัญสำหรับคำนวณกำไร)',
          'ราคาขาย - ราคาที่ขายให้ลูกค้า',
          'Stock ขั้นต่ำ - แจ้งเตือนเมื่อเหลือน้อย',
        ],
      },
      {
        subtitle: 'การจัดการ Stock',
        items: [
          'Stock เพิ่ม: เมื่อบันทึก "ซื้อสินค้า"',
          'Stock ลด: เมื่อบันทึก "ขายสินค้า"',
          'ดูประวัติการเคลื่อนไหวของ Stock ได้ทุกรายการ',
        ],
      },
    ],
  },
  {
    icon: Users,
    title: 'ทีมและสิทธิ์การใช้งาน (Team)',
    description: 'จัดการพนักงานและกำหนดสิทธิ์เข้าถึง',
    sections: [
      {
        subtitle: 'การจัดการสมาชิก',
        items: [
          'เชิญพนักงานเข้าร่วมทีมผ่าน Email',
          'พนักงานจะเห็นข้อมูลร้านค้าของเจ้าของ',
          'ลบพนักงานออกจากทีมได้เมื่อลาออก',
        ],
      },
      {
        subtitle: 'กำหนดตำแหน่ง (Roles)',
        items: [
          'สร้างตำแหน่งงานได้ละเอียด (เช่น ผู้จัดการ, พนักงานเก็บเงิน)',
          'เลือกสิทธิ์ได้รายข้อ (เช่น ให้ขายได้ แต่ห้ามแก้สินค้า)',
          'ระบบมี Logic ช่วยติ๊กสิทธิ์ที่เกี่ยวข้องกันอัตโนมัติ',
        ],
      },
    ],
  },
  {
    icon: Receipt,
    title: 'ซื้อสินค้า',
    description: 'บันทึกการสั่งซื้อสินค้าเข้าร้าน',
    sections: [
      {
        subtitle: 'บันทึกการซื้อ',
        items: [
          'ใช้บันทึกเมื่อสั่งของมาเติม',
          'ระบุ Supplier และราคาทุนจริง',
          'Stock จะเพิ่มขึ้นตามจำนวนที่รับเข้า',
        ],
      },
    ],
  },
  {
    icon: BarChart3,
    title: 'รายงาน',
    description: 'วิเคราะห์ผลประกอบการของร้าน',
    sections: [
      {
        subtitle: 'ประเภทรายงาน',
        items: [
          'รายงานยอดขาย (รายวัน/รายเดือน)',
          'รายงานกำไรและต้นทุน',
          'รายงานสินค้าขายดี',
          'Export ข้อมูลเป็นไฟล์ CSV ได้',
        ],
      },
    ],
  },
  {
    icon: Settings,
    title: 'ตั้งค่า',
    description: 'ตั้งค่าข้อมูลร้านและระบบ',
    sections: [
      {
        subtitle: 'การตั้งค่าทั่วไป',
        items: [
          'ข้อมูลร้านค้า (ชื่อ, ที่อยู่, โลโก้)',
          'ตั้งค่าหมวดหมู่สินค้าและหมวดหมู่ค่าใช้จ่าย',
        ],
      },
    ],
  },
];

export default function HelpPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <HelpCircle className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">คู่มือการใช้งาน</h1>
          <p className="text-muted-foreground">เรียนรู้วิธีใช้งานระบบ Shop Inventory อย่างละเอียด</p>
        </div>
      </div>

      {/* User Journey Section */}
      <section>
        <h2 className="text-xl font-semibold mb-4">เริ่มต้นใช้งาน (User Manual)</h2>
        <p className="text-muted-foreground mb-6">ขั้นตอนการเริ่มต้นใช้งานระบบสำหรับผู้ใช้ใหม่</p>
        
        <div className="relative">
          {/* Timeline Line */}
          <div className="absolute left-6 top-8 bottom-8 w-0.5 bg-border hidden md:block" />
          
          <div className="space-y-6">
            {userJourneySteps.map((step, index) => (
              <div key={step.step} className="flex gap-4">
                <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold z-10">
                  {step.step}
                </div>
                <Card className="flex-1">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <step.icon className="h-5 w-5 text-primary" />
                      <CardTitle className="text-base">{step.title}</CardTitle>
                    </div>
                    <CardDescription>{step.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1">
                      {step.details.map((detail, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                          <span>{detail}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Separator />

      {/* Detailed Feature Guides */}
      <section>
        <h2 className="text-xl font-semibold mb-4">คู่มือแต่ละฟีเจอร์</h2>
        <p className="text-muted-foreground mb-6">รายละเอียดการใช้งานแต่ละส่วนของระบบ</p>
        
        <div className="space-y-6">
          {featureGuides.map((guide) => (
            <Card key={guide.title}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <guide.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle>{guide.title}</CardTitle>
                    <CardDescription>{guide.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 md:grid-cols-2">
                  {guide.sections.map((section, idx) => (
                    <div key={idx}>
                      <h4 className="font-medium mb-2 text-sm text-primary">{section.subtitle}</h4>
                      <ul className="space-y-1.5">
                        {section.items.map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <Circle className="h-1.5 w-1.5 mt-2 shrink-0 fill-current" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Contact Support */}
      <Card className="bg-primary/5 border-primary/20">
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
