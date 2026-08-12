const { Front } = require("../lib/front");
const { fakeHub } = require("./fake-hub");

// What both surfaces read comes from the hub, and the hub answers about the
// active item from state it updates on the same workspace event a front end
// would subscribe to. So it must not subscribe: it is told.
describe("lib/front", () => {
  let front;
  let editor;

  beforeEach(() => {
    front = new Front();
    front.attach(fakeHub({ editor: () => lumine.workspace.getCenter().getActivePaneItem() }));
  });

  afterEach(() => {
    front.dispose();
    editor?.destroy();
  });

  it("does not follow the workspace on its own", async () => {
    editor = await lumine.workspace.open("front-spec.js");

    // The active item moved, and the hub would answer with it — but nothing has
    // said the hub has caught up, so neither has this.
    expect(front.editor).toBeNull();
  });

  it("takes the editor from the hub when it is told", async () => {
    editor = await lumine.workspace.open("front-spec.js");

    front.setEditor();

    expect(front.editor).toBe(editor);
  });

  it("passes it on to whichever surfaces exist", async () => {
    const seen = [];
    front.status = { setEditor: (value) => seen.push(value), update: () => {} };
    editor = await lumine.workspace.open("front-spec.js");

    front.setEditor();

    expect(seen[seen.length - 1]).toBe(editor);
  });
});
