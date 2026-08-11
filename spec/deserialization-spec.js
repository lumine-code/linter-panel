const main = require("../lib/main");

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
