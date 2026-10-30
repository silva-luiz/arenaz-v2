import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

/*
 * jsdom does not implement HTMLDialogElement.showModal()/close() (both are
 * undefined). These minimal stand-ins cover what Lightbox relies on: showModal
 * opens the dialog (sets `open`), close() closes it and fires the `close`
 * event. They deliberately do not emulate the top layer, focus trapping, the
 * inert background or Esc handling; the component handles Esc itself and the
 * rest is the browser's job.
 */
if (typeof HTMLDialogElement.prototype.showModal !== 'function') {
  HTMLDialogElement.prototype.showModal = function showModal(
    this: HTMLDialogElement,
  ) {
    this.setAttribute('open', '');
  };
}
if (typeof HTMLDialogElement.prototype.close !== 'function') {
  HTMLDialogElement.prototype.close = function close(
    this: HTMLDialogElement,
    returnValue?: string,
  ) {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    if (returnValue !== undefined) this.returnValue = returnValue;
    this.dispatchEvent(new Event('close'));
  };
}

afterEach(() => {
  cleanup();
});
