'use strict';
const resourceSearch = document.querySelector('#resource-search');
const resourceCategory = document.querySelector('#resource-category');
let resourceRows = [...document.querySelectorAll('.resource-row')];
function createResourcePlaceholder(category) {
  const titles = { '제품자료': '제품 기술자료 (TDS)', '안전자료': '안전보건자료 (SDS)', '시공자료': '시공 안내서' };
  const row = document.createElement('details'); row.className = 'resource-row'; row.dataset.category = category;
  const summary = document.createElement('summary');
  for (const [className, text] of [['resource-category', category], ['resource-title', titles[category]], ['resource-state', '준비 중']]) {
    const span = document.createElement('span'); span.className = className; span.textContent = text; summary.append(span);
  }
  const body = document.createElement('div'); body.className = 'resource-body';
  const description = document.createElement('p'); description.textContent = '현재 제공할 자료를 준비하고 있습니다. 필요한 자료는 상담으로 문의해 주세요.';
  const link = document.createElement('a'); link.className = 'text-link'; link.href = '#contact'; link.textContent = '관련 자료 문의 ↗';
  body.append(description, link); row.append(summary, body); return row;
}
async function loadResources() {
  try {
    const response = await fetch('resources/index.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('자료 목록 조회 실패');
    const items = await response.json();
    const list = document.querySelector('.resource-list');
    const fragment = document.createDocumentFragment();
    const categories = ['제품자료', '안전자료', '시공자료'];
    for (const category of categories) {
      const files = items.filter(item => item.category === category);
      if (!files.length) {
        fragment.append(createResourcePlaceholder(category));
        continue;
      }
      for (const item of files) {
        const row = document.createElement('details');
        row.className = 'resource-row'; row.dataset.category = category;
        const summary = document.createElement('summary');
        for (const [className, text] of [['resource-category', category], ['resource-title', item.title], ['resource-state', '다운로드 가능']]) {
          const span = document.createElement('span'); span.className = className; span.textContent = text; summary.append(span);
        }
        const body = document.createElement('div'); body.className = 'resource-body';
        const link = document.createElement('a'); link.className = 'text-link';
        // Only files in the designated local resource folders may be linked.
        if (!/^resources\/(product|safety|installation)\/[^/]+$/.test(item.url)) throw new Error('자료 경로 오류');
        link.href = item.url; link.download = item.filename; link.textContent = '파일 내려받기 ↓';
        body.append(link); row.append(summary, body); fragment.append(row);
      }
    }
    list.replaceChildren(fragment);
    resourceRows = [...list.querySelectorAll('.resource-row')];
    document.querySelector('#resource-notice').textContent = items.length
      ? '자료 제목을 누르면 첨부파일을 내려받을 수 있습니다. 자료가 없는 분류는 준비 중으로 표시됩니다.'
      : '현재 공개된 첨부파일은 없습니다. 자료 제목을 누르면 제공 상태와 문의 안내를 확인할 수 있습니다.';
    filterResources();
  } catch {
    document.querySelector('#resource-notice').textContent = '자료 목록을 불러오지 못했습니다. 새로고침하거나 상담 문의를 이용해 주세요.';
  }
}
function filterResources() {
  const query = resourceSearch.value.trim().toLocaleLowerCase('ko');
  const category = resourceCategory.value;
  let count = 0;
  resourceRows.forEach(row => {
    const matches = (!category || row.dataset.category === category) && row.textContent.toLocaleLowerCase('ko').includes(query);
    row.hidden = !matches;
    if (matches) count++;
  });
  document.querySelector('#resource-count').textContent = `전체 ${count}건`;
  document.querySelector('#resource-empty').hidden = count !== 0;
}
resourceSearch.addEventListener('input', filterResources);
resourceCategory.addEventListener('change', filterResources);
loadResources();
const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#navigation');
function closeMenu() { menuButton.setAttribute('aria-label', '메뉴 열기'); menuButton.setAttribute('aria-expanded', 'false'); navigation.classList.remove('open'); }
menuButton.addEventListener('click', () => { const open = menuButton.getAttribute('aria-expanded') !== 'true'; menuButton.setAttribute('aria-expanded', String(open)); menuButton.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기'); navigation.classList.toggle('open', open); });
navigation.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeMenu(); menuButton.focus(); } });
document.querySelectorAll('[data-inquiry]').forEach(link => link.addEventListener('click', () => { document.querySelector('[name="type"]').value = link.dataset.inquiry; }));
const form = document.querySelector('#inquiry-form');
const catalogProduct = new URLSearchParams(window.location.search).get('product')?.trim();
if (catalogProduct && catalogProduct.length <= 100 && !form.elements.message.value) {
  form.elements.type.value = '제품·시공 상담';
  form.elements.message.value = `문의 제품: ${catalogProduct}\n\n`;
}
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
  try { const response = await fetch(config.inquiryEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), signal: controller.signal }); const result = await response.json(); if (!response.ok || result.ok !== true) throw new Error('접수 실패'); status.textContent = '문의가 접수되었습니다. 담당자가 확인 후 연락드리겠습니다.'; form.reset();   } catch { status.textContent = '접수를 확인하지 못했습니다. 입력 내용은 유지됩니다. 잠시 후 다시 시도하거나 담당자에게 문의해 주세요.'; } finally { clearTimeout(timeout); submitButton.disabled = false; }
});
