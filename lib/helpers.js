// Small utilities over the messages the hub hands across. Everything here is a
// pure function of one message or one string; anything needing to know what the
// hub knows goes through the handle instead.

/**
 * What a message is about, for display.
 *
 * A message names its subject by path. A buffer that has never been saved has
 * no path, so such a message names the buffer instead and there is nothing to
 * show but that it is untitled.
 * @param {Object} message
 * @returns {string} A label, never null — an unlocated message is not valid.
 */
function messageSubject(message) {
  const file = message.location?.file;
  if (typeof file === "string") {
    return file;
  }
  return "untitled";
}

/**
 * The editor currently showing this buffer, for a message located by buffer
 * rather than by path. Returns null once nothing is showing it, which is the
 * same answer as opening a path that has since been deleted.
 * @param {Object} buffer
 * @returns {Object|null}
 */
function editorForBuffer(buffer) {
  if (!buffer) {
    return null;
  }
  for (const editor of lumine.workspace.getTextEditors()) {
    if (editor.getBuffer() === buffer) {
      return editor;
    }
  }
  return null;
}

// A message excerpt rendered to HTML, keyed by the excerpt itself.
//
// `lumine.tools.markdown.render` builds a MarkdownIt instance, installs its
// plugins, runs the front-matter parser and sanitizes the result on every call
// — far more than a one-line diagnostic is worth, and the panel asks for it once
// per row per render. Keyed by the string rather than by the message because a
// fresh lint run produces new message objects for the same text, and because one
// excerpt is usually reported many times over.
const RENDERED_EXCERPT_LIMIT = 2000;
const renderedExcerpts = new Map();

function renderExcerpt(excerpt) {
  const key = typeof excerpt === "string" ? excerpt : String(excerpt ?? "");
  if (renderedExcerpts.has(key)) {
    // Re-inserted so the entries in use are the last to be evicted.
    const cached = renderedExcerpts.get(key);
    renderedExcerpts.delete(key);
    renderedExcerpts.set(key, cached);
    return cached;
  }
  const html = lumine.tools.markdown.render(key);
  // An excerpt names an identifier or a path often enough that the set of them
  // is not bounded on its own. A Map iterates in insertion order, so the first
  // key is the least recently used one.
  if (renderedExcerpts.size >= RENDERED_EXCERPT_LIMIT) {
    renderedExcerpts.delete(renderedExcerpts.keys().next().value);
  }
  renderedExcerpts.set(key, html);
  return html;
}

module.exports = { messageSubject, editorForBuffer, renderExcerpt };
