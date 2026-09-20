"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";

export function createTouchInput() {
  return {
    moveX: 0, moveY: 0, lookX: 0, lookY: 0, keys: new Set<string>(), pressed: new Set<string>(),
    setMove(x: number, y: number) { this.moveX = x; this.moveY = -y; },
    setLook(x: number, y: number) { this.lookX = x; this.lookY = y; },
  };
}
export type TouchInput = ReturnType<typeof createTouchInput>;
export function resetTouchInput(input: TouchInput) {
  input.moveX = input.moveY = input.lookX = input.lookY = 0;
  input.keys.clear();
  input.pressed.clear();
}

function Stick({ label, onMove }: { label: string; onMove: (x: number, y: number) => void }) {
  const pointer = useRef<number | null>(null);
  const [position, setPosition] = useState([0, 0]);
  function move(event: PointerEvent<HTMLDivElement>) {
    if (pointer.current !== event.pointerId) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left - bounds.width / 2) / (bounds.width / 2);
    const y = (event.clientY - bounds.top - bounds.height / 2) / (bounds.height / 2);
    const length = Math.max(1, Math.hypot(x, y));
    const nx = x / length, ny = y / length;
    setPosition([nx * 30, ny * 30]);
    onMove(Math.abs(nx) < 0.12 ? 0 : nx, Math.abs(ny) < 0.12 ? 0 : ny);
  }
  function release(event: PointerEvent<HTMLDivElement>) {
    if (pointer.current !== event.pointerId) return;
    pointer.current = null;
    setPosition([0, 0]);
    onMove(0, 0);
  }
  return <div className="touch-stick" aria-label={label}
    onPointerDown={(event) => {
      if (pointer.current !== null) return;
      pointer.current = event.pointerId;
      event.currentTarget.setPointerCapture(event.pointerId);
      move(event);
    }} onPointerMove={move} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}>
    <span>{label}</span><i style={{ transform: `translate(${position[0]}px, ${position[1]}px)` }} />
  </div>;
}

function HoldButton({ label, code, input }: { label: string; code: string; input: TouchInput }) {
  const pointer = useRef<number | null>(null);
  const release = (event: PointerEvent<HTMLButtonElement>) => {
    if (pointer.current !== event.pointerId) return;
    pointer.current = null;
    input.keys.delete(code);
  };
  return <button onPointerDown={(event) => {
    if (pointer.current !== null) return;
    pointer.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    input.keys.add(code);
  }} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}>{label}</button>;
}

export default function TouchControls({ input }: { input: TouchInput }) {
  useEffect(() => {
    const reset = () => resetTouchInput(input);
    window.addEventListener("blur", reset);
    window.addEventListener("orientationchange", reset);
    return () => {
      window.removeEventListener("blur", reset);
      window.removeEventListener("orientationchange", reset);
      reset();
    };
  }, [input]);
  return <div className="touch-controls" aria-label="タッチ操艦">
    <div className="touch-utilities">
      {[["Sonar", "ソナー"], ["CycleWeapon", "魚雷切替"], ["Mine", "機雷"], ["Decoy", "デコイ"]].map(([action, label]) =>
        <button key={action} onClick={() => input.pressed.add(action)}>{label}</button>)}
    </div>
    <div className="touch-movement">
      <div className="touch-holds">
        <HoldButton label="上昇" code="Space" input={input} />
        <HoldButton label="下降" code="ControlLeft" input={input} />
        <HoldButton label="加速" code="ShiftLeft" input={input} />
      </div>
      <Stick label="移動" onMove={(x, y) => input.setMove(x, y)} />
    </div>
    <div className="touch-aim">
      <div className="touch-combat">
        <button onClick={() => input.pressed.add("Lock")}>ロック</button>
        <button className="touch-fire" onClick={() => input.pressed.add("Fire")}>発射</button>
      </div>
      <Stick label="旋回" onMove={(x, y) => input.setLook(x, y)} />
    </div>
  </div>;
}
