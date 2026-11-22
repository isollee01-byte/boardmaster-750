'use strict';

(() => {
  const menu = document.querySelector('#site-language');
  const languages = new Set(Array.from(menu.options, option => option.value));
  const currentUrl = new URL(window.location.href);
  const requested = currentUrl.searchParams.get('lang');
  const language = languages.has(requested) ? requested : 'ko';
  const attributes = ['alt', 'aria-label', 'placeholder', 'title', 'content'];

  menu.value = language;
  menu.addEventListener('change', () => {
    if (menu.value === 'ko') currentUrl.searchParams.delete('lang');
    else currentUrl.searchParams.set('lang', menu.value);
    window.location.assign(currentUrl.href);
  });
  if (language === 'ko') return;

  function localizeLink(link) {
    const href = link.getAttribute('href');
    if (!href || href.startsWith('#') || link.hasAttribute('download')) return;
    const url = new URL(link.href);
    if (url.origin !== currentUrl.origin || !/\/(?:index\.html|products\.html|privacy\.html)?$/.test(url.pathname)) return;
    if (url.searchParams.get('lang') === language) return;
    url.searchParams.set('lang', language);
    link.href = url.href;
  }

  async function applyLanguage() {
    const response = await fetch('locale-' + language + '.json');
    if (!response.ok) throw new Error('Locale file unavailable');
    const dictionary = await response.json();
    const translate = text => text.replace(/^\s*(.*?)\s*$/s, (full, key) =>
      Object.hasOwn(dictionary, key) ? full.replace(key, () => dictionary[key]) : full
    );
    const setText = node => {
      if (node.parentElement?.closest('script, style, textarea, code, [translate="no"]')) return;
      const value = translate(node.nodeValue);
      if (value !== node.nodeValue) node.nodeValue = value;
    };
    function localizeElement(element) {
      if (element.matches('a[href]')) localizeLink(element);
      if (element.closest('[translate="no"]')) return;
      for (const name of attributes) {
        const original = element.getAttribute(name);
        if (!original) continue;
        const value = translate(original);
        if (value !== original) element.setAttribute(name, value);
      }
    }
    function localizeSubtree(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        setText(node);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        localizeElement(node);
        node.querySelectorAll('a[href], [alt], [aria-label], [placeholder], [title], meta[content]').forEach(localizeElement);
        const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) setText(walker.currentNode);
      }
    }

    localizeSubtree(document.documentElement);
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    const observer = new MutationObserver(records => {
      for (const record of records) {
        if (record.type === 'attributes') localizeElement(record.target);
        if (record.type === 'characterData') setText(record.target);
        for (const node of record.addedNodes) localizeSubtree(node);
      }
    });
    observer.observe(document.documentElement, {
      subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: attributes
    });
  }

  applyLanguage().catch(error => {
    console.error(error);
    menu.value = 'ko';
    document.querySelector('#site-language-status').hidden = false;
  });
})();
