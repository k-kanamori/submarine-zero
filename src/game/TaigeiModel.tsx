"use client";

import { assetPath } from "../lib/base-path";

import { useFrame, useLoader } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import SonarSurfaceMaterial, { type SonarPulse } from "./SonarSurfaceMaterial";

type Part = {
  geometry: THREE.BufferGeometry;
  material: THREE.MeshStandardMaterial;
  matrix: THREE.Matrix4;
};

export default function TaigeiModel({ pulse, scale = 1 }: { pulse: SonarPulse; scale?: number }) {
  const gltf = useLoader(GLTFLoader, assetPath("/models/taigei.glb"));
  const rotor = useRef<THREE.Group>(null);
  const model = useMemo(() => {
    gltf.scene.updateMatrixWorld(true);
    const propeller = gltf.scene.getObjectByName("Taigei_Propeller")!;
    const pivot = propeller.getWorldPosition(new THREE.Vector3());
    const toPivot = new THREE.Matrix4().makeTranslation(-pivot.x, -pivot.y, -pivot.z);
    const hullParts: Part[] = [];
    const rotorParts: Part[] = [];
    gltf.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      let rotating = false;
      for (let parent: THREE.Object3D | null = object; parent; parent = parent.parent) {
        if (parent === propeller) rotating = true;
      }
      // glTF splits material primitives into meshes. Retain their baked transforms,
      // but rotate the screw around the game's longitudinal Z axis.
      const matrix = object.matrixWorld.clone();
      if (rotating) matrix.premultiply(toPivot);
      (rotating ? rotorParts : hullParts).push({
        geometry: object.geometry,
        material: object.material as THREE.MeshStandardMaterial,
        matrix,
      });
    });
    return { pivot, hullParts, rotorParts };
  }, [gltf]);

  useFrame((_, delta) => {
    if (rotor.current) rotor.current.rotation.z += Math.min(delta, 0.05) * 8;
  });

  const renderPart = (part: Part, index: number) => (
    <mesh key={index} matrix={part.matrix} matrixAutoUpdate={false}>
      <primitive object={part.geometry} attach="geometry" dispose={null} />
      <SonarSurfaceMaterial pulse={pulse} enemy color={part.material.color}
        metalness={part.material.metalness} roughness={part.material.roughness} />
    </mesh>
  );

  return (
    <group scale={scale}>
      {model.hullParts.map(renderPart)}
      <group ref={rotor} position={model.pivot}>
        {model.rotorParts.map(renderPart)}
      </group>
    </group>
  );
}
