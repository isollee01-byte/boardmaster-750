'use strict';

(() => {
  const config = window.BOARDMASTER_CONFIG || {};
  const kakaoButton = document.querySelector('#kakao-chat-button');
  const kakaoNotice = document.querySelector('#kakao-chat-notice');
  const kakaoClose = document.querySelector('#kakao-notice-close');
  let kakaoUrl = '';
  try {
    const candidate = new URL(config.kakaoChannelUrl);
    if (['http:', 'https:'].includes(candidate.protocol) && candidate.hostname === 'pf.kakao.com' && !candidate.username && !candidate.password) kakaoUrl = candidate.href;
  } catch { /* Channel URL is intentionally empty until the channel opens. */ }
  if (kakaoUrl) {
    kakaoButton.setAttribute('aria-label', '카카오톡 문의 — 새 창에서 열기');
    kakaoButton.removeAttribute('aria-controls');
    kakaoButton.removeAttribute('aria-expanded');
  }
  function closeKakaoNotice() {
    kakaoNotice.hidden = true; kakaoButton.setAttribute('aria-expanded', 'false');
  }
  kakaoButton.addEventListener('click', () => {
    if (kakaoUrl) { window.open(kakaoUrl, '_blank', 'noopener,noreferrer'); return; }
    kakaoNotice.hidden = !kakaoNotice.hidden;
    kakaoButton.setAttribute('aria-expanded', String(!kakaoNotice.hidden));
  });
  kakaoClose.addEventListener('click', () => { closeKakaoNotice(); kakaoButton.focus(); });
  const menuButton = document.querySelector('.menu-toggle');
  const navigation = document.querySelector('#navigation');
  function closeMenu() {
    if (!menuButton || !navigation) return;
    menuButton.setAttribute('aria-label', '메뉴 열기');
    menuButton.setAttribute('aria-expanded', 'false');
    navigation.classList.remove('open');
  }
  if (menuButton && navigation) {
    menuButton.addEventListener('click', () => {
      const open = menuButton.getAttribute('aria-expanded') !== 'true';
      menuButton.setAttribute('aria-expanded', String(open));
      menuButton.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
      navigation.classList.toggle('open', open);
    });
    navigation.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
  }
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (!kakaoNotice.hidden) { closeKakaoNotice(); kakaoButton.focus(); return; }
    if (navigation?.classList.contains('open')) { closeMenu(); menuButton.focus(); }
  });
  document.addEventListener('click', event => {
    if (!kakaoNotice.hidden && !event.target.closest('.kakao-floating')) closeKakaoNotice();
  });
})();
