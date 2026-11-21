(() => {
  "use strict";

  // Each row runs west to east. A dot marks a gap between buildings.
  function makeLevel(name, district, budget, rows) {
    const plots = [];
    rows.forEach((row, y) => {
      Array.from(row).forEach((id, x) => {
        if (id !== ".") plots.push({ id, x, y });
      });
    });
    return { name, district, budget, plots };
  }

  const levels = [
    makeLevel("Le square des Lilas", "Les Faubourgs", 3, [
      "A.B",
      "CDE",
      ".F.",
    ]),
    makeLevel("Passage du Canal", "Les Écluses", 3, [
      "ABC",
      "D..",
      "EFG",
    ]),
    makeLevel("La cour des Merles", "La Vieille-Ville", 3, [
      "ABC",
      "D.E",
      "FGH",
    ]),
    makeLevel("Les Halles", "Le Marché central", 3, [
      "ABC",
      "DEF",
      "GHI",
    ]),
    makeLevel("La butte aux Iris", "Les Hauts-Jardins", 2, [
      "ABC",
      "DE.",
      "FG.",
    ]),
  ];

  function coverage(level, id) {
    const origin = level.plots.find(plot => plot.id === id);
    if (!origin) return [];
    return level.plots
      .filter(plot => Math.abs(plot.x - origin.x) + Math.abs(plot.y - origin.y) <= 1)
      .map(plot => plot.id);
  }

  function watered(level, used) {
    const wet = new Set();
    for (const id of used) {
      for (const neighbor of coverage(level, id)) wet.add(neighbor);
    }
    return level.plots.filter(plot => wet.has(plot.id)).map(plot => plot.id);
  }

  function isSolved(level, used) {
    const equipped = new Set(used);
    return equipped.size <= level.budget && watered(level, equipped).length === level.plots.length;
  }

  window.RoofPuzzle = { levels, coverage, watered, isSolved };
})();
