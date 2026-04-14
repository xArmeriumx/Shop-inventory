const fs = require('fs');
let code = fs.readFileSync('src/services/report.service.ts', 'utf8');

code = code.replace(/'use server';/g, '');
code = code.replace(/import \{ requirePermission \} from '@\/lib\/auth-guard';/g, "import { RequestContext } from './product.service';");

// Convert exported functions to object methods
code = code.replace(/export async function (\w+)\(([^)]*)\) \{/g, "$1: async function ($2, ctx: RequestContext) {");
code = code.replace(/export async function (\w+)\(\n([^)]*)\n\) \{/g, "$1: async function (\n$2,\n  ctx: RequestContext) {");

// Remove requirePermission calls
code = code.replace(/const ctx = await requirePermission\('[^']+'\);/g, "");

// Wrap everything in export const ReportService = { ... }
const functionsRegex = /(\w+: async function \([\s\S]*?\)(?::\s*Promise<[^>]+>)?\s*\{[\s\S]*?\n\})/g;

let methodBodies = [];
let match;
while ((match = functionsRegex.exec(code)) !== null) {
    methodBodies.push(match[0] + ',');
}

let topStuff = code.substring(0, code.indexOf('ReportData {'));
topStuff += "export interface ReportData {\n  period: { start: string; end: string };\n  summary: {\n    totalSales: number;\n    totalCost: number;\n    totalExpenses: number;\n    totalIncomes: number;\n    grossProfit: number;\n    netProfit: number;\n  };\n  dailyStats: {\n    date: string;\n    sales: number;\n    cost: number;\n    expenses: number;\n    incomes: number;\n    profit: number;\n  }[];\n  sales: any[]; \n  expenses: any[];\n  incomes: any[];\n}\n\n";

let finalServiceCode = `${topStuff}export const ReportService = {\n`;

let newCode = code.replace(/export interface ReportData \{[\s\S]*?\}\n/, "");
newCode = newCode.replace(/export async function/g, "// matched earlier");

// It's probably easier to just do simple sed-like replacements if I don't parse properly.
