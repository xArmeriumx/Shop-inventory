// ─────────────────────────────────────────────────────────────────────────────
// Barrel: components/ui
//
// ⚠️  RULES:
//   • Keep this list alphabetically sorted
//   • Use explicit named exports — never `export * from './xxx'`
//   • Use `export type` for TypeScript types to avoid accidental runtime imports
//   • Do NOT add server-only utilities or Prisma types here
// ─────────────────────────────────────────────────────────────────────────────

// shadcn-ui primitives
export { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './alert-dialog';
export { Alert, AlertDescription, AlertTitle } from './alert';
export { Avatar, AvatarFallback, AvatarImage } from './avatar';
export { Badge, badgeVariants } from './badge';
export { Button, buttonVariants } from './button';
export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './card';
export { Checkbox } from './checkbox';
export { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut } from './command';
export { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './dialog';
export { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuPortal, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from './dropdown-menu';
export { Input } from './input';
export { Label } from './label';
export { Popover, PopoverContent, PopoverTrigger } from './popover';
export { Progress } from './progress';
export { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from './select';
export { Separator } from './separator';
export { Skeleton } from './skeleton';
export { Switch } from './switch';
export { Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow } from './table';
export { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';
export { Textarea } from './textarea';

// ERP shared components
export { BackPageHeader } from './back-page-header';
export { EmptyState } from './empty-state';
export { FileUpload } from './file-upload';
export { FormField } from './form-field';
export { GuidedErrorAlert } from './guided-error-alert';
export { ImageModal } from './image-modal';
export { MetricCard } from './metric-card';
export { SafeBoundary } from './safe-boundary';
export { SafeInput } from './safe-input';
export { SearchToolbar } from './search-toolbar';
export { SectionHeader } from './section-header';
export { StatusBadge } from './status-badge';
export { TablePagination } from './table-pagination';
export { TableShell } from './table-shell';

// Types — separated so consumers can `import type` cleanly
export type { StatusConfig } from './status-badge';
export type { PaginationInfo, TablePaginationProps } from './table-pagination';
export type { SectionHeaderProps } from './section-header';
