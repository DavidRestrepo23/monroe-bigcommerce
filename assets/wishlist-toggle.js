(function () {
  var STORAGE_KEY = 'monroe-wishlist';

  function getWishlist() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function saveWishlist(handles) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(handles));
  }

  function isInWishlist(handle) {
    return getWishlist().indexOf(handle) !== -1;
  }

  function toggleWishlist(handle) {
    var list = getWishlist();
    var idx = list.indexOf(handle);
    if (idx === -1) {
      list.push(handle);
    } else {
      list.splice(idx, 1);
    }
    saveWishlist(list);
    syncAllButtons();
    return idx === -1;
  }

  function syncAllButtons() {
    var buttons = document.querySelectorAll('[data-wishlist-toggle]');
    buttons.forEach(function (btn) {
      var handle = btn.dataset.productHandle;
      var active = isInWishlist(handle);
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-label', active ? 'Remove from wishlist' : 'Add to wishlist');
    });
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-wishlist-toggle]');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist(btn.dataset.productHandle);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncAllButtons);
  } else {
    syncAllButtons();
  }

  // Re-sync on storage changes from other tabs
  window.addEventListener('storage', function (e) {
    if (e.key === STORAGE_KEY) syncAllButtons();
  });
})();