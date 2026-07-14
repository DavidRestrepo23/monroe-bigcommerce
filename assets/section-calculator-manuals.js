(() => {
  const SELECTORS = {
    root: '[data-calculator-manuals]',
    card: '[data-manual-card]',
    group: '[data-manual-group]',
    search: '[data-manual-search]',
    clearSearch: '[data-manual-clear-search]',
    filter: '[data-manual-filter]',
    resultCount: '[data-manual-results-count]',
    empty: '[data-manual-empty]',
    reset: '[data-manual-reset]'
  };

  class CalculatorManuals {
    constructor(root) {
      if (!root || root.dataset.manualsInitialized === 'true') return;

      this.root = root;
      this.cards = Array.from(root.querySelectorAll(SELECTORS.card));
      this.groups = Array.from(root.querySelectorAll(SELECTORS.group));
      this.searchInput = root.querySelector(SELECTORS.search);
      this.clearSearchButton = root.querySelector(SELECTORS.clearSearch);
      this.filterButtons = Array.from(root.querySelectorAll(SELECTORS.filter));
      this.resultCount = root.querySelector(SELECTORS.resultCount);
      this.emptyState = root.querySelector(SELECTORS.empty);
      this.resetButton = root.querySelector(SELECTORS.reset);
      this.activeFilter = 'all';

      this.bindEvents();
      this.applyHashFilter(false);
      this.updateResults();
      root.dataset.manualsInitialized = 'true';
    }

    bindEvents() {
      this.searchInput?.addEventListener('input', () => this.updateResults());

      this.searchInput?.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && this.searchInput.value) {
          this.clearSearch(true);
        }
      });

      this.clearSearchButton?.addEventListener('click', () => this.clearSearch(true));

      this.filterButtons.forEach((button) => {
        button.addEventListener('click', () => {
          this.setFilter(button.dataset.manualFilter || 'all');
        });
      });

      this.resetButton?.addEventListener('click', () => {
        this.activeFilter = 'all';
        if (this.searchInput) this.searchInput.value = '';
        this.syncFilterButtons();
        this.updateResults();
        this.searchInput?.focus();
      });

      window.addEventListener('hashchange', () => this.applyHashFilter(true));
    }

    normalize(value) {
      return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '');
    }

    setFilter(filter) {
      this.activeFilter = ['current', 'previous'].includes(filter) ? filter : 'all';
      this.syncFilterButtons();
      this.updateResults();
    }

    syncFilterButtons() {
      this.filterButtons.forEach((button) => {
        const isActive = button.dataset.manualFilter === this.activeFilter;
        button.setAttribute('aria-pressed', String(isActive));
      });
    }

    clearSearch(returnFocus = false) {
      if (!this.searchInput) return;
      this.searchInput.value = '';
      this.updateResults();
      if (returnFocus) this.searchInput.focus();
    }

    updateResults() {
      const query = this.normalize(this.searchInput?.value);
      let visibleCount = 0;

      this.cards.forEach((card) => {
        const matchesStatus =
          this.activeFilter === 'all' ||
          card.dataset.manualStatus === this.activeFilter;

        const searchableValue = this.normalize(card.dataset.manualSearchValue);
        const matchesSearch = !query || searchableValue.includes(query);
        const shouldShow = matchesStatus && matchesSearch;

        card.hidden = !shouldShow;
        if (shouldShow) visibleCount += 1;
      });

      this.groups.forEach((group) => {
        const hasVisibleCards = Boolean(
          group.querySelector(`${SELECTORS.card}:not([hidden])`)
        );
        group.hidden = !hasVisibleCards;
      });

      if (this.resultCount) {
        const noun = visibleCount === 1 ? 'manual' : 'manuals';
        this.resultCount.textContent = `${visibleCount} ${noun} shown`;
      }

      if (this.emptyState) this.emptyState.hidden = visibleCount !== 0;

      if (this.clearSearchButton) {
        this.clearSearchButton.hidden = !(this.searchInput?.value.length > 0);
      }
    }

    applyHashFilter(shouldScroll) {
      const hash = decodeURIComponent(window.location.hash.replace(/^#/, ''));
      if (!hash) return;

      const target = document.getElementById(hash);

      if (
        !target ||
        !this.root.contains(target) ||
        !target.matches(SELECTORS.card)
      ) {
        return;
      }

      this.activeFilter = target.dataset.manualStatus || 'all';
      if (this.searchInput) this.searchInput.value = '';
      this.syncFilterButtons();
      this.updateResults();

      if (shouldScroll) {
        window.requestAnimationFrame(() => {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
    }
  }

  const initialize = (scope = document) => {
    scope.querySelectorAll(SELECTORS.root).forEach((root) => {
      new CalculatorManuals(root);
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initialize());
  } else {
    initialize();
  }

  document.addEventListener('shopify:section:load', (event) => {
    initialize(event.target);
  });
})();