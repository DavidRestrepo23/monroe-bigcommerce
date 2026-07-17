(() => {
  const elementName = 'typewriter-manual-library';

  if (customElements.get(elementName)) return;

  class TypewriterManualLibrary extends HTMLElement {
    connectedCallback() {
      if (this.controller) return;

      this.controller = new AbortController();
      this.signal = this.controller.signal;
      this.searchInput = this.querySelector('[data-manual-search]');
      this.clearButton = this.querySelector('[data-clear-search]');
      this.brandButtons = Array.from(this.querySelectorAll('[data-brand]'));
      this.sortSelect = this.querySelector('[data-manual-sort]');
      this.grid = this.querySelector('[data-manual-grid]');
      this.cards = Array.from(this.querySelectorAll('[data-manual-card]'));
      this.status = this.querySelector('[data-manual-status]');
      this.emptyState = this.querySelector('[data-manual-empty]');
      this.resetButton = this.querySelector('[data-reset-manuals]');
      this.activeBrand = this.dataset.defaultBrand || 'all';
      this.collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

      if (!this.grid || !this.cards.length) return;

      this.bindEvents();
      this.applyState();
    }

    disconnectedCallback() {
      if (this.controller) this.controller.abort();
      this.controller = null;
    }

    bindEvents() {
      if (this.searchInput) {
        this.searchInput.addEventListener('input', () => this.applyState(), { signal: this.signal });
        this.searchInput.addEventListener('keydown', (event) => {
          if (event.key !== 'Escape' || !this.searchInput.value) return;
          this.searchInput.value = '';
          this.applyState();
        }, { signal: this.signal });
      }

      if (this.clearButton) {
        this.clearButton.addEventListener('click', () => {
          if (this.searchInput) {
            this.searchInput.value = '';
            this.searchInput.focus();
          }
          this.applyState();
        }, { signal: this.signal });
      }

      this.brandButtons.forEach((button) => {
        button.addEventListener('click', () => {
          this.activeBrand = button.dataset.brand || 'all';
          this.brandButtons.forEach((candidate) => {
            candidate.setAttribute('aria-pressed', String(candidate === button));
          });
          this.applyState();
        }, { signal: this.signal });
      });

      if (this.sortSelect) {
        this.sortSelect.addEventListener('change', () => this.applyState(), { signal: this.signal });
      }

      if (this.resetButton) {
        this.resetButton.addEventListener('click', () => {
          if (this.searchInput) this.searchInput.value = '';
          this.activeBrand = 'all';
          this.brandButtons.forEach((button) => {
            button.setAttribute('aria-pressed', String(button.dataset.brand === 'all'));
          });
          if (this.sortSelect) this.sortSelect.value = 'featured';
          this.applyState();
          if (this.searchInput) this.searchInput.focus();
        }, { signal: this.signal });
      }
    }

    normalize(value) {
      return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
    }

    applyState() {
      const query = this.normalize(this.searchInput ? this.searchInput.value : '');
      const queryTokens = query ? query.split(' ') : [];
      let visibleCount = 0;

      this.cards.forEach((card) => {
        const searchable = this.normalize(card.dataset.search);
        const matchesSearch = queryTokens.every((token) => searchable.includes(token));
        const matchesBrand = this.activeBrand === 'all' || card.dataset.brand === this.activeBrand;
        const visible = matchesSearch && matchesBrand;

        card.hidden = !visible;
        if (visible) visibleCount += 1;
      });

      this.sortCards();

      if (this.clearButton) this.clearButton.hidden = !query;
      if (this.emptyState) this.emptyState.hidden = visibleCount !== 0;

      if (this.status) {
        const noun = visibleCount === 1 ? 'manual' : 'manuals';
        this.status.textContent = `${visibleCount} ${noun} shown`;
      }
    }

    sortCards() {
      if (!this.grid) return;

      const mode = this.sortSelect ? this.sortSelect.value : 'featured';
      const sorted = [...this.cards].sort((a, b) => {
        if (mode === 'brand') {
          const brandResult = this.collator.compare(a.dataset.brand || '', b.dataset.brand || '');
          return brandResult || this.collator.compare(a.dataset.model || '', b.dataset.model || '');
        }

        if (mode === 'model') {
          return this.collator.compare(a.dataset.model || '', b.dataset.model || '');
        }

        return Number(a.dataset.order || 0) - Number(b.dataset.order || 0);
      });

      sorted.forEach((card) => this.grid.append(card));
    }
  }

  customElements.define(elementName, TypewriterManualLibrary);
})();