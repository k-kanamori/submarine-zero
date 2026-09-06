"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Screen = "title" | "briefing" | "playing" | "result";

export type MissionResult = {
  score: number;
  enemiesDestroyed: number;
  elapsedSeconds: number;
  vehicleDiscovered: boolean;
};

type GameStore = {
  screen: Screen;
  selectedVehicle: string;
  unlockedVehicles: string[];
  bestScore: number;
  lastResult: MissionResult | null;
  showControls: boolean;
  setScreen: (screen: Screen) => void;
  setShowControls: (show: boolean) => void;
  selectVehicle: (vehicle: string) => void;
  completeMission: (result: MissionResult) => void;
  resetProgress: () => void;
};

export const useGameStore = create<GameStore>()(
  persist(
    (set) => ({
      screen: "title",
      selectedVehicle: "ryuou",
      unlockedVehicles: ["ryuou"],
      bestScore: 0,
      lastResult: null,
      showControls: false,
      setScreen: (screen) => set({ screen }),
      setShowControls: (showControls) => set({ showControls }),
      selectVehicle: (selectedVehicle) => set({ selectedVehicle }),
      completeMission: (result) =>
        set((state) => ({
          screen: "result",
          lastResult: result,
          bestScore: Math.max(state.bestScore, result.score),
          unlockedVehicles: result.vehicleDiscovered
            ? Array.from(new Set([...state.unlockedVehicles, "corback"]))
            : state.unlockedVehicles,
        })),
      resetProgress: () =>
        set({
          selectedVehicle: "ryuou",
          unlockedVehicles: ["ryuou"],
          bestScore: 0,
          lastResult: null,
        }),
    }),
    {
      name: "deep-zero-save-v1",
      version: 2,
      migrate: (persisted) => {
        const saved = persisted as Partial<GameStore> | undefined;
        const unlockedVehicles = Array.from(new Set([
          "ryuou",
          ...(saved?.unlockedVehicles ?? [])
            .map((id) => id === "manta-x1" ? "corback" : id)
            .filter((id) => id === "ryuou" || id === "corback"),
        ]));
        const selected = saved?.selectedVehicle === "manta-x1" ? "corback" : saved?.selectedVehicle;
        return {
          bestScore: saved?.bestScore ?? 0,
          // Preserve the second craft's unlock and current selection in old saves.
          selectedVehicle: selected && unlockedVehicles.includes(selected) ? selected : "ryuou",
          unlockedVehicles,
        };
      },
      partialize: (state) => ({
        selectedVehicle: state.selectedVehicle,
        unlockedVehicles: state.unlockedVehicles,
        bestScore: state.bestScore,
      }),
    },
  ),
);
