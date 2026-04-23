'use client';

import { useState, useEffect, useTransition } from 'react';
import {
    Card,
    CardContent
} from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
    Search,
    FileUp,
    ArrowRightCircle,
    CheckCircle2,
    XCircle,
    Info,
    ArrowDownUp
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
    getMatchCandidatesAction,
    matchLineAction,
    getUnmatchedBankLinesAction,
    getUnreconciledLedgerAction
} from '@/actions/bank';
import { StatementImportModal } from '@/components/accounting/reconcile/statement-import-modal';
import { Loader2 } from 'lucide-react';

interface ReconcileWorkspaceProps {
    bankAccounts: any[];
    initialBankId: string;
}

export function ReconcileWorkspace({ bankAccounts, initialBankId }: ReconcileWorkspaceProps) {
    const [selectedBankId, setSelectedBankId] = useState(initialBankId);
    const [selectedBankLine, setSelectedBankLine] = useState<any>(null);
    const [candidates, setCandidates] = useState<any[]>([]);
    const [isLoadingCandidates, setIsLoadingCandidates] = useState(false);
    const [isPending, startTransition] = useTransition();

    const [bankLines, setBankLines] = useState<any[]>([]);
    const [ledgerLines, setLedgerLines] = useState<any[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(false);

    const fetchData = async () => {
        if (!selectedBankId) return;
        setIsLoadingData(true);
        try {
            const [bRes, lRes] = await Promise.all([
                getUnmatchedBankLinesAction(selectedBankId),
                getUnreconciledLedgerAction(selectedBankId)
            ]);

            if (bRes.success) setBankLines(bRes.data as any[]);
            if (lRes.success) setLedgerLines(lRes.data as any[]);

            if (!bRes.success || !lRes.success) {
                toast.error(bRes.message || lRes.message || 'ไม่สามารถดึงข้อมูลได้');
            }
        } catch (error) {
            toast.error('ไม่สามารถดึงข้อมูลได้');
        } finally {
            setIsLoadingData(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [selectedBankId]);

    const handleSelectBankLine = async (line: any) => {
        setSelectedBankLine(line);
        setIsLoadingCandidates(true);
        try {
            const res = await getMatchCandidatesAction(line.id);
            if (res.success) {
                setCandidates(res.data as any[]);
            } else {
                toast.error(res.message || 'ไม่สามารถค้นหารายการที่เกี่ยวข้องได้');
            }
        } catch (error) {
            toast.error('ไม่สามารถค้นหารายการที่เกี่ยวข้องได้');
        } finally {
            setIsLoadingCandidates(false);
        }
    };

    const handleMatch = (journalLineId: string) => {
        startTransition(async () => {
            try {
                const res = await matchLineAction(selectedBankLine.id, [journalLineId]);
                if (res.success) {
                    toast.success('จับคู่รายการสำเร็จ');
                    setSelectedBankLine(null);
                    setCandidates([]);
                    fetchData(); // Refresh both lists
                } else {
                    toast.error(res.message || 'เกิดข้อผิดพลาดในการจับคู่');
                }
            } catch (error) {
                toast.error('เกิดข้อผิดพลาดในการจับคู่');
            }
        });
    };

    const selectedBank = bankAccounts.find(b => b.id === selectedBankId);

    return (
        <div className="flex h-full divide-x">
            {/* Left Column: Bank Statement Lines */}
            <div className="w-1/2 flex flex-col bg-muted/20">
                <div className="p-4 border-b bg-background flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Select value={selectedBankId} onValueChange={setSelectedBankId}>
                            <SelectTrigger className="w-[200px] font-semibold">
                                <SelectValue placeholder="เลือกธนาคาร" />
                            </SelectTrigger>
                            <SelectContent>
                                {bankAccounts.map((b) => (
                                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <div className="text-xs text-muted-foreground">
                            {selectedBank?.bankName} - {selectedBank?.accountNo}
                        </div>
                    </div>
                    <StatementImportModal bankAccountId={selectedBankId}>
                        <Button size="sm" variant="outline" className="gap-2">
                            <FileUp className="h-4 w-4" />
                            Import CSV
                        </Button>
                    </StatementImportModal>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">ธนาคารส่งมา (Bank Truth)</h3>
                        <div className="relative">
                            <Search className="absolute left-2 top-2.5 h-3 w-3 text-muted-foreground" />
                            <input className="h-8 w-48 rounded-md border border-input bg-background pl-8 text-xs focus:ring-1 focus:ring-primary outline-none" placeholder="ค้นหาตามวันที่/ยอดเงิน..." />
                        </div>
                    </div>

                    {/* Placeholder for no data */}
                    {bankLines.length === 0 && (
                        <div className="py-20 flex flex-col items-center justify-center border-2 border-dashed rounded-xl opacity-30 text-center">
                            <FileUp className="h-10 w-10 mb-2" />
                            <p className="text-sm font-medium">ยังไม่มีข้อมูล Statement</p>
                            <p className="text-xs">กรุณานำเข้าไฟล์ CSV หรือระบุเป้าหมาย</p>
                        </div>
                    )}

                    {bankLines.map((line) => (
                        <Card
                            key={line.id}
                            className={cn(
                                "cursor-pointer transition-all hover:ring-2 hover:ring-primary/50",
                                selectedBankLine?.id === line.id ? "ring-2 ring-primary bg-primary/5" : ""
                            )}
                            onClick={() => handleSelectBankLine(line)}
                        >
                            <CardContent className="p-4 flex gap-4">
                                <div className="flex flex-col items-center justify-center w-12 border-r pr-4">
                                    <span className="text-xs font-bold text-muted-foreground uppercase">{line.bookingDate.toLocaleString('en-US', { month: 'short' })}</span>
                                    <span className="text-xl font-bold">{line.bookingDate.getDate()}</span>
                                </div>
                                <div className="flex-1 space-y-1">
                                    <div className="flex justify-between items-start">
                                        <p className="font-semibold text-sm line-clamp-1">{line.description}</p>
                                        <div className={cn(
                                            "text-sm font-bold",
                                            line.netAmount > 0 ? "text-green-600" : "text-red-600"
                                        )}>
                                            {line.netAmount > 0 ? '+' : ''}{line.netAmount.toLocaleString()}
                                        </div>
                                    </div>
                                    <p className="text-xs text-muted-foreground">Ref: {line.referenceNo || '-'}</p>
                                </div>
                                <ArrowRightCircle className={cn(
                                    "h-5 w-5 self-center transition-opacity",
                                    selectedBankLine?.id === line.id ? "opacity-100 text-primary" : "opacity-0"
                                )} />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>

            {/* Right Column: Matching Candidates / Ledger */}
            <div className="w-1/2 flex flex-col">
                <div className="p-4 border-b bg-muted/5 flex items-center justify-between">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        <ArrowDownUp className="h-4 w-4" />
                        รายการในระบบบัญชี (Ledger Truth)
                    </h3>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {!selectedBankLine ? (
                        <div className="h-full flex flex-col items-center justify-center opacity-30 text-center space-y-2">
                            <Info className="h-10 w-10" />
                            <p className="text-sm font-medium">เลือกรายการจากฝั่งธนาคารด้านซ้าย</p>
                            <p className="text-xs">เพื่อค้นหาใบสำคัญที่ตรงกันเพื่อจับคู่</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="bg-primary/5 p-4 rounded-lg border border-primary/20 mb-6 group">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold text-primary uppercase">🔍 Searching Matches for:</span>
                                    <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setSelectedBankLine(null)}>ยกเลิก</Button>
                                </div>
                                <div className="flex justify-between items-end">
                                    <div>
                                        <p className="font-bold">{selectedBankLine.description}</p>
                                        <p className="text-xs text-muted-foreground">{selectedBankLine.bookingDate.toDateString()}</p>
                                    </div>
                                    <p className={cn(
                                        "text-xl font-black",
                                        selectedBankLine.netAmount > 0 ? "text-green-600" : "text-red-600"
                                    )}>
                                        {selectedBankLine.netAmount.toLocaleString()} THB
                                    </p>
                                </div>
                            </div>

                            {isLoadingCandidates ? (
                                <div className="py-10 flex flex-col items-center justify-center gap-2 opacity-50">
                                    <Loader2 className="h-6 w-6 animate-spin" />
                                    <p className="text-xs">กำลังค้นหาใบสำคัญรรับ/จ่ายที่ตรงกัน...</p>
                                </div>
                            ) : candidates.length > 0 ? (
                                <div className="space-y-3">
                                    <p className="text-xs text-muted-foreground font-semibold">แนะนำรายการที่ตรงกัน ({candidates.length})</p>
                                    {candidates.map((candidate) => (
                                        <Card key={candidate.id} className="border-green-200 bg-green-50/10 hover:bg-green-50/30 transition-colors">
                                            <CardContent className="p-4 flex gap-4">
                                                <div className="flex-1 space-y-1">
                                                    <div className="flex justify-between">
                                                        <p className="font-bold text-sm">{candidate.journalEntry.entryNo}</p>
                                                        <div className={cn(
                                                            "text-sm font-bold",
                                                            candidate.debitAmount > 0 ? "text-blue-600" : "text-orange-600"
                                                        )}>
                                                            {candidate.debitAmount > 0 ? candidate.debitAmount.toLocaleString() : (-candidate.creditAmount).toLocaleString()}
                                                        </div>
                                                    </div>
                                                    <p className="text-xs line-clamp-1">{candidate.description}</p>
                                                    <div className="flex gap-2 pt-2">
                                                        <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded uppercase font-bold text-muted-foreground italic">
                                                            {candidate.journalEntry.sourceType}
                                                        </span>
                                                        <span className="text-[10px] text-muted-foreground">
                                                            {new Date(candidate.journalEntry.journalDate).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                </div>
                                                <Button
                                                    size="sm"
                                                    className="self-center bg-green-600 hover:bg-green-700 text-white gap-2 h-8"
                                                    onClick={() => handleMatch(candidate.id)}
                                                    disabled={isPending}
                                                >
                                                    <CheckCircle2 className="h-3 w-3" />
                                                    Match
                                                </Button>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            ) : (
                                <div className="py-10 flex flex-col items-center justify-center text-center space-y-3 border-2 border-dashed rounded-xl opacity-50">
                                    <XCircle className="h-10 w-10 text-red-400" />
                                    <div>
                                        <p className="text-sm font-bold">ไม่พบรายการที่แนะนำ</p>
                                        <p className="text-xs px-10">ระบบหาไม่พบยอดเงินและวันที่ที่ตรงกัน (±7 วัน) ในสมุดบัญชี</p>
                                    </div>
                                    <Button variant="outline" size="sm">Create Adjustment Entry</Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

