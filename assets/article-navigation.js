(function () {
  'use strict';

  function slugify(value) {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'article-section';
  }

  function uniqueHeadingId(heading, usedIds) {
    var base = heading.id ? heading.id : slugify(heading.textContent || '');
    var candidate = base;
    var suffix = 2;

    while (usedIds.has(candidate) || (document.getElementById(candidate) && document.getElementById(candidate) !== heading)) {
      candidate = base + '-' + suffix;
      suffix += 1;
    }

    usedIds.add(candidate);
    heading.id = candidate;
    return candidate;
  }

  function buildTableOfContents(root) {
    var content = root.querySelector('[data-article-content]');
    var toc = root.querySelector('[data-article-toc]');
    var list = root.querySelector('[data-article-toc-list]');
    if (!content || !toc || !list) return;

    var headings = Array.prototype.slice.call(content.querySelectorAll('h2, h3'));
    if (headings.length < 3) return;

    var usedIds = new Set();
    var linkMap = new Map();
    var fragment = document.createDocumentFragment();

    headings.forEach(function (heading) {
      var id = uniqueHeadingId(heading, usedIds);
      var item = document.createElement('li');
      var link = document.createElement('a');

      item.dataset.level = heading.tagName === 'H3' ? '3' : '2';
      link.href = '#' + id;
      link.textContent = heading.textContent.trim();
      item.appendChild(link);
      fragment.appendChild(item);
      linkMap.set(heading, link);
    });

    list.appendChild(fragment);
    toc.hidden = false;
    if (window.matchMedia('(min-width: 990px)').matches) toc.open = true;

    if (!('IntersectionObserver' in window)) return;

    var visibleHeadings = new Set();
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) visibleHeadings.add(entry.target);
        else visibleHeadings.delete(entry.target);
      });

      var active = headings.find(function (heading) { return visibleHeadings.has(heading); });
      if (!active) {
        active = headings.slice().reverse().find(function (heading) {
          return heading.getBoundingClientRect().top < 150;
        });
      }

      linkMap.forEach(function (link, heading) {
        if (heading === active) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }, {
      rootMargin: '-120px 0px -65% 0px',
      threshold: 0
    });

    headings.forEach(function (heading) { observer.observe(heading); });
  }

  function fallbackCopy(value) {
    var field = document.createElement('textarea');
    field.value = value;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.appendChild(field);
    field.select();
    var copied = document.execCommand('copy');
    field.remove();
    return copied;
  }

  function setupCopyLink(root) {
    var button = root.querySelector('[data-copy-article-link]');
    var status = root.querySelector('[data-copy-status]');
    if (!button) return;

    button.addEventListener('click', function () {
      var url = window.location.href.split('#')[0];
      var copyPromise;

      if (navigator.clipboard && window.isSecureContext) {
        copyPromise = navigator.clipboard.writeText(url);
      } else {
        copyPromise = fallbackCopy(url) ? Promise.resolve() : Promise.reject(new Error('Copy failed'));
      }

      copyPromise.then(function () {
        button.textContent = button.dataset.copiedLabel || 'Copied';
        if (status) status.textContent = 'Article link copied to your clipboard.';
        window.setTimeout(function () {
          button.textContent = button.dataset.copyLabel || 'Copy link';
          if (status) status.textContent = '';
        }, 2200);
      }).catch(function () {
        if (status) status.textContent = 'Copying was not available. Please copy the address from your browser.';
      });
    });
  }

  function init() {
    document.querySelectorAll('[data-article-navigation]').forEach(function (root) {
      buildTableOfContents(root);
      setupCopyLink(root);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();