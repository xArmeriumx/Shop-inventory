/**
 * Thai Address Database Utility
 * SSOT for province/district/sub-district/zipcode resolution
 *
 * Database format (compact nested arrays):
 * [[province, [[amphoe, [[tambon, zipcode], ...]], ...]], ...]
 */

import thaiAddressDb from '@/constants/thai-address-db.json';

// Type definitions for the compact format
type TambonEntry = [string, string]; // [tambon, zipcode]
type AmphoeEntry = [string, TambonEntry[]]; // [amphoe, tambons[]]
type ProvinceEntry = [string, AmphoeEntry[]]; // [province, amphoes[]]

const db = thaiAddressDb as ProvinceEntry[];

// ─── Cached Lookups ───────────────────────────────────────
let _provinces: string[] | null = null;

/**
 * Get all 77 provinces sorted in Thai alphabetical order
 */
export function getProvinces(): string[] {
    if (!_provinces) {
        _provinces = db.map(([prov]) => prov);
    }
    return _provinces;
}

/**
 * Get amphoes (districts) for a given province
 */
export function getAmphoes(province: string): string[] {
    const entry = db.find(([prov]) => prov === province);
    if (!entry) return [];
    return entry[1].map(([amp]) => amp);
}

/**
 * Get tambons (sub-districts) for a given province + amphoe
 */
export function getTambons(province: string, amphoe: string): string[] {
    const provEntry = db.find(([prov]) => prov === province);
    if (!provEntry) return [];
    const amphoeEntry = provEntry[1].find(([amp]) => amp === amphoe);
    if (!amphoeEntry) return [];
    return amphoeEntry[1].map(([tambon]) => tambon);
}

/**
 * Get zipcode for a specific province + amphoe + tambon combination
 */
export function getZipcode(province: string, amphoe: string, tambon: string): string | null {
    const provEntry = db.find(([prov]) => prov === province);
    if (!provEntry) return null;
    const amphoeEntry = provEntry[1].find(([amp]) => amp === amphoe);
    if (!amphoeEntry) return null;
    const tambonEntry = amphoeEntry[1].find(([t]) => t === tambon);
    return tambonEntry ? tambonEntry[1] : null;
}

/**
 * Search across all address data by keyword (for autocomplete)
 * Returns matching entries with full address hierarchy
 */
export function searchAddress(keyword: string, limit = 20): {
    province: string;
    amphoe: string;
    tambon: string;
    zipcode: string;
}[] {
    if (!keyword || keyword.length < 2) return [];

    const results: { province: string; amphoe: string; tambon: string; zipcode: string }[] = [];
    const lowerKeyword = keyword.toLowerCase();

    for (const [province, amphoes] of db) {
        for (const [amphoe, tambons] of amphoes) {
            for (const [tambon, zipcode] of tambons) {
                if (
                    tambon.includes(lowerKeyword) ||
                    amphoe.includes(lowerKeyword) ||
                    province.includes(lowerKeyword) ||
                    zipcode.includes(lowerKeyword)
                ) {
                    results.push({ province, amphoe, tambon, zipcode });
                    if (results.length >= limit) return results;
                }
            }
        }
    }

    return results;
}

/**
 * Get region for a given province
 * Based on Thai Meteorological Department / Official 6-region system
 */
export function getRegion(province: string): string {
    const north = ['เชียงราย', 'เชียงใหม่', 'น่าน', 'พะเยา', 'แพร่', 'แม่ฮ่องสอน', 'ลำปาง', 'ลำพูน', 'อุตรดิตถ์'];
    const northeast = ['กาฬสินธุ์', 'ขอนแก่น', 'ชัยภูมิ', 'นครพนม', 'นครราชสีมา', 'บึงกาฬ', 'บุรีรัมย์', 'มหาสารคาม', 'มุกดาหาร', 'ยโสธร', 'ร้อยเอ็ด', 'เลย', 'สกลนคร', 'สุรินทร์', 'ศรีสะเกษ', 'หนองคาย', 'หนองบัวลำภู', 'อุดรธานี', 'อุบลราชสีมา', 'อำนาจเจริญ'];
    const central = ['กรุงเทพมหานคร', 'กำแพงเพชร', 'ชัยนาท', 'นครนายก', 'นครปฐม', 'นครสวรรค์', 'นนทบุรี', 'ปทุมธานี', 'พระนครศรีอยุธยา', 'พิจิตร', 'พิษณุโลก', 'เพชรบูรณ์', 'ลพบุรี', 'สมุทรปราการ', 'สมุทรสงคราม', 'สมุทรสาคร', 'สระบุรี', 'สิงห์บุรี', 'สุพรรณบุรี', 'อ่างทอง', 'อุทัยธานี'];
    const east = ['จันทบุรี', 'ฉะเชิงเทรา', 'ชลบุรี', 'ตราด', 'ปราจีนบุรี', 'ระยอง', 'สระแก้ว'];
    const west = ['กาญจนบุรี', 'ตาก', 'ประจวบคีรีขันธ์', 'เพชรบุรี', 'ราชบุรี'];
    const south = ['กระบี่', 'ชุมพร', 'ตรัง', 'นครศรีธรรมราช', 'นราธิวาส', 'ปัตตานี', 'พังงา', 'พัทลุง', 'ภูเก็ต', 'ระนอง', 'สตูล', 'สงขลา', 'สุราษฎร์ธานี', 'ยะลา'];

    if (north.includes(province)) return 'ภาคเหนือ';
    if (northeast.includes(province)) return 'ภาคตะวันออกเฉียงเหนือ';
    if (central.includes(province)) return 'ภาคกลาง';
    if (east.includes(province)) return 'ภาคตะวันออก';
    if (west.includes(province)) return 'ภาคตะวันตก';
    if (south.includes(province)) return 'ภาคใต้';
    return 'อื่นๆ';
}
