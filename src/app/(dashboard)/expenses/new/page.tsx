import { PageHeader } from '@/components/layout/page-header';
import { ExpenseForm } from '@/components/features/expenses/expense-form';

export default function NewExpensePage() {
  return (
    <div>
      <PageHeader
        title="บันทึกค่าใช้จ่าย"
        description="เพิ่มรายการค่าใช้จ่ายใหม่"
      />
      <div className="max-w-2xl">
        <ExpenseForm />
      </div>
    </div>
  );
}
