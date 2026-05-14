document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.main-product').forEach(function (section) {
    if (section.dataset.initialized) return;
    initProductSection(section);
    section.dataset.initialized = 'true';
  });
});

function initProductSection(section) {
  var addToCartText = section.getAttribute('data-add-to-cart-text');
  var soldOutText = section.getAttribute('data-sold-out-text');

  function initSwiper() {
    if (typeof Swiper === 'undefined') {
      return setTimeout(initSwiper, 60);
    }
    var thumbsEl = section.querySelector('.product-gallery__thumbs');
    var thumbs = null;
    if (thumbsEl) {
      thumbs = new Swiper(thumbsEl, {
        slidesPerView: 4,
        spaceBetween: 12,
        watchSlidesProgress: true,
        breakpoints: {
          0: { slidesPerView: 4, spaceBetween: 8 },
          750: { slidesPerView: 4, spaceBetween: 12 }
        }
      });
    }
    var main = new Swiper(section.querySelector('.product-gallery__main'), {
      slidesPerView: 1,
      spaceBetween: 0,
      thumbs: thumbs ? { swiper: thumbs } : undefined
    });

    section._mainSwiper = main;
    section._thumbsSwiper = thumbs;

    if (thumbsEl) {
      thumbsEl.addEventListener('click', function (e) {
        var slide = e.target.closest('.product-gallery__thumb');
        if (!slide) return;
        var index = Array.prototype.indexOf.call(slide.parentNode.children, slide);
        main.slideTo(index);
      });
    }

    var slides = section.querySelectorAll('.product-gallery__main .swiper-slide');
    section._slideIndexByMediaId = {};
    slides.forEach(function (slide, i) {
      var id = slide.getAttribute('data-media-id');
      if (id) section._slideIndexByMediaId[id] = i;
    });
  }

  initSwiper();

  section.querySelectorAll('[data-raw-desc]').forEach(function (rawDesc) {
    var tmp = document.createElement('textarea');
    tmp.innerHTML = rawDesc.innerHTML;
    rawDesc.textContent = tmp.value.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  });

  var variantsScript = section.querySelector('[data-product-json]');
  var variants = [];
  try { variants = JSON.parse(variantsScript.textContent); } catch (e) {}

  var optionButtons = section.querySelectorAll('.variant-option__value');
  var variantInput = section.querySelector('[data-variant-input]');
  var addBtn = section.querySelector('[data-add-to-cart-button]');
  var priceEl = section.querySelector('[data-price]');

  function getSelectedOptions() {
    var groups = section.querySelectorAll('.variant-option');
    var values = [];
    groups.forEach(function (group) {
      var active = group.querySelector('.variant-option__value.is-active');
      values.push(active ? active.getAttribute('data-option-value') : null);
    });
    return values;
  }

  function findVariant(values) {
    return variants.find(function (v) {
      return v.options.every(function (opt, i) { return opt === values[i]; });
    });
  }

  function updateUI(variant) {
    if (!variant) return;
    variantInput.value = variant.id;
    addBtn.disabled = !variant.available;
    var label = variant.available ? addToCartText : soldOutText;
    addBtn.querySelector('span').textContent = label;
    var compare = variant.compare_at_price && variant.compare_at_price > variant.price
      ? '<del class="price-compare">' + formatMoney(variant.compare_at_price) + '</del>' : '';
    priceEl.querySelector('.price-current').textContent = formatMoney(variant.price);
    var del = priceEl.querySelector('.price-compare');
    if (del) del.remove();
    if (compare) priceEl.insertAdjacentHTML('afterbegin', compare);

    var url = new URL(window.location);
    url.searchParams.set('variant', variant.id);
    window.history.replaceState({}, '', url);
  }

  function formatMoney(cents) {
    return '$' + (cents / 100).toFixed(2);
  }

  optionButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var idx = parseInt(btn.getAttribute('data-option-index'), 10);
      var group = section.querySelectorAll('.variant-option')[idx];
      group.querySelectorAll('.variant-option__value').forEach(function (b) { b.classList.remove('is-active'); });
      btn.classList.add('is-active');
      var sel = group.querySelector('[data-selected-value]');
      if (sel) {
        var rawVal = btn.getAttribute('data-option-value');
        sel.textContent = rawVal.split(':')[0];
      }

      var values = getSelectedOptions();
      var variant = findVariant(values);
      updateUI(variant);

      var mediaId = btn.getAttribute('data-media-id');
      if (mediaId && section._mainSwiper && section._slideIndexByMediaId[mediaId] != null) {
        section._mainSwiper.slideTo(section._slideIndexByMediaId[mediaId]);
      }
    });
  });

  var qty = section.querySelector('.qty-input__field');
  section.querySelectorAll('[data-qty-action]').forEach(function (b) {
    b.addEventListener('click', function () {
      var v = parseInt(qty.value, 10) || 1;
      v = b.getAttribute('data-qty-action') === 'increase' ? v + 1 : Math.max(1, v - 1);
      qty.value = v;
    });
  });

  var form = section.querySelector('form[action*="/cart/add"]');
  if (form && addBtn) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (addBtn.disabled || addBtn.classList.contains('is-loading')) return;

      var labelEl = addBtn.querySelector('span');
      var originalLabel = labelEl ? labelEl.textContent : '';
      addBtn.classList.add('is-loading');

      var formData = new FormData(form);
      formData.append('sections', 'cart-drawer,cart-icon-bubble');
      formData.append('sections_url', window.location.pathname);

      var rootUrl = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';

      fetch(rootUrl + 'cart/add.js', {
        method: 'POST',
        headers: { Accept: 'application/javascript', 'X-Requested-With': 'XMLHttpRequest' },
        body: formData,
      })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          addBtn.classList.remove('is-loading');
          if (data.status) {
            if (labelEl) labelEl.textContent = data.message || 'Error';
            setTimeout(function () { if (labelEl) labelEl.textContent = originalLabel; }, 2000);
            return;
          }

          var cartDrawer = document.querySelector('cart-drawer');
          if (cartDrawer && data.sections && data.sections['cart-drawer']) {
            var parsed = new DOMParser().parseFromString(data.sections['cart-drawer'], 'text/html');
            var src = parsed.querySelector('#CartDrawer');
            var dst = document.querySelector('#CartDrawer');
            if (src && dst) dst.innerHTML = src.innerHTML;
            cartDrawer.classList.remove('is-empty');
          }

          if (typeof publish === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
            publish(PUB_SUB_EVENTS.cartUpdate, { source: 'product-form', cartData: data });
          }

          if (typeof window.openCartDrawer === 'function') {
            window.openCartDrawer();
          } else if (cartDrawer) {
            cartDrawer.classList.add('animate', 'active');
            document.body.classList.add('overflow-hidden');
          }
        })
        .catch(function (err) {
          addBtn.classList.remove('is-loading');
          console.error('[main-product add-to-cart]', err);
        });
    });
  }
}

if (!customElements.get('product-form-pdp')) {
  customElements.define('product-form-pdp', class extends HTMLElement {});
}
