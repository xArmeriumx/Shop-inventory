import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-6">
        <h1 className="text-3xl font-semibold text-foreground">
          Shop Inventory
        </h1>
        <p className="text-muted-foreground">
          ระบบบริหารสต็อกและการซื้อขาย
        </p>
        <Link 
          href="/login"
          className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          เข้าสู่ระบบ
        </Link>
      </div>
    </main>
  );
}
