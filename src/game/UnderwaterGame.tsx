"use client";

/* eslint-disable react-hooks/immutability, react-hooks/refs */

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { memo, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { MissionResult } from "./store";
import { sphereBoxPenetration } from "./collision";
import RyuouModel from "./RyuouModel";
import CorbackModel from "./CorbackModel";
import SonarSurfaceMaterial, { SONAR_RANGE, SONAR_SPEED, SONAR_TRAVEL_TIME, type SonarPulse } from "./SonarSurfaceMaterial";

type EnemyKind = "scout" | "hunter" | "layer" | "boss";
type WeaponKind = "guided" | "manual";

type EnemyState = {
  id: string;
  kind: EnemyKind;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  hp: number;
  maxHp: number;
  fireCooldown: number;
  detectedUntil: number;
  alerted: boolean;
  spawned: boolean;
  spawnAt: number;
  alive: boolean;
  mesh: THREE.Group | null;
};

type ProjectileState = {
  id: number;
  active: boolean;
  friendly: boolean;
  guided: boolean;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  targetId: string | null;
  age: number;
  fuel: number;
  falling: boolean;
  sinkTime: number;
  damage: number;
  mesh: THREE.Group | null;
};

type IceFormation = {
  position: [number, number, number];
  scale: [number, number, number];
  rotation: [number, number, number];
};

type TerrainCollider = {
  center: THREE.Vector3;
  halfSize: THREE.Vector3;
};

type TimedObject = {
  id: number;
  active: boolean;
  position: THREE.Vector3;
  ttl: number;
  mesh: THREE.Group | null;
};

type ExplosionState = TimedObject & {
  size: number;
  color: string;
};

type HudContact = {
  id: string;
  x: number;
  y: number;
  boss: boolean;
  locked: boolean;
};

type HudState = {
  hp: number;
  maxHp: number;
  depth: number;
  speed: number;
  cooldown: number;
  sonarCooldown: number;
  sonarActive: boolean;
  weapon: WeaponKind;
  lockedName: string | null;
  lockedDistance: number;
  kills: number;
  objective: string;
  bossHp: number;
  bossActive: boolean;
  elapsed: number;
  checkpoint: boolean;
  discovered: boolean;
  respawning: boolean;
  contacts: HudContact[];
  dialogue: string;
};

type InputState = {
  keys: Set<string>;
  pressed: Set<string>;
  mouseX: number;
  mouseY: number;
  padPrevious: boolean[];
};

const initialHud: HudState = {
  hp: 100,
  maxHp: 100,
  depth: 25,
  speed: 0,
  cooldown: 0,
  sonarCooldown: 0,
  sonarActive: false,
  weapon: "guided",
  lockedName: null,
  lockedDistance: 0,
  kills: 0,
  objective: "護衛艇を索敵せよ",
  bossHp: 600,
  bossActive: false,
  elapsed: 0,
  checkpoint: false,
  discovered: false,
  respawning: false,
  contacts: [],
  dialogue: "NIX「氷床下へ侵入。静かすぎるね。嫌な意味で」",
};

const clamp = THREE.MathUtils.clamp;
const PLAYER_COLLISION_RADIUS = 5.2;
const SEA_FLOOR_Y = -279;
const ICE_CEILING_Y = 5;
// Shared by navigation, torpedo collision, and the rendered environment.
const SEA_HALF_WIDTH = 240;
const SEA_BACK_Z = 120;
const SEA_FRONT_Z = -1120;
const SEA_LENGTH = SEA_BACK_Z - SEA_FRONT_Z;
const SEA_CENTER_Z = (SEA_BACK_Z + SEA_FRONT_Z) / 2;
const DISCOVERY_POSITION = new THREE.Vector3(72, -106, -432);

// These slots stay in the scene even when idle (intensity 0). Changing the
// number of lights on each shot/explosion forces new shader variants to compile.
const EFFECT_LIGHT_COUNT = 2;

const ICE_FORMATIONS: IceFormation[] = Array.from({ length: 54 }, (_, index) => {
  const row = Math.floor(index / 6);
  const side = index % 2 === 0 ? -1 : 1;
  return {
    position: [
      side * (80 + (index % 6) * 22),
      -8 - ((index * 17) % 75),
      70 - row * 130 - ((index * 29) % 70),
    ],
    scale: [
      12 + ((index * 13) % 24),
      18 + ((index * 19) % 55),
      13 + ((index * 7) % 28),
    ],
    rotation: [index * 0.17, index * 0.31, index * 0.11],
  };
});

const TERRAIN_COLLIDERS: TerrainCollider[] = [
  ...ICE_FORMATIONS.map((formation) => ({
    center: new THREE.Vector3(...formation.position),
    // The rendered dodecahedrons are irregular. A slightly smaller AABB keeps
    // collision feedback close to their visible surface.
    halfSize: new THREE.Vector3(...formation.scale).multiplyScalar(0.62),
  })),
  ...[-42, -14, 14, 42].map((x) => ({
    center: new THREE.Vector3(x, -112, -420),
    halfSize: new THREE.Vector3(2, 27.5, 2),
  })),
  {
    center: new THREE.Vector3(0, -77, -420),
    halfSize: new THREE.Vector3(25, 1.5, 4),
  },
];

class AudioSynth {
  private context: AudioContext | null = null;

  unlock() {
    if (!this.context) this.context = new AudioContext();
    if (this.context.state === "suspended") void this.context.resume();
  }

  tone(frequency: number, duration: number, gain: number, type: OscillatorType = "sine") {
    if (!this.context) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const amp = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, frequency * 0.65), now + duration);
    amp.gain.setValueAtTime(gain, now);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(amp).connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  sonar() {
    this.tone(980, 0.7, 0.12, "sine");
    window.setTimeout(() => this.tone(490, 0.45, 0.035, "sine"), 520);
  }

  fire() {
    this.tone(120, 0.45, 0.13, "sawtooth");
  }

  explosion(big = false) {
    this.tone(big ? 58 : 78, big ? 1.6 : 0.85, big ? 0.24 : 0.15, "sawtooth");
  }

  warning() {
    this.tone(740, 0.16, 0.08, "square");
  }
}

function createEnemies(): EnemyState[] {
  const positions = [
    [-55, -34, -130], [60, -48, -180], [-18, -70, -235], [88, -60, -285],
    [-80, -92, -345], [20, -105, -405], [95, -110, -465], [-65, -122, -515],
    [35, -126, -560], [-105, -140, -610],
  ];
  const spawnTimes = [0, 0, 12, 24, 36, 48, 60, 72, 84, 96];
  const kinds: EnemyKind[] = ["scout", "hunter", "layer"];
  const escorts = positions.map((position, index): EnemyState => ({
    id: "escort-" + index,
    kind: kinds[index % kinds.length],
    position: new THREE.Vector3(...position),
    velocity: new THREE.Vector3(),
    hp: kinds[index % kinds.length] === "hunter" ? 90 : 65,
    maxHp: kinds[index % kinds.length] === "hunter" ? 90 : 65,
    fireCooldown: 2 + index * 0.35,
    detectedUntil: 0,
    alerted: false,
    spawned: index < 2,
    spawnAt: spawnTimes[index],
    alive: true,
    mesh: null,
  }));
  escorts.push({
    id: "zero-disc",
    kind: "boss",
    position: new THREE.Vector3(0, -155, -790),
    velocity: new THREE.Vector3(),
    hp: 600,
    maxHp: 600,
    fireCooldown: 3,
    detectedUntil: 0,
    alerted: false,
    spawned: true,
    spawnAt: 0,
    alive: true,
    mesh: null,
  });
  return escorts;
}

function createProjectilePool(count: number): ProjectileState[] {
  return Array.from({ length: count }, (_, id) => ({
    id,
    active: false,
    friendly: true,
    guided: true,
    position: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    targetId: null,
    age: 0,
    fuel: 0,
    falling: false,
    sinkTime: 0,
    damage: 0,
    mesh: null,
  }));
}

function createTimedPool(count: number): TimedObject[] {
  return Array.from({ length: count }, (_, id) => ({
    id,
    active: false,
    position: new THREE.Vector3(),
    ttl: 0,
    mesh: null,
  }));
}

function createExplosionPool(count: number): ExplosionState[] {
  return Array.from({ length: count }, (_, id) => ({
    id,
    active: false,
    position: new THREE.Vector3(),
    ttl: 0,
    size: 1,
    color: "#ff9c55",
    mesh: null,
  }));
}

function PlayerSubmarine({ variant }: { variant: string }) {
  return variant === "corback" ? <CorbackModel /> : <RyuouModel />;
}

function EnemySubmarine({ kind, pulse }: { kind: EnemyKind; pulse: SonarPulse }) {
  if (kind === "boss") {
    return (
      <>
        <mesh scale={[2.8, 0.7, 2.8]}>
          <sphereGeometry args={[10, 32, 14]} />
          <SonarSurfaceMaterial pulse={pulse} enemy color="#27383b" metalness={0.84} roughness={0.32} />
        </mesh>
        <mesh position={[0, 4.2, 0]} scale={[1.8, 0.6, 1.8]}>
          <sphereGeometry args={[5, 24, 10]} />
          <SonarSurfaceMaterial pulse={pulse} enemy color="#17282d" metalness={0.75} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[26, 1.1, 10, 48]} />
          <SonarSurfaceMaterial pulse={pulse} enemy color="#4b6063" metalness={0.9} roughness={0.25} />
        </mesh>
        {[0, 1, 2, 3, 4, 5].map((index) => {
          const angle = index * Math.PI / 3;
          return (
            <mesh key={index} position={[Math.cos(angle) * 25, 0, Math.sin(angle) * 25]}>
              <sphereGeometry args={[0.7, 10, 8]} />
              <meshBasicMaterial color="#ff473d" toneMapped={false} />
            </mesh>
          );
        })}
      </>
    );
  }

  const color = kind === "scout" ? "#6d3c3e" : kind === "hunter" ? "#593035" : "#4f3d45";
  return (
    <>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <capsuleGeometry args={[1.5, kind === "hunter" ? 6.5 : 5, 7, 14]} />
        <SonarSurfaceMaterial pulse={pulse} enemy color={color} metalness={0.7} roughness={0.45} />
      </mesh>
      <mesh position={[0, 0, 2.4]}>
        <boxGeometry args={[5.5, 0.25, 1.4]} />
        <SonarSurfaceMaterial pulse={pulse} enemy color="#452c31" />
      </mesh>
      <mesh position={[0, 0.3, -3]}>
        <sphereGeometry args={[0.32, 8, 6]} />
        <meshBasicMaterial color="#ff493f" toneMapped={false} />
      </mesh>
    </>
  );
}

function TorpedoModel({ friendly }: { friendly: boolean }) {
  return (
    <>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <capsuleGeometry args={[0.24, 1.4, 5, 8]} />
        <meshStandardMaterial color={friendly ? "#b8e1d9" : "#d67b6f"} metalness={0.65} />
      </mesh>
      <mesh position={[0, 0, 1]}>
        <sphereGeometry args={[0.2, 8, 6]} />
        <meshBasicMaterial color={friendly ? "#69ffee" : "#ff493f"} toneMapped={false} />
      </mesh>
    </>
  );
}

function IceFormations({ pulse }: { pulse: SonarPulse }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!mesh.current) return;
    const transform = new THREE.Object3D();
    const color = new THREE.Color();
    ICE_FORMATIONS.forEach((formation, index) => {
      transform.position.set(...formation.position);
      transform.scale.set(...formation.scale);
      transform.rotation.set(...formation.rotation);
      transform.updateMatrix();
      mesh.current!.setMatrixAt(index, transform.matrix);
      mesh.current!.setColorAt(index, color.set(index % 3 === 0 ? "#183d43" : "#123038"));
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
    mesh.current.computeBoundingSphere();
  }, []);
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, ICE_FORMATIONS.length]}>
      <dodecahedronGeometry args={[1, 0]} />
      <SonarSurfaceMaterial pulse={pulse} roughness={0.88} />
    </instancedMesh>
  );
}

function IceEnvironment({ pulse }: { pulse: SonarPulse }) {
  const particles = useMemo(() => {
    const array = new Float32Array(900);
    for (let index = 0; index < array.length; index += 3) {
      const seed = index / 3 + 1;
      const noiseA = Math.sin(seed * 12.9898) * 43758.5453;
      const noiseB = Math.sin(seed * 78.233) * 19341.349;
      const noiseC = Math.sin(seed * 39.425) * 96321.517;
      array[index] = ((noiseA - Math.floor(noiseA)) - 0.5) * SEA_HALF_WIDTH * 2;
      array[index + 1] = SEA_FLOOR_Y + (noiseB - Math.floor(noiseB)) * (ICE_CEILING_Y - SEA_FLOOR_Y);
      array[index + 2] = SEA_BACK_Z - (noiseC - Math.floor(noiseC)) * SEA_LENGTH;
    }
    return array;
  }, []);

  return (
    <>
      <mesh position={[0, ICE_CEILING_Y + 5, SEA_CENTER_Z]} scale={[SEA_HALF_WIDTH * 2 + 80, 10, SEA_LENGTH + 80]}>
        <boxGeometry />
        <SonarSurfaceMaterial pulse={pulse} color="#7cb7b8" roughness={0.85} />
      </mesh>
      <mesh position={[0, SEA_FLOOR_Y - 6, SEA_CENTER_Z]} scale={[SEA_HALF_WIDTH * 2 + 80, 12, SEA_LENGTH + 80]}>
        <boxGeometry />
        <SonarSurfaceMaterial pulse={pulse} color="#061416" roughness={1} />
      </mesh>
      <IceFormations pulse={pulse} />
      <group position={[0, -112, -420]}>
        {[-42, -14, 14, 42].map((x) => (
          <mesh key={x} position={[x, 0, 0]} scale={[4, 55, 4]}>
            <boxGeometry />
            <SonarSurfaceMaterial pulse={pulse} color="#12282b" metalness={0.7} roughness={0.55} />
          </mesh>
        ))}
        <mesh position={[0, 35, 0]} scale={[50, 3, 8]}>
          <boxGeometry />
          <SonarSurfaceMaterial pulse={pulse} color="#142c30" metalness={0.72} />
        </mesh>
      </group>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[particles, 3]} />
        </bufferGeometry>
        <pointsMaterial color="#a7e6dd" size={0.42} transparent opacity={0.45} sizeAttenuation />
      </points>
    </>
  );
}

type GameSceneProps = {
  vehicle: string;
  paused: boolean;
  onPause: () => void;
  onHud: (hud: HudState) => void;
  onComplete: (result: MissionResult) => void;
};

const GameScene = memo(function GameScene({
  vehicle,
  paused,
  onPause,
  onHud,
  onComplete,
}: GameSceneProps) {
  const { camera, gl, scene } = useThree();
  const input = useRef<InputState>({
    keys: new Set(),
    pressed: new Set(),
    mouseX: 0,
    mouseY: 0,
    padPrevious: [],
  });
  const synth = useRef(new AudioSynth());
  const playerMesh = useRef<THREE.Group>(null);
  const playerPosition = useRef(new THREE.Vector3(0, -25, 40));
  const playerVelocity = useRef(new THREE.Vector3());
  const yaw = useRef(0);
  const pitch = useRef(0);
  const playerHp = useRef(vehicle === "corback" ? 150 : 100);
  const maxHp = vehicle === "corback" ? 150 : 100;
  const weapon = useRef<WeaponKind>("guided");
  const weaponCooldown = useRef(0);
  const sonarCooldown = useRef(0);
  const sonarAge = useRef(99);
  const sonarPulse = useMemo<SonarPulse>(() => ({
    origin: { value: new THREE.Vector3() },
    age: { value: 99 },
  }), []);
  const lockId = useRef<string | null>(null);
  const enemies = useMemo(() => createEnemies(), []);
  const projectiles = useMemo(() => createProjectilePool(72), []);
  const mines = useMemo(() => createTimedPool(10), []);
  const decoys = useMemo(() => createTimedPool(6), []);
  const explosions = useMemo(() => createExplosionPool(18), []);
  const sonarMesh = useRef<THREE.Mesh>(null);
  const discoveryMesh = useRef<THREE.Group>(null);
  const elapsed = useRef(0);
  const kills = useRef(0);
  const checkpoint = useRef(false);
  const discovered = useRef(false);
  const respawnTimer = useRef(0);
  const completed = useRef(false);
  const completionTimer = useRef(0);
  const terrainImpactCooldown = useRef(0);
  const lastEnemySpawnAt = useRef(0);
  const lastHudUpdate = useRef(0);
  const dialogue = useRef(initialHud.dialogue);
  const dialogueFlags = useRef(new Set<string>());
  const cameraTarget = useRef(new THREE.Vector3());
  const workA = useMemo(() => new THREE.Vector3(), []);
  const workB = useMemo(() => new THREE.Vector3(), []);
  const workQ = useMemo(() => new THREE.Quaternion(), []);
  const scratch = useMemo(() => ({
    euler: new THREE.Euler(0, 0, 0, "YXZ"),
    targetVelocity: new THREE.Vector3(),
    contactNormal: new THREE.Vector3(),
    collisionNormal: new THREE.Vector3(),
    cameraBack: new THREE.Vector3(),
    desiredCamera: new THREE.Vector3(),
    toPlayer: new THREE.Vector3(),
    moveDirection: new THREE.Vector3(),
    orbit: new THREE.Vector3(),
    desired: new THREE.Vector3(),
    lookAt: new THREE.Vector3(),
  }), []);
  const effectLights = useRef<(THREE.PointLight | null)[]>([]);

  const setDialogue = useCallback((id: string, text: string) => {
    if (dialogueFlags.current.has(id)) return;
    dialogueFlags.current.add(id);
    dialogue.current = text;
  }, []);

  useEffect(() => {
    const state = input.current;
    if (paused) {
      state.keys.clear();
      state.pressed.clear();
      state.mouseX = state.mouseY = 0;
      if (document.pointerLockElement === gl.domElement) document.exitPointerLock();
    }
    const press = (code: string) => {
      if (!state.keys.has(code)) state.pressed.add(code);
      state.keys.add(code);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Escape") {
        if (!event.repeat) onPause();
        return;
      }
      if (paused) return;
      press(event.code);
      if (["Space", "Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) {
        event.preventDefault();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => state.keys.delete(event.code);
    const onMouseMove = (event: MouseEvent) => {
      if (!paused && document.pointerLockElement === gl.domElement) {
        state.mouseX += event.movementX;
        state.mouseY += event.movementY;
      }
    };
    const onMouseDown = (event: MouseEvent) => {
      if (paused) return;
      synth.current.unlock();
      if (document.pointerLockElement !== gl.domElement) {
        // Embedded browsers can decline pointer lock; keyboard steering still works.
        void gl.domElement.requestPointerLock()?.catch(() => undefined);
      }
      if (event.button === 0) state.pressed.add("Fire");
      if (event.button === 2) state.pressed.add("Lock");
    };
    const onWheel = (event: WheelEvent) => {
      if (paused) return;
      state.pressed.add("CycleWeapon");
      event.preventDefault();
    };
    const onContext = (event: MouseEvent) => event.preventDefault();
    const onVisibility = () => {
      if (document.hidden && !paused) onPause();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("mousemove", onMouseMove);
    gl.domElement.addEventListener("mousedown", onMouseDown);
    gl.domElement.addEventListener("wheel", onWheel, { passive: false });
    gl.domElement.addEventListener("contextmenu", onContext);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("mousemove", onMouseMove);
      gl.domElement.removeEventListener("mousedown", onMouseDown);
      gl.domElement.removeEventListener("wheel", onWheel);
      gl.domElement.removeEventListener("contextmenu", onContext);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [gl, onPause, paused]);

  const spawnExplosion = useCallback((position: THREE.Vector3, size: number, color = "#ff9c55") => {
    const effect = explosions.find((item) => !item.active);
    if (!effect) return;
    effect.active = true;
    effect.position.copy(position);
    effect.ttl = 1;
    effect.size = size;
    effect.color = color;
  }, [explosions]);

  const spawnProjectile = useCallback(
    (
      origin: THREE.Vector3,
      direction: THREE.Vector3,
      friendly: boolean,
      guided: boolean,
      targetId: string | null,
      damage: number,
      speed: number,
    ) => {
      const projectile = projectiles.find((item) => !item.active);
      if (!projectile) return false;
      projectile.active = true;
      projectile.friendly = friendly;
      projectile.guided = guided;
      projectile.position.copy(origin);
      projectile.velocity.copy(direction).normalize().multiplyScalar(speed);
      projectile.targetId = targetId;
      projectile.age = 0;
      projectile.fuel = friendly ? (guided ? 9 : 7) : 8;
      projectile.falling = false;
      projectile.sinkTime = 0;
      projectile.damage = damage;
      if (projectile.mesh) {
        const body = projectile.mesh.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
        const glow = projectile.mesh.children[1] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
        body.material.color.set(friendly ? "#b8e1d9" : "#d67b6f");
        glow.material.color.set(friendly ? "#69ffee" : "#ff493f");
      }
      return true;
    },
    [projectiles],
  );

  const triggerSonar = useCallback(() => {
    if (sonarCooldown.current > 0 || respawnTimer.current > 0) return;
    sonarCooldown.current = 6;
    sonarAge.current = 0;
    sonarPulse.origin.value.copy(playerPosition.current);
    synth.current.sonar();
    enemies.forEach((enemy) => {
      const distance = enemy.position.distanceTo(playerPosition.current);
      if (enemy.alive && enemy.spawned && distance < SONAR_RANGE) {
        enemy.detectedUntil = elapsed.current + 5.5;
        enemy.alerted = true;
      }
    });
    setDialogue("first-sonar", "NIX「こちらの音も丸聞こえだ。さあ、何が返事をするかな」");
  }, [enemies, setDialogue, sonarPulse]);

  const selectLock = useCallback(() => {
    const candidates = enemies
      .filter(
        (enemy) =>
          enemy.alive &&
          enemy.spawned &&
          (enemy.detectedUntil > elapsed.current || enemy.position.distanceTo(playerPosition.current) < 115),
      )
      .sort(
        (a, b) =>
          a.position.distanceTo(playerPosition.current) - b.position.distanceTo(playerPosition.current),
      );
    lockId.current = candidates[0]?.id ?? null;
    if (!lockId.current) setDialogue("no-contact", "NIX「ロックするには、まず見つけることだね」");
  }, [enemies, setDialogue]);

  const firePlayerWeapon = useCallback(() => {
    if (weaponCooldown.current > 0 || respawnTimer.current > 0 || !playerMesh.current) return;
    if (weapon.current === "guided" && !lockId.current) {
      setDialogue("need-lock", "NIX「誘導魚雷には標的ロックが必要だ。Eで選べる」");
      return;
    }
    const quaternion = playerMesh.current.quaternion;
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(quaternion);
    const origin = playerPosition.current.clone().addScaledVector(forward, 7);
    const ok = spawnProjectile(
      origin,
      forward,
      true,
      weapon.current === "guided",
      weapon.current === "guided" ? lockId.current : null,
      weapon.current === "guided" ? 72 : 95,
      weapon.current === "guided" ? 34 : 42,
    );
    if (ok) {
      weaponCooldown.current = weapon.current === "guided" ? 2.6 : 2;
      synth.current.fire();
      setDialogue("first-shot", "NIX「魚雷航走。祈るなら今のうちだ」");
    }
  }, [setDialogue, spawnProjectile]);

  const deployMine = useCallback(() => {
    const mine = mines.find((item) => !item.active);
    if (!mine || !playerMesh.current) return;
    const back = new THREE.Vector3(0, 0, 1).applyQuaternion(playerMesh.current.quaternion);
    mine.active = true;
    mine.ttl = 25;
    mine.position.copy(playerPosition.current).addScaledVector(back, 7);
  }, [mines]);

  const deployDecoy = useCallback(() => {
    const decoy = decoys.find((item) => !item.active);
    if (!decoy) return;
    decoy.active = true;
    decoy.ttl = 6;
    decoy.position.copy(playerPosition.current);
    synth.current.tone(320, 0.25, 0.06, "square");
  }, [decoys]);

  const respawn = useCallback(() => {
    playerHp.current = maxHp;
    playerVelocity.current.set(0, 0, 0);
    playerPosition.current.set(0, checkpoint.current ? -105 : -25, checkpoint.current ? -395 : 40);
    yaw.current = 0;
    pitch.current = 0;
    projectiles.forEach((projectile) => {
      projectile.active = false;
    });
    lockId.current = null;
    respawnTimer.current = 0;
    setDialogue("respawn-" + elapsed.current, checkpoint.current
      ? "NIX「観測施設の記録点から再開。今度は沈まないでくれ」"
      : "NIX「予備機へ意識を戻した。君は相変わらず乱暴だ」");
  }, [maxHp, projectiles, setDialogue]);

  useFrame((state, frameDelta) => {
    const dt = Math.min(frameDelta, 0.05);
    const now = elapsed.current;
    const controls = input.current;

    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = Array.from(gamepads).find(Boolean);
    let padThrust = 0;
    let padStrafe = 0;
    let padYaw = 0;
    let padPitch = 0;
    let padVertical = 0;
    if (pad) {
      const dead = (value: number) => (Math.abs(value) < 0.15 ? 0 : value);
      padStrafe = dead(pad.axes[0] ?? 0);
      padThrust = -dead(pad.axes[1] ?? 0);
      padYaw = dead(pad.axes[2] ?? 0);
      padPitch = dead(pad.axes[3] ?? 0);
      padVertical = (pad.buttons[5]?.pressed ? 1 : 0) - (pad.buttons[4]?.pressed ? 1 : 0);
      const edge = (index: number, action: string) => {
        const active = Boolean(pad.buttons[index]?.pressed);
        if (active && !controls.padPrevious[index]) controls.pressed.add(action);
        controls.padPrevious[index] = active;
      };
      edge(7, "Fire");
      edge(6, "Lock");
      edge(3, "Sonar");
      edge(2, "CycleWeapon");
      edge(1, "Mine");
      edge(0, "Decoy");
    }

    if (controls.pressed.has("Escape")) controls.pressed.delete("Escape");
    if (paused) {
      controls.pressed.clear();
      controls.mouseX = 0;
      controls.mouseY = 0;
      return;
    }

    elapsed.current += dt;
    weaponCooldown.current = Math.max(0, weaponCooldown.current - dt);
    sonarCooldown.current = Math.max(0, sonarCooldown.current - dt);
    terrainImpactCooldown.current = Math.max(0, terrainImpactCooldown.current - dt);
    sonarAge.current += dt;

    if (controls.pressed.has("KeyQ") || controls.pressed.has("Sonar")) triggerSonar();
    if (controls.pressed.has("KeyE") || controls.pressed.has("Lock")) selectLock();
    if (controls.pressed.has("Fire")) firePlayerWeapon();
    if (controls.pressed.has("Tab") || controls.pressed.has("CycleWeapon")) {
      weapon.current = weapon.current === "guided" ? "manual" : "guided";
      lockId.current = weapon.current === "manual" ? null : lockId.current;
    }
    if (controls.pressed.has("KeyR") || controls.pressed.has("Mine")) deployMine();
    if (controls.pressed.has("KeyF") || controls.pressed.has("Decoy")) deployDecoy();
    controls.pressed.clear();

    if (respawnTimer.current > 0) {
      respawnTimer.current -= dt;
      if (respawnTimer.current <= 0) respawn();
    } else if (!completed.current && playerMesh.current) {
      const thrust =
        (controls.keys.has("KeyW") ? 1 : 0) -
        (controls.keys.has("KeyS") ? 1 : 0) +
        padThrust;
      const strafe =
        (controls.keys.has("KeyD") ? 1 : 0) -
        (controls.keys.has("KeyA") ? 1 : 0) +
        padStrafe;
      const vertical =
        (controls.keys.has("Space") ? 1 : 0) -
        (controls.keys.has("ControlLeft") || controls.keys.has("ControlRight") ? 1 : 0) +
        padVertical;
      const keyboardYaw =
        (controls.keys.has("ArrowRight") ? 1 : 0) -
        (controls.keys.has("ArrowLeft") ? 1 : 0);
      const keyboardPitch =
        (controls.keys.has("ArrowDown") ? 1 : 0) -
        (controls.keys.has("ArrowUp") ? 1 : 0);
      yaw.current -= controls.mouseX * 0.0022 + (padYaw + keyboardYaw) * dt * 1.25;
      pitch.current -= controls.mouseY * 0.0018 + (padPitch + keyboardPitch) * dt * 0.92;
      pitch.current = clamp(pitch.current, -0.62, 0.62);
      controls.mouseX = 0;
      controls.mouseY = 0;

      workQ.setFromEuler(scratch.euler.set(pitch.current, yaw.current, 0));
      playerMesh.current.quaternion.slerp(workQ, 1 - Math.exp(-dt * 8));
      const forward = workA.set(0, 0, -1).applyQuaternion(playerMesh.current.quaternion);
      const right = workB.set(1, 0, 0).applyQuaternion(playerMesh.current.quaternion);
      const boosting = controls.keys.has("ShiftLeft") || Boolean(pad?.buttons[10]?.pressed);
      const maxSpeed = boosting ? 25 : vehicle === "corback" ? 16 : 18;
      const targetVelocity = scratch.targetVelocity.set(0, 0, 0)
        .addScaledVector(forward, clamp(thrust, -1, 1) * maxSpeed)
        .addScaledVector(right, clamp(strafe, -1, 1) * 7);
      targetVelocity.y += clamp(vertical, -1, 1) * 9;
      const response = 1 - Math.exp(-dt * (thrust === 0 && strafe === 0 && vertical === 0 ? 2.2 : 1.35));
      playerVelocity.current.lerp(targetVelocity, response);
      playerPosition.current.addScaledVector(playerVelocity.current, dt);

      const collisionNormal = scratch.collisionNormal;
      let collisionDepth = 0;
      const registerCollision = (normal: THREE.Vector3, penetration: number) => {
        if (penetration > collisionDepth) {
          collisionDepth = penetration;
          collisionNormal.copy(normal);
        }
      };

      if (playerPosition.current.x - PLAYER_COLLISION_RADIUS < -SEA_HALF_WIDTH) {
        registerCollision(
          scratch.contactNormal.set(1, 0, 0),
          -SEA_HALF_WIDTH - (playerPosition.current.x - PLAYER_COLLISION_RADIUS),
        );
      }
      if (playerPosition.current.x + PLAYER_COLLISION_RADIUS > SEA_HALF_WIDTH) {
        registerCollision(
          scratch.contactNormal.set(-1, 0, 0),
          playerPosition.current.x + PLAYER_COLLISION_RADIUS - SEA_HALF_WIDTH,
        );
      }
      if (playerPosition.current.y + PLAYER_COLLISION_RADIUS > ICE_CEILING_Y) {
        registerCollision(
          scratch.contactNormal.set(0, -1, 0),
          playerPosition.current.y + PLAYER_COLLISION_RADIUS - ICE_CEILING_Y,
        );
      }
      if (playerPosition.current.y - PLAYER_COLLISION_RADIUS < SEA_FLOOR_Y) {
        registerCollision(
          scratch.contactNormal.set(0, 1, 0),
          SEA_FLOOR_Y - (playerPosition.current.y - PLAYER_COLLISION_RADIUS),
        );
      }
      if (playerPosition.current.z - PLAYER_COLLISION_RADIUS < SEA_FRONT_Z) {
        registerCollision(
          scratch.contactNormal.set(0, 0, 1),
          SEA_FRONT_Z - (playerPosition.current.z - PLAYER_COLLISION_RADIUS),
        );
      }
      if (playerPosition.current.z + PLAYER_COLLISION_RADIUS > SEA_BACK_Z) {
        registerCollision(
          scratch.contactNormal.set(0, 0, -1),
          playerPosition.current.z + PLAYER_COLLISION_RADIUS - SEA_BACK_Z,
        );
      }

      for (const collider of TERRAIN_COLLIDERS) {
        const penetration = sphereBoxPenetration(
          playerPosition.current, PLAYER_COLLISION_RADIUS,
          collider.center, collider.halfSize, scratch.contactNormal,
        );
        registerCollision(scratch.contactNormal, penetration);
      }

      if (collisionDepth > 0) {
        const normal = collisionNormal;
        const impactSpeed = Math.max(0, -playerVelocity.current.dot(normal));
        playerPosition.current.addScaledVector(normal, collisionDepth + 0.06);

        const reflectedVelocity = scratch.desired.copy(playerVelocity.current).reflect(normal).multiplyScalar(0.34);
        playerVelocity.current.lerp(reflectedVelocity, 0.84);
        const reboundSpeed = playerVelocity.current.length();
        if (reboundSpeed > 0.2) {
          yaw.current = Math.atan2(-playerVelocity.current.x, -playerVelocity.current.z);
          pitch.current = Math.asin(clamp(playerVelocity.current.y / reboundSpeed, -0.75, 0.75));
        }

        if (impactSpeed > 2.2 && terrainImpactCooldown.current <= 0) {
          const impactDamage = clamp(2 + impactSpeed * 0.42, 2, 10);
          playerHp.current -= impactDamage;
          terrainImpactCooldown.current = 0.65;
          spawnExplosion(
            playerPosition.current.clone().addScaledVector(normal, -PLAYER_COLLISION_RADIUS),
            2.8,
            "#8dfff2",
          );
          synth.current.tone(74, 0.45, 0.12, "sawtooth");
          setDialogue("terrain-impact", "NIX「地形との接触を確認。海底は君を避けてくれないよ」");
          if (playerHp.current <= 0) {
            respawnTimer.current = 2.5;
            spawnExplosion(playerPosition.current, 18, "#79fff0");
            synth.current.explosion(true);
            setDialogue("terrain-destroyed", "NIX「衝突で船体喪失。記録点へ戻す」");
          }
        }
      }

      playerMesh.current.position.copy(playerPosition.current);

      const cameraBack = scratch.cameraBack.set(0, 6.5, 22).applyQuaternion(playerMesh.current.quaternion);
      const desiredCamera = scratch.desiredCamera.copy(playerPosition.current).add(cameraBack);
      camera.position.lerp(desiredCamera, 1 - Math.exp(-dt * 4.4));
      cameraTarget.current.lerp(
        scratch.lookAt.copy(playerPosition.current).addScaledVector(forward, 12),
        1 - Math.exp(-dt * 7),
      );
      camera.lookAt(cameraTarget.current);
      if (camera instanceof THREE.PerspectiveCamera) {
        const desiredFov = boosting ? 68 : 61;
        camera.fov += (desiredFov - camera.fov) * (1 - Math.exp(-dt * 3));
        camera.updateProjectionMatrix();
      }

      if (!checkpoint.current && (kills.current >= 5 || playerPosition.current.z < -375)) {
        checkpoint.current = true;
        setDialogue("checkpoint", "NIX「観測施設を記録点に設定。次に沈んでも、ここまでは戻れる」");
      }

      if (!discovered.current && playerPosition.current.distanceToSquared(DISCOVERY_POSITION) < 22 * 22) {
        discovered.current = true;
        setDialogue("discovery", "NIX「放棄機体コーバック号。帰還できれば、君のものだ」");
      }
    }

    const activeEscortCount = enemies.filter(
      (enemy) => enemy.kind !== "boss" && enemy.alive && enemy.spawned,
    ).length;
    const nextEscort = enemies.find(
      (enemy) =>
        enemy.kind !== "boss" &&
        enemy.alive &&
        !enemy.spawned &&
        enemy.spawnAt <= elapsed.current,
    );
    if (
      nextEscort &&
      activeEscortCount < 3 &&
      elapsed.current - lastEnemySpawnAt.current >= 8
    ) {
      nextEscort.spawned = true;
      nextEscort.fireCooldown = 3.5;
      nextEscort.detectedUntil = elapsed.current + 3;
      lastEnemySpawnAt.current = elapsed.current;
      spawnExplosion(nextEscort.position, 4.5, "#ff7467");
      synth.current.warning();
      setDialogue(
        "reinforcement-" + nextEscort.id,
        "NIX「新しい推進音を確認。増援が一隻、海域へ入った」",
      );
    }

    const boss = enemies.find((enemy) => enemy.kind === "boss");
    if (boss && boss.alive && (playerPosition.current.z < -520 || kills.current >= 8)) {
      if (!boss.alerted) {
        boss.alerted = true;
        boss.detectedUntil = now + 999;
        setDialogue("boss", "NIX「円盤型を確認。大きいね。依頼書は縮尺を間違えたらしい」");
        synth.current.warning();
      }
    }

    enemies.forEach((enemy, enemyIndex) => {
      if (!enemy.mesh) return;
      enemy.mesh.visible = enemy.alive && enemy.spawned;
      if (!enemy.alive || !enemy.spawned) return;
      const distance = enemy.position.distanceTo(playerPosition.current);
      if (distance < 90) enemy.detectedUntil = now + 1;
      const active = enemy.alerted || distance < 250;
      if (active && respawnTimer.current <= 0 && !completed.current) {
        const toPlayer = scratch.toPlayer.copy(playerPosition.current).sub(enemy.position);
        const desiredDistance = enemy.kind === "boss" ? 135 : enemy.kind === "layer" ? 100 : 75;
        const moveDirection = scratch.moveDirection.copy(toPlayer).normalize();
        if (distance < desiredDistance) moveDirection.multiplyScalar(-0.55);
        const orbit = scratch.orbit.set(-toPlayer.z, 0, toPlayer.x).normalize();
        moveDirection.addScaledVector(orbit, enemy.kind === "boss" ? 0.28 : (enemyIndex % 2 ? 0.38 : -0.38));
        const enemySpeed = enemy.kind === "boss" ? 3.2 : enemy.kind === "scout" ? 10 : 7;
        enemy.velocity.lerp(moveDirection.normalize().multiplyScalar(enemySpeed), 1 - Math.exp(-dt * 0.9));
        enemy.position.addScaledVector(enemy.velocity, dt);
        enemy.position.y = clamp(enemy.position.y, -195, -18);
        enemy.fireCooldown -= dt;
        if (distance < (enemy.kind === "boss" ? 330 : 220) && enemy.fireCooldown <= 0) {
          const shotCount = enemy.kind === "boss" && enemy.hp < 360 ? 3 : 1;
          for (let shot = 0; shot < shotCount; shot += 1) {
            const direction = scratch.desired.copy(toPlayer).normalize();
            direction.x += (shot - (shotCount - 1) / 2) * 0.11;
            spawnProjectile(
              enemy.position,
              direction,
              false,
              true,
              "player",
              enemy.kind === "boss" ? 18 : 14,
              enemy.kind === "boss" ? 25 : 22,
            );
          }
          enemy.fireCooldown = enemy.kind === "boss" ? (enemy.hp < 210 ? 2.1 : 3.2) : 4.3 + (enemyIndex % 3);
        }
      }
      enemy.mesh.position.copy(enemy.position);
      if (enemy.kind === "boss") {
        enemy.mesh.rotation.y += dt * (enemy.hp < 210 ? 0.42 : 0.2);
      } else if (enemy.velocity.lengthSq() > 0.1) {
        enemy.mesh.lookAt(scratch.lookAt.copy(enemy.position).add(enemy.velocity));
      }
      const marker = enemy.mesh.getObjectByName("contact-marker");
      if (marker) marker.visible = enemy.detectedUntil > now;
    });

    decoys.forEach((decoy) => {
      if (!decoy.mesh) return;
      decoy.ttl -= decoy.active ? dt : 0;
      if (decoy.ttl <= 0) decoy.active = false;
      decoy.mesh.visible = decoy.active;
      if (!decoy.active) return;
      decoy.mesh.position.copy(decoy.position);
      decoy.mesh.rotation.y += dt * 3;
    });

    mines.forEach((mine) => {
      if (!mine.mesh) return;
      mine.ttl -= mine.active ? dt : 0;
      if (mine.ttl <= 0) mine.active = false;
      if (mine.active) {
        const target = enemies.find(
          (enemy) =>
            enemy.alive &&
            enemy.spawned &&
            enemy.position.distanceTo(mine.position) < (enemy.kind === "boss" ? 35 : 16),
        );
        if (target) {
          target.hp -= 85;
          spawnExplosion(mine.position, 7);
          synth.current.explosion();
          mine.active = false;
        }
      }
      mine.mesh.visible = mine.active;
      if (!mine.active) return;
      mine.mesh.position.copy(mine.position);
      mine.mesh.rotation.y += dt;
    });

    projectiles.forEach((projectile) => {
      if (!projectile.mesh) return;
      if (!projectile.active) {
        projectile.mesh.visible = false;
        return;
      }

      projectile.age += dt;
      if (!projectile.falling) {
        projectile.fuel -= dt;
        if (projectile.fuel <= 0) {
          projectile.falling = true;
          projectile.guided = false;
          projectile.targetId = null;
          projectile.sinkTime = 0;
          projectile.velocity.multiplyScalar(0.32);
          if (projectile.friendly) {
            setDialogue("torpedo-fuel", "NIX「魚雷燃料切れ。推進停止、海底へ沈降する」");
          }
        }
      } else {
        projectile.sinkTime += dt;
        projectile.velocity.x *= Math.exp(-dt * 1.1);
        projectile.velocity.z *= Math.exp(-dt * 1.1);
        projectile.velocity.y = THREE.MathUtils.lerp(
          projectile.velocity.y,
          -10,
          1 - Math.exp(-dt * 0.9),
        );
      }

      let targetPosition: THREE.Vector3 | null = null;
      if (!projectile.falling && projectile.guided && projectile.targetId) {
        if (projectile.targetId === "player") {
          let nearestDecoy: TimedObject | undefined;
          let nearestDistance = Infinity;
          for (const decoy of decoys) {
            if (!decoy.active) continue;
            const distance = decoy.position.distanceToSquared(projectile.position);
            if (distance < nearestDistance) {
              nearestDistance = distance;
              nearestDecoy = decoy;
            }
          }
          targetPosition = nearestDecoy?.position ?? playerPosition.current;
        } else {
          const target = enemies.find(
            (enemy) => enemy.id === projectile.targetId && enemy.alive && enemy.spawned,
          );
          targetPosition = target?.position ?? null;
        }
      }
      if (targetPosition) {
        const speed = projectile.velocity.length();
        const desired = scratch.desired.copy(targetPosition).sub(projectile.position).normalize().multiplyScalar(speed);
        projectile.velocity.lerp(desired, 1 - Math.exp(-dt * 2.4));
      }
      projectile.position.addScaledVector(projectile.velocity, dt);

      const hitTerrain =
        projectile.position.y <= SEA_FLOOR_Y + 0.8 ||
        projectile.position.y >= ICE_CEILING_Y - 0.4 ||
        Math.abs(projectile.position.x) >= SEA_HALF_WIDTH ||
        projectile.position.z <= SEA_FRONT_Z ||
        projectile.position.z >= SEA_BACK_Z ||
        TERRAIN_COLLIDERS.some(
          (collider) =>
            Math.abs(projectile.position.x - collider.center.x) <= collider.halfSize.x &&
            Math.abs(projectile.position.y - collider.center.y) <= collider.halfSize.y &&
            Math.abs(projectile.position.z - collider.center.z) <= collider.halfSize.z,
        );
      if (hitTerrain) {
        projectile.active = false;
        projectile.position.y = Math.max(projectile.position.y, SEA_FLOOR_Y);
        spawnExplosion(projectile.position, projectile.falling ? 5.5 : 4.5, "#ffad68");
        synth.current.explosion();
        if (projectile.falling && projectile.friendly) {
          setDialogue("torpedo-bottom", "NIX「燃料切れ魚雷、海底で自壊を確認」");
        }
      }

      if (projectile.active && projectile.friendly) {
        const target = enemies.find(
          (enemy) =>
            enemy.alive &&
            enemy.spawned &&
            enemy.position.distanceTo(projectile.position) < (enemy.kind === "boss" ? 28 : 5.2),
        );
        if (target) {
          target.hp -= projectile.damage;
          projectile.active = false;
          spawnExplosion(projectile.position, target.kind === "boss" ? 10 : 5);
          synth.current.explosion(target.kind === "boss");
          if (target.hp <= 0) {
            target.alive = false;
            spawnExplosion(target.position, target.kind === "boss" ? 38 : 12);
            if (target.kind === "boss") {
              completed.current = true;
              completionTimer.current = 3.2;
              lockId.current = null;
              setDialogue("boss-down", "NIX「標的沈黙。識別符号を回収した……これは、二十年前のものだ」");
            } else {
              kills.current += 1;
              if (kills.current === 3) setDialogue("kills-3", "NIX「三隻撃破。海が少し静かになった」");
              if (kills.current === 7) setDialogue("kills-7", "NIX「残りは深部だ。巨大な反応も近い」");
            }
          }
        }
      } else if (
        projectile.active &&
        respawnTimer.current <= 0 &&
        projectile.position.distanceTo(playerPosition.current) < 4.8
      ) {
        playerHp.current -= projectile.damage;
        projectile.active = false;
        spawnExplosion(projectile.position, 4, "#83fff0");
        synth.current.explosion();
        if (playerHp.current <= 25 && playerHp.current > 0) {
          setDialogue("low-hp", "NIX「船体限界。君の過去より穴だらけになる前に避けて」");
          synth.current.warning();
        }
        if (playerHp.current <= 0) {
          respawnTimer.current = 2.5;
          spawnExplosion(playerPosition.current, 18, "#79fff0");
          synth.current.explosion(true);
          setDialogue("destroyed-" + Math.floor(now), "NIX「撃沈判定。記録点へ巻き戻す」");
        }
      }
      projectile.mesh.visible = projectile.active;
      projectile.mesh.position.copy(projectile.position);
      if (projectile.velocity.lengthSq() > 0.1) {
        projectile.mesh.lookAt(scratch.lookAt.copy(projectile.position).add(projectile.velocity));
      }
    });

    for (let firstIndex = 0; firstIndex < projectiles.length; firstIndex += 1) {
      const first = projectiles[firstIndex];
      if (!first.active || first.age < 0.6) continue;
      for (
        let secondIndex = firstIndex + 1;
        secondIndex < projectiles.length;
        secondIndex += 1
      ) {
        const second = projectiles[secondIndex];
        if (!second.active || second.age < 0.6) continue;
        if (first.position.distanceToSquared(second.position) > 1.7) continue;

        const impactPoint = first.position.clone().add(second.position).multiplyScalar(0.5);
        first.active = false;
        second.active = false;
        if (first.mesh) first.mesh.visible = false;
        if (second.mesh) second.mesh.visible = false;
        spawnExplosion(impactPoint, 6.5, "#ffbd72");
        synth.current.explosion();
        setDialogue("torpedo-intercept", "NIX「魚雷同士の接触を確認。どちらも爆発した」");
        break;
      }
    }

    projectiles.forEach((projectile) => {
      if (!projectile.active || projectile.age < 0.25) return;

      const hitMine = mines.find(
        (mine) => mine.active && mine.position.distanceToSquared(projectile.position) < 4,
      );
      if (hitMine) {
        projectile.active = false;
        hitMine.active = false;
        if (projectile.mesh) projectile.mesh.visible = false;
        if (hitMine.mesh) hitMine.mesh.visible = false;
        spawnExplosion(projectile.position, 7, "#ffc070");
        synth.current.explosion();
        return;
      }

      const hitDecoy = decoys.find(
        (decoy) => decoy.active && decoy.position.distanceToSquared(projectile.position) < 6.25,
      );
      if (hitDecoy) {
        projectile.active = false;
        hitDecoy.active = false;
        if (projectile.mesh) projectile.mesh.visible = false;
        if (hitDecoy.mesh) hitDecoy.mesh.visible = false;
        spawnExplosion(projectile.position, 5, "#ffe094");
        synth.current.explosion();
      }
    });

    for (const light of effectLights.current) {
      if (light) light.intensity = 0;
    }
    explosions.forEach((effect) => {
      if (!effect.mesh) return;
      effect.ttl -= effect.active ? dt * 0.85 : 0;
      if (effect.ttl <= 0) effect.active = false;
      effect.mesh.visible = effect.active;
      if (!effect.active) return;
      effect.mesh.position.copy(effect.position);
      const progress = 1 - effect.ttl;
      effect.mesh.scale.setScalar(effect.size * (0.3 + progress));
      const material = (effect.mesh.children[0] as THREE.Mesh | undefined)?.material as THREE.MeshBasicMaterial;
      if (material) {
        material.color.set(effect.color);
        material.opacity = Math.max(0, effect.ttl * 0.62);
      }
      if (effect.position.distanceToSquared(playerPosition.current) < 120 * 120) {
        let slot: THREE.PointLight | null = null;
        for (const light of effectLights.current) {
          if (light && (!slot || light.intensity < slot.intensity)) slot = light;
        }
        const intensity = effect.ttl * 5;
        if (slot && intensity > slot.intensity) {
          slot.position.copy(effect.position);
          slot.color.set(effect.color);
          slot.intensity = intensity;
        }
      }
    });

    sonarPulse.age.value = sonarAge.current;
    if (sonarMesh.current) {
      const active = sonarAge.current < SONAR_TRAVEL_TIME;
      sonarMesh.current.visible = active;
      sonarMesh.current.position.copy(sonarPulse.origin.value);
      sonarMesh.current.scale.setScalar(Math.max(0.01, sonarAge.current * SONAR_SPEED));
      const material = sonarMesh.current.material as THREE.MeshBasicMaterial;
      material.opacity = active ? Math.max(0, 0.22 * (1 - sonarAge.current / SONAR_TRAVEL_TIME)) : 0;
    }

    if (discoveryMesh.current) {
      discoveryMesh.current.visible = !discovered.current;
      discoveryMesh.current.rotation.y += dt * 0.35;
    }

    const depth = Math.max(0, -playerPosition.current.y);
    if (scene.fog instanceof THREE.FogExp2) {
      scene.fog.density = 0.009 + depth * 0.000055;
      scene.fog.color.set(depth > 120 ? "#010b0f" : "#062830");
    }
    if (scene.background instanceof THREE.Color) {
      scene.background.set(depth > 120 ? "#01090c" : "#06242a");
    }

    if (completed.current) {
      completionTimer.current -= dt;
      if (completionTimer.current <= 0) {
        completed.current = false;
        const score = 8000 + kills.current * 750 + (discovered.current ? 3000 : 0) +
          Math.max(0, Math.floor(600 - elapsed.current) * 10);
        onComplete({
          score,
          enemiesDestroyed: kills.current + 1,
          elapsedSeconds: elapsed.current,
          vehicleDiscovered: discovered.current,
        });
      }
    }

    if (now - lastHudUpdate.current > 0.08) {
      lastHudUpdate.current = now;
      const currentBoss = enemies.find((enemy) => enemy.kind === "boss");
      const locked = enemies.find(
        (enemy) => enemy.id === lockId.current && enemy.alive && enemy.spawned,
      );
      if (!locked) lockId.current = null;
      const contacts = enemies
        .filter((enemy) => enemy.alive && enemy.spawned && enemy.detectedUntil > now)
        .map((enemy) => {
          const relative = enemy.position.clone().sub(playerPosition.current);
          return {
            id: enemy.id,
            x: clamp(50 + relative.x * 0.09, 5, 95),
            y: clamp(50 - relative.z * 0.07, 5, 95),
            boss: enemy.kind === "boss",
            locked: enemy.id === lockId.current,
          };
        });
      const objective = currentBoss?.alerted
        ? "円盤型巨大潜水艦を撃破せよ"
        : kills.current < 5
          ? "護衛艇を索敵・突破せよ"
          : "観測施設の深部へ向かえ";
      onHud({
        hp: Math.max(0, playerHp.current),
        maxHp,
        depth,
        speed: playerVelocity.current.length(),
        cooldown: weaponCooldown.current,
        sonarCooldown: sonarCooldown.current,
        sonarActive: sonarAge.current < SONAR_TRAVEL_TIME,
        weapon: weapon.current,
        lockedName: locked ? (locked.kind === "boss" ? "UNKNOWN DISC" : locked.kind.toUpperCase()) : null,
        lockedDistance: locked ? locked.position.distanceTo(playerPosition.current) : 0,
        kills: kills.current,
        objective,
        bossHp: currentBoss ? Math.max(0, currentBoss.hp) : 0,
        bossActive: Boolean(currentBoss?.alerted && currentBoss.alive),
        elapsed: elapsed.current,
        checkpoint: checkpoint.current,
        discovered: discovered.current,
        respawning: respawnTimer.current > 0,
        contacts,
        dialogue: dialogue.current,
      });
    }
  });

  return (
    <>
      <fogExp2 attach="fog" args={["#062830", 0.011]} />
      <color attach="background" args={["#06242a"]} />
      <ambientLight color="#6ca9a7" intensity={0.3} />
      <directionalLight position={[30, 80, 10]} color="#b7f4ee" intensity={1.25} />
      <IceEnvironment pulse={sonarPulse} />
      {Array.from({ length: EFFECT_LIGHT_COUNT }, (_, index) => (
        <pointLight
          key={index}
          ref={(light) => { effectLights.current[index] = light; }}
          intensity={0}
          distance={35}
        />
      ))}

      <group ref={playerMesh} position={playerPosition.current.toArray()}>
        <PlayerSubmarine variant={vehicle} />
      </group>

      {enemies.map((enemy) => (
        <group
          key={enemy.id}
          ref={(group) => { enemy.mesh = group; }}
          position={enemy.position.toArray()}
          visible={enemy.alive && enemy.spawned}
        >
          <EnemySubmarine kind={enemy.kind} pulse={sonarPulse} />
          <group name="contact-marker" position={[0, enemy.kind === "boss" ? 35 : 6, 0]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[enemy.kind === "boss" ? 8 : 2.8, 0.16, 8, 28]} />
              <meshBasicMaterial color={enemy.kind === "boss" ? "#ff5b4f" : "#ff8b75"} toneMapped={false} />
            </mesh>
          </group>
        </group>
      ))}

      {projectiles.map((projectile) => (
        <group
          key={projectile.id}
          ref={(group) => { projectile.mesh = group; }}
          visible={false}
        >
          <TorpedoModel friendly={projectile.friendly} />
        </group>
      ))}

      {mines.map((mine) => (
        <group key={mine.id} ref={(group) => { mine.mesh = group; }} visible={false}>
          <mesh>
            <icosahedronGeometry args={[1.2, 0]} />
            <meshStandardMaterial color="#69584c" metalness={0.7} />
          </mesh>
        </group>
      ))}

      {decoys.map((decoy) => (
        <group key={decoy.id} ref={(group) => { decoy.mesh = group; }} visible={false}>
          <mesh>
            <octahedronGeometry args={[0.8, 0]} />
            <meshBasicMaterial color="#ffdf7d" toneMapped={false} />
          </mesh>
        </group>
      ))}

      {explosions.map((effect) => (
        <group key={effect.id} ref={(group) => { effect.mesh = group; }} visible={false}>
          <mesh>
            <sphereGeometry args={[1, 16, 12]} />
            <meshBasicMaterial color={effect.color} transparent opacity={0.5} wireframe />
          </mesh>
        </group>
      ))}

      <mesh ref={sonarMesh} visible={false}>
        <sphereGeometry args={[1, 32, 16]} />
        <meshBasicMaterial
          color="#6affea"
          transparent
          opacity={0.2}
          wireframe
          depthWrite={false}
        />
      </mesh>

      <group ref={discoveryMesh} position={[72, -106, -432]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[5, 0.12, 8, 32]} />
          <meshBasicMaterial color="#ffd36a" toneMapped={false} />
        </mesh>
        <group scale={0.75} rotation={[0, 0.2, 0]}>
          <CorbackModel active={false} />
        </group>
      </group>
    </>
  );
});

function Hud({ hud }: { hud: HudState }) {
  const minutes = Math.floor(hud.elapsed / 60);
  const seconds = String(Math.floor(hud.elapsed % 60)).padStart(2, "0");
  const hpPercent = (hud.hp / hud.maxHp) * 100;
  return (
    <div className="game-hud" aria-live="polite">
      <div className="hud-top-left">
        <p className="hud-label">HULL INTEGRITY</p>
        <div className="hp-row">
          <div className="hp-track"><i style={{ width: hpPercent + "%" }} /></div>
          <strong>{Math.ceil(hpPercent)}%</strong>
        </div>
        <p className="objective"><span>OBJECTIVE</span>{hud.objective}</p>
      </div>

      <div className="hud-top-right">
        <span>ICE SECTOR 04</span>
        <strong>{minutes}:{seconds}</strong>
        <small>HOSTILES {hud.kills}/10</small>
      </div>

      <div className={"crosshair " + (hud.lockedName ? "locked" : "")}>
        <i /><i /><i /><i />
        {hud.lockedName && (
          <span>{hud.lockedName} {"//"} {Math.round(hud.lockedDistance)}m</span>
        )}
      </div>

      <div className={"sonar-panel " + (hud.sonarActive ? "pinging" : "")}>
        <div className="sonar-grid">
          <i className="sonar-sweep" />
          {hud.contacts.map((contact) => (
            <b
              key={contact.id}
              className={(contact.boss ? "boss " : "") + (contact.locked ? "target" : "")}
              style={{ left: contact.x + "%", top: contact.y + "%" }}
            />
          ))}
          <em className="sonar-self" />
        </div>
        <div className="sonar-copy">
          <span>SONAR</span>
          <strong>{hud.sonarCooldown > 0 ? hud.sonarCooldown.toFixed(1) : "READY"}</strong>
        </div>
      </div>

      <div className="telemetry">
        <div><span>DEPTH</span><strong>{Math.round(hud.depth)}<small>m</small></strong></div>
        <div><span>SPEED</span><strong>{hud.speed.toFixed(1)}<small>m/s</small></strong></div>
      </div>

      <div className="weapon-panel">
        <p><span>TORPEDO</span><strong>{hud.weapon === "guided" ? "GUIDED" : "MANUAL"}</strong></p>
        <div className="reload-track">
          <i style={{ width: (hud.cooldown <= 0 ? 100 : Math.max(0, 100 - hud.cooldown * 38)) + "%" }} />
        </div>
        <small>{hud.cooldown <= 0 ? "ARMED" : "RELOADING"} {"//"} TAB TO SWITCH</small>
      </div>

      {hud.bossActive && (
        <div className="boss-health">
          <span>BOUNTY TARGET // UNKNOWN DISC</span>
          <div><i style={{ width: (hud.bossHp / 600) * 100 + "%" }} /></div>
        </div>
      )}

      <div className="dialogue-box">
        <span>AI // NIX</span>
        <p>{hud.dialogue.replace(/^NIX「|」$/g, "")}</p>
      </div>

      <div className="hud-status">
        {hud.checkpoint && <span>◆ RECORD POINT</span>}
        {hud.discovered && <span>◆ CORBACK II FOUND</span>}
      </div>

      {hud.respawning && (
        <div className="death-overlay">
          <strong>CONNECTION LOST</strong>
          <span>記録点から機体を再構成中...</span>
        </div>
      )}
    </div>
  );
}

function SceneReady({ onReady }: { onReady: () => void }) {
  useEffect(onReady, [onReady]);
  return null;
}

// HUD snapshots must not rebuild Canvas options, the scene or pooled models.
const GameViewport = memo(function GameViewport(props: GameSceneProps) {
  const [ready, setReady] = useState(false);
  const markReady = useCallback(() => setReady(true), []);
  return (
    <>
      <Canvas
        camera={{ position: [0, -18, 58], fov: 61, near: 0.1, far: 1300 }}
        dpr={[0.75, 1]}
        frameloop={props.paused ? "demand" : "always"}
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <Suspense fallback={null}>
          <GameScene {...props} />
          <SceneReady onReady={markReady} />
        </Suspense>
      </Canvas>
      {!ready && (
        <div className="loading-screen game-model-loading" role="status">
          <div className="loading-sonar" />
          <p>潜航艇を準備中...</p>
        </div>
      )}
    </>
  );
});

export default function UnderwaterGame({
  vehicle,
  onExit,
  onComplete,
}: {
  vehicle: string;
  onExit: () => void;
  onComplete: (result: MissionResult) => void;
}) {
  const [hud, setHud] = useState<HudState>({ ...initialHud, maxHp: vehicle === "corback" ? 150 : 100 });
  const [paused, setPaused] = useState(false);
  const togglePause = useCallback(() => setPaused((value) => !value), []);

  return (
    <section className="game-screen">
      <GameViewport
        vehicle={vehicle}
        paused={paused}
        onPause={togglePause}
        onHud={setHud}
        onComplete={onComplete}
      />
      <Hud hud={hud} />
      <button className="pause-button" onClick={togglePause}>Ⅱ</button>
      <div className="game-tip">クリックで操艦 // Q ソナー // E ロック // 左クリック 発射</div>

      {paused && (
        <div className="pause-overlay">
          <div className="pause-panel">
            <p className="eyebrow">SYSTEM PAUSED</p>
            <h2>潜航停止</h2>
            <button className="primary-action" onClick={togglePause}>潜航を再開</button>
            <button onClick={onExit}>任務を放棄</button>
          </div>
        </div>
      )}
    </section>
  );
}
