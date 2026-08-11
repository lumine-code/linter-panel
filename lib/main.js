const { CompositeDisposable, Disposable } = require("lumine");
const { Front } = require("./front");
const { StatusPanel } = require("./status");

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

function activate() {
  front = new Front();
  subscriptions = new CompositeDisposable(
    lumine.commands.add("lumine-workspace", {
      "linter-panel:toggle": () => getPanel().toggle(),
      "linter-panel:toggle-focus": () => getPanel().toggleFocus(),
      "linter-panel:file-mode": () => front.setViewMode("file"),
      "linter-panel:project-mode": () => front.setViewMode("project"),
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
  activate,
  deactivate,
  deserializePanel,
  provideLinterUI,
  consumeStatusBar,
  PANEL_URI,
};
