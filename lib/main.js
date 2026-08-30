const { CompositeDisposable, Disposable } = require("lumine");
const { Front } = require("./front");
const { StatusPanel } = require("./status");
const etch = require("@lumine-code/etch");

// Etch holds its scheduler per copy of the library, and this package resolves
// its own copy — so the assignment the editor makes on core's copy never
// reaches it. Point it at the view registry before anything renders, or this
// package's DOM writes land on an animation frame of their own alongside the
// editor's and force a synchronous reflow.
etch.setScheduler(lumine.views);

const PANEL_URI = "lumine://linter-panel";

let subscriptions = null;
let front = null;
let statusTile = null;

/**
 * The panel, built the first time something asks for it. A package whose panel
 * is never opened pays for the status-bar tile and nothing else, and a closed
 * tab drops the item rather than leaving a destroyed one behind.
 * @returns {Object} The panel
 */
function getPanel() {
  if (!front.panel) {
    const { LinterPanel } = require("./linter-panel");
    const panel = new LinterPanel(front);
    panel.onDidDestroy(() => {
      if (front.panel === panel) {
        front.panel = null;
      }
    });
    front.panel = panel;
  }
  return front.panel;
}

/**
 * Builds the front end before anything can ask for the panel.
 *
 * The workspace deserializes its docks during window startup, which is before
 * initial packages activate — and a deserializer deliberately does not trigger
 * activation then, because the workspace element is not in the DOM yet. So a
 * saved panel tab reaches `deserializePanel` with `activate()` still to come.
 * `initialize` is the one hook the editor guarantees ahead of both deserializers
 * and view providers, so the state they need is built here.
 */
function initialize() {
  front ??= new Front();
}

function activate() {
  // Kept rather than replaced: a panel restored during startup deserialization
  // is already talking to this one.
  front ??= new Front();
  subscriptions = new CompositeDisposable(
    lumine.commands.add("lumine-workspace", {
      "linter-panel:toggle": (event) => getPanel().toggle(event),
      "linter-panel:toggle-focus": () => getPanel().toggleFocus(),
      "linter-panel:file-mode": {
        description: "Show only the messages for the file now open.",
        didDispatch: () => front.setViewMode("file"),
      },
      "linter-panel:project-mode": {
        description: "Show the messages for every file in the project.",
        didDispatch: () => front.setViewMode("project"),
      },
    }),
    lumine.workspace.addOpener((uri) => (uri === PANEL_URI ? getPanel() : undefined)),
    new Disposable(() => {
      const panel = front.panel;
      if (!panel) return;
      const pane = lumine.workspace.paneForItem(panel);
      if (pane) {
        pane.destroyItem(panel);
      } else {
        panel.destroy();
      }
    }),
  );
}

function deactivate() {
  subscriptions?.dispose();
  subscriptions = null;
  // The status bar keeps its tiles in an ordered collection and inserts later
  // ones relative to them, so a detached item left behind breaks the next
  // insertion.
  statusTile?.destroy();
  statusTile = null;
  front?.status?.destroy();
  front?.dispose();
  front = null;
}

/**
 * Restores the panel after a window reload. The workspace records the item by
 * its deserializer name; the opener above answers for the URI.
 * @returns {Object} The panel
 */
function deserializePanel() {
  return getPanel();
}

/**
 * The front end the linter hub renders through.
 * @returns {Object} A `linter.ui` provider
 */
function provideLinterUI() {
  return {
    name: "linter-panel",
    attach: (hub) => front.attach(hub),
    render: (difference) => front.render(difference),
    didChangeActiveItem: () => front.setEditor(),
    didChangeLintingState: () => front.update(),
    showProjectView: () => front.setViewMode("project"),
    dispose: () => front.detach(),
  };
}

/**
 * Consumes the status bar service.
 * @param {Object} statusBar
 */
function consumeStatusBar(statusBar) {
  front.status = new StatusPanel(front);
  // Diagnostics band — the outermost tile on the left edge. See the priority
  // convention in the status-bar package README.
  statusTile = statusBar.addLeftTile({ item: front.status, priority: 110 });
  front.status.update();
}

module.exports = {
  initialize,
  activate,
  deactivate,
  deserializePanel,
  provideLinterUI,
  consumeStatusBar,
  PANEL_URI,
};
