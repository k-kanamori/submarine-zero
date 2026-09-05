import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { Vector3 } from "three";

const { outputText } = ts.transpileModule(readFileSync(new URL("../src/game/torpedo.ts", import.meta.url), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ES2020 },
});
const { steerTorpedo, tubeDirection, TORPEDO_TURN_RATE, playerTorpedoPerformance, ENEMY_TORPEDO, BOSS_TORPEDO } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`,
);

test("player torpedoes have distinct roles and share the fastest, strongest unguided weapon", () => {
  const ryuou = playerTorpedoPerformance("ryuou", true);
  const corback = playerTorpedoPerformance("corback", true);
  const manual = playerTorpedoPerformance("ryuou", false);
  assert.equal(manual, playerTorpedoPerformance("corback", false));
  assert.ok(ryuou.speed < corback.speed && corback.speed < manual.speed);
  assert.ok(ryuou.damage < corback.damage && corback.damage < manual.damage);
  assert.ok(ryuou.fuel > corback.fuel);
  assert.ok(ryuou.turnRate > corback.turnRate);
  assert.equal(manual.turnRate, 0);
  assert.deepEqual(ENEMY_TORPEDO, {speed:22, fuel:8, turnRate:TORPEDO_TURN_RATE, damage:14});
  assert.deepEqual(BOSS_TORPEDO, {speed:25, fuel:8, turnRate:TORPEDO_TURN_RATE, damage:18});
  // The profiles drive the actual steering helper, including unguided straight travel.
  for (const profile of [ryuou, corback, manual, ENEMY_TORPEDO, BOSS_TORPEDO]) {
    const velocity = new Vector3(0,0,-profile.speed);
    const forward = velocity.clone();
    for (let i=0;i<60;i++) steerTorpedo(velocity, new Vector3(100,0,0), profile.turnRate/60);
    assert.ok(Math.abs(forward.angleTo(velocity)-profile.turnRate) < 1e-8);
    assert.ok(Math.abs(velocity.length()-profile.speed) < 1e-8);
  }
});

test("bow/stern tubes stay aligned with the hull for front, rear and sideways targets", () => {
  const forward = new Vector3(1, 2, -3).normalize();
  for (const target of [new Vector3(8, 0, -10), new Vector3(-8, 0, 10), new Vector3(20, -10, 0)]) {
    const direction = new Vector3();
    tubeDirection(forward, target, direction);
    assert.ok(Math.abs(direction.dot(forward)) > 1 - 1e-12);
    assert.ok(direction.dot(target) >= -1e-12);
  }
  const inPlace = forward.clone();
  tubeDirection(inPlace, forward.clone().negate(), inPlace);
  assert.ok(inPlace.distanceTo(forward.clone().negate()) < 1e-12);
});

test("guidance never exceeds turn rate or loses speed, even directly behind and above", () => {
  for (const target of [new Vector3(0, 0, 100), new Vector3(100, 0, 0), new Vector3(0, 100, 0), new Vector3(1e-12, 0, 100)]) {
    const velocity = new Vector3(0, 0, -34);
    for (let i = 0; i < 240; i++) {
      const previous = velocity.clone();
      steerTorpedo(velocity, target, TORPEDO_TURN_RATE / 60);
      assert.ok(Math.abs(velocity.length() - 34) < 1e-9);
      assert.ok(previous.angleTo(velocity) <= TORPEDO_TURN_RATE / 60 + 1e-9);
      assert.ok(velocity.toArray().every(Number.isFinite));
    }
  }
});

test("turning is frame-rate independent, stops on target and handles degenerate inputs", () => {
  for (const fps of [20, 30, 60, 144]) {
    const velocity = new Vector3(0, 0, -34);
    for (let i = 0; i < fps; i++) steerTorpedo(velocity, new Vector3(100, 0, 0), TORPEDO_TURN_RATE / fps);
    assert.ok(Math.abs(new Vector3(0, 0, -1).angleTo(velocity) - Math.PI / 6) < 1e-9);
    for (let i = 0; i < fps * 4; i++) steerTorpedo(velocity, new Vector3(100, 0, 0), TORPEDO_TURN_RATE / fps);
    assert.ok(velocity.distanceTo(new Vector3(34, 0, 0)) < 1e-9);
  }
  const velocity = new Vector3(0, 0, -34);
  steerTorpedo(velocity, new Vector3(), 1);
  steerTorpedo(velocity, new Vector3(1, 0, 0), 0);
  assert.deepEqual(velocity.toArray(), [0, 0, -34]);
  const stopped = new Vector3();
  steerTorpedo(stopped, new Vector3(1, 0, 0), 1);
  assert.equal(stopped.length(), 0);
});
