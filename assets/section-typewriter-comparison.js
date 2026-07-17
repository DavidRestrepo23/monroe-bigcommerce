(() => {
  const elementName = 'typewriter-comparison-explorer';

  if (customElements.get(elementName)) return;

  class TypewriterComparisonExplorer extends HTMLElement {
    connectedCallback() {
      if (this.dataset.ready === 'true') return;
      this.dataset.ready = 'true';

      this.abortController = new AbortController();
      this.signal = this.abortController.signal;
      this.compareLimit = Math.max(2, Number.parseInt(this.dataset.compareLimit || '3', 10));
      this.cards = Array.from(this.querySelectorAll('[data-model-card]'));
      this.cardGrid = this.querySelector('[data-card-grid]');
      this.defaultOrder = new Map(this.cards.map((card, index) => [card.dataset.modelId, index]));
      this.selected = new Set();
      this.activeBrand = 'all';
      this.activePreset = '';
      this.lastDialogTrigger = null;

      this.searchInput = this.querySelector('[data-search]');
      this.paperFilter = this.querySelector('[data-paper-filter]');
      this.sortControl = this.querySelector('[data-sort]');
      this.featureFilters = Array.from(this.querySelectorAll('[data-feature-filter]'));
      this.brandButtons = Array.from(this.querySelectorAll('[data-brand]'));
      this.presetButtons = Array.from(this.querySelectorAll('[data-preset]'));
      this.compareCheckboxes = Array.from(this.querySelectorAll('[data-compare-checkbox]'));
      this.resultsStatus = this.querySelector('[data-results-status]');
      this.emptyState = this.querySelector('[data-empty-state]');
      this.compareBar = this.querySelector('[data-compare-bar]');
      this.selectedList = this.querySelector('[data-selected-list]');
      this.selectedCount = this.querySelector('[data-selected-count]');
      this.openComparisonButton = this.querySelector('[data-open-comparison]');
      this.dialog = this.querySelector('[data-comparison-dialog]');
      this.dialogColumns = this.querySelector('[data-dialog-columns]');
      this.differencesOnly = this.querySelector('[data-differences-only]');
      this.announcement = this.querySelector('[data-announcement]');
      this.filterToggle = this.querySelector('[data-filter-toggle]');
      this.filterPanel = this.querySelector('[data-filter-panel]');

      this.addEventListener('click', this.handleClick.bind(this), { signal: this.signal });
      this.addEventListener('change', this.handleChange.bind(this), { signal: this.signal });
      this.addEventListener('input', this.handleInput.bind(this), { signal: this.signal });
      this.addEventListener('submit', this.handleSubmit.bind(this), { signal: this.signal });
      this.addEventListener('keydown', this.handleKeydown.bind(this), { signal: this.signal });

      if (this.dialog) {
        this.dialog.addEventListener('close', this.handleDialogClose.bind(this), { signal: this.signal });
      }

      this.mobileQuery = window.matchMedia('(max-width: 760px)');
      this.syncMobileFilters(this.mobileQuery.matches);
      this.mobileQuery.addEventListener('change', this.handleViewportChange.bind(this), { signal: this.signal });

      this.applyFiltersAndSort();
      this.updateComparisonBar();
    }

    disconnectedCallback() {
      if (this.abortController) this.abortController.abort();
      if (this.dialog && this.dialog.open && typeof this.dialog.close === 'function') {
        this.dialog.close();
      }
      delete this.dataset.ready;
    }

    normalize(value) {
      return String(value || '').trim().toLowerCase();
    }

    announce(message) {
      if (!this.announcement) return;
      this.announcement.textContent = '';
      window.requestAnimationFrame(() => {
        this.announcement.textContent = message;
      });
    }

    handleViewportChange(event) {
      this.syncMobileFilters(event.matches);
    }

    syncMobileFilters(isMobile) {
      if (!this.filterToggle || !this.filterPanel) return;
      this.filterPanel.hidden = isMobile;
      this.filterToggle.setAttribute('aria-expanded', isMobile ? 'false' : 'true');
    }

    handleClick(event) {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;

      const resetButton = target.closest('[data-reset-filters]');
      if (resetButton && this.contains(resetButton)) {
        this.resetFilters();
        return;
      }

      const brandButton = target.closest('[data-brand]');
      if (brandButton && this.contains(brandButton)) {
        this.setBrand(brandButton.dataset.brand || 'all');
        return;
      }

      const presetButton = target.closest('[data-preset]');
      if (presetButton && this.contains(presetButton)) {
        this.setPreset(presetButton.dataset.preset || '');
        return;
      }

      const filterToggle = target.closest('[data-filter-toggle]');
      if (filterToggle && this.contains(filterToggle)) {
        const expanded = filterToggle.getAttribute('aria-expanded') === 'true';
        filterToggle.setAttribute('aria-expanded', String(!expanded));
        if (this.filterPanel) this.filterPanel.hidden = expanded;
        return;
      }

      const removeButton = target.closest('[data-remove-model]');
      if (removeButton && this.contains(removeButton)) {
        this.removeComparisonModel(removeButton.dataset.removeModel);
        return;
      }

      const clearButton = target.closest('[data-clear-comparison]');
      if (clearButton && this.contains(clearButton)) {
        this.clearComparison();
        return;
      }

      const openButton = target.closest('[data-open-comparison]');
      if (openButton && this.contains(openButton)) {
        this.openComparison(openButton);
        return;
      }

      const closeButton = target.closest('[data-dialog-close]');
      if (closeButton && this.contains(closeButton)) {
        this.closeComparison();
        return;
      }

      if (this.dialog && target === this.dialog) {
        this.closeComparison();
      }
    }

    handleChange(event) {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;

      if (target.matches('[data-feature-filter], [data-paper-filter], [data-sort]')) {
        this.applyFiltersAndSort();
        return;
      }

      if (target.matches('[data-compare-checkbox]')) {
        this.handleComparisonSelection(target);
        return;
      }

      if (target.matches('[data-differences-only]')) {
        this.applyDifferenceVisibility();
      }
    }

    handleInput(event) {
      const target = event.target instanceof Element ? event.target : null;
      if (target && target.matches('[data-search]')) this.applyFiltersAndSort();
    }

    handleKeydown(event) {
      if (event.key === 'Escape' && this.dialog && this.dialog.hasAttribute('open') && typeof this.dialog.close !== 'function') {
        event.preventDefault();
        this.closeComparison();
      }
    }

    async handleSubmit(event) {
      const form = event.target instanceof HTMLFormElement ? event.target : null;
      if (!form || !form.matches('[data-quick-add]')) return;

      event.preventDefault();
      const button = form.querySelector('[data-quick-add-button]');
      const status = form.querySelector('[data-quick-status]');
      const cartLink = form.querySelector('[data-cart-link]');
      const originalText = button ? button.textContent : '';

      if (button) {
        button.disabled = true;
        button.textContent = 'Adding…';
      }
      if (status) status.textContent = '';
      if (cartLink) cartLink.hidden = true;

      try {
        const shopRoot = window.Shopify && window.Shopify.routes && window.Shopify.routes.root
          ? window.Shopify.routes.root
          : '/';
        const response = await fetch(`${shopRoot}cart/add.js`, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: new FormData(form)
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.description || 'This item could not be added right now.');

        if (button) button.textContent = 'Added';
        if (status) status.textContent = 'Added to your cart.';
        if (cartLink) cartLink.hidden = false;
        this.dispatchEvent(new CustomEvent('twc:cart-added', { bubbles: true, detail: { item: data } }));
      } catch (error) {
        if (button) {
          button.disabled = false;
          button.textContent = originalText;
        }
        if (status) status.textContent = error.message || 'This item could not be added right now.';
      }
    }

    setBrand(brand) {
      this.activeBrand = brand;
      this.brandButtons.forEach((button) => {
        button.setAttribute('aria-pressed', String(button.dataset.brand === brand));
      });
      this.applyFiltersAndSort();
    }

    setPreset(preset) {
      this.activePreset = this.activePreset === preset ? '' : preset;
      this.presetButtons.forEach((button) => {
        button.setAttribute('aria-pressed', String(button.dataset.preset === this.activePreset));
      });
      this.applyFiltersAndSort();
    }

    resetFilters() {
      if (this.searchInput) this.searchInput.value = '';
      if (this.paperFilter) this.paperFilter.value = 'all';
      if (this.sortControl) this.sortControl.value = 'default';
      this.featureFilters.forEach((input) => { input.checked = false; });
      this.activePreset = '';
      this.presetButtons.forEach((button) => button.setAttribute('aria-pressed', 'false'));
      this.setBrand('all');
      this.announce('All filters have been reset.');
    }

    cardMatchesPreset(card) {
      const weight = Number.parseFloat(card.dataset.weight || '0');
      const paper = Number.parseFloat(card.dataset.paper || '0');

      switch (this.activePreset) {
        case 'lightweight':
          return weight > 0 && weight <= 12;
        case 'wide':
          return paper >= 16.5;
        case 'spell':
          return card.dataset.spell === 'true';
        case 'display':
          return card.dataset.display === 'true';
        default:
          return true;
      }
    }

    applyFiltersAndSort() {
      const searchValue = this.normalize(this.searchInput ? this.searchInput.value : '');
      const paperValue = this.paperFilter ? this.paperFilter.value : 'all';
      const requiredFeatures = this.featureFilters
        .filter((input) => input.checked)
        .map((input) => input.value);

      let visibleCount = 0;

      this.cards.forEach((card) => {
        const textMatch = !searchValue || this.normalize(card.dataset.search).includes(searchValue);
        const brandMatch = this.activeBrand === 'all' || card.dataset.brand === this.activeBrand;
        const paperMatch = paperValue === 'all'
          || Math.abs(Number.parseFloat(card.dataset.paper || '0') - Number.parseFloat(paperValue)) < 0.01;
        const featureMatch = requiredFeatures.every((feature) => card.dataset[feature] === 'true');
        const presetMatch = this.cardMatchesPreset(card);
        const visible = textMatch && brandMatch && paperMatch && featureMatch && presetMatch;

        card.hidden = !visible;
        if (visible) visibleCount += 1;
      });

      this.sortCards();

      if (this.resultsStatus) {
        this.resultsStatus.textContent = `${visibleCount} of ${this.cards.length} models shown`;
      }
      if (this.emptyState) this.emptyState.hidden = visibleCount !== 0;
    }

    sortCards() {
      if (!this.cardGrid) return;
      const sortValue = this.sortControl ? this.sortControl.value : 'default';
      const sorted = [...this.cards].sort((cardA, cardB) => {
        if (sortValue === 'title') {
          return this.normalize(cardA.dataset.title).localeCompare(this.normalize(cardB.dataset.title));
        }
        if (sortValue === 'price-asc') {
          return Number(cardA.dataset.price || 0) - Number(cardB.dataset.price || 0);
        }
        if (sortValue === 'weight-asc') {
          return Number.parseFloat(cardA.dataset.weight || '999') - Number.parseFloat(cardB.dataset.weight || '999');
        }
        if (sortValue === 'paper-desc') {
          return Number.parseFloat(cardB.dataset.paper || '0') - Number.parseFloat(cardA.dataset.paper || '0');
        }
        return (this.defaultOrder.get(cardA.dataset.modelId) || 0) - (this.defaultOrder.get(cardB.dataset.modelId) || 0);
      });

      sorted.forEach((card) => this.cardGrid.appendChild(card));
    }

    handleComparisonSelection(checkbox) {
      const modelId = checkbox.value;
      if (!modelId) return;

      if (checkbox.checked) {
        if (this.selected.size >= this.compareLimit) {
          checkbox.checked = false;
          this.announce(`You can compare up to ${this.compareLimit} models at a time.`);
          return;
        }
        this.selected.add(modelId);
      } else {
        this.selected.delete(modelId);
      }

      this.updateComparisonBar();
    }

    removeComparisonModel(modelId) {
      if (!modelId) return;
      this.selected.delete(modelId);
      const checkbox = this.compareCheckboxes.find((input) => input.value === modelId);
      if (checkbox) checkbox.checked = false;
      this.updateComparisonBar();
    }

    clearComparison() {
      this.selected.clear();
      this.compareCheckboxes.forEach((checkbox) => {
        checkbox.checked = false;
        checkbox.disabled = false;
      });
      this.updateComparisonBar();
      this.announce('Comparison selection cleared.');
    }

    getSelectedCards() {
      return Array.from(this.selected)
        .map((modelId) => this.cards.find((card) => card.dataset.modelId === modelId))
        .filter(Boolean);
    }

    updateComparisonBar() {
      const selectedCards = this.getSelectedCards();
      const atLimit = selectedCards.length >= this.compareLimit;

      if (this.compareBar) this.compareBar.hidden = selectedCards.length === 0;
      if (this.selectedCount) this.selectedCount.textContent = String(selectedCards.length);
      if (this.openComparisonButton) this.openComparisonButton.disabled = selectedCards.length < 2;

      this.compareCheckboxes.forEach((checkbox) => {
        checkbox.disabled = atLimit && !checkbox.checked;
      });

      if (this.selectedList) {
        this.selectedList.replaceChildren();
        selectedCards.forEach((card) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.dataset.removeModel = card.dataset.modelId;
          button.textContent = card.dataset.title || 'Selected model';
          button.setAttribute('aria-label', `Remove ${button.textContent} from comparison`);
          this.selectedList.appendChild(button);
        });
      }

      this.announce(`${selectedCards.length} model${selectedCards.length === 1 ? '' : 's'} selected for comparison.`);
    }

    openComparison(trigger) {
      const selectedCards = this.getSelectedCards();
      if (!this.dialog || !this.dialogColumns || selectedCards.length < 2) return;

      this.renderComparison(selectedCards);
      this.lastDialogTrigger = trigger || document.activeElement;

      if (typeof this.dialog.showModal === 'function') {
        if (!this.dialog.open) this.dialog.showModal();
      } else {
        this.dialog.setAttribute('open', '');
      }

      const closeButton = this.dialog.querySelector('[data-dialog-close]');
      if (closeButton) window.requestAnimationFrame(() => closeButton.focus());
    }

    closeComparison() {
      if (!this.dialog) return;
      if (typeof this.dialog.close === 'function' && this.dialog.open) {
        this.dialog.close();
      } else {
        this.dialog.removeAttribute('open');
        this.handleDialogClose();
      }
    }

    handleDialogClose() {
      const trigger = this.lastDialogTrigger;
      this.lastDialogTrigger = null;
      if (trigger && typeof trigger.focus === 'function') {
        window.requestAnimationFrame(() => trigger.focus());
      }
    }

    renderComparison(selectedCards) {
      this.dialogColumns.replaceChildren();
      this.dialogColumns.style.setProperty('--twc-columns', String(selectedCards.length));

      const columns = selectedCards.map((card) => {
        const template = card.querySelector('[data-compare-template]');
        if (!template) return null;
        const fragment = template.content.cloneNode(true);
        const column = fragment.querySelector('[data-dialog-column]');
        this.dialogColumns.appendChild(fragment);
        return column;
      }).filter(Boolean);

      const firstColumn = columns[0];
      if (!firstColumn) return;

      const specKeys = Array.from(firstColumn.querySelectorAll('[data-spec]'))
        .map((row) => row.dataset.spec)
        .filter(Boolean);

      specKeys.forEach((key) => {
        const rows = columns.map((column) => column.querySelector(`[data-spec="${key}"]`)).filter(Boolean);
        const values = new Set(rows.map((row) => this.normalize(row.querySelector('dd')?.textContent)));
        const isDifferent = values.size > 1;
        rows.forEach((row) => {
          row.dataset.different = String(isDifferent);
          row.dataset.same = String(!isDifferent);
        });
      });

      if (this.differencesOnly) this.differencesOnly.checked = false;
      this.applyDifferenceVisibility();
    }

    applyDifferenceVisibility() {
      if (!this.dialogColumns) return;
      const differencesOnly = Boolean(this.differencesOnly && this.differencesOnly.checked);
      this.dialogColumns.querySelectorAll('[data-spec]').forEach((row) => {
        row.hidden = differencesOnly && row.dataset.same === 'true';
      });
    }
  }

  customElements.define(elementName, TypewriterComparisonExplorer);
})();