import assert from "node:assert/strict";

// Complete the real welcome UI before testing another module's modal dialogs.
export async function completeWelcome(w, name = "Study learner") {
  const waitFor = async predicate => {
    for (let n = 0; n < 160; n++) {
      if (predicate()) return;
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    assert.ok(predicate(), "Welcome UI did not become ready");
  };
  const popup = () => w.document.querySelector("dialog.welcome-dialog[open]");
  await waitFor(popup);
  const input = popup().querySelector('input[name="guestName"]');
  if (input) {
    Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, "value").set.call(input, name);
    input.dispatchEvent(new w.Event("input", { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 30));
    popup().querySelector("form").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
  }
  const start = () => popup() && [...popup().querySelectorAll("button")].find(button => button.textContent.trim() === "Let’s study");
  await waitFor(start); start().click();
  await waitFor(() => !popup());
}
