"use client";
import { useFrame, useLoader } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import SonarSurfaceMaterial, { type SonarPulse } from "./SonarSurfaceMaterial";

export default function AshWingModel({ pulse }: { pulse: SonarPulse }) {
  const gltf = useLoader(GLTFLoader, "/models/ash-wing.glb");
  const rotors = useRef<(THREE.Group | null)[]>([]);
  const groups = useMemo(() => {
    gltf.scene.updateMatrixWorld(true);
    return ["AshWing_Hull", "AshWing_Rotor_Left", "AshWing_Rotor_Right"].map((name) => {
      const root = gltf.scene.getObjectByName(name)!;
      const pivot = root.getWorldPosition(new THREE.Vector3());
      const inverse = new THREE.Matrix4().makeTranslation(-pivot.x, -pivot.y, -pivot.z);
      const parts: { mesh: THREE.Mesh; matrix: THREE.Matrix4; material: THREE.MeshStandardMaterial }[] = [];
      root.traverse((object) => {
        if (object instanceof THREE.Mesh) parts.push({ mesh: object,
          matrix: inverse.clone().multiply(object.matrixWorld), material: object.material as THREE.MeshStandardMaterial });
      });
      return { name, pivot, parts };
    });
  }, [gltf]);
  useFrame((_, delta) => {
    rotors.current.forEach((rotor, i) => {
      if (rotor && i > 0) rotor.rotation.z += Math.min(delta, .05) * (i === 1 ? 7 : -7);
    });
  });
  return <group>{groups.map((group, index) => (
    <group key={group.name} position={group.pivot} ref={(object) => { rotors.current[index] = object; }}>
      {group.parts.map(({ mesh, matrix, material }) => <mesh key={mesh.uuid} matrix={matrix} matrixAutoUpdate={false}>
        <primitive object={mesh.geometry} attach="geometry" dispose={null} />
        <SonarSurfaceMaterial pulse={pulse} enemy color={material.color} metalness={material.metalness} roughness={material.roughness} />
      </mesh>)}
    </group>
  ))}</group>;
}
