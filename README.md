# 🏛️ 곡성군 AI 민원상담봇

## 프로젝트 개요

곡성군 AI 민원상담봇은 곡성군 민원편람 2025를 기반으로 한 지능형 AI 상담 시스템입니다. 기존 Streamlit 기반 애플리케이션을 현대적인 웹 애플리케이션으로 완전히 새롭게 개발하여 더 나은 사용자 경험을 제공합니다.

### 🎯 주요 목표
- 24시간 민원 상담 서비스 제공
- 곡성군 민원편람 기반 정확한 정보 제공
- 직관적이고 현대적인 사용자 인터페이스
- 모바일 친화적인 반응형 디자인
- PWA 지원으로 앱과 같은 사용자 경험

## ✨ 주요 기능

### 현재 구현된 기능
- ✅ **실시간 AI 채팅**: OpenAI GPT 기반 대화형 상담
- ✅ **타이핑 효과**: 실제 사람과 대화하는 듯한 자연스러운 응답
- ✅ **자주 묻는 질문**: 원클릭으로 빠른 질문 시작
- ✅ **PDF 파일 업로드**: 문서 기반 추가 상담 (UI 완성)
- ✅ **대화 내용 저장**: 로컬 스토리지를 통한 대화 기록 관리
- ✅ **설정 관리**: API 키 설정, 응답 속도 조절
- ✅ **반응형 디자인**: 모바일, 태블릿, 데스크톱 완벽 지원
- ✅ **PWA 지원**: 앱처럼 설치 가능
- ✅ **오프라인 기본 지원**: Service Worker를 통한 캐싱
- ✅ **접근성 고려**: 키보드 네비게이션, 시각적 피드백

### 구현 예정 기능
- 🔄 **고급 PDF 처리**: PDF.js를 통한 실제 문서 분석
- 🔄 **벡터 데이터베이스**: 실제 RAG 구현을 위한 임베딩 처리
- 🔄 **다국어 지원**: 영어, 중국어 등 다국어 인터페이스
- 🔄 **음성 인식**: Web Speech API를 통한 음성 질문
- 🔄 **다크 모드**: 사용자 선호도에 따른 테마 전환

## 🛠️ 기술 스택

### Frontend
- **HTML5**: 시맨틱 마크업
- **CSS3**: Flexbox, Grid, 애니메이션
- **Tailwind CSS**: 유틸리티 기반 스타일링
- **JavaScript (ES6+)**: 모던 JavaScript 문법
- **Font Awesome**: 아이콘 라이브러리
- **Google Fonts**: Inter 폰트 패밀리

### 외부 서비스
- **OpenAI API**: GPT-3.5/4 기반 대화 생성
- **jsDelivr CDN**: 빠른 라이브러리 로딩

### PWA 기술
- **Service Worker**: 오프라인 지원 및 캐싱
- **Web App Manifest**: 네이티브 앱과 같은 설치 경험
- **Local Storage**: 클라이언트 사이드 데이터 저장

## 📁 프로젝트 구조

```
📦 gokseong-ai-chatbot/
├── 📄 index.html              # 메인 페이지
├── 📄 manifest.json           # PWA 매니페스트
├── 📄 sw.js                   # Service Worker
├── 📄 README.md               # 프로젝트 문서
├── 📁 css/
│   └── 📄 style.css           # 커스텀 스타일
├── 📁 js/
│   ├── 📄 main.js             # 메인 애플리케이션 로직
│   └── 📄 utils.js            # 유틸리티 함수들
└── 📁 docs/                   # 추가 문서 (계획)
    ├── 📄 api.md              # API 문서
    └── 📄 deployment.md       # 배포 가이드
```

## 🚀 시작하기

### 1. 프로젝트 클론
```bash
# 프로젝트를 로컬에 복사
git clone <repository-url>
cd gokseong-ai-chatbot
```

### 2. 웹 서버 실행
```bash
# Python 3을 사용하는 경우
python -m http.server 8000

# Node.js를 사용하는 경우
npx serve .

# Live Server (VS Code 확장)을 사용하는 경우
# VS Code에서 index.html 우클릭 -> "Open with Live Server"
```

### 3. 브라우저에서 접속
```
http://localhost:8000
```

### 4. OpenAI API 키 설정
1. 상단 우측 ⚙️ 설정 버튼 클릭
2. OpenAI API 키 입력 (sk-로 시작하는 키)
3. 저장 버튼 클릭

## 🔧 설정 및 사용법

### API 키 설정
- OpenAI API 키가 필요합니다 ([OpenAI Platform](https://platform.openai.com/)에서 발급)
- 설정에서 API 키를 입력하면 브라우저에 안전하게 저장됩니다
- API 키는 OpenAI와의 통신에만 사용되며 외부로 전송되지 않습니다

### 기본 사용법
1. **질문 입력**: 하단 텍스트 입력창에 민원 관련 질문 입력
2. **자주 묻는 질문**: 왼쪽 사이드바의 미리 준비된 질문 클릭
3. **파일 업로드**: 📎 버튼을 통해 PDF 파일 업로드 (향후 구현 예정)
4. **대화 저장**: 대화 내용은 자동으로 브라우저에 저장됩니다

### 키보드 단축키
- `Enter`: 메시지 전송
- `Shift + Enter`: 줄바꿈
- `Esc`: 모달 창 닫기

## 🔄 개발 가이드

### 코드 구조
- **`main.js`**: 메인 애플리케이션 클래스 (`GokseongChatbot`)
- **`utils.js`**: 유틸리티 함수들 (텍스트 처리, 저장, 파일 처리 등)
- **`style.css`**: 추가 스타일 및 애니메이션

### 주요 클래스
```javascript
// 메인 애플리케이션
class GokseongChatbot {
    constructor()           // 초기화
    sendMessage()          // 메시지 전송
    processRAGQuery()      // RAG 쿼리 처리
    addTypingMessage()     // 타이핑 효과가 있는 메시지 추가
}

// 유틸리티 클래스들
class TextProcessor        // 텍스트 처리
class StorageManager      // 로컬 저장소 관리
class FileHandler         // 파일 처리
class AnimationHelper     // 애니메이션 도우미
class Analytics          // 분석 및 추적
```

### 개발 서버 실행
```bash
# 개발용 라이브 서버 (파일 변경 시 자동 새로고침)
npx live-server --port=8000

# 또는 Python의 간단한 서버
python -m http.server 8000
```

## 🌐 배포 가이드

### 정적 웹 호스팅
이 프로젝트는 순수 정적 웹사이트이므로 다양한 플랫폼에 배포 가능합니다:

- **GitHub Pages**: 무료 호스팅
- **Netlify**: 자동 배포 및 CDN
- **Vercel**: 빠른 배포 및 성능 최적화
- **Firebase Hosting**: Google의 호스팅 서비스

### 배포 전 체크리스트
- [ ] OpenAI API 키 테스트 완료
- [ ] 모든 링크 및 경로 확인
- [ ] 반응형 디자인 테스트 (모바일/태블릿/데스크톱)
- [ ] PWA 기능 테스트 (설치, 오프라인 작동)
- [ ] 브라우저 호환성 확인

## 📊 성능 최적화

### 이미 적용된 최적화
- **CDN 사용**: Tailwind CSS, Font Awesome 등
- **이미지 최적화**: SVG 아이콘 사용
- **코드 분할**: 메인 로직과 유틸리티 분리
- **캐싱 전략**: Service Worker를 통한 효율적 캐싱
- **애니메이션 최적화**: CSS3 하드웨어 가속 활용

### 향후 개선 계획
- 번들링 및 압축 (Webpack, Rollup)
- 이미지 lazy loading
- 코드 분할 및 동적 import
- 성능 모니터링 도구 통합

## 🔒 보안 고려사항

### 현재 보안 기능
- **API 키 보호**: 로컬 저장소에만 저장, 외부 전송 없음
- **HTTPS 필수**: 프로덕션 배포 시 HTTPS 사용 권장
- **입력 검증**: 사용자 입력에 대한 기본적인 검증
- **XSS 방지**: innerHTML 대신 textContent 사용

### 보안 권장사항
- API 키는 절대 코드에 하드코딩하지 않음
- HTTPS 환경에서만 사용
- 정기적인 의존성 업데이트
- CSP (Content Security Policy) 헤더 설정 권장

## 🤝 기여 가이드

### 개발 참여
1. 이슈 등록 또는 기존 이슈 확인
2. 포크 후 새로운 브랜치 생성
3. 변경사항 구현 및 테스트
4. Pull Request 제출

### 코드 스타일
- ES6+ 모던 JavaScript 사용
- 함수와 변수명은 camelCase
- 클래스명은 PascalCase
- 주석은 한국어/영어 혼용 가능

## 📞 지원 및 연락처

### 기술 문의
- 이슈 등록: GitHub Issues
- 이메일: [담당자 이메일]

### 곡성군 민원 문의
- 전화: 061-360-8000
- 주소: 전라남도 곡성군 곡성읍 군청로 31
- 운영시간: 평일 09:00-18:00

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 LICENSE 파일을 참조하세요.

## 🙏 감사의 말

이 프로젝트는 곡성군 민원 서비스 개선을 위해 개발되었습니다. 더 나은 민원 서비스를 위해 기여해주신 모든 분들께 감사드립니다.

---

**최종 업데이트**: 2025년 1월
**프로젝트 버전**: v1.0.0
**개발자**: AI 지원 개발팀