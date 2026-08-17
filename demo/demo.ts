import 'picktime';
import type { PickTimeElement } from 'picktime';

const byId = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el as T;
};

/* Playground ------------------------------------------------------------- */

const play = byId<PickTimeElement>('play');
const readout = byId<HTMLOutputElement>('readout');

const describe = (): void => {
  readout.textContent = play.value
    ? `value="${play.value}"  valueAsNumber=${play.valueAsNumber}  valid=${play.checkValidity()}`
    : 'empty';
};

play.addEventListener('change', describe);
describe();

for (const control of document.querySelectorAll<HTMLInputElement>(
  '[data-attr]'
)) {
  control.addEventListener('input', () => {
    const name = control.dataset.attr;
    if (!name) return;
    if (control.value) play.setAttribute(name, control.value);
    else play.removeAttribute(name);
    describe();

    // Placement is easiest to understand while the panel is visible. Choosing
    // an option light-dismisses the popover because the select is outside it,
    // so reopen after that dismissal completes and show the new position.
    if (name === 'placement') {
      requestAnimationFrame(() => play.showPicker());
    }
  });
}

for (const toggle of document.querySelectorAll<HTMLInputElement>(
  '[data-bool]'
)) {
  toggle.addEventListener('change', () => {
    const name = toggle.dataset.bool;
    if (!name) return;
    play.toggleAttribute(name, toggle.checked);
    describe();
  });
}

/* Form ------------------------------------------------------------------- */

const form = byId<HTMLFormElement>('real-form');
const output = byId<HTMLPreElement>('form-output');

form.addEventListener('submit', event => {
  event.preventDefault();
  const entries = [...new FormData(form).entries()];
  output.textContent = JSON.stringify(Object.fromEntries(entries), null, 2);
});

/* Typed entry ------------------------------------------------------------ */

const typed = byId<PickTimeElement>('typed');
const typedOut = byId<HTMLOutputElement>('typed-out');

const reportTyped = (): void => {
  if (typed.validity.badInput) {
    typedOut.textContent = 'Could not parse that. validity.badInput = true';
    return;
  }
  typedOut.textContent = typed.value
    ? `Parsed to "${typed.value}"`
    : 'Nothing entered yet.';
};

typed.addEventListener('change', reportTyped);
// Unparseable text does not change the value, so no `change` fires. Validity
// is the signal instead, and `focusout` is composed so it escapes the shadow
// root and reaches us here.
typed.addEventListener('focusout', () => {
  requestAnimationFrame(reportTyped);
});
reportTyped();

/* Framework tabs --------------------------------------------------------- */

const tablist = document.querySelector<HTMLElement>('[role="tablist"]');

if (tablist) {
  const tabs = [...tablist.querySelectorAll<HTMLButtonElement>('[role="tab"]')];

  const select = (tab: HTMLButtonElement): void => {
    for (const other of tabs) {
      const selected = other === tab;
      other.setAttribute('aria-selected', String(selected));
      other.tabIndex = selected ? 0 : -1;
      const panelId = other.getAttribute('aria-controls');
      const panel = panelId ? document.getElementById(panelId) : null;
      if (panel) panel.hidden = !selected;
    }
  };

  for (const tab of tabs) {
    tab.addEventListener('click', () => select(tab));
  }

  // Arrow-key navigation, per the ARIA tabs pattern.
  tablist.addEventListener('keydown', event => {
    const step =
      event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();

    const current = tabs.findIndex(
      t => t.getAttribute('aria-selected') === 'true'
    );
    const next = tabs[(current + step + tabs.length) % tabs.length];
    if (next) {
      select(next);
      next.focus();
    }
  });
}
