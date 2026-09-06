"use client";

import { useFrame, useLoader } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export default function CorbackModel({ active = true }: { active?: boolean }) {
  const gltf = useLoader(GLTFLoader, "/models/corback.glb");
  const model = useMemo(() => {
    const scene = gltf.scene.clone(true);
    return { scene, rotor: scene.getObjectByName("Corback_Rotor_Game") };
  }, [gltf]);
  const lightTarget = useMemo(() => {
    const target = new THREE.Object3D();
    target.position.set(0, -2, -32);
    return target;
  }, []);

  useFrame((_, delta) => {
    if (active) model.rotor?.rotateZ(Math.min(delta, 0.05) * 6);
  });

  return (
    <group>
      <primitive object={model.scene} dispose={null} />
      {active && <>
        <primitive object={lightTarget} />
        <pointLight position={[0, 4, 3]} color="#b5d9ff" intensity={14} distance={18} />
        <spotLight position={[0, -0.3, -4.7]} target={lightTarget}
          color="#c1f3ff" intensity={20} angle={0.35} penumbra={0.75} distance={75} />
      </>}
    </group>
  );
}
