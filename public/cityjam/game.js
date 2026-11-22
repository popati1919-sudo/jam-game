(() => {
  "use strict";

  function start() {
    const { levels, endlessLevel, coverage, watered, isSolved } = window.RoofPuzzle;
    const city = window.CityView;
    const byId = id => document.getElementById(id);
    const board = byId("board");
    const map = byId("map-dialog");
    const result = byId("result-dialog");
    const help = byId("help-dialog");
    const key = "toits-en-fleurs.progress.v1";
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const fresh = () => ({ mode: "campaign", current: 0, sound: false, moves: levels.map(() => []), completed: levels.map(() => false), endless: null });

    function restoreMoves(level, data) {
      if (!Array.isArray(data)) return [];
      const legal = level.plots.map(plot => plot.id).filter(id => !level.blocked?.includes(id));
      return [...new Set(data.filter(id => legal.includes(id)))].slice(0, level.budget);
    }

    function restore() {
      const saved = fresh();
      try {
        const data = JSON.parse(localStorage.getItem(key));
        if (!data || typeof data !== "object") return saved;
        if (Number.isInteger(data.current) && levels[data.current]) saved.current = data.current;
        saved.sound = data.sound === true;
        levels.forEach((level, i) => {
          saved.moves[i] = restoreMoves(level, data.moves?.[i]);
          saved.completed[i] = data.completed?.[i] === true || isSolved(level, saved.moves[i]);
        });
        const endless = data.endless;
        if (endless && Number.isInteger(endless.seed) && endless.seed >= 0 && endless.seed <= 0xffffffff
            && Number.isSafeInteger(endless.round) && endless.round >= 1) {
          const level = endlessLevel(endless.round, endless.seed);
          saved.endless = { seed: endless.seed, round: endless.round, moves: restoreMoves(level, endless.moves) };
          if (data.mode === "endless") saved.mode = "endless";
        }
      } catch {
        // A new game also works when browser storage is unavailable.
      }
      return saved;
    }

    const progress = restore();
    const inEndless = () => progress.mode === "endless";
    const moves = () => inEndless() ? progress.endless.moves : progress.moves[progress.current];
    let garden = progress.endless && endlessLevel(progress.endless.round, progress.endless.seed);
    const currentLevel = () => inEndless() ? garden : levels[progress.current];
    const isBlocked = id => currentLevel().blocked?.includes(id) === true;
    let selected = null;
    let hovered = null;
    let resultTimer = 0;
    let frame = { used: [], watered: [], preview: [], hover: null, complete: false };
    let audio = null;

    function save() {
      try { localStorage.setItem(key, JSON.stringify(progress)); } catch { /* Temporary session. */ }
    }

    function chime(notes) {
      if (!progress.sound) return;
      try {
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (!Audio) return;
        audio ||= new Audio();
        if (audio.state === "suspended") audio.resume().catch(() => {});
        notes.forEach((hz, index) => {
          const startTime = audio.currentTime + 0.045 + index * 0.115;
          const tone = audio.createOscillator();
          const volume = audio.createGain();
          tone.type = "sine";
          tone.frequency.value = hz;
          volume.gain.setValueAtTime(0.0001, startTime);
          volume.gain.exponentialRampToValueAtTime(0.09, startTime + 0.015);
          volume.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.36);
          tone.connect(volume);
          volume.connect(audio.destination);
          tone.start(startTime);
          tone.stop(startTime + 0.37);
        });
      } catch { /* Audio support is optional, including in embedded players. */ }
    }

    function ended() {
      return frame.complete || moves().length >= currentLevel().budget;
    }

    function draw(time = performance.now()) {
      city.render(board, currentLevel(), frame, reducedMotion.matches ? 0 : time);
    }

    function note(text) {
      const element = byId("board-note");
      if (element.textContent !== text) element.textContent = text;
    }

    function highlight() {
      const id = ended() ? null : hovered || selected;
      frame.hover = id;
      frame.preview = id && !isBlocked(id) ? coverage(currentLevel(), id) : [];
      const canPlace = !!selected && !ended() && !moves().includes(selected) && !isBlocked(selected);
      byId("plant").disabled = !canPlace;
      if (frame.complete) {
        note("Every roof in this neighborhood is in bloom!");
      } else if (ended()) {
        note("Out of sprinklers. Undo your last move to try again.");
      } else if (id && isBlocked(id)) {
        note("Roof " + id + " is locked. Water it from an adjacent roof.");
      } else if (id && moves().includes(id)) {
        note("Roof " + id + " already has a sprinkler.");
      } else if (id) {
        const count = frame.preview.filter(roof => !frame.watered.includes(roof)).length;
        const preview = count
          ? "Waters " + count + (count === 1 ? " new planter." : " new planters.")
          : "Every planter in reach is already in bloom.";
        note("Roof " + id + " · " + preview);
      } else {
        note("Select a roof on the map.");
      }
      draw();
    }

    function update() {
      const level = currentLevel();
      frame = {
        used: moves(), watered: watered(level, moves()), preview: [], hover: null, complete: isSolved(level, moves()),
      };
      byId("mode-label").textContent = inEndless() ? "Endless garden" : "Neighborhood";
      byId("level-num").textContent = String(inEndless() ? progress.endless.round : progress.current + 1).padStart(2, "0");
      byId("level-total").textContent = inEndless() ? "" : "/ " + String(levels.length).padStart(2, "0");
      byId("endless-mode").setAttribute("aria-pressed", String(inEndless()));
      byId("endless-mode").title = inEndless() ? "Return to the campaign" : "Play Endless Mode";
      byId("level-title").textContent = level.name;
      byId("district-name").textContent = level.district;
      byId("locked-tip").hidden = !level.blocked?.length;
      byId("water-count").textContent = String(frame.watered.length);
      byId("water-total").textContent = String(level.plots.length);
      byId("growth-bar").style.width = (100 * frame.watered.length / level.plots.length) + "%";
      byId("reserve").textContent = String(level.budget - moves().length);
      byId("reserve-total").textContent = String(level.budget);
      byId("undo").disabled = moves().length === 0;
      byId("sound").setAttribute("aria-pressed", String(progress.sound));
      byId("sound-label").textContent = progress.sound ? "Sound on" : "Sound off";
      const descriptions = level.plots.map(plot => {
        const neighbors = coverage(level, plot.id).filter(id => id !== plot.id);
        const status = moves().includes(plot.id) ? "sprinkler installed" : frame.watered.includes(plot.id) ? "in bloom" : "needs water";
        const adjacent = neighbors.length === 1 ? "Next to roof " : "Next to roofs ";
        const locked = isBlocked(plot.id) ? " Locked: water it from an adjacent roof." : "";
        return "Roof " + plot.id + ", " + status + "." + locked + " " + adjacent + neighbors.join(", ") + ".";
      }).join(" ");
      byId("board-a11y").textContent = "Use a roof letter or the arrow keys to select a roof. Press Enter to place a sprinkler. " + descriptions;
      highlight();
    }

    function menu() {
      const list = byId("level-options");
      list.replaceChildren();
      levels.forEach((level, i) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "level-option";
        button.setAttribute("aria-current", String(!inEndless() && progress.current === i));
        button.dataset.complete = String(progress.completed[i]);
        const status = progress.completed[i] ? "In bloom" : progress.moves[i].length ? "In progress" : "Unplayed";
        const parts = { num: String(i + 1).padStart(2, "0"), name: level.name, status };
        for (const [suffix, text] of Object.entries(parts)) {
          const span = document.createElement("span");
          span.className = "level-option-" + suffix;
          span.textContent = text;
          button.append(span);
        }
        button.addEventListener("click", () => {
          map.close();
          switchTo(i);
        });
        list.append(button);
      });
      byId("endless-option").textContent = !progress.endless ? "Start Endless Mode"
        : isSolved(garden, progress.endless.moves) ? "Play endless garden " + (progress.endless.round + 1)
        : "Resume endless garden " + progress.endless.round;
      map.showModal();
    }

    function enterBoard(showOutcome = true) {
      clearTimeout(resultTimer);
      hovered = selected = null;
      save();
      update();
      board.focus({ preventScroll: true });
      if (showOutcome && ended()) showResult();
    }

    function switchTo(index) {
      progress.mode = "campaign";
      progress.current = index;
      enterBoard();
    }

    function enterEndless() {
      if (!progress.endless) {
        const seed = window.crypto?.getRandomValues(new Uint32Array(1))[0] ?? Math.floor(Math.random() * 0x100000000);
        progress.endless = { seed, round: 1, moves: [] };
      } else if (isSolved(garden, progress.endless.moves)) {
        progress.endless.round++;
        progress.endless.moves = [];
      }
      garden = endlessLevel(progress.endless.round, progress.endless.seed);
      progress.mode = "endless";
      enterBoard();
    }

    function nextCampaignLevel() {
      for (let offset = 1; offset <= levels.length; offset++) {
        const i = (progress.current + offset) % levels.length;
        if (!progress.completed[i]) return i;
      }
      return -1;
    }

    function returnToCampaign() {
      const previous = progress.current;
      if (!isSolved(levels[previous], progress.moves[previous])) return switchTo(previous);
      const next = nextCampaignLevel();
      if (next >= 0) return switchTo(next);
      progress.mode = "campaign";
      enterBoard(false);
      menu();
    }

    function showResult() {
      if (!ended() || document.querySelector("dialog[open]")) return;
      const count = progress.completed.filter(Boolean).length;
      const campaign = count === levels.length;
      if (frame.complete && inEndless()) {
        byId("result-title").textContent = currentLevel().name + " is in bloom!";
        byId("result-text").textContent = "Every roof in garden " + progress.endless.round + " is watered. A new garden is ready.";
        byId("result-action").textContent = "Next garden";
      } else if (frame.complete) {
        byId("result-title").textContent = campaign ? "The city is in bloom!" : currentLevel().name + " is in bloom!";
        byId("result-text").textContent = campaign
          ? "From Lilac Square to Iris Hill, all five neighborhoods are in bloom. Keep growing in Endless Mode."
          : "Every planter is watered. You've brought " + count + " of " + levels.length + " neighborhoods into bloom.";
        byId("result-action").textContent = campaign ? "Play Endless Mode" : "Next neighborhood";
      } else {
        const left = currentLevel().plots.length - frame.watered.length;
        byId("result-title").textContent = "Out of sprinklers";
        byId("result-text").textContent = left === 1 ? "One planter still needs water. Try another roof." : left + " planters still need water. Try another layout.";
        byId("result-action").textContent = "Undo last move";
      }
      result.dataset.outcome = frame.complete ? "win" : "retry";
      result.showModal();
    }

    function place() {
      if (!selected || ended() || moves().includes(selected) || isBlocked(selected)) return;
      moves().push(selected);
      hovered = selected = null;
      update();
      if (frame.complete && !inEndless()) progress.completed[progress.current] = true;
      save();
      chime(frame.complete ? [392, 494, 587, 784] : [523.25, 659.25]);
      if (ended()) {
        resultTimer = setTimeout(showResult, reducedMotion.matches ? 0 : 460);
      }
    }

    function undo() {
      if (!moves().length) return;
      clearTimeout(resultTimer);
      moves().pop();
      hovered = selected = null;
      save();
      update();
    }

    function replay() {
      clearTimeout(resultTimer);
      moves().length = 0;
      hovered = selected = null;
      save();
      update();
      board.focus({ preventScroll: true });
    }

    board.addEventListener("pointermove", event => {
      if (event.pointerType === "touch" || ended()) return;
      const id = city.hitTest(board, event.clientX, event.clientY, currentLevel());
      if (id === hovered) return;
      hovered = id;
      highlight();
    });
    board.addEventListener("pointerleave", () => {
      if (!hovered) return;
      hovered = null;
      highlight();
    });
    board.addEventListener("click", event => {
      if (ended()) return;
      const id = city.hitTest(board, event.clientX, event.clientY, currentLevel());
      board.focus({ preventScroll: true });
      hovered = null;
      if (id && id === selected) return place();
      selected = id;
      highlight();
    });

    document.addEventListener("keydown", event => {
      if (event.metaKey || event.ctrlKey || event.altKey || document.querySelector("dialog[open]")) return;
      if (event.target.closest?.("input, textarea, select, [contenteditable=true]")) return;
      if (event.key === "Escape") {
        hovered = selected = null;
        highlight();
        return;
      }
      if (ended()) return;
      const ids = currentLevel().plots.map(plot => plot.id);
      const letter = event.key.toUpperCase();
      const directions = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
      if (ids.includes(letter)) {
        selected = letter;
      } else if (Object.hasOwn(directions, event.key)) {
        const step = directions[event.key];
        const previous = ids.indexOf(selected);
        const index = previous < 0 ? (step > 0 ? 0 : ids.length - 1) : (previous + step + ids.length) % ids.length;
        selected = ids[index];
      } else if (event.key === "Enter" && !event.target.closest?.("button, a")) {
        event.preventDefault();
        if (!event.repeat) place();
        return;
      } else return;
      event.preventDefault();
      hovered = null;
      board.focus({ preventScroll: true });
      highlight();
    });

    byId("plant").addEventListener("click", place);
    byId("undo").addEventListener("click", undo);
    byId("restart").addEventListener("click", replay);
    byId("help").addEventListener("click", () => help.showModal());
    byId("level-menu").addEventListener("click", menu);
    byId("endless-mode").addEventListener("click", () => inEndless() ? returnToCampaign() : enterEndless());
    byId("endless-option").addEventListener("click", () => { map.close(); enterEndless(); });
    byId("sound").addEventListener("click", () => {
      progress.sound = !progress.sound;
      save();
      update();
      chime([523.25]);
    });
    byId("result-replay").addEventListener("click", () => { result.close(); replay(); });
    byId("result-action").addEventListener("click", () => {
      result.close();
      if (!frame.complete) {
        undo();
        board.focus({ preventScroll: true });
        return;
      }
      if (inEndless()) return enterEndless();
      const next = nextCampaignLevel();
      if (next >= 0) switchTo(next);
      else enterEndless();
    });
    document.querySelectorAll("[data-close]").forEach(button => {
      button.addEventListener("click", () => {
        const dialog = button.closest("dialog");
        if (dialog?.open) dialog.close();
      });
    });
    for (const dialog of [map, help, result, byId("credits-dialog")]) {
      dialog.addEventListener("click", event => {
        if (event.target !== dialog) return;
        const b = dialog.getBoundingClientRect();
        if (event.clientX < b.left || event.clientX > b.right || event.clientY < b.top || event.clientY > b.bottom) dialog.close();
      });
    }

    // Inactive tabs and motion-sensitive players only need renders on state changes.
    let animation = 0;
    let lastDraw = -Infinity;
    function tick(time) {
      if (time - lastDraw >= 100) {
        draw(time);
        lastDraw = time;
      }
      animation = requestAnimationFrame(tick);
    }
    function setAnimation() {
      cancelAnimationFrame(animation);
      if (!document.hidden && !reducedMotion.matches) animation = requestAnimationFrame(tick);
      else if (!document.hidden) draw(0);
    }
    document.addEventListener("visibilitychange", setAnimation);
    reducedMotion.addEventListener("change", setAnimation);
    update();
    setAnimation();
    if (ended()) showResult();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
