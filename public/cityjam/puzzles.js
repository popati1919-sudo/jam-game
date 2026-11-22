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
    makeLevel("Lilac Square", "West End", 3, [
      "A.B",
      "CDE",
      ".F.",
    ]),
    makeLevel("Canal Walk", "The Locks", 3, [
      "ABC",
      "D..",
      "EFG",
    ]),
    makeLevel("Blackbird Court", "Old Town", 3, [
      "ABC",
      "D.E",
      "FGH",
    ]),
    makeLevel("Market Hall", "Market District", 3, [
      "ABC",
      "DEF",
      "GHI",
    ]),
    makeLevel("Iris Hill", "Upper Gardens", 2, [
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
      if (level.blocked?.includes(id)) continue;
      for (const neighbor of coverage(level, id)) wet.add(neighbor);
    }
    return level.plots.filter(plot => wet.has(plot.id)).map(plot => plot.id);
  }

  function isSolved(level, used) {
    const equipped = new Set(used);
    if (level.blocked?.some(id => equipped.has(id))) return false;
    return equipped.size <= level.budget && watered(level, equipped).length === level.plots.length;
  }

  // A footprint uses one bit per grid square, ordered left to right and top to bottom.
  const grid = Array.from({ length: 9 }, (_, id) => ({ id, x: id % 3, y: Math.floor(id / 3) }));
  let catalog;
  let deckSeed;
  let deck;

  function buildCatalog() {
    const layouts = [];
    const limit = 1 << grid.length;
    const sizes = new Uint8Array(limit);
    const reaches = new Uint16Array(limit);
    const neighborhoods = grid.map(cell =>
      coverage({ plots: grid }, cell.id).reduce((mask, id) => mask | (1 << id), 0)
    );
    for (let mask = 1; mask < limit; mask++) {
      const first = mask & -mask;
      const rest = mask ^ first;
      sizes[mask] = sizes[rest] + 1;
      reaches[mask] = reaches[rest] | neighborhoods[31 - Math.clz32(first)];
    }

    function connected(footprint) {
      let visited = footprint & -footprint;
      let expanded = reaches[visited] & footprint;
      while (expanded !== visited) {
        visited = expanded;
        expanded = reaches[visited] & footprint;
      }
      return visited === footprint;
    }

    function minimumBudget(footprint, blocked) {
      const allowed = footprint ^ blocked;
      let smallestWin = grid.length + 1;
      let largestLoss = 0;
      // Enumerate every nonempty subset of the allowed sprinkler positions.
      for (let chosen = allowed; chosen; chosen = (chosen - 1) & allowed) {
        if ((reaches[chosen] & footprint) === footprint) {
          smallestWin = Math.min(smallestWin, sizes[chosen]);
        } else {
          largestLoss = Math.max(largestLoss, sizes[chosen]);
        }
      }
      // Any subset of a losing placement also loses. This guarantees a real choice at full budget.
      return smallestWin >= 2 && largestLoss >= smallestWin ? smallestWin : 0;
    }

    for (let footprint = 1; footprint < limit; footprint++) {
      if (sizes[footprint] < 6 || !connected(footprint)) continue;
      const variants = [[], [], []];
      for (let blocked = 0; blocked < limit; blocked++) {
        if (sizes[blocked] > 2 || (blocked & footprint) !== blocked) continue;
        const budget = minimumBudget(footprint, blocked);
        if (budget) variants[sizes[blocked]].push({ blocked, budget });
      }
      if (variants.every(options => options.length)) layouts.push({ footprint, variants });
    }
    return layouts;
  }

  // This 32-bit integer mixer also works for a seed of zero.
  function mix(value) {
    let n = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
    n = Math.imul(n ^ (n >>> 15), 0x735a2d97);
    return (n ^ (n >>> 15)) >>> 0;
  }

  function deckFor(seed) {
    if (deckSeed === seed) return deck;
    catalog ||= buildCatalog();
    deck = catalog.slice();
    let state = seed;
    for (let i = deck.length - 1; i > 0; i--) {
      state = (state + 0x9e3779b9) >>> 0;
      const j = mix(state) % (i + 1);
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    deckSeed = seed;
    return deck;
  }

  const nameStarts = ["Alder", "Birch", "Cedar", "Clover", "Finch", "Heron", "Juniper", "Lark",
    "Laurel", "Maple", "Marigold", "Poppy", "Rowan", "Sparrow", "Willow", "Wren"];
  const nameEnds = ["Arcade", "Bridge", "Close", "Court", "Crescent", "Gardens", "Grove", "Hill",
    "Lane", "Mews", "Park", "Place", "Row", "Square", "Terrace", "Walk"];
  const districts = ["Brookside", "The Docks", "East Bank", "Glassworks", "Old Station", "South End", "Upper Mill", "Westgate"];

  function endlessLevel(round, seed) {
    if (!Number.isSafeInteger(round) || round < 1) throw new RangeError("Round must be a positive safe integer.");
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RangeError("Seed must be an unsigned 32-bit integer.");
    const layouts = deckFor(seed);
    const index = round - 1;
    const cycle = Math.floor(index / layouts.length);
    const { footprint, variants } = layouts[index % layouts.length];
    const lockedCount = round < 7 ? 0 : round < 15 ? 1 : 2;
    const choices = variants[lockedCount];
    const offset = mix(seed ^ footprint) % choices.length;
    const chosen = choices[(offset + cycle % choices.length) % choices.length];
    const occupied = grid.filter(cell => footprint & (1 << cell.id));
    const plots = occupied.map((cell, i) => ({ id: String.fromCharCode(65 + i), x: cell.x, y: cell.y }));
    const blocked = plots.filter((_, i) => chosen.blocked & (1 << occupied[i].id)).map(plot => plot.id);
    // An odd stride visits every name pair before repeating.
    const nameIndex = ((index % 256) * 73 + mix(seed)) % 256;
    const name = nameStarts[nameIndex % 16] + " " + nameEnds[Math.floor(nameIndex / 16)];
    const district = districts[mix(seed ^ footprint ^ (cycle >>> 0)) % districts.length];
    return { name, district, budget: chosen.budget, plots, blocked, round, seed };
  }

  window.RoofPuzzle = { levels, coverage, watered, isSolved, endlessLevel };
})();
