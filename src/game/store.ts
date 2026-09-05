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
            ? Array.from(new Set([...state.unlockedVehicles, "manta-x1"]))
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
      version: 1,
      migrate: (persisted) => {
        const saved = persisted as Partial<GameStore> | undefined;
        return {
          bestScore: saved?.bestScore ?? 0,
          // Introduce the new player craft once, preserving scores and unlocks.
          selectedVehicle: "ryuou",
          unlockedVehicles: Array.from(new Set([
            "ryuou",
            ...(saved?.unlockedVehicles ?? []).filter((id) => id !== "zero-skiff"),
          ])),
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
