'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Search, Grid, List, Tag, ShoppingCart } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { POSProduct, POSCategory } from '@/lib/pos/types';
import { formatCurrency } from '@/lib/formatters';
import { Badge } from '@/components/ui/badge';

interface ProductCatalogProps {
    products: POSProduct[];
    categories: POSCategory[];
    onAddToCart: (product: POSProduct) => void;
}

export function ProductCatalog({ products, categories, onAddToCart }: ProductCatalogProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

    const filteredProducts = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            p.sku?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = !selectedCategory || p.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    return (
        <div className="flex flex-col h-full bg-slate-50/50">
            {/* Search & Filter Bar */}
            <div className="p-4 space-y-4 bg-white border-b shadow-sm">
                <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                    <Input 
                        placeholder="Search products or scan SKU..." 
                        className="pl-10 h-12 bg-slate-100/50 border-none focus-visible:ring-2 focus-visible:ring-primary/20 transition-all font-medium"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    <button
                        onClick={() => setSelectedCategory(null)}
                        className={cn(
                            "px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all",
                            !selectedCategory 
                                ? "bg-primary text-white shadow-md shadow-primary/20" 
                                : "bg-white text-slate-600 border hover:bg-slate-50"
                        )}
                    >
                        All Items
                    </button>
                    {categories.map((cat) => (
                        <button
                            key={cat.id}
                            onClick={() => setSelectedCategory(cat.code)}
                            className={cn(
                                "px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all",
                                selectedCategory === cat.code 
                                    ? "bg-primary text-white shadow-md shadow-primary/20" 
                                    : "bg-white text-slate-600 border hover:bg-slate-50"
                            )}
                        >
                            {cat.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Product Grid */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredProducts.map((product) => (
                        <button
                            key={product.id}
                            onClick={() => onAddToCart(product)}
                            disabled={product.stock <= 0}
                            className={cn(
                                "group relative flex flex-col bg-white rounded-xl border shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden text-left",
                                product.stock <= 0 && "opacity-60 grayscale cursor-not-allowed"
                            )}
                        >
                            {/* Image Placeholder or Image */}
                            <div className="aspect-square bg-slate-100 flex items-center justify-center overflow-hidden">
                                {product.image ? (
                                    <Image 
                                        src={product.image} 
                                        alt={product.name} 
                                        width={200} 
                                        height={200} 
                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                                        unoptimized
                                    />
                                ) : (
                                    <Tag className="h-10 w-10 text-slate-300 group-hover:scale-110 transition-transform duration-500" />
                                )}
                                
                                {product.stock <= 5 && product.stock > 0 && (
                                    <div className="absolute top-2 left-2">
                                        <Badge variant="warning" className="bg-amber-500 text-white border-none shadow-sm">
                                            Low Stock
                                        </Badge>
                                    </div>
                                )}
                            </div>

                            <div className="p-3 flex flex-col flex-1">
                                <span className="text-xs font-semibold text-slate-400 uppercase tracking-tight mb-1">{product.category}</span>
                                <h3 className="font-bold text-slate-800 line-clamp-2 leading-tight mb-2 group-hover:text-primary transition-colors">{product.name}</h3>
                                <div className="mt-auto flex items-end justify-between">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-slate-400 font-medium">Available: {product.stock}</span>
                                        <span className="text-lg font-black text-primary">{formatCurrency(product.salePrice)}</span>
                                    </div>
                                    <div className={cn(
                                        "h-8 w-8 rounded-lg flex items-center justify-center bg-slate-50 group-hover:bg-primary group-hover:text-white transition-colors border",
                                        product.stock <= 0 ? "bg-slate-200" : "animate-in fade-in"
                                    )}>
                                        <ShoppingCart className="h-4 w-4" />
                                    </div>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>

                {filteredProducts.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full py-20 text-slate-400">
                    <Search className="h-12 w-12 mb-4 opacity-20" />
                    <p className="font-medium italic">No products found matching your search</p>
                  </div>
                )}
            </div>
        </div>
    );
}
