import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

test("legacy saves retain scores and transfer the second craft unlock to Corback", async () => {
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
    assert.deepEqual(useGameStore.getState().unlockedVehicles, ["ryuou", "corback"]);
    useGameStore.getState().selectVehicle("corback");
    assert.equal(JSON.parse(values.get("deep-zero-save-v1")).version, 3);
    const reloaded = (await import(url + "#reload")).useGameStore;
    assert.equal(reloaded.getState().selectedVehicle, "corback");
    assert.equal(reloaded.getState().bestScore, 18750);
    reloaded.getState().resetProgress();
    assert.equal(reloaded.getState().selectedVehicle, "ryuou");
    assert.deepEqual(reloaded.getState().unlockedVehicles, ["ryuou"]);

    // A v1 save already selecting Manta must continue in Corback after migration.
    values.set("deep-zero-save-v1", JSON.stringify({version:1,state:{
      selectedVehicle:"manta-x1",unlockedVehicles:["ryuou","manta-x1"],bestScore:42000,
    }}));
    const v1 = (await import(url + "#v1")).useGameStore;
    assert.equal(v1.getState().selectedVehicle,"corback");
    assert.deepEqual(v1.getState().unlockedVehicles,["ryuou","corback"]);
    assert.equal(v1.getState().bestScore,42000);

    // Merely upgrading the game must not unlock a craft the player never found.
    values.set("deep-zero-save-v1", JSON.stringify({version:1,state:{
      selectedVehicle:"ryuou",unlockedVehicles:["ryuou"],bestScore:900,
    }}));
    const locked = (await import(url + "#locked")).useGameStore;
    assert.deepEqual(locked.getState().unlockedVehicles,["ryuou"]);
    const result = {score:1000,enemiesDestroyed:10,elapsedSeconds:300,vehicleDiscovered:false};
    locked.getState().completeMission(result);
    assert.deepEqual(locked.getState().unlockedVehicles,["ryuou"]);
    locked.getState().completeMission({...result,vehicleDiscovered:true});
    locked.getState().completeMission({...result,vehicleDiscovered:true});
    assert.deepEqual(locked.getState().unlockedVehicles,["ryuou","corback"]);
    locked.getState().selectVehicle("corback");
    const unlockedReload = (await import(url + "#unlocked-reload")).useGameStore;
    assert.equal(unlockedReload.getState().selectedVehicle,"corback");
    assert.deepEqual(unlockedReload.getState().unlockedVehicles,["ryuou","corback"]);

    // Stage selection and completion survive reload without losing vehicle progress.
    unlockedReload.getState().selectStage(2);
    unlockedReload.getState().completeMission({...result,stageId:2});
    assert.equal(unlockedReload.getState().lastResult.stageId,2);
    assert.deepEqual(unlockedReload.getState().clearedStages,[1,2]);
    const stageReload = (await import(url + "#stage-reload")).useGameStore;
    assert.equal(stageReload.getState().selectedStage,2);
    assert.deepEqual(stageReload.getState().clearedStages,[1,2]);
    stageReload.getState().resetProgress();
    assert.equal(stageReload.getState().selectedStage,1);
    assert.deepEqual(stageReload.getState().clearedStages,[]);

    values.set("deep-zero-save-v1",JSON.stringify({version:2,state:{
      selectedVehicle:"corback",unlockedVehicles:["ryuou","corback"],bestScore:19000,
    }}));
    const v2=(await import(url + "#v2-stage-migration")).useGameStore;
    assert.equal(v2.getState().selectedStage,1);
    assert.deepEqual(v2.getState().clearedStages,[]);
    assert.equal(v2.getState().bestScore,19000);
    assert.equal(v2.getState().selectedVehicle,"corback");
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else delete globalThis.window;
  }
});
