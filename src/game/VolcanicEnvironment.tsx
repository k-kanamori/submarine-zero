"use client";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import SonarSurfaceMaterial, { type SonarPulse } from "./SonarSurfaceMaterial";
import { VOLCANOES, VOLCANIC_FLOOR } from "./stages";

function SmokePlumes() {
  const smokeMaterial = useRef<THREE.ShaderMaterial>(null);
  const { positions, seeds, uniforms } = useMemo(() => {
    const positions = new Float32Array(VOLCANOES.length * 100 * 3);
    const seeds = new Float32Array(VOLCANOES.length * 100 * 3);
    VOLCANOES.forEach((vent, v) => {
      for (let i = 0; i < 100; i++) {
        const n = (v * 100 + i) * 3;
        positions.set([vent.x, VOLCANIC_FLOOR + vent.height, vent.z], n);
        seeds.set([i / 100, (i * 2.39996) % (Math.PI * 2), .3 + ((i * 17) % 61) / 90], n);
      }
    });
    return { positions, seeds, uniforms: { time: { value: 0 } } };
  }, []);
  useFrame((_, delta) => {
    if (smokeMaterial.current) smokeMaterial.current.uniforms.time.value += Math.min(delta, .05);
  });
  return <points frustumCulled={false} renderOrder={2}>
    <bufferGeometry>
      <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      <bufferAttribute attach="attributes-seed" args={[seeds, 3]} />
    </bufferGeometry>
    <shaderMaterial ref={smokeMaterial} transparent depthWrite={false} uniforms={uniforms}
      vertexShader={`attribute vec3 seed; uniform float time; varying float life;
        void main() {
          life = fract(seed.x + time * .025);
          float radius = (7.0 + life * 26.0) * seed.z;
          vec3 p = position + vec3(cos(seed.y + life * 2.0) * radius,
            life * 175.0, sin(seed.y + life * 2.0) * radius);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp((16.0 + life * 22.0) * 500.0 / max(1.0, -mv.z), 1.0, 280.0);
        }`}
      fragmentShader={`varying float life; void main() {
        float r = length(gl_PointCoord - .5) * 2.0;
        float a = (1.0 - smoothstep(.1, 1.0, r)) * .19
          * smoothstep(0.0, .08, life) * (1.0 - smoothstep(.75, 1.0, life));
        gl_FragColor = vec4(mix(vec3(.22, .20, .16), vec3(.09, .105, .09), life), a);
      }`} />
  </points>;
}

export default function VolcanicEnvironment({ pulse }: { pulse: SonarPulse }) {
  return <>
    <mesh position={[0, VOLCANIC_FLOOR - 6, -500]} scale={[560, 12, 1320]}>
      <boxGeometry /><SonarSurfaceMaterial pulse={pulse} color="#171611" roughness={1} />
    </mesh>
    {VOLCANOES.map((vent, i) => <group key={i} position={[vent.x, VOLCANIC_FLOOR, vent.z]}>
      <mesh position={[0, vent.height / 2, 0]}>
        <cylinderGeometry args={[7, vent.radius, vent.height, 24, 4]} />
        <SonarSurfaceMaterial pulse={pulse} color={i % 2 ? "#302b23" : "#282b25"} roughness={.95} flatShading />
      </mesh>
      <mesh position={[0, vent.height + .4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[5, 8, 32]} /><meshStandardMaterial color="#ff7327" emissive="#ff4008" emissiveIntensity={2} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, vent.height, 0]}>
        <cylinderGeometry args={[5.5, 5.5, .5, 24]} /><meshBasicMaterial color="#ff6425" toneMapped={false} fog={false} />
      </mesh>
      <pointLight position={[0, vent.height + 8, 0]} color="#ff6026" intensity={130} distance={100} decay={1.5} />
      {[0, 1, 2, 3].map((j) => <mesh key={j}
        position={[Math.cos(j * 1.7 + i) * vent.radius * .75, 9, Math.sin(j * 1.7 + i) * vent.radius * .75]}
        scale={[8, 18 + j * 3, 8]}>
        <dodecahedronGeometry args={[1, 0]} /><SonarSurfaceMaterial pulse={pulse} color="#383027" roughness={1} />
      </mesh>)}
    </group>)}
    <group position={[0, -155, -405]}>
      <mesh position={[0, -7, 0]}><cylinderGeometry args={[8, 10, 3, 16]} /><SonarSurfaceMaterial pulse={pulse} color="#4b4a36" metalness={.7} /></mesh>
      <mesh><cylinderGeometry args={[.5, .5, 16, 12]} /><SonarSurfaceMaterial pulse={pulse} color="#828577" metalness={.8} /></mesh>
      <mesh position={[0, 8, 0]}><sphereGeometry args={[1, 12, 8]} /><meshBasicMaterial color="#83ffb6" /></mesh>
    </group>
    <SmokePlumes />
  </>;
}
