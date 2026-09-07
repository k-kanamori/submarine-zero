import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { Vector3 } from "three";

const { outputText } = ts.transpileModule(readFileSync(new URL("../src/game/targetLock.ts", import.meta.url), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ES2020 },
});
const { nextLockTarget } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
const origin = new Vector3();
const enemy = (id, distance, props = {}) => ({
  id, alive: true, spawned: true, detectedUntil: 20, position: new Vector3(distance, 0, 0), ...props,
});

test("initial lock chooses nearest, then cycles every candidate and wraps despite movement", () => {
  const enemies = [enemy("a", 90), enemy("b", 20), enemy("c", 60)];
  assert.equal(nextLockTarget(enemies, null, origin, 10), "b");
  assert.equal(nextLockTarget(enemies, "b", origin, 10), "c");
  enemies[0].position.x = 10;
  enemies[1].position.x = 100;
  assert.equal(nextLockTarget(enemies, "c", origin, 10), "a");
  assert.equal(nextLockTarget(enemies, "a", origin, 10), "b");
});

test("cycling excludes destroyed, unspawned and undetected distant enemies", () => {
  const enemies = [enemy("dead", 1, { alive: false }), enemy("pending", 2, { spawned: false }),
    enemy("lost", 200, { detectedUntil: 9 }), enemy("near", 100, { detectedUntil: 9 }), enemy("echo", 300)];
  assert.equal(nextLockTarget(enemies, null, origin, 10), "near");
  assert.equal(nextLockTarget(enemies, "near", origin, 10), "echo");
  assert.equal(nextLockTarget(enemies, "echo", origin, 10), "near");
  assert.equal(nextLockTarget(enemies, "dead", origin, 10), "near");
  assert.equal(nextLockTarget(enemies, "echo", origin, 21), "near");
});

test("one candidate stays locked and no candidates clears the lock", () => {
  assert.equal(nextLockTarget([enemy("only", 20)], "only", origin, 10), "only");
  assert.equal(nextLockTarget([], "removed", origin, 10), null);
  assert.equal(nextLockTarget([enemy("lost", 200, { detectedUntil: 0 })], "lost", origin, 10), null);
});
