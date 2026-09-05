type Vector = { x: number; y: number; z: number };

export const TORPEDO_TURN_RATE = Math.PI / 6; // 30 degrees per second
export const TORPEDO_STRAIGHT_RUN = 0.25; // Clear the tube before guiding.

export type TorpedoPerformance = Readonly<{
  speed: number;
  fuel: number;
  turnRate: number;
  damage: number;
}>;

const RYUOU_GUIDED: TorpedoPerformance = { speed: 28, fuel: 14, turnRate: Math.PI / 3, damage: 72 };
const CORBACK_GUIDED: TorpedoPerformance = { speed: 44, fuel: 6, turnRate: Math.PI / 9, damage: 84 };
const UNGUIDED: TorpedoPerformance = { speed: 56, fuel: 7, turnRate: 0, damage: 110 };
export const ENEMY_TORPEDO: TorpedoPerformance = { speed: 22, fuel: 8, turnRate: TORPEDO_TURN_RATE, damage: 14 };
export const BOSS_TORPEDO: TorpedoPerformance = { speed: 25, fuel: 8, turnRate: TORPEDO_TURN_RATE, damage: 18 };

export function playerTorpedoPerformance(vehicle: string, guided: boolean): TorpedoPerformance {
  return guided ? (vehicle === "corback" ? CORBACK_GUIDED : RYUOU_GUIDED) : UNGUIDED;
}

/** Choose a bow or stern tube, never aim the tube sideways at a target. */
export function tubeDirection(forward: Vector, toTarget: Vector, out: Vector) {
  const sign = forward.x * toTarget.x + forward.y * toTarget.y + forward.z * toTarget.z < 0 ? -1 : 1;
  out.x = forward.x * sign;
  out.y = forward.y * sign;
  out.z = forward.z * sign;
}

/** Rotate velocity on the unit sphere, preserving speed even for a target behind it.
 * Allocation-free; maxAngle is the turn-rate limit multiplied by simulation dt.
 */
export function steerTorpedo(velocity: Vector, toTarget: Vector, maxAngle: number) {
  const speed = Math.hypot(velocity.x, velocity.y, velocity.z);
  const distance = Math.hypot(toTarget.x, toTarget.y, toTarget.z);
  if (speed < 1e-10 || distance < 1e-10 || maxAngle <= 0) return;
  const x = velocity.x / speed, y = velocity.y / speed, z = velocity.z / speed;
  const tx = toTarget.x / distance, ty = toTarget.y / distance, tz = toTarget.z / distance;
  const dot = Math.max(-1, Math.min(1, x * tx + y * ty + z * tz));
  const angle = Math.acos(dot);
  if (angle <= maxAngle) {
    velocity.x = tx * speed;
    velocity.y = ty * speed;
    velocity.z = tz * speed;
    return;
  }
  let px = tx - dot * x, py = ty - dot * y, pz = tz - dot * z;
  let length = Math.hypot(px, py, pz);
  if (length < 1e-10) {
    // Exactly opposite: choose a stable perpendicular rather than stop/reverse.
    if (Math.abs(y) < 0.9) { px = -z; py = 0; pz = x; }
    else { px = 0; py = z; pz = -y; }
    length = Math.hypot(px, py, pz);
  }
  const c = Math.cos(maxAngle), s = Math.sin(maxAngle) / length;
  velocity.x = (x * c + px * s) * speed;
  velocity.y = (y * c + py * s) * speed;
  velocity.z = (z * c + pz * s) * speed;
}
