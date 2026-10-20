(() => {
  const init = (root) => {
    if (root.dataset.tccReady) return;
    root.dataset.tccReady = 'true';
    const brand = root.querySelector('[data-tcc-brand]');
    const model = root.querySelector('[data-tcc-model]');
    const empty = root.querySelector('[data-tcc-empty]');
    const cards = Array.from(root.querySelectorAll('[data-tcc-result]'));
    const options = Array.from(model.options).slice(1);

    const show = () => {
      const selected = model.value;
      cards.forEach((card) => { card.hidden = card.dataset.tccResult !== selected; });
      empty.hidden = Boolean(selected);
    };
    const filter = () => {
      model.value = '';
      model.disabled = !brand.value;
      options.forEach((option) => {
        option.hidden = option.dataset.brand !== brand.value;
        option.disabled = option.hidden;
      });
      show();
    };
    brand.addEventListener('change', filter);
    model.addEventListener('change', show);
    filter();
  };
  const boot = () => document.querySelectorAll('.tcc').forEach(init);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  document.addEventListener('shopify:section:load', boot);
})();