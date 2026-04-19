'use client';

import React, { useState } from 'react';
import {
    LayoutDashboard,
    DollarSign,
    Truck,
    RotateCcw,
    Package,
    Warehouse,
    Receipt,
    Briefcase,
    Users,
    MinusCircle,
    PlusCircle,
    Sparkles,
    BarChart3,
    Settings,
    HelpCircle,
    Activity,
    ShieldCheck,
    LogOut,
    Bell,
    ShoppingCart,
    Box,
    X,
    Smartphone,
    Menu,
    MoreHorizontal,
    Grid,
    User,
} from 'lucide-react';
import { DashboardView } from './views/dashboard-view';
import { SalesView } from './views/sales-view';
import { ProductsView } from './views/products-view';
import { POSView } from './views/pos-view';
import { ShipmentsView, ReturnsView, WarehouseView } from './views/logistics-views';
import { PurchasesView, FinanceViews } from './views/finance-views';
import { PeopleView } from './views/people-views';
import { ReportsView, AIView, AuditView, SettingsView, HelpView, HealthView } from './views/extra-views';

type ViewType = 'dashboard' | 'sales' | 'products' | 'pos' | 'shipments' | 'returns' | 'warehouse' | 'purchases' | 'suppliers' | 'customers' | 'expenses' | 'incomes' | 'ai' | 'reports' | 'settings' | 'help' | 'health' | 'audit';

export function SystemPreview() {
    const [currentView, setCurrentView] = useState<ViewType>('dashboard');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const navItems = [
        { id: 'dashboard' as const, icon: LayoutDashboard, label: 'Dashboard' },
        { id: 'sales' as const, icon: DollarSign, label: 'ขายสินค้า' },
        { id: 'shipments' as const, icon: Truck, label: 'จัดส่งสินค้า' },
        { id: 'returns' as const, icon: RotateCcw, label: 'คืนสินค้า' },
        { id: 'products' as const, icon: Package, label: 'สินค้า' },
        { id: 'warehouse' as const, icon: Warehouse, label: 'คลังสินค้า (Mobile)' },
        { id: 'purchases' as const, icon: Receipt, label: 'ซื้อสินค้า' },
        { id: 'suppliers' as const, icon: Briefcase, label: 'ผู้จำหน่าย' },
        { id: 'customers' as const, icon: Users, label: 'ลูกค้า' },
        { id: 'expenses' as const, icon: MinusCircle, label: 'ค่าใช้จ่าย' },
        { id: 'incomes' as const, icon: PlusCircle, label: 'รายรับอื่นๆ' },
        { id: 'ai' as const, icon: Sparkles, label: 'AI ผู้ช่วย' },
        { id: 'reports' as const, icon: BarChart3, label: 'รายงาน' },
        { id: 'settings' as const, icon: Settings, label: 'ตั้งค่า' },
        { id: 'help' as const, icon: HelpCircle, label: 'คู่มือ' },
        { id: 'health' as const, icon: Activity, label: 'สถานะระบบ' },
        { id: 'audit' as const, icon: ShieldCheck, label: 'ประวัติการใช้งาน (Audit)' },
    ];

    const renderContent = () => {
        switch (currentView) {
            case 'dashboard':
                return <DashboardView />;
            case 'pos':
                return <POSView />;
            case 'sales':
                return <SalesView />;
            case 'products':
                return <ProductsView />;
            case 'shipments':
                return <ShipmentsView />;
            case 'returns':
                return <ReturnsView />;
            case 'warehouse':
                return <WarehouseView />;
            case 'purchases':
                return <PurchasesView />;
            case 'suppliers':
                return <PeopleView type="suppliers" />;
            case 'customers':
                return <PeopleView type="customers" />;
            case 'expenses':
                return <FinanceViews type="expenses" />;
            case 'incomes':
                return <FinanceViews type="incomes" />;
            case 'ai':
                return <AIView />;
            case 'reports':
                return <ReportsView />;
            case 'settings':
                return <SettingsView />;
            case 'help':
                return <HelpView />;
            case 'health':
                return <HealthView />;
            case 'audit':
                return <AuditView />;
            default:
                return (
                    <div className="h-full flex flex-col items-center justify-center p-12 text-center space-y-4">
                        <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center">
                            <Box className="h-10 w-10 text-muted-foreground/30" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold">ส่วนนี้อยู่ระหว่างการจำลอง</h3>
                            <p className="text-sm text-muted-foreground max-w-xs mx-auto mt-2 text-pretty">
                                โมดูลจริงรองรับการใช้งานเต็มรูปแบบ แต่ใน Mockup นี้เราจำลองเฉพาะส่วน Dashboard, รายการขาย และสินค้า เพื่อให้เห็นภาพการทำงานหลัก
                            </p>
                        </div>
                        <button
                            onClick={() => setCurrentView('dashboard')}
                            className="px-6 py-2 rounded-lg bg-foreground text-background text-sm font-bold"
                        >
                            กลับไปหน้าแรก
                        </button>
                    </div>
                );
        }
    };

    return (
        <div className="relative group">
            {/* Reduced decorative backgrounds */}
            <div className="absolute -inset-1 bg-foreground/5 rounded-[2rem] blur-2xl opacity-50" />

            <div className="relative rounded-[1.5rem] border bg-background/80 backdrop-blur-xl shadow-2xl overflow-hidden ring-1 ring-border/50">
                {/* Browser Header */}
                <div className="h-10 border-b bg-muted/30 flex items-center px-4 justify-between">
                    <div className="flex gap-1.5">
                        <div className="h-2.5 w-2.5 rounded-full bg-border" />
                        <div className="h-2.5 w-2.5 rounded-full bg-border" />
                        <div className="h-2.5 w-2.5 rounded-full bg-border" />
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="h-3.5 w-3.5 rounded bg-muted/50" />
                        <div className="h-3 w-32 rounded bg-muted/50" />
                    </div>
                    <div className="w-10" />
                </div>

                <div className="flex h-[600px] md:h-[750px]">
                    {/* Left Sidebar (Mockup) */}
                    <div className="hidden md:flex w-64 border-r flex-col p-4 bg-muted/5 overflow-y-auto custom-scrollbar">
                        {/* Brand */}
                        <div className="mb-6 px-3 py-1 flex items-center gap-2.5">
                            <div className="h-7 w-7 rounded-lg bg-foreground flex items-center justify-center text-background font-bold text-xs shrink-0">S</div>
                            <div className="text-xs font-bold truncate">Shop Inventory</div>
                        </div>

                        {/* Primary POS Button */}
                        <div className="mb-6">
                            <button
                                onClick={() => setCurrentView('pos')}
                                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg bg-[#18181b] text-white text-sm font-bold shadow-lg shadow-black/10 hover:bg-[#18181b]/90"
                            >
                                <ShoppingCart className="h-4 w-4" />
                                POS
                            </button>
                        </div>

                        {/* Nav Items */}
                        <nav className="space-y-0.5 flex-1">
                            {navItems.map((item) => (
                                <button
                                    key={item.label}
                                    onClick={() => setCurrentView(item.id as ViewType)}
                                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${currentView === item.id
                                        ? 'bg-muted/80 text-foreground'
                                        : 'text-muted-foreground hover:bg-muted'
                                        }`}
                                >
                                    <item.icon className={`h-4 w-4 ${currentView === item.id
                                        ? 'text-foreground'
                                        : 'text-muted-foreground/60'
                                        }`} />
                                    {item.label}
                                </button>
                            ))}
                        </nav>

                        <div className="pt-4 mt-4 border-t">
                            <button className="w-full flex items-center gap-3 px-3 py-2 text-muted-foreground hover:text-foreground text-[13px] font-medium transition-colors">
                                <LogOut className="h-4 w-4" />
                                ออกจากระบบ
                            </button>
                        </div>
                    </div>

                    {/* Main Content (Mockup) */}
                    <div className="flex-1 flex flex-col min-w-0 bg-background">
                        {/* Inner Header */}
                        <header className="h-14 border-b flex items-center justify-between px-8 shrink-0 bg-background">
                            <div className="flex items-center gap-4">
                                {/* Mobile Menu Trigger (Hamburger) */}
                                <button
                                    onClick={() => setIsMobileMenuOpen(true)}
                                    className="md:hidden h-10 w-10 flex items-center justify-center text-foreground"
                                >
                                    <Menu className="h-6 w-6" />
                                </button>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="relative cursor-pointer group/bell p-2">
                                    <Bell className="h-6 w-6 text-foreground group-hover/bell:text-foreground transition-colors" />
                                    <div className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center border-2 border-background">1</div>
                                </div>
                                <div className="h-9 w-9 rounded-full bg-black flex items-center justify-center text-white text-sm font-bold shrink-0 cursor-pointer">
                                    T
                                </div>
                            </div>
                        </header>

                        {/* View Container */}
                        <main className="flex-1 overflow-auto p-6 md:p-8 bg-[#fbfbfc] custom-scrollbar pb-24 md:pb-8">
                            {renderContent()}
                        </main>
                    </div>
                </div>

                {/* Mobile Bottom Tab Bar */}
                <div className="md:hidden absolute bottom-0 left-0 right-0 bg-background/95 backdrop-blur-md border-t z-50 flex justify-around items-center h-[65px] px-2 shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
                    {[
                        { id: 'dashboard', label: 'หน้าหลัก', icon: Grid },
                        { id: 'products', label: 'สินค้า', icon: Box },
                        { id: 'reports', label: 'รายงาน', icon: BarChart3 },
                        { id: 'more', label: 'เพิ่มเติม', icon: Menu },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => {
                                if (tab.id === 'more') {
                                    setIsMobileMenuOpen(true);
                                } else {
                                    setCurrentView(tab.id as ViewType);
                                }
                            }}
                            className={`flex flex-col items-center justify-center gap-1 min-w-[60px] h-full transition-all ${currentView === tab.id
                                ? 'text-foreground'
                                : 'text-muted-foreground'
                                }`}
                        >
                            <tab.icon className={`h-6 w-6 mt-1 ${currentView === tab.id ? 'text-foreground stroke-[2.5]' : 'text-muted-foreground'}`} />
                            <span className={`text-[10px] font-bold ${currentView === tab.id ? 'text-foreground' : 'text-muted-foreground'}`}>{tab.label}</span>
                        </button>
                    ))}
                </div>

                {/* Mobile Navigation Drawer */}
                {isMobileMenuOpen && (
                    <div className="md:hidden fixed inset-0 z-[100]">
                        {/* Backdrop */}
                        <div
                            className="absolute inset-0 bg-background/80 backdrop-blur-sm animate-in fade-in duration-300"
                            onClick={() => setIsMobileMenuOpen(false)}
                        />

                        {/* Drawer */}
                        <div className="absolute top-0 left-0 bottom-0 w-[280px] bg-background border-r shadow-2xl flex flex-col p-6 animate-in slide-in-from-left duration-300">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-2.5">
                                    <div className="h-8 w-8 rounded-lg bg-foreground flex items-center justify-center text-background font-bold text-sm">S</div>
                                    <div className="font-bold text-sm">Shop Inventory</div>
                                </div>
                                <button
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-foreground"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            <div className="mb-6">
                                <button
                                    onClick={() => {
                                        setIsMobileMenuOpen(false);
                                    }}
                                    className="hidden w-full items-center gap-3 px-4 py-3 rounded-xl bg-foreground text-background text-sm font-bold shadow-lg"
                                >
                                    <ShoppingCart className="h-4 w-4" />
                                    POS
                                </button>
                            </div>

                            <nav className="space-y-1 flex-1 overflow-y-auto custom-scrollbar pr-2">
                                {navItems.map((item) => (
                                    <button
                                        key={item.label}
                                        onClick={() => {
                                            setCurrentView(item.id as ViewType);
                                            setIsMobileMenuOpen(false);
                                        }}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${currentView === item.id
                                            ? 'bg-muted text-foreground'
                                            : 'text-muted-foreground hover:bg-muted'
                                            }`}
                                    >
                                        <item.icon className={`h-4 w-4 ${currentView === item.id ? 'text-foreground' : 'text-muted-foreground/60'}`} />
                                        {item.label}
                                    </button>
                                ))}
                            </nav>
                        </div>
                    </div>
                )}
            </div>

            <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.05);
          border-radius: 10px;
        }
        .group:hover .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.1);
        }
      `}</style>
        </div>
    );
}
