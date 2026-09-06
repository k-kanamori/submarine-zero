import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { Box3, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const bytes = readFileSync(new URL("../public/models/taigei.glb", import.meta.url));
const document = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
const asset = await new GLTFLoader().parseAsync(
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "",
);

test("Taigei is self-contained with a stern propeller on the game's Z axis", () => {
  assert.equal(document.nodes.length, 2);
  assert.ok(asset.scene.getObjectByName("Taigei_Hull"));
  const rotor = asset.scene.getObjectByName("Taigei_Propeller");
  assert.ok(rotor);
  assert.ok(rotor.getWorldPosition(new Vector3()).distanceTo(new Vector3(0, 0, 4.82)) < .001);
  assert.equal(document.cameras, undefined);
  assert.equal(document.extensions?.KHR_lights_punctual, undefined);
  assert.equal(document.images, undefined);
});

test("Taigei fits enemy collision and launch clearances within the asset budget", () => {
  const bounds = new Box3().setFromObject(asset.scene);
  const size = bounds.getSize(new Vector3());
  assert.ok(size.z > 9 && size.z < 10);
  assert.ok(size.x < 2.1 && size.y < 3);
  // Bow faces -Z and stays behind both existing torpedo launch origins.
  assert.ok(bounds.min.z > -5.2);
  assert.ok(bounds.min.z * 1.15 > -6);
  let triangles = 0;
  let draws = 0;
  asset.scene.traverse((object) => {
    if (!object.isMesh) return;
    // The runtime renders each glTF primitive with one sonar material.
    assert.equal(Array.isArray(object.material), false);
    assert.ok(object.material.isMeshStandardMaterial);
    assert.ok(object.geometry.attributes.position.array.every(Number.isFinite));
    triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
    draws += Math.max(1, object.geometry.groups.length);
  });
  assert.ok(triangles > 1000 && triangles <= 12000, `${triangles} triangles`);
  assert.ok(draws <= 5, `${draws} draws`);
  assert.ok(bytes.length < 300 * 1024);
});
