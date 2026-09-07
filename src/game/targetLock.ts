import type { Vector3 } from "three";

type LockCandidate = {
  id: string;
  alive: boolean;
  spawned: boolean;
  detectedUntil: number;
  position: Vector3;
};

export function nextLockTarget(
  enemies: readonly LockCandidate[],
  currentId: string | null,
  position: Vector3,
  now: number,
): string | null {
  const candidates = enemies.filter((enemy) => enemy.alive && enemy.spawned &&
    (enemy.detectedUntil > now || enemy.position.distanceTo(position) < 115));
  if (!candidates.length) return null;

  // Keep mission order during cycling so moving enemies cannot continually
  // swap distance ranks and prevent another candidate from being selected.
  const currentIndex = candidates.findIndex((enemy) => enemy.id === currentId);
  if (currentIndex !== -1) return candidates[(currentIndex + 1) % candidates.length].id;

  return candidates.reduce((nearest, enemy) =>
    enemy.position.distanceToSquared(position) < nearest.position.distanceToSquared(position)
      ? enemy : nearest,
  ).id;
}
