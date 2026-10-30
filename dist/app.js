'use strict';
const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#navigation');
function closeMenu() { menuButton.setAttribute('aria-label', '메뉴 열기'); menuButton.setAttribute('aria-expanded', 'false'); navigation.classList.remove('open'); }
menuButton.addEventListener('click', () => { const open = menuButton.getAttribute('aria-expanded') !== 'true'; menuButton.setAttribute('aria-expanded', String(open)); menuButton.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기'); navigation.classList.toggle('open', open); });
navigation.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeMenu(); menuButton.focus(); } });
document.querySelectorAll('[data-inquiry]').forEach(link => link.addEventListener('click', () => { document.querySelector('[name="type"]').value = link.dataset.inquiry; }));
const form = document.querySelector('#inquiry-form');
const status = document.querySelector('#form-status');
const submitButton = form.querySelector('button[type="submit"]');
const config = window.BOARDMASTER_CONFIG || {};
const connected = Boolean(config.inquiryEndpoint && config.privacyApproved);
if (connected) { document.querySelector('#form-notice').textContent = '제품 용도와 현장 조건을 남겨주세요. 담당자가 확인 후 연락드립니다.'; document.querySelector('#submit-label').textContent = '상담 문의 접수'; document.querySelector('#consent-row').hidden = false; form.elements.consent.required = true; }
form.addEventListener('submit', async event => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  if (!data.name.trim() || !data.message.trim()) { status.textContent = '이름과 문의 내용을 공백 없이 입력해 주세요.'; return; }
  if (!/^[+\d\s().-]{7,30}$/.test(data.phone) || data.phone.replace(/\D/g, '').length < 7) { status.textContent = '연락 가능한 전화번호를 확인해 주세요.'; form.elements.phone.focus(); return; }
  submitButton.disabled = true;
  if (!connected) {
    const text = `보드마스터 750 상담 문의\n문의 유형: ${data.type}\n이름/회사명: ${data.name}\n연락처: ${data.phone}\n이메일: ${data.email || '-'}\n예상 수량: ${data.quantity || '-'}\n납품 지역/일정: ${data.delivery || '-'}\n문의 내용: ${data.message}`;
    try { await navigator.clipboard.writeText(text); status.textContent = '문의 내용을 복사했습니다. 아직 접수되지 않았습니다. 상담 시 활용해 주세요.'; } catch { const fallback = document.querySelector('#copy-fallback'); fallback.hidden = false; fallback.value = text; fallback.focus(); fallback.select(); status.textContent = '아래 내용을 선택해 직접 복사하세요. 아직 접수되지 않았습니다.'; }
    submitButton.disabled = false; return;
  }
  status.textContent = '문의 내용을 전송하고 있습니다…';
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 15000);
  try { const response = await fetch(config.inquiryEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), signal: controller.signal }); const result = await response.json(); if (!response.ok || result.ok !== true) throw new Error('접수 실패'); status.textContent = '문의가 접수되었습니다. 담당자가 확인 후 연락드리겠습니다.'; form.reset(); } catch { status.textContent = '접수를 확인하지 못했습니다. 입력 내용은 유지됩니다. 잠시 후 다시 시도하거나 담당자에게 문의해 주세요.'; } finally { clearTimeout(timeout); submitButton.disabled = false; }
});
