(() => {
  const roots = document.querySelectorAll('[data-article-root]');

  roots.forEach((root) => {
    const body = root.querySelector('[data-article-body]');
    const toc = root.querySelector('[data-article-toc]');
    const list = root.querySelector('[data-toc-links]');
    const toggle = root.querySelector('[data-toc-toggle]');
    const progress = document.querySelector('[data-article-progress] span');
    if (!body) return;

    const headings = [...body.querySelectorAll('h2, h3')].filter((heading) =>
      heading.textContent.trim() && !heading.closest('.article-share')
    );

    const slugify = (text) => text.toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');

    if (toc && list && headings.length > 1) {
      toc.classList.remove('article-toc--empty');
      const used = new Set();

      headings.forEach((heading, index) => {
        let id = heading.id || slugify(heading.textContent) || `article-section-${index + 1}`;
        const base = id;
        let suffix = 2;
        while (used.has(id) || (document.getElementById(id) && document.getElementById(id) !== heading)) {
          id = `${base}-${suffix++}`;
        }
        used.add(id);
        heading.id = id;

        const item = document.createElement('li');
        if (heading.tagName === 'H3') item.className = 'article-toc__subitem';
        const link = document.createElement('a');
        link.href = `#${id}`;
        link.textContent = heading.textContent.trim();
        item.appendChild(link);
        list.appendChild(item);
      });

      const links = [...list.querySelectorAll('a')];
      const activate = (id) => links.forEach((link) => {
        const active = link.hash === `#${id}`;
        link.classList.toggle('is-active', active);
        if (active) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });

      const observer = new IntersectionObserver((entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) activate(visible[0].target.id);
      }, { rootMargin: '-18% 0px -70% 0px' });
      headings.forEach((heading) => observer.observe(heading));

      links.forEach((link) => link.addEventListener('click', () => {
        toc.classList.remove('is-open');
        toggle?.setAttribute('aria-expanded', 'false');
      }));

      toggle?.addEventListener('click', () => {
        const open = toc.classList.toggle('is-open');
        toggle.setAttribute('aria-expanded', String(open));
      });
    }

    const updateProgress = () => {
      if (!progress) return;
      const rect = body.getBoundingClientRect();
      const start = window.scrollY + rect.top - window.innerHeight * 0.2;
      const end = start + body.offsetHeight - window.innerHeight * 0.6;
      const ratio = Math.min(1, Math.max(0, (window.scrollY - start) / Math.max(1, end - start)));
      progress.style.transform = `scaleX(${ratio})`;
    };

    updateProgress();
    window.addEventListener('scroll', updateProgress, { passive: true });
    window.addEventListener('resize', updateProgress, { passive: true });
  });
})();