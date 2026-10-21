import { useEffect, useRef } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Open dialogs, innermost last — only the top one reacts to Esc/Tab so a
// dialog stacked on another doesn't close both.
const stack: symbol[] = [];

/**
 * Keyboard/focus handling for dialogs: Esc closes, focus moves into the dialog
 * on open, Tab stays inside it, and focus returns to the previously focused
 * element on close. Attach the returned ref to the dialog element.
 * `active` is for components that stay mounted while closed.
 */
export function useModalA11y<T extends HTMLElement = HTMLDivElement>(onClose: () => void, active = true) {
  const ref = useRef<T>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!active) return;
    const dialog = ref.current;
    if (!dialog) return;

    const id = Symbol('modal');
    stack.push(id);
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusables = () =>
      Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);

    // Focus the first control; fall back to the dialog itself so Esc/Tab work.
    if (!dialog.hasAttribute('tabindex')) dialog.setAttribute('tabindex', '-1');
    (focusables()[0] ?? dialog).focus({ preventScroll: true });

    function onKeyDown(e: KeyboardEvent) {
      if (stack[stack.length - 1] !== id) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) { e.preventDefault(); dialog!.focus(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;
      if (e.shiftKey && (current === first || current === dialog || !dialog!.contains(current))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (current === last || !dialog!.contains(current))) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      const i = stack.indexOf(id);
      if (i >= 0) stack.splice(i, 1);
      if (previouslyFocused && document.contains(previouslyFocused)) previouslyFocused.focus({ preventScroll: true });
    };
  }, [active]);

  return ref;
}
