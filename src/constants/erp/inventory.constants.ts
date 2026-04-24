import { StatusConfig } from '@/components/ui/status-badge';

export const STOCK_TAKE_STATUS_CONFIG: Record<string, StatusConfig> = {
    DRAFT: {
        label: 'ร่าง',
        variant: 'outline',
        className: 'border-blue-500 text-blue-600'
    },
    SUBMITTED: {
        label: 'รอยืนยัน',
        variant: 'secondary',
        className: 'bg-yellow-100 text-yellow-700 border-yellow-200'
    },
    COMPLETED: {
        label: 'สำเร็จ',
        variant: 'default',
        className: 'bg-green-600 hover:bg-green-700'
    },
    CANCELLED: {
        label: 'ยกเลิก',
        variant: 'destructive',
        className: ''
    }
};
