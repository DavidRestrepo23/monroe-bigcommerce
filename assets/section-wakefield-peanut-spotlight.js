(function () {
  'use strict';

  function normalize(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[’']/g, '')
      .replace(/[^a-z0-9\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function initWakefield(root) {
    if (!root || root.dataset.wpfReady === 'true') return;
    root.dataset.wpfReady = 'true';

    var searchInput = root.querySelector('[data-wpf-search]');
    var sortSelect = root.querySelector('[data-wpf-sort]');
    var filterButtons = Array.prototype.slice.call(root.querySelectorAll('[data-wpf-filter]'));
    var grid = root.querySelector('[data-wpf-grid]');
    var cards = grid ? Array.prototype.slice.call(grid.querySelectorAll('[data-wpf-card]')) : [];
    var status = root.querySelector('[data-wpf-status]');
    var clearButton = root.querySelector('[data-wpf-clear]');
    var emptyState = root.querySelector('[data-wpf-empty]');
    var emptyReset = root.querySelector('[data-wpf-empty-reset]');
    var guideTabs = Array.prototype.slice.call(root.querySelectorAll('[data-wpf-guide-tab]'));
    var guidePanels = Array.prototype.slice.call(root.querySelectorAll('[data-wpf-guide-panel]'));

    var state = {
      query: '',
      filter: 'all',
      sort: 'featured'
    };

    function cardMatches(card) {
      var query = normalize(state.query);
      var searchText = normalize(card.dataset.search);
      var categories = normalize(card.dataset.category).split(' ');
      var filterMatch = state.filter === 'all' || categories.indexOf(state.filter) !== -1;
      var queryMatch = !query || searchText.indexOf(query) !== -1;
      return filterMatch && queryMatch;
    }

    function sortCards() {
      if (!grid || !cards.length) return;

      cards.sort(function (a, b) {
        var aName = normalize(a.dataset.name);
        var bName = normalize(b.dataset.name);
        var aPosition = parseInt(a.dataset.position || '0', 10);
        var bPosition = parseInt(b.dataset.position || '0', 10);
        var aPrice = parseInt(a.dataset.price || '0', 10);
        var bPrice = parseInt(b.dataset.price || '0', 10);

        switch (state.sort) {
          case 'az':
            return aName.localeCompare(bName);
          case 'za':
            return bName.localeCompare(aName);
          case 'price-low':
            return aPrice - bPrice || aPosition - bPosition;
          case 'price-high':
            return bPrice - aPrice || aPosition - bPosition;
          default:
            return aPosition - bPosition;
        }
      });

      cards.forEach(function (card) {
        grid.appendChild(card);
      });
    }

    function applyFilters() {
      var visible = 0;

      cards.forEach(function (card) {
        var show = cardMatches(card);
        card.hidden = !show;
        if (show) visible += 1;
      });

      if (status) {
        status.textContent = 'Showing ' + visible + ' of ' + cards.length + ' products';
      }

      if (clearButton) {
        clearButton.hidden = !state.query && state.filter === 'all' && state.sort === 'featured';
      }

      if (emptyState) {
        emptyState.hidden = visible !== 0;
      }
    }

    function updateFilterButtons() {
      filterButtons.forEach(function (button) {
        var active = button.dataset.wpfFilter === state.filter;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    }

    function resetProducts() {
      state.query = '';
      state.filter = 'all';
      state.sort = 'featured';

      if (searchInput) searchInput.value = '';
      if (sortSelect) sortSelect.value = 'featured';

      updateFilterButtons();
      sortCards();
      applyFilters();

      if (searchInput) searchInput.focus();
    }

    function activateGuide(name, focusTab) {
      guideTabs.forEach(function (tab) {
        var active = tab.dataset.wpfGuideTab === name;
        tab.classList.toggle('is-active', active);
        tab.setAttribute('aria-selected', active ? 'true' : 'false');
        tab.setAttribute('tabindex', active ? '0' : '-1');
        if (active && focusTab) tab.focus();
      });

      guidePanels.forEach(function (panel) {
        panel.hidden = panel.dataset.wpfGuidePanel !== name;
      });
    }

    if (searchInput) {
      searchInput.addEventListener('input', function () {
        state.query = searchInput.value;
        applyFilters();
      });
    }

    if (sortSelect) {
      sortSelect.addEventListener('change', function () {
        state.sort = sortSelect.value;
        sortCards();
        applyFilters();
      });
    }

    filterButtons.forEach(function (button) {
      button.addEventListener('click', function () {
        state.filter = button.dataset.wpfFilter || 'all';
        updateFilterButtons();
        applyFilters();
      });
    });

    if (clearButton) clearButton.addEventListener('click', resetProducts);
    if (emptyReset) emptyReset.addEventListener('click', resetProducts);

    guideTabs.forEach(function (tab, index) {
      tab.addEventListener('click', function () {
        activateGuide(tab.dataset.wpfGuideTab, false);
      });

      tab.addEventListener('keydown', function (event) {
        var nextIndex = index;

        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
          nextIndex = (index + 1) % guideTabs.length;
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
          nextIndex = (index - 1 + guideTabs.length) % guideTabs.length;
        } else if (event.key === 'Home') {
          nextIndex = 0;
        } else if (event.key === 'End') {
          nextIndex = guideTabs.length - 1;
        } else {
          return;
        }

        event.preventDefault();
        activateGuide(guideTabs[nextIndex].dataset.wpfGuideTab, true);
      });
    });

    sortCards();
    applyFilters();

    if (guideTabs.length) {
      activateGuide(guideTabs[0].dataset.wpfGuideTab, false);
    }
  }

  function initAll(scope) {
    var context = scope || document;
    var roots = context.querySelectorAll ? context.querySelectorAll('[data-wpf-section]') : [];
    Array.prototype.forEach.call(roots, initWakefield);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initAll(document);
    });
  } else {
    initAll(document);
  }

  document.addEventListener('shopify:section:load', function (event) {
    initAll(event.target);
  });
})();