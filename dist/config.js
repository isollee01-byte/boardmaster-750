// 운영 전 실제 HTTPS 수신 API와 승인된 처리방침을 준비한 뒤 설정합니다.
// API는 JSON POST를 받고, 접수·저장 완료 후 { "ok": true }를 반환해야 합니다.
// 카카오톡 채널 개설 후 http://pf.kakao.com/.../chat 주소를 입력합니다.
window.BOARDMASTER_CONFIG = { inquiryEndpoint: '', privacyApproved: false, kakaoChannelUrl: 'http://pf.kakao.com/_lxjCvX/chat' };
