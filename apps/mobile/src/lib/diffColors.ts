import type { DiffColorScheme } from "@t3tools/contracts/settings";

export function getDiffColors(scheme: DiffColorScheme, appearance: "light" | "dark") {
  const dark = appearance === "dark";
  return scheme === "blue-orange"
    ? {
        addText: dark ? "#60a5fa" : "#2563eb",
        deleteText: dark ? "#fb923c" : "#c2410c",
        addBar: "#60a5fa",
        deleteBar: "#fb923c",
        addBackground: dark ? "#142a45" : "#e7f0ff",
        deleteBackground: dark ? "#3e2718" : "#fff0e3",
      }
    : {
        addText: dark ? "#5ECC71" : "#199F43",
        deleteText: dark ? "#FF6762" : "#D52C36",
        addBar: "#00cab1",
        deleteBar: "#ff2e3f",
        addBackground: dark ? "#0d2f28" : "#e5f8f5",
        deleteBackground: dark ? "#391415" : "#ffe6e7",
      };
}
