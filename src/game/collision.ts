import type { Vector3 } from "three";

// Writes the contact normal only on collision. Scalar math avoids allocating
// vectors (and sorting faces) for every terrain collider on every frame.
export function sphereBoxPenetration(
  position: Vector3,
  radius: number,
  center: Vector3,
  halfSize: Vector3,
  normal: Vector3,
): number {
  const x = position.x - center.x;
  const y = position.y - center.y;
  const z = position.z - center.z;
  if (Math.abs(x) >= halfSize.x + radius ||
      Math.abs(y) >= halfSize.y + radius ||
      Math.abs(z) >= halfSize.z + radius) return 0;

  const dx = x - Math.max(-halfSize.x, Math.min(halfSize.x, x));
  const dy = y - Math.max(-halfSize.y, Math.min(halfSize.y, y));
  const dz = z - Math.max(-halfSize.z, Math.min(halfSize.z, z));
  const distanceSquared = dx * dx + dy * dy + dz * dz;
  if (distanceSquared >= radius * radius) return 0;
  if (distanceSquared > 0.0001) {
    const distance = Math.sqrt(distanceSquared);
    normal.set(dx / distance, dy / distance, dz / distance);
    return radius - distance;
  }

  let depth = halfSize.x - Math.abs(x);
  normal.set(Math.sign(x) || 1, 0, 0);
  const yDepth = halfSize.y - Math.abs(y);
  const zDepth = halfSize.z - Math.abs(z);
  if (yDepth < depth) {
    depth = yDepth;
    normal.set(0, Math.sign(y) || 1, 0);
  }
  if (zDepth < depth) {
    depth = zDepth;
    normal.set(0, 0, Math.sign(z) || 1);
  }
  return radius + depth;
}
