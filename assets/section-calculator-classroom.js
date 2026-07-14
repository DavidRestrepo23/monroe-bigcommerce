(() => {
  const sections = document.querySelectorAll('[data-calculator-classroom]');

  sections.forEach((section) => {
    const searches = Array.from(section.querySelectorAll('[data-cc-search]'));
    const lessons = Array.from(section.querySelectorAll('[data-cc-lesson]'));
    const chapters = Array.from(section.querySelectorAll('[data-cc-chapter]'));
    const tocLinks = Array.from(section.querySelectorAll('.cc-toc a[href^="#"]'));
    const status = section.querySelector('[data-cc-search-status]');
    const backToTop = section.querySelector('[data-cc-back-to-top]');

    const normalize = (value) => value.toLowerCase().replace(/\s+/g, ' ').trim();

    const filterCourse = (rawValue) => {
      const value = normalize(rawValue);
      let visibleLessons = 0;

      searches.forEach((input) => {
        if (input.value !== rawValue) input.value = rawValue;
      });

      lessons.forEach((lesson) => {
        const matches = !value || normalize(lesson.textContent).includes(value);
        lesson.hidden = !matches;
        if (matches) visibleLessons += 1;
      });

      chapters.forEach((chapter) => {
        const chapterLessons = Array.from(chapter.querySelectorAll('[data-cc-lesson]'));
        chapter.hidden = value && chapterLessons.length > 0 && chapterLessons.every((lesson) => lesson.hidden);
      });

      tocLinks.forEach((link) => {
        const target = section.querySelector(link.getAttribute('href'));
        const item = link.closest('li');
        if (item && target && target.matches('[data-cc-lesson]')) {
          item.hidden = target.hidden;
        }
      });

      section.querySelectorAll('.cc-toc__group').forEach((group) => {
        const visibleItems = Array.from(group.querySelectorAll('li')).some((item) => !item.hidden);
        group.hidden = value && !visibleItems;
        if (value && visibleItems) group.open = true;
      });

      if (status) {
        status.textContent = value
          ? `${visibleLessons} topic${visibleLessons === 1 ? '' : 's'} found`
          : '';
      }
    };

    searches.forEach((input) => {
      input.addEventListener('input', (event) => filterCourse(event.target.value));
    });

    tocLinks.forEach((link) => {
      link.addEventListener('click', () => {
        const mobilePanel = link.closest('.cc-mobile-tools');
        if (mobilePanel) mobilePanel.open = false;
      });
    });

    if ('IntersectionObserver' in window) {
      const tracked = Array.from(section.querySelectorAll('[data-cc-lesson][id], [data-cc-chapter][id], #additional-resources'));
      const observer = new IntersectionObserver((entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];

        if (!visible) return;
        const id = visible.target.id;
        tocLinks.forEach((link) => {
          link.classList.toggle('is-active', link.getAttribute('href') === `#${id}`);
        });
      }, { rootMargin: '-18% 0px -70% 0px', threshold: 0 });

      tracked.forEach((item) => observer.observe(item));
    }

    const updateBackToTop = () => {
      if (!backToTop) return;
      const rect = section.getBoundingClientRect();
      const show = rect.top < -650 && rect.bottom > 300;
      backToTop.classList.toggle('is-visible', show);
    };

    window.addEventListener('scroll', updateBackToTop, { passive: true });
    updateBackToTop();

    backToTop?.addEventListener('click', () => {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
})();