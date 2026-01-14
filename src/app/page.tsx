import Link from 'next/link';
import { BarChart3, Package, Receipt } from 'lucide-react';

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" />
            <span className="font-semibold text-lg">Shop Inventory</span>
          </div>
          <div className="flex items-center gap-3">
            <Link 
              href="/login"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              เข้าสู่ระบบ
            </Link>
            <Link 
              href="/register"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              สมัครใช้งาน
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-24 text-center">
        <div className="max-w-3xl mx-auto space-y-6">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">
            ระบบบริหารจัดการ
            <span className="block text-primary">สต็อกและการขาย</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            จัดการสินค้า ติดตามยอดขาย วิเคราะห์กำไร
            ทุกอย่างในที่เดียว ใช้งานง่าย พร้อมรองรับหลายร้านค้า
          </p>
          <div className="flex items-center justify-center gap-4 pt-4">
            <Link 
              href="/register"
              className="inline-flex items-center justify-center rounded-md bg-primary px-8 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              เริ่มต้นใช้งานฟรี
            </Link>
            <Link 
              href="/login"
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-8 py-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              เข้าสู่ระบบ
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="border-t bg-muted/30">
        <div className="container mx-auto px-6 py-20">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold text-foreground">ฟีเจอร์หลัก</h2>
            <p className="text-muted-foreground mt-2">ครบทุกความต้องการสำหรับร้านค้าของคุณ</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center space-y-3 p-6">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto">
                <Package className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">จัดการสินค้า</h3>
              <p className="text-sm text-muted-foreground">
                เพิ่ม แก้ไข ติดตามสต็อกสินค้าได้อย่างง่ายดาย พร้อมแจ้งเตือนเมื่อสินค้าใกล้หมด
              </p>
            </div>

            <div className="text-center space-y-3 p-6">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto">
                <Receipt className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">บันทึกการขาย</h3>
              <p className="text-sm text-muted-foreground">
                สร้างใบเสร็จ บันทึกยอดขาย รองรับหลายช่องทางชำระเงิน พร้อมพิมพ์ใบเสร็จได้ทันที
              </p>
            </div>

            <div className="text-center space-y-3 p-6">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto">
                <BarChart3 className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">รายงานและวิเคราะห์</h3>
              <p className="text-sm text-muted-foreground">
                ดูยอดขาย กำไร ค่าใช้จ่าย พร้อมกราฟวิเคราะห์แนวโน้มธุรกิจของคุณ
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t">
        <div className="container mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Shop Inventory</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2026 Shop Inventory. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
