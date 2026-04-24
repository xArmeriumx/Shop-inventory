'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { settingsNavItems } from '@/config/navigation';
import { usePermissions } from '@/hooks/use-permissions';
import { ChevronRight, Settings2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

export function SettingsSidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const { hasPermission } = usePermissions();

    const currentItem = settingsNavItems.find(item =>
        pathname === item.href || (item.href !== '/settings' && pathname.startsWith(item.href))
    );

    return (
        <>
            {/* Mobile Select Navigation */}
            <div className="lg:hidden mb-6">
                <Select
                    value={currentItem?.href || '/settings/profile'}
                    onValueChange={(value) => router.push(value)}
                >
                    <SelectTrigger className="w-full h-12">
                        <div className="flex items-center gap-3">
                            <Settings2 className="h-4 w-4 text-muted-foreground" />
                            <SelectValue placeholder="เลือกหมวดหมู่" />
                        </div>
                    </SelectTrigger>
                    <SelectContent>
                        {settingsNavItems.map((item) => {
                            if (item.permission && !hasPermission(item.permission)) return null;
                            return (
                                <SelectItem key={item.href} value={item.href}>
                                    <div className="flex items-center gap-3">
                                        <item.icon className="h-4 w-4" />
                                        <span>{item.title}</span>
                                    </div>
                                </SelectItem>
                            );
                        })}
                    </SelectContent>
                </Select>
            </div>

            {/* Desktop List Navigation */}
            <nav className="hidden lg:flex flex-col space-y-1">
                {settingsNavItems.map((item) => {
                    if (item.permission && !hasPermission(item.permission)) {
                        return null;
                    }

                    const isActive = pathname === item.href || (item.href !== '/settings' && pathname.startsWith(item.href));

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                'group flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-all',
                                isActive
                                    ? 'bg-primary text-primary-foreground shadow-sm'
                                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                            )}
                        >
                            <div className="flex items-center gap-3">
                                <item.icon className={cn(
                                    "h-4 w-4 shrink-0 transition-colors",
                                    isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                                )} />
                                <span>{item.title}</span>
                            </div>
                            {isActive && <ChevronRight className="h-4 w-4" />}
                        </Link>
                    );
                })}
            </nav>
        </>
    );
}
