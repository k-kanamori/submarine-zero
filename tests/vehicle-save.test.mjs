import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

test("Ryuou migration preserves the player's score and Manta unlock, then respects future selections", async () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const values = new Map([
    ["deep-zero-save-v1", JSON.stringify({
      version: 0,
      state: { selectedVehicle: "zero-skiff", unlockedVehicles: ["zero-skiff", "manta-x1"], bestScore: 18750 },
    })],
  ]);
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  } } });
  try {
    const source = readFileSync(new URL("../src/game/store.ts", import.meta.url), "utf8");
    let { outputText } = ts.transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ES2020 },
    });
    for (const dependency of ["zustand", "zustand/middleware"]) {
      outputText = outputText.replace(`from "${dependency}"`, `from ${JSON.stringify(import.meta.resolve(dependency))}`);
    }
    const url = `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`;
    const { useGameStore } = await import(url + "#migration");
    assert.equal(useGameStore.getState().selectedVehicle, "ryuou");
    assert.equal(useGameStore.getState().bestScore, 18750);
    assert.deepEqual(useGameStore.getState().unlockedVehicles, ["ryuou", "manta-x1"]);
    useGameStore.getState().selectVehicle("manta-x1");
    assert.equal(JSON.parse(values.get("deep-zero-save-v1")).version, 1);
    const reloaded = (await import(url + "#reload")).useGameStore;
    assert.equal(reloaded.getState().selectedVehicle, "manta-x1");
    assert.equal(reloaded.getState().bestScore, 18750);
    reloaded.getState().resetProgress();
    assert.equal(reloaded.getState().selectedVehicle, "ryuou");
    assert.deepEqual(reloaded.getState().unlockedVehicles, ["ryuou"]);
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else delete globalThis.window;
  }
});
