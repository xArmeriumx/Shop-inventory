'use client';

import { ShoppingBag, Trash2, Plus, Minus, User, CreditCard, ChevronRight, Calculator } from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { POSCart, POSCartItem, POSCustomer } from '@/lib/pos/types';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

interface CartPanelProps {
    cart: POSCart;
    customers: POSCustomer[];
    selectedCustomer: POSCustomer | null;
    onSelectCustomer: (customer: POSCustomer | null) => void;
    onUpdateQty: (productId: string, qty: number) => void;
    onRemoveItem: (productId: string) => void;
    onCheckout: () => void;
    isProcessing: boolean;
}

export function CartPanel({
    cart,
    customers,
    selectedCustomer,
    onSelectCustomer,
    onUpdateQty,
    onRemoveItem,
    onCheckout,
    isProcessing
}: CartPanelProps) {
    const isEmpty = cart.items.length === 0;

    return (
        <div className="flex flex-col h-full bg-slate-900 text-white shadow-2xl">
            {/* Customer Selector Header */}
            <div className="p-4 bg-slate-800/50 border-b border-slate-700">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-primary/20 rounded-lg">
                        <User className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Selected Customer</p>
                        <Select 
                            value={selectedCustomer?.id || 'walking'} 
                            onValueChange={(val) => {
                                if (val === 'walking') onSelectCustomer(null);
                                else onSelectCustomer(customers.find(c => c.id === val) || null);
                            }}
                        >
                            <SelectTrigger className="w-full bg-transparent border-none p-0 h-auto text-sm font-bold focus:ring-0">
                                <SelectValue placeholder="Walking Customer" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-800 border-slate-700 text-white">
                                <SelectItem value="walking">Walking Customer</SelectItem>
                                {customers.map(c => (
                                    <SelectItem key={c.id} value={c.id}>
                                        {c.name} {c.phone ? `(${c.phone})` : ''}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {/* Cart Items */}
            <div className="flex-1 overflow-hidden">
                <div className="px-4 py-2 flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <span>Order Details</span>
                    <span>{cart.itemCount} Items</span>
                </div>
                
                {isEmpty ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-600 px-10 text-center">
                        <div className="p-6 bg-slate-800/30 rounded-full mb-4 border border-slate-700/50">
                            <ShoppingBag className="h-10 w-10 opacity-20" />
                        </div>
                        <p className="text-sm font-medium italic">Your cart is empty. Scan items to begin.</p>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto px-4 custom-scrollbar">
                        <div className="space-y-3 pb-6">
                            {cart.items.map((item) => (
                                <CartItemRow 
                                    key={item.productId} 
                                    item={item} 
                                    onUpdateQty={onUpdateQty} 
                                    onRemove={onRemoveItem}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Billing Footer */}
            <div className="p-6 bg-slate-800/80 backdrop-blur-md border-t border-slate-700 space-y-4">
                <div className="space-y-2">
                    <div className="flex justify-between text-slate-400 text-sm font-medium">
                        <span>Subtotal</span>
                        <span>{formatCurrency(cart.totalAmount)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400 text-sm font-medium">
                        <span>Tax (Included)</span>
                        <span>{formatCurrency(0)}</span>
                    </div>
                    <div className="pt-2 border-t border-slate-700 flex justify-between items-end">
                        <div className="flex flex-col">
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Total Payable</span>
                            <span className="text-3xl font-black text-white tabular-nums">
                                {formatCurrency(cart.totalAmount)}
                            </span>
                        </div>
                        <Badge className="mb-2 bg-emerald-500/20 text-emerald-400 border-none">
                            Ready to Pay
                        </Badge>
                    </div>
                </div>

                <Button 
                    onClick={onCheckout}
                    disabled={isEmpty || isProcessing}
                    className="w-full h-16 text-lg font-black bg-primary hover:bg-primary/90 text-white shadow-xl shadow-primary/20 group overflow-hidden relative"
                >
                    {isProcessing ? (
                        "Processing..."
                    ) : (
                        <div className="flex items-center justify-between w-full">
                            <div className="flex items-center">
                                <CreditCard className="mr-3 h-6 w-6 group-hover:scale-110 transition-transform" />
                                CONSOLIDATE & PAY
                            </div>
                            <ChevronRight className="h-5 w-5 opacity-50 group-hover:translate-x-1 transition-transform" />
                        </div>
                    )}
                </Button>

                <div className="flex justify-center gap-4 text-[10px] text-slate-500 font-bold uppercase py-2">
                    <div className="flex items-center gap-1">
                        <Calculator className="h-3 w-3" />
                        Atomic Transaction
                    </div>
                    <div className="h-3 w-px bg-slate-700" />
                    <span>Real-time Sync</span>
                </div>
            </div>
        </div>
    );
}

function CartItemRow({ item, onUpdateQty, onRemove }: { item: POSCartItem, onUpdateQty: (pId: string, q: number) => void, onRemove: (id: string) => void }) {
    return (
        <div className="group bg-slate-800/40 hover:bg-slate-800/70 border border-slate-700/50 rounded-xl p-3 transition-all duration-200 animate-in slide-in-from-right-4">
            <div className="flex gap-4">
                <div className="h-12 w-12 rounded-lg bg-slate-700 flex items-center justify-center shrink-0 overflow-hidden border border-slate-600">
                    {item.product.image ? (
                        <Image 
                            src={item.product.image} 
                            alt={item.product.name}
                            width={48}
                            height={48}
                            className="w-full h-full object-cover" 
                            unoptimized
                        />
                    ) : (
                        <ShoppingBag className="h-5 w-5 text-slate-500" />
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                        <h4 className="text-sm font-bold truncate pr-2">{item.product.name}</h4>
                        <button 
                            onClick={() => onRemove(item.productId)}
                            className="p-1 text-slate-500 hover:text-rose-500 transition-colors"
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                    </div>
                    
                    <div className="flex items-center justify-between">
                        <div className="flex items-center bg-slate-900 rounded-lg p-0.5 border border-slate-700">
                            <button 
                                onClick={() => item.quantity > 1 && onUpdateQty(item.productId, item.quantity - 1)}
                                className="h-7 w-7 flex items-center justify-center hover:text-primary transition-colors"
                            >
                                <Minus className="h-3 w-3" />
                            </button>
                            <span className="w-8 text-center text-xs font-black tabular-nums">{item.quantity}</span>
                            <button 
                                onClick={() => item.quantity < item.product.stock && onUpdateQty(item.productId, item.quantity + 1)}
                                className="h-7 w-7 flex items-center justify-center hover:text-primary transition-colors"
                            >
                                <Plus className="h-3 w-3" />
                            </button>
                        </div>
                        <div className="text-right">
                            <div className="text-[10px] text-slate-500 font-medium line-through decoration-slate-700">
                                {formatCurrency(item.salePrice)}
                            </div>
                            <div className="text-sm font-black text-emerald-400">
                                {formatCurrency(item.subtotal)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
