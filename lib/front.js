const { Severities } = require("./severities");

/**
 * The front end's own state, and the one object both surfaces talk to.
 *
 * The hub knows about diagnostics; this knows what is being looked at. The view
 * mode lives here rather than on the panel because the status-bar tile renders
 * it too and the tile exists long before the panel is first built — a package
 * whose panel has never been opened still counts messages on the status bar.
 */
class Front {
  constructor() {
    // The handle onto the linter hub, or null until it attaches. Every question
    // about diagnostics goes through it, and every one of them has an answer for
    // "no hub yet", because the status-bar tile is built at activation.
    this.hub = null;
    this.messages = [];
    this.viewMode = "file";
    this.editor = null;
    this.panel = null;
    this.status = null;
    // Empty until the hub attaches: the vocabulary is the hub's, and a surface
    // built before it arrives renders no tier rather than a guessed one.
    this.severities = new Severities();
    // Deliberately not a workspace subscription. Which messages belong to the
    // active item, and which editor's cursor marks a row, are both answered by
    // the hub from state it updates on the very same event — so watching for it
    // here raced the hub and lost, and both surfaces showed the item before
    // last. The hub says when it has caught up; see `didChangeActiveItem`.
  }

  dispose() {
    this.hub = null;
  }

  /**
   * Receives the hub handle. Called once, before the first render.
   * @param {Object} hub
   */
  attach(hub) {
    this.hub = hub;
    this.severities = new Severities(hub.getSeverities());
    // The hub may have been linting long before this package registered, so the
    // first state comes from asking rather than from waiting for a change.
    this.messages = hub.getMessages();
    this.setEditor();
  }

  /**
   * Releases the hub. The panel keeps its tab — there is simply nothing in it.
   */
  detach() {
    this.hub = null;
    this.messages = [];
    this.editor = null;
    this.status?.setEditor(null);
    this.panel?.setEditor(null);
    this.update();
  }

  /**
   * The message set changed.
   * @param {Object} difference
   */
  render({ messages }) {
    this.messages = messages;
    this.update();
  }

  /**
   * The messages both surfaces are showing: the active item's, or the project's.
   * @returns {Array}
   */
  getMessages() {
    return this.viewMode === "project" ? this.messages : this.getCurrentMessages();
  }

  /**
   * The active item's messages, whatever the view mode. The hub answers, because
   * it knows how a provider and a buffer spell the same path and it knows about
   * items an adapter owns.
   * @returns {Array}
   */
  getCurrentMessages() {
    return this.hub ? this.hub.getCurrentMessages() : [];
  }

  setViewMode(mode) {
    if (this.viewMode === mode) {
      return;
    }
    this.viewMode = mode;
    this.panel?.viewModeChanged();
    this.update();
  }

  /**
   * Resolves the editor whose cursor marks the current row. Null whenever the
   * active item is not a plain text editor — a notebook handled by an adapter
   * has its own idea of a current position.
   */
  setEditor() {
    this.editor = this.hub ? this.hub.getCursorEditor() : null;
    this.status?.setEditor(this.editor);
    this.panel?.setEditor(this.editor);
    this.update();
  }

  update() {
    this.status?.update();
    this.panel?.update();
  }

  revealMessage(message) {
    this.hub?.revealMessage(message);
  }

  deleteMessage(message) {
    this.hub?.deleteMessages([message]);
  }

  isLintingDisabled() {
    return Boolean(this.editor && this.hub?.isLintingDisabled(this.editor));
  }

  // A message's long form is either the text itself or a function producing it.
  // Both of those, and the memo that keeps a lazy one from running once per
  // render, belong to the hub — it hands the same message objects to every UI,
  // and a second cache here would run a provider's function a second time.

  getDescription(message) {
    return this.hub ? this.hub.getDescription(message) : null;
  }

  hasLazyDescription(message) {
    return Boolean(this.hub?.hasLazyDescription(message));
  }

  resolveDescription(message) {
    return this.hub ? this.hub.resolveDescription(message) : Promise.resolve(null);
  }
}

module.exports = { Front };
