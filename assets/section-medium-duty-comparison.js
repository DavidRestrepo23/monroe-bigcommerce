(() => {
  const SELECTOR = '[data-md-comparison]';

  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const isAvailabilityValue = (value) => ['Standard', 'Not available', 'Not standard'].includes(value);

  const renderValue = (value) => {
    if (!isAvailabilityValue(value)) return escapeHtml(value);
    const available = value === 'Standard';
    const label = available ? '✓ Included' : (value === 'Not standard' ? '— Not standard' : '— Not included');
    return `<span class="mdc__value-pill mdc__value-pill--${available ? 'yes' : 'no'}">${label}</span>`;
  };

  class MediumDutyComparison {
    constructor(root) {
      this.root = root;
      this.dataNode = root.querySelector('[data-mdc-data]');
      this.modelGrid = root.querySelector('[data-mdc-model-grid]');
      this.table = root.querySelector('[data-mdc-table]');
      this.tray = root.querySelector('[data-mdc-tray]');
      this.selectedChips = root.querySelector('[data-mdc-selected-chips]');
      this.selectionCount = root.querySelector('[data-mdc-selection-count]');
      this.openCompareButton = root.querySelector('[data-mdc-open-compare]');
      this.clearButton = root.querySelector('[data-mdc-clear]');
      this.modal = root.querySelector('[data-mdc-modal]');
      this.modalBody = root.querySelector('[data-mdc-modal-body]');
      this.differencesToggle = root.querySelector('[data-mdc-differences]');
      this.searchInput = root.querySelector('[data-mdc-search]');
      this.tableStatus = root.querySelector('[data-mdc-table-status]');
      this.toast = root.querySelector('[data-mdc-toast]');
      this.toastTimer = null;
      this.recommendation = root.querySelector('[data-mdc-recommendation]');
      this.resetPriorityButton = root.querySelector('[data-mdc-reset-priority]');
      this.selected = [];
      this.activeSection = 'all';
      this.activePriority = '';
      this.searchQuery = '';
      this.lastFocusedElement = null;

      if (!this.dataNode || !this.modelGrid || !this.table) return;

      try {
        this.data = JSON.parse(this.dataNode.textContent);
      } catch (error) {
        console.error('Medium-duty comparison data could not be parsed.', error);
        return;
      }

      this.renderModels();
      this.renderTable();
      this.bindEvents();
      this.updateSelectionUI();
      this.updateTableVisibility();
    }

    bindEvents() {
      this.root.addEventListener('click', (event) => {
        const selectButton = event.target.closest('[data-mdc-select-model]');
        if (selectButton) {
          event.preventDefault();
          this.toggleModel(selectButton.dataset.mdcSelectModel);
          return;
        }

        const removeButton = event.target.closest('[data-mdc-remove-model]');
        if (removeButton) {
          this.removeModel(removeButton.dataset.mdcRemoveModel);
          return;
        }

        const priorityButton = event.target.closest('[data-priority]');
        if (priorityButton) {
          this.applyPriority(priorityButton.dataset.priority);
          return;
        }

        const sectionButton = event.target.closest('[data-section-filter]');
        if (sectionButton) {
          this.setSection(sectionButton.dataset.sectionFilter);
          return;
        }

        if (event.target.closest('[data-mdc-open-compare]')) {
          this.openModal();
          return;
        }

        if (event.target.closest('[data-mdc-clear]')) {
          this.selected = [];
          this.updateSelectionUI();
          return;
        }

        if (event.target.closest('[data-mdc-reset-priority]')) {
          this.resetPriority();
          return;
        }

        if (event.target.closest('[data-mdc-close-modal]')) {
          this.closeModal();
          return;
        }

        if (event.target.closest('[data-mdc-print]')) {
          window.print();
        }
      });

      this.differencesToggle?.addEventListener('change', () => this.updateTableVisibility());
      this.searchInput?.addEventListener('input', () => {
        this.searchQuery = this.searchInput.value.trim().toLowerCase();
        this.updateTableVisibility();
      });

      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && this.modal && !this.modal.hidden) this.closeModal();
      });

      document.addEventListener('shopify:section:load', (event) => {
        if (event.target === this.root || event.target.contains(this.root)) this.updateSelectionUI();
      });
    }

    renderModels() {
      this.modelGrid.innerHTML = this.data.models.map((model) => `
        <article class="mdc__model-card" data-model-card="${escapeHtml(model.id)}">
          <a class="mdc__model-media" href="${escapeHtml(model.url)}" target="_blank" rel="noopener">
            <img src="${escapeHtml(model.image)}" alt="${escapeHtml(model.alt)}" width="260" height="260" loading="lazy" decoding="async">
          </a>
          <div class="mdc__model-body">
            <p class="mdc__model-eyebrow">${escapeHtml(model.eyebrow)}</p>
            <h4 class="mdc__model-title">${escapeHtml(model.name)}</h4>
            <p class="mdc__model-description">${escapeHtml(model.bestFor)}</p>
            <ul class="mdc__badges" role="list">
              ${model.badges.map((badge) => `<li class="mdc__badge">${escapeHtml(badge)}</li>`).join('')}
            </ul>
            <div class="mdc__model-actions">
              <button type="button" class="mdc__select-button" data-mdc-select-model="${escapeHtml(model.id)}" aria-pressed="false">Add to compare</button>
              <a class="mdc__product-link" href="${escapeHtml(model.url)}" target="_blank" rel="noopener">View model</a>
            </div>
          </div>
        </article>
      `).join('');
    }

    renderTable() {
      const head = `
        <thead>
          <tr>
            <th scope="col">Feature or specification</th>
            ${this.data.models.map((model) => `
              <th scope="col" data-table-model="${escapeHtml(model.id)}">
                <div class="mdc__table-model">
                  <img src="${escapeHtml(model.image)}" alt="" width="100" height="100" loading="lazy">
                  <a href="${escapeHtml(model.url)}" target="_blank" rel="noopener">${escapeHtml(model.shortName)}</a>
                  <button type="button" class="mdc__select-button" data-mdc-select-model="${escapeHtml(model.id)}" aria-pressed="false">Compare</button>
                </div>
              </th>
            `).join('')}
          </tr>
        </thead>`;

      const body = this.data.sections.map((section) => `
        <tbody data-table-section="${escapeHtml(section.id)}">
          <tr class="mdc__table-section">
            <th colspan="${this.data.models.length + 1}" scope="rowgroup">${escapeHtml(section.label)}</th>
          </tr>
          ${section.rows.map((row) => `
            <tr data-row-key="${escapeHtml(row.key)}">
              <th scope="row">
                <span class="mdc__row-label">
                  <span>${escapeHtml(row.label)}</span>
                  <span class="mdc__help" title="${escapeHtml(row.help)}" aria-label="${escapeHtml(row.help)}">?</span>
                </span>
              </th>
              ${this.data.models.map((model) => `<td data-cell-model="${escapeHtml(model.id)}">${renderValue(model.values[row.key])}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      `).join('');

      this.table.innerHTML = head + body;
    }

    toggleModel(modelId) {
      if (this.selected.includes(modelId)) {
        this.removeModel(modelId);
        return;
      }

      if (this.selected.length >= 2) {
        this.announce('You can compare up to two models. Remove one before adding another.');
        return;
      }

      this.selected.push(modelId);
      this.updateSelectionUI();
    }

    removeModel(modelId) {
      this.selected = this.selected.filter((id) => id !== modelId);
      this.updateSelectionUI();
    }

    updateSelectionUI() {
      const selectedModels = this.data.models.filter((model) => this.selected.includes(model.id));

      this.root.querySelectorAll('[data-mdc-select-model]').forEach((button) => {
        const selected = this.selected.includes(button.dataset.mdcSelectModel);
        button.classList.toggle('is-selected', selected);
        button.setAttribute('aria-pressed', selected ? 'true' : 'false');
        button.textContent = selected ? 'Selected ✓' : (button.closest('.mdc__table-model') ? 'Compare' : 'Add to compare');
      });

      this.root.querySelectorAll('[data-model-card]').forEach((card) => {
        card.classList.toggle('is-selected', this.selected.includes(card.dataset.modelCard));
      });

      this.root.querySelectorAll('[data-table-model], [data-cell-model]').forEach((cell) => {
        const modelId = cell.dataset.tableModel || cell.dataset.cellModel;
        cell.classList.toggle('is-selected', this.selected.includes(modelId));
      });

      if (this.selectionCount) this.selectionCount.textContent = `${this.selected.length} of 2 selected`;
      if (this.tray) this.tray.hidden = this.selected.length === 0;
      if (this.openCompareButton) this.openCompareButton.disabled = this.selected.length !== 2;

      if (this.selectedChips) {
        this.selectedChips.innerHTML = selectedModels.map((model) => `
          <span class="mdc__compare-chip">
            ${escapeHtml(model.shortName)}
            <button type="button" data-mdc-remove-model="${escapeHtml(model.id)}" aria-label="Remove ${escapeHtml(model.name)}">×</button>
          </span>
        `).join('');
      }

      this.updateTableVisibility();
    }

    applyPriority(priority) {
      this.activePriority = priority;
      const matches = this.data.models.filter((model) => model.priorityTags.includes(priority));

      this.root.querySelectorAll('[data-priority]').forEach((button) => {
        button.classList.toggle('is-active', button.dataset.priority === priority);
      });

      this.root.querySelectorAll('[data-model-card]').forEach((card) => {
        card.classList.toggle('is-recommended', matches.some((model) => model.id === card.dataset.modelCard));
      });

      if (this.resetPriorityButton) this.resetPriorityButton.hidden = false;

      if (this.recommendation) {
        const modelNames = matches.map((model) => model.name).join(matches.length > 1 ? ' and ' : '');
        this.recommendation.innerHTML = `
          <p class="mdc__recommendation-title">${escapeHtml(modelNames)} ${matches.length > 1 ? 'match' : 'matches'} this priority.</p>
          <p>${matches.length > 1 ? 'Both models include' : 'This model includes'} the selected capability. Review the cards below or add models to your comparison.</p>
          <div class="mdc__recommendation-links">
            ${matches.map((model) => `<a href="#" data-mdc-select-model="${escapeHtml(model.id)}">Add ${escapeHtml(model.shortName)} to compare</a>`).join('')}
          </div>
        `;
        this.recommendation.hidden = false;
      }

      const modelsSection = this.root.querySelector('.mdc__models-section');
      modelsSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    resetPriority() {
      this.activePriority = '';
      this.searchQuery = '';
      this.root.querySelectorAll('[data-priority]').forEach((button) => button.classList.remove('is-active'));
      this.root.querySelectorAll('[data-model-card]').forEach((card) => card.classList.remove('is-recommended'));
      if (this.recommendation) this.recommendation.hidden = true;
      if (this.resetPriorityButton) this.resetPriorityButton.hidden = true;
    }

    setSection(sectionId) {
      this.activeSection = sectionId;
      this.root.querySelectorAll('[data-section-filter]').forEach((button) => {
        const active = button.dataset.sectionFilter === sectionId;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      this.updateTableVisibility();
    }

    updateTableVisibility() {
      const showDifferences = Boolean(this.differencesToggle?.checked);
      let visibleRows = 0;

      this.data.sections.forEach((section) => {
        const tbody = this.table.querySelector(`[data-table-section="${section.id}"]`);
        if (!tbody) return;

        const sectionMatches = this.activeSection === 'all' || this.activeSection === section.id;
        let sectionVisibleRows = 0;

        tbody.querySelectorAll('[data-row-key]').forEach((row) => {
          const key = row.dataset.rowKey;
          const rowDefinition = section.rows.find((item) => item.key === key);
          const differenceModels = this.selected.length === 2
            ? this.data.models.filter((model) => this.selected.includes(model.id))
            : this.data.models;
          const values = differenceModels.map((model) => model.values[key]);
          const isDifferent = new Set(values).size > 1;
          const searchableText = [
            rowDefinition?.label,
            rowDefinition?.help,
            ...this.data.models.map((model) => model.values[key])
          ].join(' ').toLowerCase();
          const matchesSearch = !this.searchQuery || searchableText.includes(this.searchQuery);
          const visible = sectionMatches && matchesSearch && (!showDifferences || isDifferent);
          row.hidden = !visible;
          if (visible) {
            visibleRows += 1;
            sectionVisibleRows += 1;
          }
        });

        tbody.querySelector('.mdc__table-section').hidden = !sectionMatches || sectionVisibleRows === 0;
      });

      if (this.tableStatus) {
        const mode = showDifferences ? 'different rows' : 'rows';
        const comparisonScope = showDifferences && this.selected.length === 2 ? ' between your selected models' : '';
        const searchScope = this.searchQuery ? ` matching “${this.searchInput.value.trim()}”` : '';
        this.tableStatus.textContent = `Showing ${visibleRows} ${mode}${comparisonScope}${searchScope}.`;
      }
    }

    openModal() {
      if (!this.modal || this.selected.length !== 2) return;
      this.lastFocusedElement = document.activeElement;
      this.renderModal();
      this.modal.hidden = false;
      document.body.classList.add('mdc-modal-open');
      this.modal.querySelector('[data-mdc-close-modal]')?.focus();
    }

    renderModal() {
      const models = this.selected.map((id) => this.data.models.find((model) => model.id === id)).filter(Boolean);
      if (models.length !== 2 || !this.modalBody) return;

      this.modalBody.innerHTML = `
        <div class="mdc__modal-models">
          ${models.map((model) => `
            <article class="mdc__modal-model">
              <div class="mdc__modal-model-head">
                <img src="${escapeHtml(model.image)}" alt="${escapeHtml(model.alt)}" width="100" height="100">
                <div>
                  <h4>${escapeHtml(model.name)}</h4>
                  <a href="${escapeHtml(model.url)}" target="_blank" rel="noopener">View product →</a>
                </div>
              </div>
              <dl class="mdc__modal-list">
                ${this.data.sections.map((section) => section.rows.map((row) => `
                  <div class="mdc__modal-row">
                    <dt>${escapeHtml(row.label)}</dt>
                    <dd>${renderValue(model.values[row.key])}</dd>
                  </div>
                `).join('')).join('')}
              </dl>
            </article>
          `).join('')}
        </div>
      `;
    }

    closeModal() {
      if (!this.modal) return;
      this.modal.hidden = true;
      document.body.classList.remove('mdc-modal-open');
      this.lastFocusedElement?.focus?.();
    }

    announce(message) {
      if (this.tableStatus) this.tableStatus.textContent = message;
      if (!this.toast) return;
      window.clearTimeout(this.toastTimer);
      this.toast.textContent = message;
      this.toast.hidden = false;
      this.toastTimer = window.setTimeout(() => {
        this.toast.hidden = true;
      }, 3600);
    }
  }

  const init = (scope = document) => {
    scope.querySelectorAll(SELECTOR).forEach((root) => {
      if (root.dataset.mdcInitialized === 'true') return;
      root.dataset.mdcInitialized = 'true';
      new MediumDutyComparison(root);
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init());
  } else {
    init();
  }

  document.addEventListener('shopify:section:load', (event) => init(event.target));
})();