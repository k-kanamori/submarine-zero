/** Returns true exactly once, when this hit destroys a living target. */
export function damageEnemy(target: { hp: number; alive: boolean }, damage: number): boolean {
  if (!target.alive || damage <= 0 || !Number.isFinite(damage)) return false;
  target.hp = Math.max(0, target.hp - damage);
  if (target.hp > 0) return false;
  target.alive = false;
  return true;
}
