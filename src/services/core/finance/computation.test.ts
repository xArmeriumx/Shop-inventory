import { ComputationEngine } from './computation.service';

function test() {
    console.log('--- STARTING COMPUTATION ENGINE TESTS ---');

    // Test 1: VAT Inclusive (Back-calculation)
    const res1 = ComputationEngine.calculateTotals(
        [{ qty: 1, unitPrice: 107 }],
        { type: 'FIXED', value: 0 },
        { rate: 7, mode: 'INCLUSIVE', kind: 'VAT' }
    );
    console.log('Test 1 (VAT Inclusive 107.00):');
    console.log(`  Taxable Base: ${res1.totals.taxableBaseAmount} (Expect 100.00)`);
    console.log(`  Tax Amount: ${res1.totals.taxAmount} (Expect 7.00)`);

    // Test 2: Proportional Discount Allocation (0.01 remainder)
    // 10.00 discount on 3 items of 33.33 each (total 99.99)
    const res2 = ComputationEngine.calculateTotals(
        [
            { qty: 1, unitPrice: 33.33 },
            { qty: 1, unitPrice: 33.33 },
            { qty: 1, unitPrice: 33.33 },
        ],
        { type: 'FIXED', value: 10.00 }
    );
    console.log('\nTest 2 (Proportional Discount 10.00 on 3 lines):');
    const sumDiscounts = res2.lines.reduce((acc, l) => acc + l.billDiscountAllocation, 0);
    console.log(`  Sum of Disocunt Allocations: ${sumDiscounts.toFixed(2)} (Expect 10.00)`);
    console.log(`  Line 1 Discount: ${res2.lines[0].billDiscountAllocation}`);
    console.log(`  Line 2 Discount: ${res2.lines[1].billDiscountAllocation}`);
    console.log(`  Line 3 Discount: ${res2.lines[2].billDiscountAllocation}`);

    // Test 3: WHT Gross-up
    const res3 = ComputationEngine.calculateWHT(100, 3, true);
    console.log('\nTest 3 (WHT Gross-up 3% on 100.00):');
    // Formula: 100 * (3 / (100 - 3)) = 100 * (3 / 97) = 3.09278... -> 3.09
    console.log(`  WHT Amount: ${res3.taxAmount} (Expect 3.09)`);
    console.log(`  Net Paid: ${res3.netPaid} (Expect 96.91)`);

    // Test 4: Percent Discount
    const res4 = ComputationEngine.calculateTotals(
        [{ qty: 2, unitPrice: 500 }],
        { type: 'PERCENT', value: 10 }
    );
    console.log('\nTest 4 (10% Discount on 1000.00):');
    console.log(`  Discount: ${res4.totals.billDiscountAmount} (Expect 100.00)`);
    console.log(`  Net: ${res4.totals.netAmount} (Expect 900.00)`);

    console.log('\n--- TESTS COMPLETED ---');
}

test();
