class StatusPanel {
  constructor(pkg, statusBar = null) {
    this.pkg = pkg;
    this.statusBar = statusBar;
    this.statusTile = null;
    this.editor = null;
    this.statusMode = true;
    this.counters = [];
    this.destroyed = false;

    this.element = document.createElement("status-bar-tile");
    this.element.classList.add("linter-status");

    this.element.onmouseup = (e) => this.onmouseup(e);
    this.element.oncontextmenu = (e) => e.preventDefault();

    this.configDisposable = lumine.config.observe("linter-panel.statusMode", (value) => {
      this.statusMode = value;
      this.update();
    });

    this.tooltipDisposable = lumine.tooltips.addComposite(this.element, [
      {
        title: "Toggle panel",
        keyBindingExtra: "LMB",
        keyBindingCommand: "linter-panel:toggle",
      },
      {
        title: "Toggle file/project view",
        keyBindingExtra: "MMB",
      },
      {
        title: "Clear all messages",
        keyBindingExtra: "cmdorctrl+MMB",
        keyBindingCommand: "linter:clear",
      },
      {
        title: "Go to next message",
        keyBindingExtra: "RMB",
        keyBindingCommand: "linter:next",
      },
      {
        title: "Go to previous message",
        keyBindingExtra: "cmdorctrl+RMB",
        keyBindingCommand: "linter:previous",
      },
    ]);

    this.addToStatusBar();
    this.update();
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.removeFromStatusBar();
    this.configDisposable.dispose();
    this.tooltipDisposable.dispose();
    this.element.remove();
  }

  setEditor(editor) {
    if (this.destroyed) return;
    this.editor = editor;
    this.update();
  }

  addToStatusBar() {
    if (!this.statusBar || this.statusTile) return;
    this.statusTile = this.statusBar.addLeftTile({ item: this, priority: 110 });
  }

  removeFromStatusBar() {
    const tile = this.statusTile;
    this.statusTile = null;
    tile?.destroy();
  }

  /**
   * One counter per severity, built from the hub's vocabulary when available,
   * or from Front's baseline before the hub connects. The tile stays attached
   * even before the first editor, so the status bar has a stable control from
   * the first paint.
   */
  buildCounters() {
    const records = this.pkg.severities.records;
    if (this.counters.length === records.length) {
      return;
    }
    for (const { counter } of this.counters) {
      counter.remove();
    }
    this.counters = records.map((severity) => {
      const counter = document.createElement("span");
      counter.classList.add("linter-status-counter");
      const icon = document.createElement("span");
      icon.classList.add("icon", severity.icon);
      counter.appendChild(icon);
      const label = document.createElement("span");
      counter.appendChild(label);
      this.element.appendChild(counter);
      return { severity, counter, label };
    });
  }

  update() {
    this.buildCounters();
    // Null-prototype so a severity literally named "constructor" cannot corrupt
    // the tally.
    const counts = Object.create(null);
    for (const { severity } of this.counters) {
      counts[severity.name] = 0;
    }
    const lintingDisabled = this.pkg.isLintingDisabled();
    for (const message of this.pkg.getMessages()) {
      if (counts[message.severity] !== undefined) counts[message.severity]++;
    }

    // Only the loud tiers keep the band open. A file whose sole diagnostics are
    // hints reads as clean, which is what turning statusMode off asks for.
    let loudCount = 0;
    for (const { severity, counter, label } of this.counters) {
      const count = counts[severity.name];
      counter.classList.toggle(severity.textClass, Boolean(count) && !lintingDisabled);
      label.textContent = lintingDisabled && count === 0 ? "X" : count;
      // A quiet tile stays out of the way until one is reported, so a user with
      // no hint provider sees the same three tiles, and the same three "X", as
      // before.
      counter.classList.toggle(
        "linter-status-counter-hidden",
        severity.hideWhenZero && count === 0,
      );
      if (!severity.hideWhenZero) loudCount += count;
    }

    this.element.classList.toggle("linting-disabled", lintingDisabled);
    this.element.classList.toggle("project-mode", this.pkg.viewMode === "project");
    this.element.classList.toggle(
      "linter-status-hidden",
      !this.statusMode && loudCount === 0 && !lintingDisabled,
    );
  }

  // The hub owns navigating between messages and clearing them, so those two
  // go out as commands rather than through the handle: they are the same
  // actions the menu and the keymap dispatch.
  dispatch(command) {
    lumine.commands.dispatch(lumine.views.getView(lumine.workspace), command);
  }

  onmouseup(e) {
    if (e.which === 2 && e.ctrlKey) {
      // ctrl+middle click
      this.dispatch("linter:clear");
    } else if (e.which === 3 && e.ctrlKey) {
      // ctrl+right click
      this.dispatch("linter:previous");
    } else if (e.which === 1) {
      // left click
      this.dispatch("linter-panel:toggle");
    } else if (e.which === 2) {
      // middle click
      this.pkg.setViewMode(this.pkg.viewMode === "project" ? "file" : "project");
    } else if (e.which === 3) {
      // right click
      this.dispatch("linter:next");
    }
  }
}

module.exports = { StatusPanel };
