/**
 * computeDistanceKm
 * คำนวณระยะทางระหว่าง 2 จุดบนผิวโลกด้วยสูตร Haversine (หน่วย: กิโลเมตร)
 */
export function computeDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // รัศมีของโลก (กิโลเมตร)
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export interface SpatialPoint {
  latitude: number | null;
  longitude: number | null;
}

export interface ShippableEntity {
  id: string;
  createdAt: Date;
  latitude: number | null;
  longitude: number | null;
}

/**
 * classifyRouteBucket
 * แยก Shipment ออกเป็นกลุ่มที่มีพิกัดครบ (Known) และไม่ครบ (Unknown)
 */
export function classifyRouteBucket<T extends ShippableEntity>(
  items: T[],
  origin: SpatialPoint
) {
  const isOriginValid = origin.latitude !== null && origin.longitude !== null;

  const known: (T & { distance: number })[] = [];
  const unknown: T[] = [];

  for (const item of items) {
    if (
      isOriginValid &&
      item.latitude !== null &&
      item.longitude !== null
    ) {
      const distance = computeDistanceKm(
        origin.latitude!,
        origin.longitude!,
        item.latitude,
        item.longitude
      );
      known.push({ ...item, distance });
    } else {
      unknown.push(item);
    }
  }

  return { known, unknown };
}

/**
 * sortShipmentsByRoute
 * จัดลำดับตามกฎ:
 * - Outbound: Near -> Far
 * - Inbound: Far -> Near
 * - Unknown: ท้ายสุดเสมอ
 * - Tie-breaker: createdAt (เพื่อให้ผลลัพธ์ stable)
 */
export function sortShipmentsByRoute<T extends ShippableEntity>(
  items: T[],
  type: 'OUTBOUND' | 'INBOUND',
  origin: SpatialPoint
): T[] {
  const { known, unknown } = classifyRouteBucket(items, origin);

  // 1. Sort Known Bucket
  known.sort((a, b) => {
    const diff = type === 'OUTBOUND' 
      ? a.distance - b.distance 
      : b.distance - a.distance;
    
    // Tie-breaker
    if (Math.abs(diff) < 0.0001) {
      return a.createdAt.getTime() - b.createdAt.getTime();
    }
    return diff;
  });

  // 2. Sort Unknown Bucket (Tie-breaker only)
  unknown.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  // 3. Combine: Known first, Unknown always at the end
  return [...known, ...unknown];
}
