/**
 * Floating UI wiring, isolated so the rest of the component never touches it.
 *
 * The v2 bug this fixes: `autoUpdate` was called on every focus and its
 * cleanup return value was discarded, so each open leaked another scroll and
 * resize loop. Here exactly one loop can exist at a time and `stop()` always
 * disposes it.
 */

import {
  arrow as arrowMiddleware,
  autoUpdate,
  computePosition,
  flip,
  offset,
  shift,
} from '@floating-ui/dom';

export type Placement = 'top' | 'bottom' | 'left' | 'right';

export interface PositionerOptions {
  placement?: Placement | undefined;
  mainAxis?: number | undefined;
  crossAxis?: number | undefined;
  arrow?: HTMLElement | null | undefined;
}

export interface Positioner {
  start(): void;
  stop(): void;
}

const OPPOSITE = {
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left',
} as const;

export const createPositioner = (
  anchor: HTMLElement,
  floating: HTMLElement,
  options: PositionerOptions = {}
): Positioner => {
  const {
    placement = 'bottom',
    mainAxis = 6,
    crossAxis = 0,
    arrow = null,
  } = options;

  let dispose: (() => void) | null = null;

  const update = async (): Promise<void> => {
    const {
      x,
      y,
      placement: used,
      middlewareData,
    } = await computePosition(anchor, floating, {
      placement: `${placement}-start`,
      strategy: 'absolute',
      middleware: [
        offset({ mainAxis, crossAxis }),
        flip(),
        shift({ padding: 8 }),
        ...(arrow ? [arrowMiddleware({ element: arrow, padding: 8 })] : []),
      ],
    });

    floating.style.left = `${x}px`;
    floating.style.top = `${y}px`;

    if (!arrow) return;

    const side = used.split('-')[0] as Placement;
    const staticSide = OPPOSITE[side];
    const { x: arrowX, y: arrowY } = middlewareData.arrow ?? {};

    arrow.style.left = arrowX == null ? '' : `${arrowX}px`;
    arrow.style.top = arrowY == null ? '' : `${arrowY}px`;
    arrow.style.right = '';
    arrow.style.bottom = '';
    // Keep the fill one physical pixel inside the panel. That overlap masks
    // the panel border beneath the arrow instead of leaving a visible seam.
    // The reversed vertical arrow needs one more pixel because its SVG base
    // lands on the opposite edge of the square positioning box.
    arrow.style[staticSide] = staticSide === 'bottom' ? '-10px' : '-11px';
    arrow.dataset.side = staticSide;
  };

  return {
    start() {
      if (dispose) return; // Idempotent: re-opening must not stack loops.
      dispose = autoUpdate(anchor, floating, () => {
        void update();
      });
    },
    stop() {
      dispose?.();
      dispose = null;
    },
  };
};
