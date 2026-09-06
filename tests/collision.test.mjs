import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { Vector3 } from "three";

// Use the project's compiler so the tests also run on the supported Node 20.
const source = readFileSync(new URL("../src/game/collision.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ES2020 },
});
const { sphereBoxPenetration } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

test("outside and tangent spheres do not collide or overwrite the normal", () => {
  const normal = new Vector3(1, 2, 3);
  const center = new Vector3();
  const halfSize = new Vector3(2, 3, 4);
  for (const position of [new Vector3(100, 0, 0), new Vector3(3, 0, 0), new Vector3(2.8, 3.8, 4)]) {
    assert.equal(sphereBoxPenetration(position, 1, center, halfSize, normal), 0);
    assert.deepEqual(normal.toArray(), [1, 2, 3]);
  }
});

test("face, edge, corner and interior contacts give the expected response", () => {
  const center = new Vector3(10, -20, 30);
  const halfSize = new Vector3(2, 3, 4);
  const cases = [
    { local: [2.5, 0, 0], depth: 0.5, normal: [1, 0, 0] },
    { local: [-2.5, 0, 0], depth: 0.5, normal: [-1, 0, 0] },
    { local: [2.3, 3.4, 0], depth: 0.5, normal: [0.6, 0.8, 0] },
    { local: [2.2, 3.2, 4.2], depth: 1 - Math.sqrt(0.12), normal: [1, 1, 1].map(() => 1 / Math.sqrt(3)) },
    { local: [0, 0, 0], depth: 3, normal: [1, 0, 0] },
    { local: [0, -2.8, 0], depth: 1.2, normal: [0, -1, 0] },
    { local: [0, 0, 3.8], depth: 1.2, normal: [0, 0, 1] },
  ];
  const normal = new Vector3();
  for (const contact of cases) {
    const position = new Vector3(...contact.local).add(center);
    const depth = sphereBoxPenetration(position, 1, center, halfSize, normal);
    assert.ok(Math.abs(depth - contact.depth) < 1e-10);
    assert.ok(normal.distanceTo(new Vector3(...contact.normal)) < 1e-10);
  }
});

test("separating a colliding sphere resolves contact for 10,000 seeded positions", () => {
  let seed = 42;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  const center = new Vector3(-55, -42, -310);
  const halfSize = new Vector3(13, 18, 7);
  const normal = new Vector3();
  const position = new Vector3();
  let contacts = 0;
  for (let i = 0; i < 10000; i++) {
    position.set((random() - 0.5) * 50, (random() - 0.5) * 50, (random() - 0.5) * 50).add(center);
    const depth = sphereBoxPenetration(position, 5.2, center, halfSize, normal);
    if (depth <= 0) continue;
    contacts++;
    assert.ok(Math.abs(normal.length() - 1) < 1e-10);
    position.addScaledVector(normal, depth + 0.06);
    assert.equal(sphereBoxPenetration(position, 5.2, center, halfSize, normal), 0);
  }
  assert.ok(contacts > 1000);
});
