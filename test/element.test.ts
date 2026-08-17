import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import '../src/index';
import type { PickTimeElement } from '../src/element';

const mount = (html: string): HTMLElement => {
  const host = document.createElement('div');
  host.innerHTML = html;
  document.body.append(host);
  return host;
};

const pick = (host: ParentNode): PickTimeElement => {
  const el = host.querySelector<PickTimeElement>('pick-time');
  if (!el) throw new Error('no <pick-time> found');
  return el;
};

const part = (el: PickTimeElement, selector: string): HTMLElement => {
  const found = el.shadowRoot?.querySelector<HTMLElement>(selector);
  if (!found) throw new Error(`no ${selector} in shadow root`);
  return found;
};

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('registration', () => {
  it('upgrades the element', () => {
    const el = pick(mount('<pick-time></pick-time>'));
    expect(el).toBeInstanceOf(HTMLElement);
    expect(el.shadowRoot).not.toBeNull();
  });

  it('is form associated', () => {
    expect(
      (customElements.get('pick-time') as { formAssociated?: boolean })
        .formAssociated
    ).toBe(true);
  });
});

describe('value', () => {
  it('reads the value attribute as the default', () => {
    const el = pick(mount('<pick-time value="09:30"></pick-time>'));
    expect(el.value).toBe('09:30');
    expect(el.valueAsNumber).toBe(9 * 3600 + 30 * 60);
  });

  it('treats midnight as a real value', () => {
    const el = pick(mount('<pick-time value="00:00"></pick-time>'));
    expect(el.value).toBe('00:00');
    expect(el.valueAsObject).toEqual({
      hours: 0,
      minutes: 0,
      seconds: 0,
      meridiem: 'am',
    });
  });

  it('exposes seconds only when the attribute is set', () => {
    const plain = pick(mount('<pick-time value="09:30:45"></pick-time>'));
    expect(plain.value).toBe('09:30');

    const withSeconds = pick(
      mount('<pick-time seconds value="09:30:45"></pick-time>')
    );
    expect(withSeconds.value).toBe('09:30:45');
  });

  it('renders a formatted, localised label in the field', () => {
    const el = pick(
      mount('<pick-time locale="en-US" value="13:05"></pick-time>')
    );
    const field = part(el, '.field') as HTMLInputElement;
    expect(field.value).toMatch(/01:05/);
    expect(field.value.toLowerCase()).toContain('pm');
  });
});

describe('form participation', () => {
  it('submits its value under its name', () => {
    const host = mount(
      '<form><pick-time name="start" value="09:30"></pick-time></form>'
    );
    const form = host.querySelector('form');
    if (!form) throw new Error('no form');
    expect(new FormData(form).get('start')).toBe('09:30');
  });

  it('tracks later changes', () => {
    const host = mount(
      '<form><pick-time name="start" value="09:30"></pick-time></form>'
    );
    const form = host.querySelector('form');
    if (!form) throw new Error('no form');
    pick(host).value = '17:45';
    expect(new FormData(form).get('start')).toBe('17:45');
  });

  it('submits an empty string for an optional empty control', () => {
    const host = mount('<form><pick-time name="start"></pick-time></form>');
    const form = host.querySelector('form');
    if (!form) throw new Error('no form');
    expect(new FormData(form).get('start')).toBe('');
  });

  it('resets to the default value', () => {
    const host = mount(
      '<form><pick-time name="start" value="09:30"></pick-time></form>'
    );
    const form = host.querySelector('form');
    if (!form) throw new Error('no form');
    const el = pick(host);
    el.value = '17:45';
    form.reset();
    expect(el.value).toBe('09:30');
  });

  it('exposes its label through internals', () => {
    const host = mount(
      '<label for="t">Start</label><pick-time id="t" name="start"></pick-time>'
    );
    expect(pick(host).labels.length).toBe(1);
  });

  it('focuses and names the text field when its external label is clicked', () => {
    const host = mount(
      '<label for="t">Meeting time</label><pick-time id="t"></pick-time>'
    );
    const el = pick(host);
    const label = host.querySelector('label');
    if (!label) throw new Error('no label');
    label.click();
    expect(el.shadowRoot?.activeElement).toBe(part(el, '.field'));
    expect(part(el, '.field').getAttribute('aria-label')).toBe('Meeting time');
  });
});

describe('constraint validation', () => {
  it('reports valueMissing when required and empty', () => {
    const el = pick(mount('<pick-time required name="t"></pick-time>'));
    expect(el.validity.valueMissing).toBe(true);
    expect(el.checkValidity()).toBe(false);
    el.value = '09:00';
    expect(el.validity.valueMissing).toBe(false);
    expect(el.checkValidity()).toBe(true);
  });

  it('reports range underflow and overflow', () => {
    const el = pick(
      mount('<pick-time min="09:00" max="17:00" value="08:00"></pick-time>')
    );
    expect(el.validity.rangeUnderflow).toBe(true);
    el.value = '18:00';
    expect(el.validity.rangeOverflow).toBe(true);
    el.value = '12:00';
    expect(el.checkValidity()).toBe(true);
  });

  it('blocks form submission while invalid', () => {
    const host = mount(
      '<form><pick-time required name="t"></pick-time></form>'
    );
    const form = host.querySelector('form');
    if (!form) throw new Error('no form');
    expect(form.checkValidity()).toBe(false);
    pick(host).value = '09:00';
    expect(form.checkValidity()).toBe(true);
  });
});

describe('picker popover', () => {
  it('opens and closes through the public methods', () => {
    const el = pick(mount('<pick-time value="09:30"></pick-time>'));
    expect(el.open).toBe(false);
    el.showPicker();
    expect(el.open).toBe(true);
    el.hidePicker();
    expect(el.open).toBe(false);
  });

  it('renders the panel in the top layer as a popover', () => {
    const el = pick(mount('<pick-time value="09:30"></pick-time>'));
    expect(part(el, '.picker').getAttribute('popover')).toBe('auto');
  });

  it('refuses to open when disabled or read only', () => {
    const disabled = pick(mount('<pick-time disabled></pick-time>'));
    disabled.showPicker();
    expect(disabled.open).toBe(false);

    const readOnly = pick(mount('<pick-time readonly></pick-time>'));
    readOnly.showPicker();
    expect(readOnly.open).toBe(false);
  });

  it('closes on Escape without any handler of our own', async () => {
    const el = pick(mount('<pick-time value="09:30"></pick-time>'));
    el.showPicker();
    expect(el.open).toBe(true);
    await userEvent.keyboard('{Escape}');
    expect(el.open).toBe(false);
  });
});

describe('accessibility', () => {
  it('marks the segments as spinbuttons with a full value set', () => {
    const el = pick(mount('<pick-time seconds value="09:30:15"></pick-time>'));
    const hours = part(el, '[data-field="hours"]');
    expect(hours.getAttribute('role')).toBe('spinbutton');
    expect(hours.getAttribute('aria-valuenow')).toBe('9');
    expect(hours.getAttribute('aria-valuemin')).toBe('1');
    expect(hours.getAttribute('aria-valuemax')).toBe('12');
    expect(hours.getAttribute('aria-valuetext')).toBe('9 hours');

    const minutes = part(el, '[data-field="minutes"]');
    expect(minutes.getAttribute('aria-valuemax')).toBe('59');
    expect(minutes.getAttribute('aria-valuenow')).toBe('30');
  });

  it('uses a 0-23 range on a 24-hour clock', () => {
    const el = pick(
      mount('<pick-time hour-cycle="h23" value="13:00"></pick-time>')
    );
    const hours = part(el, '[data-field="hours"]');
    expect(hours.getAttribute('aria-valuemin')).toBe('0');
    expect(hours.getAttribute('aria-valuemax')).toBe('23');
    expect(hours.getAttribute('aria-valuenow')).toBe('13');
  });

  it('never emits a positive tabindex', () => {
    const el = pick(mount('<pick-time value="09:30"></pick-time>'));
    const root = el.shadowRoot;
    if (!root) throw new Error('no shadow root');
    for (const node of root.querySelectorAll('[tabindex]')) {
      expect(Number(node.getAttribute('tabindex'))).toBeLessThanOrEqual(0);
    }
  });

  it('hides the meridiem control on a 24-hour clock', () => {
    const twelve = pick(mount('<pick-time hour-cycle="h12"></pick-time>'));
    expect(part(twelve, '.meridiem').hidden).toBe(false);

    const twentyFour = pick(mount('<pick-time hour-cycle="h23"></pick-time>'));
    expect(part(twentyFour, '.meridiem').hidden).toBe(true);
  });

  it('hides the seconds segment unless enabled', () => {
    const el = pick(mount('<pick-time value="09:30"></pick-time>'));
    expect(part(el, '[data-field="seconds"]').hidden).toBe(true);
  });
});

describe('keyboard stepping', () => {
  /**
   * The popover `toggle` event is queued, and its handler moves focus to the
   * hours segment. Tests must let that land before targeting another segment,
   * otherwise the key lands on hours instead.
   */
  const open = async (el: PickTimeElement) => {
    el.showPicker();
    await new Promise(resolve => setTimeout(resolve, 0));
  };

  const press = async (el: PickTimeElement, field: string, key: string) => {
    const spin = part(el, `[data-field="${field}"]`);
    spin.focus();
    await userEvent.keyboard(key);
  };

  it('steps minutes and wraps within the field', async () => {
    const el = pick(
      mount('<pick-time value="09:59" minute-step="1"></pick-time>')
    );
    await open(el);
    await press(el, 'minutes', '{ArrowUp}');
    expect(el.value).toBe('09:00');
  });

  it('honours minute-step', async () => {
    const el = pick(
      mount('<pick-time value="09:00" minute-step="15"></pick-time>')
    );
    await open(el);
    await press(el, 'minutes', '{ArrowUp}');
    expect(el.value).toBe('09:15');
  });

  it('wraps hours inside the meridiem half', async () => {
    const el = pick(mount('<pick-time value="11:00"></pick-time>'));
    await open(el);
    await press(el, 'hours', '{ArrowUp}');
    expect(el.value).toBe('00:00');
  });

  it('jumps to the field bounds with Home and End', async () => {
    const el = pick(mount('<pick-time value="09:30"></pick-time>'));
    await open(el);
    await press(el, 'minutes', '{Home}');
    expect(el.value).toBe('09:00');
    await press(el, 'minutes', '{End}');
    expect(el.value).toBe('09:59');
  });

  it('emits input and change when stepping', async () => {
    const el = pick(mount('<pick-time value="09:30"></pick-time>'));
    let inputs = 0;
    let changes = 0;
    el.addEventListener('input', () => inputs++);
    el.addEventListener('change', () => changes++);
    await open(el);
    await press(el, 'minutes', '{ArrowUp}');
    expect(inputs).toBe(1);
    expect(changes).toBe(1);
  });
});

describe('meridiem', () => {
  it('moves the value by twelve hours', () => {
    const el = pick(mount('<pick-time value="09:30"></pick-time>'));
    const pm = part(el, '[data-period="pm"]');
    pm.click();
    expect(el.value).toBe('21:30');
    expect(pm.getAttribute('aria-checked')).toBe('true');
  });

  it('uses localised day period labels', () => {
    const el = pick(
      mount('<pick-time locale="ja-JP" hour-cycle="h12"></pick-time>')
    );
    const am = part(el, '[data-period="am"]');
    const pm = part(el, '[data-period="pm"]');
    expect(am.textContent).not.toBe('');
    expect(am.textContent).not.toBe(pm.textContent);
  });
});

describe('typed entry', () => {
  it('accepts real keyboard input after a normal click', async () => {
    const el = pick(mount('<pick-time></pick-time>'));
    const field = part(el, '.field') as HTMLInputElement;
    await userEvent.click(field);
    await new Promise(r => setTimeout(r, 50));
    expect(el.shadowRoot?.activeElement).toBe(field);
    await userEvent.keyboard('9:30 pm{Enter}');
    expect(el.value).toBe('21:30');
  });

  it('accepts a lenient typed time', async () => {
    const el = pick(mount('<pick-time></pick-time>'));
    const field = part(el, '.field') as HTMLInputElement;
    field.value = '9:30 pm';
    field.dispatchEvent(new Event('change', { bubbles: true }));
    expect(el.value).toBe('21:30');
  });

  it('flags unparseable input rather than throwing', () => {
    const el = pick(mount('<pick-time></pick-time>'));
    const field = part(el, '.field') as HTMLInputElement;
    field.value = 'half past nine';
    field.dispatchEvent(new Event('change', { bubbles: true }));
    expect(el.validity.badInput).toBe(true);
  });

  it('is not readonly by default, so a keyboard user can type', () => {
    const el = pick(mount('<pick-time></pick-time>'));
    expect((part(el, '.field') as HTMLInputElement).readOnly).toBe(false);
  });

  it('clears the value when the field is emptied', () => {
    const el = pick(mount('<pick-time value="09:30"></pick-time>'));
    const field = part(el, '.field') as HTMLInputElement;
    field.value = '';
    field.dispatchEvent(new Event('change', { bubbles: true }));
    expect(el.value).toBe('');
  });
});

describe('multiple instances', () => {
  it('keeps two pickers independent', () => {
    const host = mount(
      '<pick-time id="a" value="09:00"></pick-time>' +
        '<pick-time id="b" value="17:00"></pick-time>'
    );
    const a = host.querySelector<PickTimeElement>('#a');
    const b = host.querySelector<PickTimeElement>('#b');
    if (!a || !b) throw new Error('missing pickers');

    part(a, '[data-period="pm"]').click();
    expect(a.value).toBe('21:00');
    expect(b.value).toBe('17:00');
  });

  it('survives one being destroyed and another created', () => {
    const host = mount(
      '<pick-time id="a" value="09:00"></pick-time>' +
        '<pick-time id="b" value="17:00"></pick-time>'
    );
    host.querySelector('#a')?.remove();

    const fresh = document.createElement('pick-time');
    fresh.setAttribute('value', '11:15');
    host.append(fresh);

    const b = host.querySelector<PickTimeElement>('#b');
    expect(b?.value).toBe('17:00');
    expect((fresh as PickTimeElement).value).toBe('11:15');
  });
});

describe('teardown', () => {
  it('closes and detaches cleanly on disconnect', () => {
    const host = mount('<pick-time value="09:30"></pick-time>');
    const el = pick(host);
    el.showPicker();
    expect(el.open).toBe(true);
    expect(() => el.remove()).not.toThrow();
  });

  it('can be reconnected after removal', () => {
    const host = mount('<pick-time value="09:30"></pick-time>');
    const el = pick(host);
    el.remove();
    host.append(el);
    expect(el.value).toBe('09:30');
    expect(() => el.showPicker()).not.toThrow();
  });
});

describe('registering under a custom name', () => {
  it('exposes definePickTime without auto-registering from picktime/element', async () => {
    const { definePickTime, PickTimeElement: Klass } = await import(
      '../src/element'
    );
    definePickTime('picktime-field');
    const registered = customElements.get('picktime-field');
    // A second name gets a subclass, since one constructor cannot back two tags.
    expect(registered).toBeDefined();
    expect(registered?.prototype).toBeInstanceOf(Klass);

    const host = mount('<picktime-field value="08:15"></picktime-field>');
    const el = host.querySelector('picktime-field') as PickTimeElement;
    expect(el.value).toBe('08:15');
  });

  it('is a no-op when the name is already taken', async () => {
    const { definePickTime } = await import('../src/element');
    expect(() => definePickTime('pick-time')).not.toThrow();
  });
});

describe('opening by pointer', () => {
  it('opens on click and stays open (pointerup must not light-dismiss)', async () => {
    const el = pick(mount('<pick-time value="09:30"></pick-time>'));
    const field = part(el, '.field');
    await userEvent.click(field);
    await new Promise(r => setTimeout(r, 50));
    expect(el.open).toBe(true);
    expect(el.shadowRoot?.activeElement).toBe(field);
  });

  it('increments a segment when it is clicked', async () => {
    const el = pick(mount('<pick-time value="09:30"></pick-time>'));
    el.showPicker();
    await new Promise(r => setTimeout(r, 50));
    await userEvent.click(part(el, '[data-field="minutes"]'));
    expect(el.value).toBe('09:31');
  });

  it('closes on a second click, rather than reopening', async () => {
    const el = pick(mount('<pick-time value="09:30"></pick-time>'));
    const field = part(el, '.field');
    await userEvent.click(field);
    await new Promise(r => setTimeout(r, 50));
    expect(el.open).toBe(true);
    await userEvent.click(field);
    await new Promise(r => setTimeout(r, 50));
    expect(el.open).toBe(false);
  });
});

describe('field reflects committed changes', () => {
  it('updates the field while a segment inside the shadow root has focus', async () => {
    const el = pick(mount('<pick-time value="09:30"></pick-time>'));
    const field = part(el, '.field') as HTMLInputElement;
    expect(field.value).toMatch(/09:30/);

    el.showPicker();
    await new Promise(r => setTimeout(r, 50));
    const minutes = part(el, '[data-field="minutes"]');
    minutes.focus();
    await userEvent.keyboard('{ArrowUp}');

    expect(el.value).toBe('09:31');
    expect(field.value).toMatch(/09:31/);
  });

  it('leaves the field alone while the user is typing in it', () => {
    const el = pick(mount('<pick-time value="09:30"></pick-time>'));
    const field = part(el, '.field') as HTMLInputElement;
    field.focus();
    field.value = '11:4';
    el.setAttribute('minute-step', '5');
    expect(field.value).toBe('11:4');
  });
});

describe('hour-cycle aliases', () => {
  it('accepts plain 12 and 24', () => {
    const twelve = pick(mount('<pick-time hour-cycle="12"></pick-time>'));
    expect(twelve.hourCycle).toBe('h12');
    expect(part(twelve, '.meridiem').hidden).toBe(false);

    const twentyFour = pick(mount('<pick-time hour-cycle="24"></pick-time>'));
    expect(twentyFour.hourCycle).toBe('h23');
    expect(part(twentyFour, '.meridiem').hidden).toBe(true);
  });

  it('still accepts the CLDR names', () => {
    const el = pick(mount('<pick-time hour-cycle="h24"></pick-time>'));
    expect(el.hourCycle).toBe('h24');
  });

  it('falls back to the locale for an unknown value', () => {
    const el = pick(
      mount('<pick-time locale="de-DE" hour-cycle="nonsense"></pick-time>')
    );
    expect(el.hourCycle).toBe('h23');
  });
});

describe('hidden segments', () => {
  it('really hides the seconds segment, not just marks it hidden', () => {
    const el = pick(mount('<pick-time value="09:30"></pick-time>'));
    el.showPicker();
    const seconds = part(el, '[data-field="seconds"]');
    expect(getComputedStyle(seconds).display).toBe('none');
  });

  it('shows it when the attribute is present', () => {
    const el = pick(mount('<pick-time seconds value="09:30:15"></pick-time>'));
    el.showPicker();
    const seconds = part(el, '[data-field="seconds"]');
    expect(getComputedStyle(seconds).display).not.toBe('none');
  });

  it('really hides the meridiem on a 24-hour clock', () => {
    const el = pick(mount('<pick-time hour-cycle="24"></pick-time>'));
    el.showPicker();
    expect(getComputedStyle(part(el, '.meridiem')).display).toBe('none');
  });
});

describe('focus trap', () => {
  const open = async (el: PickTimeElement) => {
    el.showPicker();
    await new Promise(r => setTimeout(r, 60));
  };
  const active = (el: PickTimeElement) =>
    el.shadowRoot?.activeElement as HTMLElement | null;

  it('focuses the hours segment on open', async () => {
    const el = pick(mount('<pick-time value="09:30"></pick-time>'));
    await open(el);
    expect(active(el)?.dataset.field).toBe('hours');
  });

  it('cycles forward through the visible controls and wraps', async () => {
    const el = pick(mount('<pick-time value="09:30"></pick-time>'));
    await open(el);
    const order: (string | undefined)[] = [];
    for (let i = 0; i < 5; i++) {
      await userEvent.keyboard('{Tab}');
      const node = active(el);
      order.push(node?.dataset.field ?? node?.dataset.period);
    }
    expect(order).toEqual(['minutes', 'am', 'pm', 'hours', 'minutes']);
  });

  it('cycles backwards with Shift+Tab', async () => {
    const el = pick(mount('<pick-time value="09:30"></pick-time>'));
    await open(el);
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    expect(active(el)?.dataset.period).toBe('pm');
  });

  it('skips hidden segments', async () => {
    const el = pick(
      mount('<pick-time hour-cycle="24" value="09:30"></pick-time>')
    );
    await open(el);
    const order: (string | undefined)[] = [];
    for (let i = 0; i < 3; i++) {
      await userEvent.keyboard('{Tab}');
      order.push(active(el)?.dataset.field);
    }
    // No seconds column and no meridiem, so it is just hours <-> minutes.
    expect(order).toEqual(['minutes', 'hours', 'minutes']);
  });

  it('includes the seconds segment when enabled', async () => {
    const el = pick(
      mount('<pick-time hour-cycle="24" seconds value="09:30:15"></pick-time>')
    );
    await open(el);
    const order: (string | undefined)[] = [];
    for (let i = 0; i < 3; i++) {
      await userEvent.keyboard('{Tab}');
      order.push(active(el)?.dataset.field);
    }
    expect(order).toEqual(['minutes', 'seconds', 'hours']);
  });

  it('returns focus to the field when the panel closes', async () => {
    const el = pick(mount('<pick-time value="09:30"></pick-time>'));
    await open(el);
    expect(active(el)?.dataset.field).toBe('hours');
    el.hidePicker();
    await new Promise(r => setTimeout(r, 60));
    expect(active(el)).toBe(part(el, '.field'));
  });

  it('does not trap once the panel is closed', async () => {
    const el = pick(mount('<pick-time value="09:30"></pick-time>'));
    await open(el);
    el.hidePicker();
    await new Promise(r => setTimeout(r, 60));
    await userEvent.keyboard('{Tab}');
    expect(el.shadowRoot?.activeElement).toBeNull();
  });
});

describe('closing does not reopen', () => {
  it('stays closed after Escape, even though focus returns to the field', async () => {
    const el = pick(mount('<pick-time value="09:30"></pick-time>'));
    el.showPicker();
    await new Promise(r => setTimeout(r, 60));
    await userEvent.keyboard('{Escape}');
    await new Promise(r => setTimeout(r, 120));
    expect(el.open).toBe(false);
  });

  it('stays closed after hidePicker()', async () => {
    const el = pick(mount('<pick-time value="09:30"></pick-time>'));
    el.showPicker();
    await new Promise(r => setTimeout(r, 60));
    el.hidePicker();
    await new Promise(r => setTimeout(r, 120));
    expect(el.open).toBe(false);
  });

  it('leaves a genuinely focused field available for typing', async () => {
    const el = pick(mount('<pick-time value="09:30"></pick-time>'));
    part(el, '.field').focus();
    await new Promise(r => setTimeout(r, 60));
    expect(el.open).toBe(false);
    expect(el.shadowRoot?.activeElement).toBe(part(el, '.field'));
  });
});

describe('non-ASCII day periods', () => {
  it('does not overflow the panel for ja-JP', () => {
    const el = pick(
      mount(
        '<pick-time locale="ja-JP" hour-cycle="12" value="14:05"></pick-time>'
      )
    );
    el.showPicker();

    const am = part(el, '[data-period="am"]');
    const pm = part(el, '[data-period="pm"]');
    expect(am.textContent).toBe('午前');
    expect(pm.textContent).toBe('午後');

    const panel = part(el, '.picker').getBoundingClientRect();
    for (const node of [am, pm]) {
      const box = node.getBoundingClientRect();
      expect(box.right).toBeLessThanOrEqual(panel.right + 0.5);
      // Two CJK glyphs must sit on one line, not wrap.
      expect(box.height).toBeLessThan(40);
    }
  });

  it('keeps the 28px floor for two-letter ASCII labels', () => {
    const el = pick(
      mount(
        '<pick-time locale="en-US" hour-cycle="12" value="14:05"></pick-time>'
      )
    );
    el.showPicker();

    const am = part(el, '[data-period="am"]');
    const box = am.getBoundingClientRect();
    /*
     * 28px is the floor from v2. The exact width is text width + padding, so
     * it tracks the platform's font metrics: "AM" measures 28.67 on macOS and
     * 30.83 on Firefox/Linux, and the CJK labels next door only reach 32. Any
     * tighter bound would be asserting one engine's font, not the component,
     * so check the floor holds and the label neither wraps nor runs away.
     */
    expect(box.width).toBeGreaterThanOrEqual(28);
    expect(box.width).toBeLessThan(40);
    // Height is set by the 58px column, not the text, so it stays square-ish.
    expect(box.height).toBeLessThanOrEqual(29);
  });
});

describe('field styling tokens', () => {
  it('lets the trigger be restyled without touching the panel segments', () => {
    const el = pick(mount('<pick-time value="09:30"></pick-time>'));
    el.style.setProperty('--pt-field-border-radius', '10px');
    el.showPicker();

    expect(getComputedStyle(part(el, '.field')).borderRadius).toBe('10px');
    // The segments keep the picker's own 6px radius.
    expect(
      getComputedStyle(part(el, '[data-field="hours"]')).borderRadius
    ).toBe('6px');
  });
});

describe('field colour tokens', () => {
  it('lets the trigger keep a neutral palette while the panel is themed', () => {
    const el = pick(mount('<pick-time value="09:30"></pick-time>'));
    el.style.setProperty('--pt-background', 'rgb(39, 75, 206)');
    el.style.setProperty('--pt-field-background', 'rgb(255, 255, 255)');
    el.style.setProperty('--pt-field-color', 'rgb(9, 9, 11)');
    el.showPicker();

    const field = getComputedStyle(part(el, '.field'));
    expect(field.backgroundColor).toBe('rgb(255, 255, 255)');
    expect(field.color).toBe('rgb(9, 9, 11)');

    // The panel still follows --pt-background.
    expect(getComputedStyle(part(el, '.picker')).backgroundColor).toBe(
      'rgb(39, 75, 206)'
    );
  });
});

describe('programmatic bad input', () => {
  it('clears the value and reports badInput', () => {
    const el = pick(mount('<pick-time value="09:30"></pick-time>'));
    el.value = 'garbage';
    expect(el.value).toBe('');
    expect(el.validity.badInput).toBe(true);
    expect(el.checkValidity()).toBe(false);
  });

  it('recovers on a valid assignment', () => {
    const el = pick(mount('<pick-time value="09:30"></pick-time>'));
    el.value = 'garbage';
    el.value = '10:15';
    expect(el.value).toBe('10:15');
    expect(el.validity.badInput).toBe(false);
  });

  it('clears a non-finite valueAsNumber without throwing', () => {
    const el = pick(mount('<pick-time value="09:30"></pick-time>'));
    expect(() => {
      el.valueAsNumber = Number.NaN;
    }).not.toThrow();
    expect(el.value).toBe('');
    expect(el.valueAsNumber).toBeNull();
  });
});

describe('live value state', () => {
  it('does not reset a property assignment after another attribute changes', () => {
    const el = pick(mount('<pick-time value="09:30"></pick-time>'));
    el.value = '17:45';
    el.min = '08:00';
    expect(el.value).toBe('17:45');
  });

  it('keeps a value assigned before connection', () => {
    const el = document.createElement('pick-time') as PickTimeElement;
    el.value = '17:45';
    document.body.append(el);
    expect(el.value).toBe('17:45');
  });

  it('normalises hidden seconds in every value representation', () => {
    const el = pick(mount('<pick-time value="09:30:45"></pick-time>'));
    expect(el.value).toBe('09:30');
    expect(el.valueAsNumber).toBe(9 * 3600 + 30 * 60);
  });
});

describe('typed invalid state', () => {
  it('survives unrelated attribute changes', () => {
    const el = pick(mount('<pick-time value="09:30"></pick-time>'));
    const field = part(el, '.field') as HTMLInputElement;
    field.focus();
    field.value = 'not a time';
    field.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
    expect(el.validity.badInput).toBe(true);
    el.placeholder = 'Choose';
    expect(el.validity.badInput).toBe(true);
    expect(field.value).toBe('not a time');
  });
});

describe('reflected configuration properties', () => {
  it('reflects every configurable attribute exposed in the README', () => {
    const el = pick(mount('<pick-time></pick-time>'));
    el.secondStep = 15;
    el.placement = 'left';
    el.offset = 12;
    el.placeholder = 'Choose';
    el.theme = 'dark';
    el.animation = 'fade';
    expect(el.secondStep).toBe(15);
    expect(el.placement).toBe('left');
    expect(el.offset).toBe(12);
    expect(el.placeholder).toBe('Choose');
    expect(el.theme).toBe('dark');
    expect(el.animation).toBe('fade');
  });

  it('falls back safely for an invalid locale', () => {
    expect(() =>
      pick(mount('<pick-time locale="bad_locale"></pick-time>'))
    ).not.toThrow();
  });
});

describe('disabled is enforced, not just styled', () => {
  it('ignores segment keys while disabled', () => {
    const el = pick(mount('<pick-time value="09:30" disabled></pick-time>'));
    part(el, '[data-field="minutes"]').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true })
    );
    expect(el.value).toBe('09:30');
  });

  it('ignores the wheel while disabled', () => {
    const el = pick(mount('<pick-time value="09:30" disabled></pick-time>'));
    part(el, '[data-field="minutes"]').dispatchEvent(
      new WheelEvent('wheel', { deltaY: -1, bubbles: true, cancelable: true })
    );
    expect(el.value).toBe('09:30');
  });

  it('ignores the meridiem buttons while disabled', () => {
    const el = pick(mount('<pick-time value="09:30" disabled></pick-time>'));
    part(el, '[data-period="pm"]').click();
    expect(el.value).toBe('09:30');
  });

  it('reflects disabled onto the segments and period buttons', () => {
    const el = pick(mount('<pick-time value="09:30" disabled></pick-time>'));
    expect(part(el, '[data-field="hours"]').getAttribute('aria-disabled')).toBe(
      'true'
    );
    expect((part(el, '[data-period="pm"]') as HTMLButtonElement).disabled).toBe(
      true
    );
  });

  it('stays disabled inside a disabled fieldset', () => {
    const host = mount(
      '<form><fieldset disabled><pick-time name="t" value="09:30"></pick-time></fieldset></form>'
    );
    const el = pick(host);
    const field = part(el, '.field') as HTMLInputElement;
    expect(field.disabled).toBe(true);

    // An unrelated attribute change must not re-enable it.
    el.setAttribute('minute-step', '15');
    expect(field.disabled).toBe(true);

    part(el, '[data-period="pm"]').click();
    expect(el.value).toBe('09:30');
  });
});

describe('typed commit emits once', () => {
  const typeInto = (el: PickTimeElement, text: string) => {
    const field = part(el, '.field') as HTMLInputElement;
    field.focus();
    field.value = text;
    return field;
  };

  it('emits one change for change-then-blur', async () => {
    const el = pick(mount('<pick-time></pick-time>'));
    let changes = 0;
    let inputs = 0;
    el.addEventListener('change', () => changes++);
    el.addEventListener('input', () => inputs++);

    const field = typeInto(el, '9:30 pm');
    field.dispatchEvent(new Event('change', { bubbles: true }));
    field.blur();
    await new Promise(r => setTimeout(r, 60));

    expect(el.value).toBe('21:30');
    expect(changes).toBe(1);
    expect(inputs).toBe(1);
  });

  it('emits one change for Enter followed by the native change', async () => {
    const el = pick(mount('<pick-time></pick-time>'));
    let changes = 0;
    el.addEventListener('change', () => changes++);

    const field = typeInto(el, '9:30 pm');
    field.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    );
    field.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 60));

    expect(el.value).toBe('21:30');
    expect(changes).toBe(1);
  });

  it('emits nothing when a blur commits the same value again', async () => {
    const el = pick(mount('<pick-time value="09:30"></pick-time>'));
    let changes = 0;
    el.addEventListener('change', () => changes++);

    const field = part(el, '.field') as HTMLInputElement;
    field.focus();
    field.blur();
    await new Promise(r => setTimeout(r, 60));

    expect(changes).toBe(0);
  });
});

describe('late attribute changes take effect', () => {
  it('applies a placeholder set after connection', () => {
    const el = pick(mount('<pick-time></pick-time>'));
    el.setAttribute('placeholder', 'pick a time');
    expect((part(el, '.field') as HTMLInputElement).placeholder).toBe(
      'pick a time'
    );
  });

  it('applies a placement changed after the first open', async () => {
    const el = pick(
      mount(
        '<pick-time value="09:30" style="position:fixed;top:50vh"></pick-time>'
      )
    );
    const panel = part(el, '.picker');
    const settle = () => new Promise(r => setTimeout(r, 80));

    el.showPicker();
    await settle();
    const below = panel.getBoundingClientRect().top;
    el.hidePicker();
    await settle();

    el.setAttribute('placement', 'top');
    el.showPicker();
    await settle();
    expect(panel.getBoundingClientRect().top).toBeLessThan(below);
  });

  it('repositions immediately when placement changes while open', async () => {
    const el = pick(
      mount(
        '<pick-time value="09:30" placement="bottom" style="position:fixed;left:50vw;top:50vh;transform:translate(-50%,-50%)"></pick-time>'
      )
    );
    const arrow = part(el, '.arrow');
    el.showPicker();
    await new Promise(r => setTimeout(r, 80));
    expect(arrow.dataset.side).toBe('top');

    const svg = arrow.querySelector('svg:last-of-type');
    if (!svg) throw new Error('no arrow svg');

    for (const [placement, side] of [
      ['top', 'bottom'],
      ['left', 'right'],
      ['right', 'left'],
      ['bottom', 'top'],
    ] as const) {
      el.placement = placement;
      await new Promise(r => setTimeout(r, 80));
      expect(arrow.dataset.side).toBe(side);

      const panel = part(el, '.picker').getBoundingClientRect();
      const point = svg.getBoundingClientRect();
      if (side === 'top') {
        expect(point.bottom).toBeGreaterThan(panel.top + 0.5);
        expect(point.top).toBeLessThan(panel.top - 4);
      } else if (side === 'bottom') {
        expect(point.top).toBeLessThan(panel.bottom - 0.5);
        expect(point.bottom).toBeGreaterThan(panel.bottom + 3.5);
      } else if (side === 'right') {
        expect(point.left).toBeLessThan(panel.right - 0.5);
        expect(point.right).toBeGreaterThan(panel.right + 4);
      } else {
        expect(point.right).toBeGreaterThan(panel.left + 0.5);
        expect(point.left).toBeLessThan(panel.left - 4);
      }
    }
  });
});

describe('theme accents', () => {
  it('uses subtle, theme-specific accent border colours', () => {
    const light = pick(mount('<pick-time theme="light"></pick-time>'));
    const dark = pick(mount('<pick-time theme="dark"></pick-time>'));
    const lightStyle = getComputedStyle(light);
    const darkStyle = getComputedStyle(dark);
    expect(lightStyle.getPropertyValue('--pt-accent-color').trim()).toBe(
      '#9c766d'
    );
    expect(darkStyle.getPropertyValue('--pt-accent-color').trim()).toBe(
      '#c19b91'
    );
    expect(lightStyle.getPropertyValue('--pt-border-color')).not.toBe(
      darkStyle.getPropertyValue('--pt-border-color')
    );
  });
});

describe('internal events do not leak', () => {
  it('emits one input per committed edit, not one per keystroke', async () => {
    const el = pick(mount('<pick-time></pick-time>'));
    const field = part(el, '.field') as HTMLInputElement;
    const seen: string[] = [];
    el.addEventListener('input', () => seen.push('input'));

    field.focus();
    for (const text of ['9', '9:4', '9:45']) {
      field.value = text;
      field.dispatchEvent(
        new Event('input', { bubbles: true, composed: true })
      );
    }
    field.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 60));

    expect(el.value).toBe('09:45');
    // The inner input's native `input` is composed and would otherwise be
    // retargeted onto the host, indistinguishable from ours.
    expect(seen).toEqual(['input']);
  });
});
