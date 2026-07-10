/* Monroe Toner Finder
   Asset: assets/monroe-toner-finder.js
*/
(function () {
  'use strict';

  if (window.MonroeTonerFinder && typeof window.MonroeTonerFinder.initAll === 'function') {
    window.MonroeTonerFinder.initAll();
    return;
  }

  var DEFAULT_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRi_wzfF3eX5KmEkQhAVfSIrNln1bYHABlkYJceHzOa8tgV05pIb4Djj3zrDRyC1AP318vgXZlftDkx/pub?gid=0&single=true&output=csv';

  var FIELD_ALIASES = {
    product_type: ['product_type', 'type', 'supply_type'],
    sku: ['sku', 'product_sku', 'item_number', 'item_no', 'part_number'],
    toner_model: ['toner_model', 'toner_name', 'product_name', 'name', 'cartridge_model'],
    printer_brand: ['printer_brand', 'brand', 'manufacturer', 'printer_manufacturer'],
    image_url: ['image_url', 'image', 'image_link', 'product_image', 'product_image_url'],
    product_url: ['product_url', 'url', 'product_link', 'link'],
    color: ['color', 'toner_color', 'cartridge_color'],
    compatible_models: [
      'compatible_models',
      'compatible_model',
      'compatible_printer_models',
      'compatible_printers',
      'printer_models',
      'printer_model',
      'models'
    ],
    yield_pages: ['yield_pages', 'page_yield', 'yield', 'pages', 'estimated_yield'],
    description: ['description', 'product_description'],
    sustainability_notes: ['sustainability_notes', 'sustainability']
  };

  function onReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
    } else {
      callback();
    }
  }

  function norm(value) {
    return value == null ? '' : String(value).trim();
  }

  function key(value) {
    return norm(value).toLowerCase();
  }

  function canonicalHeader(value) {
    return norm(value)
      .replace(/^\uFEFF/, '')
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function toYieldNumber(value) {
    var match = norm(value).match(/\d[\d,]*/);
    if (!match) return null;
    var parsed = parseInt(match[0].replace(/,/g, ''), 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function uniqueSorted(values) {
    var seen = Object.create(null);
    var output = [];

    values.forEach(function (value) {
      var clean = norm(value);
      var normalized = key(clean);
      if (!clean || seen[normalized]) return;
      seen[normalized] = true;
      output.push(clean);
    });

    return output.sort(function (a, b) {
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    });
  }

  function debounce(callback, wait) {
    var timeout;
    return function () {
      var context = this;
      var args = arguments;
      window.clearTimeout(timeout);
      timeout = window.setTimeout(function () {
        callback.apply(context, args);
      }, wait);
    };
  }

  function csvEscape(value) {
    var clean = String(value == null ? '' : value);
    if (/[",\n]/.test(clean)) {
      return '"' + clean.replace(/"/g, '""') + '"';
    }
    return clean;
  }

  function countDelimiter(line, delimiter) {
    var count = 0;
    var inQuotes = false;

    for (var i = 0; i < line.length; i += 1) {
      var character = line[i];
      if (character === '"') {
        if (inQuotes && line[i + 1] === '"') {
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (!inQuotes && character === delimiter) {
        count += 1;
      }
    }

    return count;
  }

  function detectDelimiter(text) {
    var lines = String(text || '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .filter(function (line) { return norm(line); })
      .slice(0, 12);

    var commaScore = 0;
    var tabScore = 0;

    lines.forEach(function (line) {
      commaScore = Math.max(commaScore, countDelimiter(line, ','));
      tabScore = Math.max(tabScore, countDelimiter(line, '\t'));
    });

    return tabScore > commaScore ? '\t' : ',';
  }

  function parseRows(text, delimiter) {
    var source = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    var rows = [];
    var row = [];
    var field = '';
    var inQuotes = false;

    for (var i = 0; i < source.length; i += 1) {
      var character = source[i];

      if (inQuotes) {
        if (character === '"') {
          if (source[i + 1] === '"') {
            field += '"';
            i += 1;
          } else {
            inQuotes = false;
          }
        } else {
          field += character;
        }
        continue;
      }

      if (character === '"') {
        inQuotes = true;
      } else if (character === delimiter) {
        row.push(field);
        field = '';
      } else if (character === '\n') {
        row.push(field);
        field = '';
        if (row.some(function (cell) { return norm(cell); })) rows.push(row);
        row = [];
      } else {
        field += character;
      }
    }

    row.push(field);
    if (row.some(function (cell) { return norm(cell); })) rows.push(row);

    return rows;
  }

  function headerScore(row) {
    var headers = row.map(canonicalHeader);
    var score = 0;
    ['sku', 'toner_model', 'printer_brand', 'compatible_models'].forEach(function (fieldName) {
      var aliases = FIELD_ALIASES[fieldName];
      if (headers.some(function (header) { return aliases.indexOf(header) !== -1; })) score += 1;
    });
    return score;
  }

  function parseDelimited(text) {
    var delimiter = detectDelimiter(text);
    var rows = parseRows(text, delimiter);

    if (!rows.length) {
      throw new Error('The Google Sheet returned no readable rows.');
    }

    var headerIndex = -1;
    var bestScore = -1;

    rows.forEach(function (row, index) {
      var score = headerScore(row);
      if (score > bestScore) {
        bestScore = score;
        headerIndex = index;
      }
    });

    if (headerIndex < 0 || bestScore < 3) {
      throw new Error('The header row could not be identified. Keep columns for SKU, toner model, printer brand, and compatible models.');
    }

    var headers = rows[headerIndex].map(canonicalHeader);
    var records = [];

    for (var rowIndex = headerIndex + 1; rowIndex < rows.length; rowIndex += 1) {
      var rawRow = rows[rowIndex];
      var record = {};
      var hasData = false;

      headers.forEach(function (header, columnIndex) {
        if (!header) return;
        var value = norm(rawRow[columnIndex]);
        if (value) hasData = true;
        record[header] = value;
      });

      if (hasData) records.push(record);
    }

    return {
      headers: headers,
      records: records,
      delimiter: delimiter
    };
  }

  function resolveHeader(headers, fieldName) {
    var aliases = FIELD_ALIASES[fieldName] || [];
    for (var i = 0; i < aliases.length; i += 1) {
      if (headers.indexOf(aliases[i]) !== -1) return aliases[i];
    }
    return '';
  }

  function getField(record, headers, fieldName) {
    var resolved = resolveHeader(headers, fieldName);
    return resolved ? norm(record[resolved]) : '';
  }

  function splitModels(value) {
    var clean = norm(value);
    if (!clean) return [];

    var delimiterPattern;
    if (clean.indexOf('|') !== -1) {
      delimiterPattern = /\|+/;
    } else if (clean.indexOf('\n') !== -1) {
      delimiterPattern = /\n+/;
    } else if (clean.indexOf(';') !== -1) {
      delimiterPattern = /;+/;
    } else {
      delimiterPattern = /,+/;
    }

    return uniqueSorted(clean.split(delimiterPattern).map(norm).filter(Boolean));
  }

  function normalizeRecords(parsed) {
    var requiredFields = ['sku', 'toner_model', 'printer_brand', 'compatible_models'];
    var missingFields = requiredFields.filter(function (fieldName) {
      return !resolveHeader(parsed.headers, fieldName);
    });

    if (missingFields.length) {
      throw new Error('Missing required Google Sheet column' + (missingFields.length > 1 ? 's' : '') + ': ' + missingFields.join(', ') + '.');
    }

    var merged = new Map();

    parsed.records.forEach(function (record) {
      var sku = getField(record, parsed.headers, 'sku');
      var toner = getField(record, parsed.headers, 'toner_model');
      var brand = getField(record, parsed.headers, 'printer_brand');
      var color = getField(record, parsed.headers, 'color') || 'Not specified';
      var yieldPages = getField(record, parsed.headers, 'yield_pages') || 'Not specified';
      var productUrl = getField(record, parsed.headers, 'product_url');
      var imageUrl = getField(record, parsed.headers, 'image_url');
      var models = splitModels(getField(record, parsed.headers, 'compatible_models'));

      if (!sku && !toner) return;

      var product = {
        productType: getField(record, parsed.headers, 'product_type'),
        sku: sku,
        toner: toner || sku || 'Toner supply',
        brand: brand || 'Brand not provided',
        color: color,
        yieldPages: yieldPages,
        yieldNumber: toYieldNumber(yieldPages),
        imageUrl: imageUrl,
        productUrl: productUrl,
        models: models
      };

      var identity = [
        key(product.sku),
        key(product.toner),
        key(product.color),
        key(product.yieldPages),
        key(product.productUrl)
      ].join('|');

      if (!merged.has(identity)) {
        merged.set(identity, product);
      } else {
        var existing = merged.get(identity);
        existing.models = uniqueSorted(existing.models.concat(product.models));
        if (!existing.imageUrl && product.imageUrl) existing.imageUrl = product.imageUrl;
        if (!existing.productUrl && product.productUrl) existing.productUrl = product.productUrl;
        if (existing.brand === 'Brand not provided' && product.brand !== 'Brand not provided') existing.brand = product.brand;
      }
    });

    return Array.from(merged.values()).sort(function (a, b) {
      return a.toner.localeCompare(b.toner, undefined, { numeric: true, sensitivity: 'base' });
    });
  }

  function normalizeSheetUrl(rawUrl) {
    var input = norm(rawUrl) || DEFAULT_CSV_URL;
    var url;

    try {
      url = new URL(input, window.location.href);
    } catch (error) {
      throw new Error('The Google Sheets URL is not valid.');
    }

    if (url.hostname === 'docs.google.com') {
      if (/\/pubhtml\/?$/.test(url.pathname)) {
        var publishedGid = url.searchParams.get('gid') || '0';
        url.pathname = url.pathname.replace(/\/pubhtml\/?$/, '/pub');
        url.search = '';
        url.hash = '';
        url.searchParams.set('gid', publishedGid);
        url.searchParams.set('single', 'true');
        url.searchParams.set('output', 'csv');
      } else if (/\/pub\/?$/.test(url.pathname)) {
        if (!url.searchParams.get('gid')) url.searchParams.set('gid', '0');
        url.searchParams.set('single', 'true');
        url.searchParams.set('output', 'csv');
      } else {
        var sheetIdMatch = url.pathname.match(/\/spreadsheets\/d\/([^/]+)/);
        if (sheetIdMatch) {
          var hashGidMatch = url.hash.match(/gid=(\d+)/);
          var gid = url.searchParams.get('gid') || (hashGidMatch ? hashGidMatch[1] : '0');
          return 'https://docs.google.com/spreadsheets/d/' + encodeURIComponent(sheetIdMatch[1]) + '/gviz/tq?tqx=out:csv&gid=' + encodeURIComponent(gid);
        }
      }
    }

    return url.toString();
  }

  function safeUrl(value, allowRelative) {
    var clean = norm(value);
    if (!clean) return '';

    try {
      var parsed = new URL(clean, window.location.origin);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
      if (allowRelative && parsed.origin === window.location.origin) {
        return parsed.pathname + parsed.search + parsed.hash;
      }
      return parsed.toString();
    } catch (error) {
      return '';
    }
  }

  function placeholderImage() {
    var svg = ''
      + '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="450" viewBox="0 0 600 450">'
      + '<rect width="600" height="450" fill="#ffffff"/>'
      + '<rect x="45" y="45" width="510" height="360" rx="24" fill="#f3f3f3" stroke="#666666" stroke-width="4"/>'
      + '<text x="300" y="235" text-anchor="middle" font-family="Arial, sans-serif" font-size="38" font-weight="700" fill="#000000">Toner Supply</text>'
      + '</svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function setSelectOptions(select, values, placeholder) {
    var previous = select.value;
    var fragment = document.createDocumentFragment();
    var firstOption = document.createElement('option');
    firstOption.value = '';
    firstOption.textContent = placeholder;
    fragment.appendChild(firstOption);

    values.forEach(function (value) {
      var option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      fragment.appendChild(option);
    });

    select.innerHTML = '';
    select.appendChild(fragment);
    select.disabled = values.length === 0;

    if (previous && values.indexOf(previous) !== -1) {
      select.value = previous;
    }
  }

  function createFinder(root) {
    if (!root || root.dataset.msfInitialized === 'true') return;
    root.dataset.msfInitialized = 'true';

    var elements = {
      form: root.querySelector('[data-msf-form]'),
      brand: root.querySelector('[data-msf-brand]'),
      model: root.querySelector('[data-msf-model]'),
      search: root.querySelector('[data-msf-search]'),
      color: root.querySelector('[data-msf-color]'),
      minYield: root.querySelector('[data-msf-min-yield]'),
      sort: root.querySelector('[data-msf-sort]'),
      reset: root.querySelector('[data-msf-reset]'),
      retry: root.querySelector('[data-msf-retry]'),
      download: root.querySelector('[data-msf-download]'),
      print: root.querySelector('[data-msf-print]'),
      status: root.querySelector('[data-msf-status]'),
      count: root.querySelector('[data-msf-count]'),
      context: root.querySelector('[data-msf-context]'),
      gate: root.querySelector('[data-msf-gate]'),
      results: root.querySelector('[data-msf-results]'),
      loadMoreWrap: root.querySelector('[data-msf-load-more-wrap]'),
      loadMore: root.querySelector('[data-msf-load-more]'),
      chartCard: root.querySelector('[data-msf-chart-card]'),
      chartLabel: root.querySelector('[data-msf-chart-label]'),
      chartBody: root.querySelector('[data-msf-chart-body]'),
      chartTable: root.querySelector('[data-msf-chart-table]')
    };

    var missingElement = Object.keys(elements).find(function (name) { return !elements[name]; });
    if (missingElement) {
      root.dataset.msfInitialized = 'error';
      console.error('Monroe Toner Finder: missing element', missingElement);
      return;
    }

    var state = {
      records: [],
      filtered: [],
      chartRows: [],
      visibleCount: 0,
      pageSize: Math.max(8, parseInt(root.dataset.pageSize || '12', 10) || 12),
      loaded: false,
      controller: null
    };

    function setStatus(message, statusState) {
      elements.status.textContent = message;
      elements.status.dataset.state = statusState || '';
    }

    function setBusy(isBusy) {
      elements.results.setAttribute('aria-busy', isBusy ? 'true' : 'false');
      elements.brand.disabled = isBusy || !state.loaded;
      elements.search.disabled = isBusy;
      elements.minYield.disabled = isBusy;
      elements.sort.disabled = isBusy || !state.loaded;
      if (isBusy) {
        elements.model.disabled = true;
        elements.color.disabled = true;
      }
    }

    function hasActiveFilters() {
      return Boolean(
        norm(elements.brand.value) ||
        norm(elements.model.value) ||
        norm(elements.color.value) ||
        norm(elements.minYield.value) ||
        norm(elements.search.value).length >= 2
      );
    }

    function updateResetButton() {
      elements.reset.disabled = !hasActiveFilters();
    }

    function filteredByBrandAndModel(record) {
      var selectedBrand = key(elements.brand.value);
      var selectedModel = key(elements.model.value);

      if (selectedBrand && key(record.brand) !== selectedBrand) return false;
      if (selectedModel && !record.models.some(function (model) { return key(model) === selectedModel; })) return false;
      return true;
    }

    function rebuildBrandOptions() {
      setSelectOptions(
        elements.brand,
        uniqueSorted(state.records.map(function (record) { return record.brand; })),
        'All printer brands'
      );
    }

    function rebuildModelOptions() {
      var selectedBrand = key(elements.brand.value);
      var models = [];

      state.records.forEach(function (record) {
        if (!selectedBrand || key(record.brand) === selectedBrand) {
          models = models.concat(record.models);
        }
      });

      setSelectOptions(elements.model, uniqueSorted(models), 'All printer models');
    }

    function rebuildColorOptions() {
      var colors = state.records
        .filter(filteredByBrandAndModel)
        .map(function (record) { return record.color; })
        .filter(function (color) { return color && color !== 'Not specified'; });

      setSelectOptions(elements.color, uniqueSorted(colors), 'All colors');
    }

    function rebuildDropdowns() {
      rebuildBrandOptions();
      rebuildModelOptions();
      rebuildColorOptions();
      elements.sort.disabled = false;
    }

    function recordMatches(record) {
      var selectedBrand = key(elements.brand.value);
      var selectedModel = key(elements.model.value);
      var selectedColor = key(elements.color.value);
      var minimumYield = toYieldNumber(elements.minYield.value);
      var searchTerm = key(elements.search.value);
      var useSearch = searchTerm.length >= 2;

      if (selectedBrand && key(record.brand) !== selectedBrand) return false;
      if (selectedModel && !record.models.some(function (model) { return key(model) === selectedModel; })) return false;
      if (selectedColor && key(record.color) !== selectedColor) return false;
      if (minimumYield != null && (record.yieldNumber == null || record.yieldNumber < minimumYield)) return false;

      if (useSearch) {
        var searchable = [
          record.productType,
          record.sku,
          record.toner,
          record.brand,
          record.color,
          record.yieldPages,
          record.models.join(' ')
        ].map(key).join(' ');

        if (searchable.indexOf(searchTerm) === -1) return false;
      }

      return true;
    }

    function sortRecords(records) {
      var mode = elements.sort.value || 'yield_desc';
      var output = records.slice();

      output.sort(function (a, b) {
        if (mode === 'yield_asc') {
          var aYieldAsc = a.yieldNumber == null ? Number.MAX_SAFE_INTEGER : a.yieldNumber;
          var bYieldAsc = b.yieldNumber == null ? Number.MAX_SAFE_INTEGER : b.yieldNumber;
          return aYieldAsc - bYieldAsc || a.toner.localeCompare(b.toner, undefined, { numeric: true, sensitivity: 'base' });
        }

        if (mode === 'yield_desc') {
          var aYieldDesc = a.yieldNumber == null ? -1 : a.yieldNumber;
          var bYieldDesc = b.yieldNumber == null ? -1 : b.yieldNumber;
          return bYieldDesc - aYieldDesc || a.toner.localeCompare(b.toner, undefined, { numeric: true, sensitivity: 'base' });
        }

        if (mode === 'name_desc') {
          return b.toner.localeCompare(a.toner, undefined, { numeric: true, sensitivity: 'base' });
        }

        return a.toner.localeCompare(b.toner, undefined, { numeric: true, sensitivity: 'base' });
      });

      return output;
    }

    function buildContext() {
      var parts = [];
      if (elements.brand.value) parts.push(elements.brand.value);
      if (elements.model.value) parts.push(elements.model.value);
      if (elements.color.value) parts.push('Color: ' + elements.color.value);
      if (elements.minYield.value) parts.push('Minimum yield: ' + elements.minYield.value);
      if (norm(elements.search.value).length >= 2) parts.push('Search: ' + norm(elements.search.value));
      elements.context.textContent = parts.length ? 'Showing matches for ' + parts.join(' | ') : '';
    }

    function cardMarkup(record) {
      var imageUrl = safeUrl(record.imageUrl, false) || placeholderImage();
      var productUrl = safeUrl(record.productUrl, true);
      var productButton = productUrl
        ? '<a class="msf-button msf-button--primary msf-result-card__view" href="' + escapeHtml(productUrl) + '">View Toner</a>'
        : '<span class="msf-button msf-button--secondary msf-result-card__view" aria-disabled="true">Product Link Unavailable</span>';

      return ''
        + '<article class="msf-result-card">'
        +   '<div class="msf-result-card__top">'
        +     '<div class="msf-result-card__brand">' + escapeHtml(record.brand) + '</div>'
        +     '<div class="msf-result-card__color">' + escapeHtml(record.color) + '</div>'
        +   '</div>'
        +   '<div class="msf-result-card__media">'
        +     '<div class="msf-result-card__image-wrap">'
        +       '<img class="msf-result-card__image" data-msf-product-image src="' + escapeHtml(imageUrl) + '" alt="' + escapeHtml(record.toner + ' toner supply') + '" width="600" height="450" loading="lazy" decoding="async" fetchpriority="low">'
        +     '</div>'
        +     productButton
        +   '</div>'
        +   '<div class="msf-result-card__body">'
        +     '<h3 class="msf-result-card__title">' + escapeHtml(record.toner) + '</h3>'
        +     '<div class="msf-detail-stack">'
        +       '<div class="msf-detail"><div class="msf-detail__label">SKU</div><div class="msf-detail__value">' + escapeHtml(record.sku || 'Not provided') + '</div></div>'
        +       '<div class="msf-detail"><div class="msf-detail__label">Yield</div><div class="msf-detail__value">' + escapeHtml(record.yieldPages) + '</div></div>'
        +       '<div class="msf-detail"><div class="msf-detail__label">Color</div><div class="msf-detail__value">' + escapeHtml(record.color) + '</div></div>'
        +     '</div>'
        +   '</div>'
        + '</article>';
    }

    function bindImageFallbacks() {
      elements.results.querySelectorAll('[data-msf-product-image]').forEach(function (image) {
        image.addEventListener('error', function handleImageError() {
          image.removeEventListener('error', handleImageError);
          image.src = placeholderImage();
        });
      });
    }

    function renderChart() {
      var selectedModel = norm(elements.model.value);
      var selectedBrand = norm(elements.brand.value);

      if (!selectedModel) {
        state.chartRows = [];
        elements.chartCard.hidden = true;
        elements.chartBody.innerHTML = '';
        elements.download.disabled = true;
        elements.print.disabled = true;
        return;
      }

      state.chartRows = sortRecords(state.records.filter(function (record) {
        if (selectedBrand && key(record.brand) !== key(selectedBrand)) return false;
        return record.models.some(function (model) { return key(model) === key(selectedModel); });
      }));

      elements.chartLabel.textContent = (selectedBrand ? selectedBrand + ' ' : '') + selectedModel;

      if (!state.chartRows.length) {
        elements.chartBody.innerHTML = '<tr><td colspan="7">No chart rows are available for this printer model.</td></tr>';
      } else {
        elements.chartBody.innerHTML = state.chartRows.map(function (record) {
          var productUrl = safeUrl(record.productUrl, true);
          var productLink = productUrl
            ? '<a href="' + escapeHtml(productUrl) + '">View Toner</a>'
            : 'Not available';

          return ''
            + '<tr>'
            +   '<td>' + escapeHtml(record.brand) + '</td>'
            +   '<td>' + escapeHtml(selectedModel) + '</td>'
            +   '<td>' + escapeHtml(record.toner) + '</td>'
            +   '<td>' + escapeHtml(record.sku || 'Not provided') + '</td>'
            +   '<td>' + escapeHtml(record.color) + '</td>'
            +   '<td>' + escapeHtml(record.yieldPages) + '</td>'
            +   '<td>' + productLink + '</td>'
            + '</tr>';
        }).join('');
      }

      elements.chartCard.hidden = false;
      elements.download.disabled = state.chartRows.length === 0;
      elements.print.disabled = state.chartRows.length === 0;
    }

    function renderResults() {
      buildContext();
      updateResetButton();

      if (!hasActiveFilters()) {
        elements.count.textContent = '0 results';
        elements.gate.hidden = false;
        elements.gate.textContent = norm(elements.search.value).length === 1
          ? 'Enter at least two characters to search, or choose a printer brand or model.'
          : 'Choose a printer brand or model, apply a filter, or search by toner name or SKU to view matching supplies.';
        elements.results.innerHTML = '';
        elements.loadMoreWrap.hidden = true;
        elements.chartCard.hidden = true;
        elements.download.disabled = true;
        elements.print.disabled = true;
        state.filtered = [];
        return;
      }

      elements.gate.hidden = true;
      state.filtered = sortRecords(state.records.filter(recordMatches));
      elements.count.textContent = state.filtered.length + (state.filtered.length === 1 ? ' result' : ' results');

      if (!state.filtered.length) {
        elements.results.innerHTML = '<div class="msf-empty-state">No matching toner supplies were found. Try clearing a filter or contact Monroe with the exact printer model and toner part number.</div>';
        elements.loadMoreWrap.hidden = true;
        renderChart();
        return;
      }

      if (!state.visibleCount) {
        state.visibleCount = Math.min(state.pageSize, state.filtered.length);
      }

      var visibleRecords = state.filtered.slice(0, state.visibleCount);
      elements.results.innerHTML = '<div class="msf-result-grid">' + visibleRecords.map(cardMarkup).join('') + '</div>';
      bindImageFallbacks();

      if (state.visibleCount < state.filtered.length) {
        elements.loadMoreWrap.hidden = false;
        elements.loadMore.textContent = 'Load More (' + (state.filtered.length - state.visibleCount) + ' remaining)';
      } else {
        elements.loadMoreWrap.hidden = true;
      }

      renderChart();
    }

    function applyFilters() {
      state.visibleCount = 0;
      renderResults();
    }

    function resetFilters() {
      elements.brand.value = '';
      elements.search.value = '';
      elements.minYield.value = '';
      elements.sort.value = 'yield_desc';
      rebuildModelOptions();
      elements.model.value = '';
      rebuildColorOptions();
      elements.color.value = '';
      state.visibleCount = 0;
      renderResults();
    }

    function downloadChart() {
      if (!state.chartRows.length || !elements.model.value) return;

      var headers = ['printer_brand', 'printer_model', 'toner', 'sku', 'color', 'yield_pages', 'product_url'];
      var lines = [headers.join(',')];

      state.chartRows.forEach(function (record) {
        var values = [
          record.brand,
          elements.model.value,
          record.toner,
          record.sku,
          record.color,
          record.yieldPages,
          record.productUrl
        ];
        lines.push(values.map(csvEscape).join(','));
      });

      var blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
      var link = document.createElement('a');
      var filename = ['monroe', elements.brand.value || 'all-brands', elements.model.value, 'toner-chart']
        .join('_')
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9_-]+/g, '')
        .toLowerCase() + '.csv';

      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      window.setTimeout(function () {
        URL.revokeObjectURL(link.href);
        link.remove();
      }, 100);
    }

    function printChart() {
      if (!state.chartRows.length || !elements.model.value) return;

      var title = (elements.brand.value ? elements.brand.value + ' ' : '') + elements.model.value;
      var printWindow = window.open('', '_blank', 'noopener,noreferrer');
      if (!printWindow) {
        setStatus('The print window was blocked by the browser.', 'error');
        return;
      }

      var printHtml = ''
        + '<!doctype html><html><head><meta charset="utf-8">'
        + '<title>' + escapeHtml(title) + '</title>'
        + '<style>'
        + 'body{font-family:Arial,sans-serif;color:#000;padding:24px;font-size:16px;}'
        + 'h1{font-size:26px;margin:0 0 8px;}p{margin:0 0 18px;}'
        + 'table{width:100%;border-collapse:collapse;}th,td{border:1px solid #666;padding:8px;text-align:left;vertical-align:top;}th{background:#f2f2f2;}'
        + 'a{color:#000;}'
        + '</style></head><body>'
        + '<h1>Monroe Toner Compatibility Chart</h1>'
        + '<p>' + escapeHtml(title) + '</p>'
        + elements.chartTable.outerHTML
        + '</body></html>';

      printWindow.document.open();
      printWindow.document.write(printHtml);
      printWindow.document.close();
      printWindow.focus();
      window.setTimeout(function () { printWindow.print(); }, 250);
    }

    function showLoadError(error) {
      console.error('Monroe Toner Finder:', error);
      state.loaded = false;
      setBusy(false);
      elements.brand.disabled = true;
      elements.model.disabled = true;
      elements.color.disabled = true;
      elements.sort.disabled = true;
      elements.retry.hidden = false;
      elements.gate.hidden = true;
      elements.results.innerHTML = '<div class="msf-error-state"><strong>Toner data could not be loaded.</strong><br>' + escapeHtml(error.message || 'Unknown data error.') + '</div>';
      elements.count.textContent = '0 results';
      setStatus('Data load failed', 'error');
    }

    async function loadData() {
      if (state.controller) state.controller.abort();
      state.controller = new AbortController();
      root._msfAbortController = state.controller;

      state.loaded = false;
      elements.retry.hidden = true;
      elements.results.innerHTML = '';
      elements.gate.hidden = false;
      elements.gate.textContent = 'Loading toner data…';
      elements.count.textContent = '0 results';
      setStatus('Loading toner data…', '');
      setBusy(true);

      try {
        var csvUrl = normalizeSheetUrl(root.dataset.csvUrl);
        var response = await fetch(csvUrl, {
          method: 'GET',
          mode: 'cors',
          credentials: 'omit',
          cache: 'no-store',
          headers: { Accept: 'text/csv,text/plain;q=0.9,*/*;q=0.8' },
          signal: state.controller.signal
        });

        if (!response.ok) {
          throw new Error('Google Sheets returned HTTP ' + response.status + '. Confirm the sheet is published and accessible to anyone with the link.');
        }

        var text = await response.text();
        var trimmedStart = text.trimStart().slice(0, 80).toLowerCase();
        if (trimmedStart.indexOf('<!doctype html') === 0 || trimmedStart.indexOf('<html') === 0) {
          throw new Error('The configured Google Sheets link returned an HTML webpage instead of CSV data. Use the published CSV URL ending in output=csv.');
        }

        var parsed = parseDelimited(text);
        var records = normalizeRecords(parsed);
        if (!records.length) {
          throw new Error('The sheet was read successfully, but no toner records were found below the header row.');
        }

        state.records = records;
        state.loaded = true;
        state.visibleCount = 0;
        rebuildDropdowns();
        setBusy(false);
        setStatus('Ready: ' + records.length + ' toner supplies loaded', 'success');
        renderResults();
      } catch (error) {
        if (error && error.name === 'AbortError') return;
        showLoadError(error instanceof Error ? error : new Error('Unknown data error.'));
      }
    }

    elements.form.addEventListener('submit', function (event) {
      event.preventDefault();
    });

    elements.form.addEventListener('reset', function (event) {
      event.preventDefault();
      resetFilters();
    });

    elements.brand.addEventListener('change', function () {
      rebuildModelOptions();
      elements.model.value = '';
      rebuildColorOptions();
      elements.color.value = '';
      applyFilters();
    });

    elements.model.addEventListener('change', function () {
      rebuildColorOptions();
      if (elements.color.value && Array.from(elements.color.options).every(function (option) { return option.value !== elements.color.value; })) {
        elements.color.value = '';
      }
      applyFilters();
    });

    elements.color.addEventListener('change', applyFilters);
    elements.minYield.addEventListener('input', debounce(applyFilters, 180));
    elements.search.addEventListener('input', debounce(applyFilters, 180));
    elements.sort.addEventListener('change', function () {
      if (hasActiveFilters()) renderResults();
    });

    elements.loadMore.addEventListener('click', function () {
      state.visibleCount = Math.min(state.filtered.length, state.visibleCount + state.pageSize);
      renderResults();
    });

    elements.download.addEventListener('click', downloadChart);
    elements.print.addEventListener('click', printChart);
    elements.retry.addEventListener('click', loadData);

    root._msfDestroy = function () {
      if (state.controller) state.controller.abort();
    };

    loadData();
  }

  function initAll(scope) {
    var context = scope && scope.querySelectorAll ? scope : document;
    if (context.matches && context.matches('[data-msf-root]')) createFinder(context);
    context.querySelectorAll('[data-msf-root]').forEach(createFinder);
  }

  window.MonroeTonerFinder = {
    initAll: initAll,
    version: '2.0.0'
  };

  onReady(function () {
    initAll(document);
  });

  document.addEventListener('shopify:section:load', function (event) {
    initAll(event.target);
  });

  document.addEventListener('shopify:section:unload', function (event) {
    var root = event.target.matches && event.target.matches('[data-msf-root]')
      ? event.target
      : event.target.querySelector('[data-msf-root]');
    if (root && typeof root._msfDestroy === 'function') root._msfDestroy();
  });
}());