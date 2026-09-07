import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { Box3, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

async function sourceModule(name) {
  const { outputText } = ts.transpileModule(readFileSync(new URL(`../src/game/${name}.ts`, import.meta.url), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ES2020 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}
const { STAGES, VOLCANOES, VOLCANIC_FLOOR, volcanicHeightAt, smokeDensityAt } = await sourceModule("stages");
const { damageEnemy } = await sourceModule("combat");

test("volcanic collision matches crater heights and slopes, with a clear spawn and checkpoint", () => {
  for (const vent of VOLCANOES) {
    assert.equal(volcanicHeightAt(vent.x, vent.z), VOLCANIC_FLOOR + vent.height);
    assert.equal(volcanicHeightAt(vent.x + vent.radius, vent.z), VOLCANIC_FLOOR);
    const mid = volcanicHeightAt(vent.x + (vent.radius + 7) / 2, vent.z);
    assert.ok(Math.abs(mid - (VOLCANIC_FLOOR + vent.height / 2)) < .001);
  }
  assert.ok(-STAGES[2].startDepth - volcanicHeightAt(0,40) > 5.2);
  assert.ok(-STAGES[2].checkpointDepth - volcanicHeightAt(0,-395) > 5.2);
  assert.equal(volcanicHeightAt(230,110),VOLCANIC_FLOOR);
});

test("smoke obscures the volume above vents and clears outside it", () => {
  for (const vent of VOLCANOES) {
    const y = VOLCANIC_FLOOR + vent.height;
    assert.equal(smokeDensityAt(vent.x,y+30,vent.z),1);
    assert.ok(smokeDensityAt(vent.x+10,y+30,vent.z) > 0);
    assert.equal(smokeDensityAt(vent.x,y-20,vent.z),0);
    assert.equal(smokeDensityAt(vent.x,y+190,vent.z),0);
  }
  assert.equal(smokeDensityAt(230,-100,100),0);
});

test("torpedoes and mines can both finish the 840 HP boss, reporting destruction only once", () => {
  for (const finalDamage of [72,85,110]) {
    const boss = {hp:STAGES[2].bossHp,alive:true};
    while (boss.hp > finalDamage) assert.equal(damageEnemy(boss,finalDamage),false);
    assert.equal(damageEnemy(boss,finalDamage),true);
    assert.equal(boss.hp,0);
    assert.equal(boss.alive,false);
    assert.equal(damageEnemy(boss,finalDamage),false);
  }
});

const bytes = readFileSync(new URL("../public/models/ash-wing.glb", import.meta.url));
const document = JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),"");
test("Ash Wing preserves twin independently rotating propellers and its long-wing silhouette", () => {
  assert.ok(gltf.scene.getObjectByName("AshWing_Hull"));
  for (const [side,x] of [["Left",-7],["Right",7]]) {
    const rotor=gltf.scene.getObjectByName(`AshWing_Rotor_${side}`);
    assert.ok(rotor);
    assert.ok(rotor.getWorldPosition(new Vector3()).distanceTo(new Vector3(x,5,-4)) < .001);
  }
  const box=new Box3().setFromObject(gltf.scene);const size=box.getSize(new Vector3());
  assert.ok(size.x>53 && size.x<55);
  assert.ok(size.z>25 && size.z<29);
  assert.ok(size.y>9 && size.y<12);
  assert.ok(box.min.z>-18 && box.max.z<18,"bow and stern launches clear the model");
  assert.equal(document.images,undefined);
  assert.equal(document.cameras,undefined);
  let triangles=0,draws=0;
  gltf.scene.traverse(o=>{if(!o.isMesh)return;
    assert.equal(Array.isArray(o.material),false);
    assert.ok(o.geometry.attributes.position.array.every(Number.isFinite));
    triangles+=(o.geometry.index?.count ?? o.geometry.attributes.position.count)/3;draws++;
  });
  assert.ok(triangles<20000,`${triangles} triangles`);
  assert.ok(draws<=8,`${draws} draws`);
  assert.ok(bytes.length<500*1024,`${bytes.length} bytes`);
});
