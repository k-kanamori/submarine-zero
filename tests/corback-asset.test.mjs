import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { Box3, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const bytes = readFileSync(new URL("../public/models/corback.glb", import.meta.url));
const document = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
const asset = await new GLTFLoader().parseAsync(
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "",
);

test("Corback exports only its hull and correctly positioned stern rotor", () => {
  assert.equal(document.scenes.length, 1);
  assert.equal(document.nodes.length, 2);
  assert.ok(asset.scene.getObjectByName("Corback_Hull"));
  const rotor = asset.scene.getObjectByName("Corback_Rotor_Game");
  assert.ok(rotor);
  assert.ok(Math.abs(rotor.position.z - 5.85) < .001);
  assert.equal(document.cameras, undefined);
  assert.equal(document.extensions?.KHR_lights_punctual, undefined);
});

test("Corback fits the chase camera and retains a lightweight texture-free asset", () => {
  const size = new Box3().setFromObject(asset.scene).getSize(new Vector3());
  assert.ok(size.z > 12 && size.z < 13, `length ${size.z}`);
  assert.ok(size.x > 3 && size.x < 4, `X-tail width ${size.x}`);
  assert.ok(size.y > 3 && size.y < 4, `height ${size.y}`);
  let triangles = 0;
  let draws = 0;
  asset.scene.traverse((object) => {
    if (!object.isMesh) return;
    triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
    draws += Math.max(1, object.geometry.groups.length);
    assert.ok(object.geometry.attributes.position.array.every(Number.isFinite));
  });
  assert.ok(triangles > 1000 && triangles <= 15000, `${triangles} triangles`);
  assert.ok(draws <= 7, `${draws} draws`);
  assert.ok(bytes.length <= 350 * 1024, `${bytes.length} bytes`);
  assert.equal(document.images, undefined);
});
