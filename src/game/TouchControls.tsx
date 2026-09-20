"use client";

import { useEffect, useId, useRef, useState, type PointerEvent } from "react";

export function createTouchInput() {
  return {
    moveX: 0, moveY: 0, lookX: 0, lookY: 0, reverseLookY: false,
    keys: new Set<string>(), pressed: new Set<string>(),
    setMove(x: number, y: number) { this.moveX = x; this.moveY = -y; },
    setLook(x: number, y: number) { this.lookX = x; this.lookY = this.reverseLookY ? -y : y; },
    toggleReverse() {
      this.reverseLookY = !this.reverseLookY;
      this.lookY = -this.lookY;
      return this.reverseLookY;
    },
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

function ActionButton({ label, action, input, className }: {
  label: string; action: string; input: TouchInput; className?: string;
}) {
  return <button className={className} onPointerDown={(event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    // Each finger can activate an action while another finger holds a stick.
    // Do not depend on the compatibility click generated after a touch ends.
    event.preventDefault();
    input.pressed.add(action);
  }} onClick={(event) => {
    // Preserve keyboard/assistive activation without repeating pointer actions.
    if (event.detail === 0) input.pressed.add(action);
  }}>{label}</button>;
}

export default function TouchControls({ input }: { input: TouchInput }) {
  const [utilitiesOpen, setUtilitiesOpen] = useState(false);
  const [reversed, setReversed] = useState(input.reverseLookY);
  const utilitiesId = useId();
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
    <div className="touch-utility-drawer">
      <div id={utilitiesId} className="touch-utilities" hidden={!utilitiesOpen}>
        {[["Sonar", "ソナー"], ["CycleWeapon", "魚雷切替"], ["Mine", "機雷"], ["Decoy", "デコイ"]].map(([action, label]) =>
          <ActionButton key={action} action={action} label={label} input={input} />)}
      </div>
      <button className="touch-utility-toggle" aria-expanded={utilitiesOpen} aria-controls={utilitiesId}
        aria-label={utilitiesOpen ? "補助操作を隠す" : "補助操作を表示"}
        onPointerDown={(event) => {
          if (event.pointerType === "mouse" && event.button !== 0) return;
          event.preventDefault();
          setUtilitiesOpen((open) => !open);
        }} onClick={(event) => {
          if (event.detail === 0) setUtilitiesOpen((open) => !open);
        }}>
        {utilitiesOpen ? "閉じる ▾" : "補助操作 ▴"}
      </button>
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
        <ActionButton action="Lock" label="ロック" input={input} />
        <ActionButton action="Fire" label="発射" className="touch-fire" input={input} />
        <button className="touch-reverse" aria-label="旋回パッドの上下を反転" aria-pressed={reversed}
          onPointerDown={(event) => {
            if (event.pointerType === "mouse" && event.button !== 0) return;
            event.preventDefault();
            setReversed(input.toggleReverse());
          }} onClick={(event) => {
            if (event.detail === 0) setReversed(input.toggleReverse());
          }}>
          <span>REVERSE</span><small>{reversed ? "ON" : "OFF"}</small>
        </button>
      </div>
      <Stick label="旋回" onMove={(x, y) => input.setLook(x, y)} />
    </div>
  </div>;
}
