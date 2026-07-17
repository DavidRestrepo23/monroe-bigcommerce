(() => {
  const elementName = 'typewriter-reconditioning-process';

  if (customElements.get(elementName)) return;

  class TypewriterReconditioningProcess extends HTMLElement {
    connectedCallback() {
      this.abortController?.abort();
      this.abortController = new AbortController();
      this.lastDialogTrigger = null;
      this.bindControls();
      this.applyPhase(this.dataset.defaultPhase || 'all');
    }

    disconnectedCallback() {
      this.abortController?.abort();
    }

    bindControls() {
      const signal = this.abortController.signal;

      this.querySelectorAll('[data-phase-filter]').forEach((button) => {
        button.addEventListener('click', () => {
          this.applyPhase(button.dataset.phaseFilter || 'all');
        }, { signal });
      });

      this.querySelector('[data-expand-all]')?.addEventListener('click', () => {
        this.visibleSteps().forEach((step) => {
          const details = step.querySelector('details');
          if (details) details.open = true;
        });
      }, { signal });

      this.querySelector('[data-collapse-all]')?.addEventListener('click', () => {
        this.visibleSteps().forEach((step) => {
          const details = step.querySelector('details');
          if (details) details.open = false;
        });
      }, { signal });

      const dialog = this.querySelector('[data-review-dialog]');
      const openButton = this.querySelector('[data-review-open]');
      const closeButton = this.querySelector('[data-review-close]');

      openButton?.addEventListener('click', () => this.openDialog(dialog, openButton), { signal });
      closeButton?.addEventListener('click', () => this.closeDialog(dialog), { signal });

      dialog?.addEventListener('cancel', (event) => {
        event.preventDefault();
        this.closeDialog(dialog);
      }, { signal });

      dialog?.addEventListener('click', (event) => {
        if (event.target === dialog) this.closeDialog(dialog);
      }, { signal });

      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && dialog?.hasAttribute('open')) {
          event.preventDefault();
          this.closeDialog(dialog);
        }
      }, { signal });
    }

    visibleSteps() {
      return Array.from(this.querySelectorAll('[data-step]:not([hidden])'));
    }

    applyPhase(phase) {
      const buttons = this.querySelectorAll('[data-phase-filter]');
      const steps = this.querySelectorAll('[data-step]');
      let visibleCount = 0;

      buttons.forEach((button) => {
        const isActive = button.dataset.phaseFilter === phase;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
      });

      steps.forEach((step) => {
        const isVisible = phase === 'all' || step.dataset.phase === phase;
        step.hidden = !isVisible;
        if (isVisible) visibleCount += 1;
      });

      const count = this.querySelector('[data-visible-count]');
      if (count) count.textContent = String(visibleCount);
    }

    openDialog(dialog, trigger) {
      if (!dialog) return;
      this.lastDialogTrigger = trigger || document.activeElement;

      if (typeof dialog.showModal === 'function') {
        if (!dialog.open) dialog.showModal();
      } else {
        dialog.setAttribute('open', '');
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
      }

      requestAnimationFrame(() => {
        dialog.querySelector('[data-review-close]')?.focus();
      });
    }

    closeDialog(dialog) {
      if (!dialog || !dialog.hasAttribute('open')) return;

      if (typeof dialog.close === 'function') {
        dialog.close();
      } else {
        dialog.removeAttribute('open');
      }

      if (this.lastDialogTrigger instanceof HTMLElement && this.lastDialogTrigger.isConnected) {
        this.lastDialogTrigger.focus();
      }
    }
  }

  customElements.define(elementName, TypewriterReconditioningProcess);
})();