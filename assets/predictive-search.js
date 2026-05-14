class PredictiveSearch extends HTMLElement {
  constructor() {
    super();
    this.input = this.querySelector('[data-predictive-search-input]');
    this.form = this.querySelector('[data-predictive-search-form]');
    this.results = this.querySelector('[data-predictive-search-results]');
    this.content = this.querySelector('[data-predictive-search-content]');
    this.clearBtn = this.querySelector('[data-predictive-search-clear]');
    this.debounceTimer = null;
    this.abortController = null;
    this.cache = new Map();
  }

  connectedCallback() {
    this.input.addEventListener('input', this.onInput.bind(this));
    this.input.addEventListener('focus', this.onFocus.bind(this));
    this.form.addEventListener('submit', this.onSubmit.bind(this));
    this.clearBtn.addEventListener('click', this.onClear.bind(this));
    document.addEventListener('click', this.onDocumentClick.bind(this));
    this.addEventListener('keydown', this.onKeydown.bind(this));
  }

  onInput(e) {
    const q = e.target.value.trim();
    this.clearBtn.hidden = q.length === 0;

    clearTimeout(this.debounceTimer);

    if (q.length < 1) {
      this.close();
      return;
    }

    this.debounceTimer = setTimeout(() => this.fetchResults(q), 180);
  }

  onFocus() {
    const q = this.input.value.trim();
    if (q.length >= 1) this.fetchResults(q);
  }

  onSubmit(e) {
    if (!this.input.value.trim()) e.preventDefault();
  }

  onClear() {
    this.input.value = '';
    this.clearBtn.hidden = true;
    this.close();
    this.input.focus();
  }

  onDocumentClick(e) {
    if (!this.contains(e.target)) this.close();
  }

  onKeydown(e) {
    if (e.key === 'Escape') {
      this.close();
      this.input.blur();
    }
  }

  async fetchResults(q) {
    if (this.cache.has(q)) {
      this.render(this.cache.get(q), q);
      return;
    }

    if (this.abortController) this.abortController.abort();
    this.abortController = new AbortController();

    this.renderLoading();

    const params = new URLSearchParams({
      'q': q,
      'resources[type]': 'product,query,collection',
      'resources[limit]': '4',
      'resources[limit_scope]': 'each',
      'resources[options][unavailable_products]': 'last',
      'resources[options][fields]': 'title,product_type,variants.title,vendor'
    });

    try {
      const res = await fetch(`${window.Shopify?.routes?.root || '/'}search/suggest.json?${params}`, {
        signal: this.abortController.signal
      });
      if (!res.ok) throw new Error('Fetch failed');
      const data = await res.json();
      this.cache.set(q, data);
      this.render(data, q);
    } catch (err) {
      if (err.name !== 'AbortError') this.renderError();
    }
  }

  renderLoading() {
    this.open();
    this.content.innerHTML = `<div class="header__search-loading"><div class="header__search-spinner"></div></div>`;
  }

  renderError() {
    this.content.innerHTML = `<div class="header__search-empty">Couldn't load results. Try again.</div>`;
  }

  render(data, q) {
    const products = data?.resources?.results?.products || [];
    const queries = data?.resources?.results?.queries || [];
    const collections = data?.resources?.results?.collections || [];

    if (!products.length && !queries.length && !collections.length) {
      this.open();
      this.content.innerHTML = `
        <div class="header__search-empty">
          <p>No results found for <strong>"${this.escape(q)}"</strong></p>
          <span>Try a different keyword or check spelling.</span>
        </div>`;
      return;
    }

    const left = `
      ${queries.length ? `
        <section class="header__search-col">
          <h3 class="header__search-col-title">Suggestions</h3>
          <ul class="header__search-list">
            ${queries.map(item => `
              <li>
                <a class="header__search-suggestion" href="/search?q=${encodeURIComponent(item.text)}">
                  ${this.highlight(item.text, q)}
                </a>
              </li>`).join('')}
          </ul>
        </section>` : ''}
      ${collections.length ? `
        <section class="header__search-col">
          <h3 class="header__search-col-title">Collections</h3>
          <ul class="header__search-list">
            ${collections.map(c => `
              <li>
                <a class="header__search-suggestion" href="${c.url}">
                  ${this.highlight(c.title, q)}
                </a>
              </li>`).join('')}
          </ul>
        </section>` : ''}
    `;

    const right = products.length ? `
      <section class="header__search-col header__search-col--products">
        <h3 class="header__search-col-title">Products</h3>
        <ul class="header__search-products">
          ${products.map(p => `
            <li>
              <a class="header__search-product" href="${p.url}">
                <span class="header__search-product-thumb">
                  ${p.featured_image?.url
                    ? `<img src="${p.featured_image.url}" alt="${this.escape(p.featured_image.alt || p.title)}" loading="lazy" width="64" height="64">`
                    : `<span class="header__search-product-thumb-placeholder"></span>`}
                </span>
                <span class="header__search-product-info">
                  <span class="header__search-product-title">${this.highlight(p.title, q)}</span>
                  ${p.vendor ? `<span class="header__search-product-vendor">${this.escape(p.vendor)}</span>` : ''}
                </span>
              </a>
            </li>`).join('')}
        </ul>
      </section>` : '';

    this.content.innerHTML = `
      <div class="header__search-grid${(!left.trim()) ? ' header__search-grid--single' : ''}${(!right) ? ' header__search-grid--single' : ''}">
        ${left ? `<div class="header__search-grid-left">${left}</div>` : ''}
        ${right ? `<div class="header__search-grid-right">${right}</div>` : ''}
      </div>
      <a class="header__search-view-all" href="/search?q=${encodeURIComponent(q)}">
        View all results for "${this.escape(q)}"
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M7.5 4l5.5 6-5.5 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </a>`;
    this.open();
  }

  highlight(text, q) {
    const safe = this.escape(text);
    if (!q) return safe;
    const escapedQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return safe.replace(new RegExp(`(${escapedQ})`, 'ig'), '<mark>$1</mark>');
  }

  escape(str) {
    return String(str).replace(/[&<>"']/g, s => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[s]));
  }

  open() {
    this.results.hidden = false;
    this.input.setAttribute('aria-expanded', 'true');
    this.classList.add('is-open');
  }

  close() {
    this.results.hidden = true;
    this.input.setAttribute('aria-expanded', 'false');
    this.classList.remove('is-open');
  }
}

customElements.define('predictive-search', PredictiveSearch);
