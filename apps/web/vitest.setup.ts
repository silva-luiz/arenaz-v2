import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// `server-only` throws outside React's server condition; it is a build-time guard.
vi.mock('server-only', () => ({}));

/*
 * jsdom does not implement HTMLDialogElement.showModal()/close(). Minimal
 * stand-ins (same as packages/ui): showModal sets `open`, close() clears it and
 * fires `close`. No top layer, focus trap or Esc: the components handle Esc
 * themselves and the rest is the browser's job.
 */
if (typeof HTMLDialogElement.prototype.showModal !== 'function') {
  HTMLDialogElement.prototype.showModal = function showModal(
    this: HTMLDialogElement,
  ) {
    this.setAttribute('open', '');
  };
}
if (typeof HTMLDialogElement.prototype.close !== 'function') {
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
}

afterEach(() => {
  cleanup();
});
