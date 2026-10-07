const main = require("../lib/main");
const { fakeHub, normalize } = require("./fake-hub");

// The workspace deserializes its docks during window startup, before initial
// packages activate — and a deserializer does not trigger activation then,
// because the workspace element is not in the DOM yet. So a window reloaded with
// the panel open reaches `deserializePanel` with `activate()` still to come, and
// anything it needs has to exist by `initialize`.
describe("restoring the panel at window startup", () => {
  afterEach(() => {
    main.deactivate();
  });

  it("builds the panel from the deserializer alone, before activation", () => {
    main.initialize();

    const panel = main.deserializePanel();

    expect(panel).toBeTruthy();
    expect(panel.getURI()).toBe(main.PANEL_URI);
  });

  it("keeps that panel when activation follows", () => {
    main.initialize();
    const restored = main.deserializePanel();

    main.activate();

    // A fresh front end here would leave the restored tab talking to an object
    // nothing else renders through.
    expect(main.deserializePanel()).toBe(restored);
  });

  it("still builds one when activation comes first, as it does on a fresh install", () => {
    main.activate();

    expect(main.deserializePanel()).toBeTruthy();
  });
});

describe("opening the panel after selecting an editor", () => {
  let editor;
  let ui;
  let panel;
  let messages;

  const currentMessage = () => panel._currentMessage();

  beforeEach(async () => {
    main.activate();
    editor = await lumine.workspace.open();
    editor.setText("first\nsecond\n");
    messages = normalize(
      [0, 1].map((row) => ({
        severity: "warning",
        excerpt: `warning at ${row}`,
        location: {
          buffer: editor.getBuffer(),
          position: [
            [row, 0],
            [row, 1],
          ],
        },
      })),
    );
    ui = main.provideLinterUI();
    ui.attach(fakeHub({ messages: () => messages, editor: () => editor }));
  });

  afterEach(async () => {
    ui.dispose();
    await panel?.destroy();
    panel = null;
    main.deactivate();
    editor.destroy();
  });

  const openPanel = async () => {
    panel = main.deserializePanel();
    jasmine.attachToDOM(panel.element);
    await panel.update();
  };

  it("highlights the current warning on its first render", async () => {
    editor.setCursorBufferPosition([1, 0]);

    await openPanel();

    expect(currentMessage()).toBe(messages[1]);
  });

  it("follows cursor movement without switching editors", async () => {
    await openPanel();
    const highlight = spyOn(panel, "_updateCurrentRowHighlight").and.callThrough();

    editor.setCursorBufferPosition([1, 0]);
    window.advanceClock(100);

    expect(highlight).toHaveBeenCalled();
    expect(currentMessage()).toBe(messages[1]);
  });

  it("resumes highlighting when a closed panel is created again", async () => {
    await openPanel();
    await panel.destroy();
    panel = null;
    editor.setCursorBufferPosition([1, 0]);

    await openPanel();

    expect(currentMessage()).toBe(messages[1]);
  });
});
