(function () {
  'use strict';

  function initClassicCookie(root) {
    if (!root || root.dataset.ccbInitialized === 'true') return;
    root.dataset.ccbInitialized = 'true';

    var searchInput = root.querySelector('[data-ccb-search]');
    var sortSelect = root.querySelector('[data-ccb-sort]');
    var filterButtons = Array.prototype.slice.call(root.querySelectorAll('[data-ccb-filter]'));
    var grid = root.querySelector('[data-ccb-grid]');
    var cards = Array.prototype.slice.call(root.querySelectorAll('[data-ccb-card]'));
    var status = root.querySelector('[data-ccb-status]');
    var clearButton = root.querySelector('[data-ccb-clear]');
    var emptyState = root.querySelector('[data-ccb-empty]');
    var emptyReset = root.querySelector('[data-ccb-empty-reset]');

    if (!grid || !cards.length) return;

    var state = {
      query: '',
      filter: 'all',
      sort: 'featured'
    };

    function normalize(value) {
      return String(value || '')
        .toLowerCase()
        .replace(/[’‘]/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
    }

    function sortCards() {
      var sorted = cards.slice();

      if (state.sort === 'az') {
        sorted.sort(function (a, b) {
          return a.dataset.name.localeCompare(b.dataset.name);
        });
      } else if (state.sort === 'za') {
        sorted.sort(function (a, b) {
          return b.dataset.name.localeCompare(a.dataset.name);
        });
      } else {
        sorted.sort(function (a, b) {
          return Number(a.dataset.position) - Number(b.dataset.position);
        });
      }

      sorted.forEach(function (card) {
        grid.appendChild(card);
      });
    }

    function applyFilters() {
      var visible = 0;
      var query = normalize(state.query);

      cards.forEach(function (card) {
        var searchText = normalize(card.dataset.search);
        var profiles = normalize(card.dataset.profile).split(' ');
        var queryMatch = !query || searchText.indexOf(query) !== -1;
        var filterMatch = state.filter === 'all' || profiles.indexOf(state.filter) !== -1;
        var show = queryMatch && filterMatch;

        card.hidden = !show;
        if (show) visible += 1;
      });

      if (status) {
        status.textContent = 'Showing ' + visible + ' of ' + cards.length + ' flavors';
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
        var active = button.dataset.ccbFilter === state.filter;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    }

    function resetAll() {
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
        state.filter = button.dataset.ccbFilter || 'all';
        updateFilterButtons();
        applyFilters();
      });
    });

    if (clearButton) clearButton.addEventListener('click', resetAll);
    if (emptyReset) emptyReset.addEventListener('click', resetAll);

    sortCards();
    applyFilters();
  }

  function initAll(scope) {
    var context = scope || document;
    var roots = context.querySelectorAll ? context.querySelectorAll('[data-ccb-section]') : [];
    Array.prototype.forEach.call(roots, initClassicCookie);
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