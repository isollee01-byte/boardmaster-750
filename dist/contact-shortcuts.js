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
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !kakaoNotice.hidden) { closeKakaoNotice(); kakaoButton.focus(); }
  });
  document.addEventListener('click', event => {
    if (!kakaoNotice.hidden && !event.target.closest('.kakao-floating')) closeKakaoNotice();
  });
})();
