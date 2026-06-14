import type { Density } from "@/lib/types";
import { useLocalStorage } from "./useLocalStorage";

export function useDensity(): [Density, (d: Density) => void] {
  return useLocalStorage<Density>("imm.density", "comfortable");
}
