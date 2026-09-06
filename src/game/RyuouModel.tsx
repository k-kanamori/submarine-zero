"use client";

import { useFrame, useLoader } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export default function RyuouModel() {
  const gltf = useLoader(GLTFLoader, "/models/ryuou.glb");
  const model = useMemo(() => {
    // Keep the cached geometry/materials, but give each mission its own transforms.
    const scene = gltf.scene.clone(true);
    return {
      scene,
      front: scene.getObjectByName("Ryuou_Rotor_Front_Game"),
      rear: scene.getObjectByName("Ryuou_Rotor_Rear_Game"),
    };
  }, [gltf]);
  const lightTarget = useMemo(() => {
    const target = new THREE.Object3D();
    target.position.set(0, -2, -32);
    return target;
  }, []);

  useFrame((_, delta) => {
    const angle = Math.min(delta, 0.05) * 5;
    model.front?.rotateZ(angle);
    model.rear?.rotateZ(-angle);
  });

  return (
    <group>
      <primitive object={model.scene} dispose={null} />
      <primitive object={lightTarget} />
      <pointLight position={[0, 4, 3]} color="#c2c5ff" intensity={14} distance={18} />
      <spotLight
        position={[0, -0.9, -3.9]}
        target={lightTarget}
        color="#d8f7ff"
        intensity={20}
        angle={0.35}
        penumbra={0.75}
        distance={75}
      />
    </group>
  );
}
