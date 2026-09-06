import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { Box3, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const bytes = readFileSync(new URL("../public/models/ryuou.glb", import.meta.url));
const jsonLength = bytes.readUInt32LE(12);
const document = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
const asset = await new GLTFLoader().parseAsync(
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "",
);

test("runtime asset contains only the Ryuou and its two independently rotating propellers", () => {
  assert.equal(document.scenes.length, 1);
  assert.equal(document.nodes.length, 3);
  assert.ok(asset.scene.getObjectByName("Ryuou_Hull"));
  const front = asset.scene.getObjectByName("Ryuou_Rotor_Front_Game");
  const rear = asset.scene.getObjectByName("Ryuou_Rotor_Rear_Game");
  assert.ok(front && rear);
  // Game forward is -Z. The propellers must be behind the hull center at +Z.
  assert.ok(front.position.z > 3 && rear.position.z > front.position.z);
  assert.equal(asset.scene.getObjectByName("Cube"), undefined);
  assert.equal(document.cameras, undefined);
  assert.equal(document.extensions?.KHR_lights_punctual, undefined);
});

test("asset stays within the rendering and transfer budgets", () => {
  let triangles = 0;
  let draws = 0;
  asset.scene.traverse((object) => {
    if (!object.isMesh) return;
    triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
    draws += Math.max(1, object.geometry.groups.length);
  });
  assert.ok(triangles > 1000 && triangles <= 15000, `${triangles} triangles`);
  assert.ok(draws <= 8, `${draws} draws`);
  assert.ok(bytes.length <= 350 * 1024, `${bytes.length} bytes`);
  assert.equal(document.images, undefined, "model must not fetch textures during play");
});

test("scale fits the existing chase camera and all vertex positions are finite", () => {
  const size = new Box3().setFromObject(asset.scene).getSize(new Vector3());
  assert.ok(size.z > 11 && size.z < 13, `length ${size.z}`);
  assert.ok(size.x > 5 && size.x < 7, `width ${size.x}`);
  assert.ok(size.y > 4 && size.y < 6, `height ${size.y}`);
  asset.scene.traverse((object) => {
    if (!object.isMesh) return;
    assert.ok(object.geometry.attributes.position.array.every(Number.isFinite));
  });
});
