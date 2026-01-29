import { PageHeader } from '@/components/layout/page-header';
import { AIChat } from '@/components/features/ai/ai-chat';

export default function AIPage() {
  return (
    <div>
      <PageHeader
        title="AI ผู้ช่วย"
        description="ถามข้อมูลร้านค้า วิเคราะห์ยอดขาย และรับคำแนะนำจาก AI"
      />
      <AIChat />
    </div>
  );
}
