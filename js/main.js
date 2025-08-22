// main.js – 곡성군 AI 민원상담 챗봇 (Cloudflare 완전 호환 버전)

class GokseongChatbot {
    constructor() {
        this.messages = [];
        this.apiKey = localStorage.getItem('openai_api_key') || null;
        this.questionCount = 0;
        this.processing = false;
        this.typingSpeed = parseFloat(localStorage.getItem('typing_speed')) || 0.02;
        this.ragEngine = null;
        this.ragInitialized = false;
        this.fileNames = ['곡성군 민원편람 2025'];
        this.isCloudflareEnv = this.detectCloudflareEnvironment();
        this.initializeWhenReady();
    }

    detectCloudflareEnvironment() {
        // Cloudflare Pages 또는 Workers 환경 감지
        return (
            typeof window !== 'undefined' && (
                window.location.hostname.includes('.pages.dev') ||
                window.location.hostname.includes('.workers.dev') ||
                window.location.hostname.includes('cloudflare') ||
                navigator.userAgent.includes('Cloudflare')
            )
        );
    }

    async initializeWhenReady() {
        // 페이지 로드 완료 대기
        if (document.readyState === 'loading') {
            await new Promise(resolve => {
                document.addEventListener('DOMContentLoaded', resolve);
            });
        }

        // Cloudflare 환경에서는 복잡한 라이브러리 로딩 건너뛰기
        if (!this.isCloudflareEnv) {
            await this.waitForLibraries();
        }

        // 실제 초기화 진행
        await this.init();
    }

    async waitForLibraries() {
        // Cloudflare가 아닌 환경에서만 실행
        if (this.isCloudflareEnv) return;

        // TensorFlow.js 로드 대기 (선택적, 타임아웃 적용)
        try {
            await this.waitForLibraryWithTimeout('tf', 5000);
            console.log('TensorFlow.js 로드됨');
        } catch (e) {
            console.warn('TensorFlow.js 로드 실패 - 기본 모드로 진행');
        }
    }

    async waitForLibraryWithTimeout(libraryName, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            
            const checkLibrary = () => {
                if (typeof window[libraryName] !== 'undefined') {
                    resolve(window[libraryName]);
                } else if (Date.now() - startTime > timeout) {
                    reject(new Error(`${libraryName} 로드 타임아웃`));
                } else {
                    setTimeout(checkLibrary, 100);
                }
            };
            
            checkLibrary();
        });
    }

    async init() {
        this.bindEvents();
        this.updateAPIKeyStatus();
        this.setupMessageInput();
        this.loadSuggestedQuestions();

        // RAG 엔진 초기화 (Cloudflare 환경에서는 비활성화)
        if (!this.isCloudflareEnv) {
            try {
                if (typeof RAGEngine !== 'undefined' && typeof tf !== 'undefined') {
                    this.ragEngine = new RAGEngine();
                    await this.ragEngine.initialize();
                    this.ragInitialized = true;
                    console.log('RAG 엔진 초기화 완료');
                } else {
                    console.log('RAG 기능 비활성화 - 기본 OpenAI 채팅 모드');
                }
            } catch (e) {
                console.warn('RAG 엔진 초기화 실패, 기본 모드로 진행:', e);
                this.ragInitialized = false;
            }
        } else {
            console.log('Cloudflare 환경: RAG 기능 비활성화 - 기본 OpenAI 채팅 모드');
            this.ragInitialized = false;
        }

        // 타이핑 속도 설정
        const savedTypingSpeed = localStorage.getItem('typing_speed');
        if (savedTypingSpeed) {
            const speedSlider = document.getElementById('typingSpeed');
            if (speedSlider) {
                speedSlider.value = savedTypingSpeed;
            }
        }

        console.log('곡성군 AI 챗봇 초기화 완료' + (this.isCloudflareEnv ? ' (Cloudflare 호환 모드)' : ''));
    }

    bindEvents() {
        // Send button event
        const sendButton = document.getElementById('sendButton');
        if (sendButton) {
            sendButton.addEventListener('click', () => this.sendMessage());
        }

        // Message input events
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            messageInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
            messageInput.addEventListener('input', this.autoResizeTextarea);
        }

        // File upload button (Cloudflare 환경에서는 비활성화)
        const fileUploadBtn = document.getElementById('fileUploadBtn');
        const fileUpload = document.getElementById('fileUpload');
        if (fileUploadBtn && fileUpload) {
            if (this.isCloudflareEnv) {
                // Cloudflare 환경에서는 파일 업로드 버튼 비활성화
                fileUploadBtn.disabled = true;
                fileUploadBtn.title = 'Cloudflare 환경에서는 파일 업로드가 지원되지 않습니다';
                fileUploadBtn.style.opacity = '0.5';
            } else {
                fileUploadBtn.addEventListener('click', () => fileUpload.click());
                fileUpload.addEventListener('change', (e) => this.handleFileUpload(e));
            }
        }

        // Settings modal events
        const settingsBtn = document.getElementById('settingsBtn');
        const closeSettings = document.getElementById('closeSettings');
        const saveSettings = document.getElementById('saveSettings');
        const cancelSettings = document.getElementById('cancelSettings');
        const settingsModal = document.getElementById('settingsModal');

        if (settingsBtn) settingsBtn.addEventListener('click', () => this.openSettingsModal());
        if (closeSettings) closeSettings.addEventListener('click', () => this.closeSettingsModal());
        if (saveSettings) saveSettings.addEventListener('click', () => this.saveSettings());
        if (cancelSettings) cancelSettings.addEventListener('click', () => this.closeSettingsModal());
        
        if (settingsModal) {
            settingsModal.addEventListener('click', (e) => {
                if (e.target.id === 'settingsModal') this.closeSettingsModal();
            });
        }

        // Help modal events
        const helpBtn = document.getElementById('helpBtn');
        const closeHelp = document.getElementById('closeHelp');
        const helpModal = document.getElementById('helpModal');

        if (helpBtn) helpBtn.addEventListener('click', () => this.openHelpModal());
        if (closeHelp) closeHelp.addEventListener('click', () => this.closeHelpModal());
        
        if (helpModal) {
            helpModal.addEventListener('click', (e) => {
                if (e.target.id === 'helpModal') this.closeHelpModal();
            });
        }

        // Clear chat event
        const clearChat = document.getElementById('clearChat');
        if (clearChat) {
            clearChat.addEventListener('click', () => this.clearChat());
        }

        // Suggested questions
        document.querySelectorAll('.suggested-question').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const question = e.currentTarget.getAttribute('data-question');
                this.askSuggestedQuestion(question);
            });
        });

        // ESC 키로 모달 닫기
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeSettingsModal();
                this.closeHelpModal();
            }
        });
    }

    setupMessageInput() {
        const input = document.getElementById('messageInput');
        const sendButton = document.getElementById('sendButton');
        
        if (input && sendButton) {
            input.addEventListener('input', () => {
                const hasText = input.value.trim().length > 0;
                sendButton.disabled = !hasText || this.processing;
                
                if (hasText && !this.processing) {
                    sendButton.classList.remove('opacity-50', 'cursor-not-allowed');
                } else {
                    sendButton.classList.add('opacity-50', 'cursor-not-allowed');
                }
            });
        }
    }

    autoResizeTextarea(e) {
        const textarea = e.target;
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }

    async sendMessage() {
        const input = document.getElementById('messageInput');
        const message = input.value.trim();
        
        if (!message || this.processing) return;

        if (!this.apiKey) {
            this.showToast('OpenAI API 키를 먼저 설정해주세요.', 'error');
            this.openSettingsModal();
            return;
        }

        this.processing = true;
        input.value = '';
        input.style.height = 'auto';
        this.updateSendButton();
        
        this.addMessage('user', message);
        this.updateQuestionCount();
        this.showTypingIndicator();

        try {
            let response;
            
            // RAG 기능이 있으면 사용, 없으면 기본 OpenAI 호출
            if (this.ragInitialized && this.ragEngine && !this.isCloudflareEnv) {
                response = await this.processRAGQuery(message);
            } else {
                response = await this.processBasicQuery(message);
            }
            
            this.hideTypingIndicator();
            await this.addTypingMessage('ai', response);
            
        } catch (error) {
            console.error('Error processing message:', error);
            this.hideTypingIndicator();
            
            let errorMessage = '죄송합니다. 처리 중 오류가 발생했습니다. 다시 시도해주세요.';
            
            // OpenAI API 에러 상세 처리
            if (error.message.includes('401')) {
                errorMessage = 'API 키가 유효하지 않습니다. 설정에서 올바른 API 키를 입력해주세요.';
            } else if (error.message.includes('429')) {
                errorMessage = 'API 호출 한도를 초과했습니다. 잠시 후 다시 시도해주세요.';
            } else if (error.message.includes('network') || error.message.includes('fetch')) {
                errorMessage = '네트워크 연결을 확인해주세요. 인터넷 연결이 불안정할 수 있습니다.';
            }
            
            this.addMessage('ai', errorMessage);
            this.showToast('메시지 처리 중 오류가 발생했습니다.', 'error');
        }

        this.processing = false;
        this.updateSendButton();
    }

    async processBasicQuery(query) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30초 타임아웃

        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: [
                        {
                            role: 'system',
                            content: `당신은 곡성군의 친절한 AI 민원상담봇입니다. 곡성군 민원과 관련된 질문에 도움이 되는 답변을 제공해주세요. 
                            
정확하지 않은 정보는 제공하지 말고, 확실하지 않은 경우 곡성군청(061-360-8000)으로 문의하도록 안내해주세요.
                            
주요 민원 분야:
- 주민등록, 가족관계등록 등 증명서 발급
- 건축, 토지 관련 인허가
- 복지 및 보조금 신청
- 세금 및 지방세 관련 업무
- 농업, 축산업 관련 지원사업
- 교통, 도로 관련 민원
                            
친절하고 정확하게 답변해주세요.`
                        },
                        {
                            role: 'user',
                            content: query
                        }
                    ],
                    max_tokens: 1000,
                    temperature: 0.7
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`OpenAI API 오류: ${response.status} - ${errorData.error?.message || '알 수 없는 오류'}`);
            }

            const data = await response.json();
            return data.choices[0].message.content;

        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
                throw new Error('요청 시간이 초과되었습니다. 다시 시도해주세요.');
            }
            throw error;
        }
    }

    async processRAGQuery(query) {
        // Cloudflare 환경에서는 실행되지 않음
        if (this.isCloudflareEnv || !this.ragInitialized || !this.ragEngine) {
            return await this.processBasicQuery(query);
        }

        try {
            const { context, sources, forms } = await this.ragEngine.buildContext(query);
            
            const systemPrompt = `당신은 곡성군의 AI 민원상담봇입니다. 다음 문서 내용을 참고하여 정확하고 친절한 답변을 제공해주세요.

문서 내용: ${context}

답변 가이드라인:
1. 문서에 있는 정보를 바탕으로 정확한 답변을 제공하세요
2. 문서에 없는 내용은 추측하지 마세요
3. 필요시 곡성군청(061-360-8000)으로 문의하도록 안내하세요
4. 친절하고 이해하기 쉽게 설명해주세요`;

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: query }
                    ],
                    max_tokens: 1000,
                    temperature: 0.7
                })
            });

            if (!response.ok) {
                throw new Error(`OpenAI API 오류: ${response.status}`);
            }

            const data = await response.json();
            let answer = data.choices[0].message.content;

            // 출처 정보 추가
            if (sources.length > 0) {
                answer += '\n\n📋 **참고 문서:**\n' + sources.slice(0, 3).map(s => `• ${s}`).join('\n');
            }

            // 관련 서식 정보 추가
            if (forms.length > 0) {
                answer += '\n\n📝 **관련 서식:**\n' + forms.slice(0, 3).map(f => `• ${f}`).join('\n');
            }

            return answer;

        } catch (error) {
            console.error('RAG 처리 중 오류:', error);
            return await this.processBasicQuery(query);
        }
    }

    updateSendButton() {
        const btn = document.getElementById('sendButton');
        const messageInput = document.getElementById('messageInput');
        
        if (btn && messageInput) {
            const hasText = messageInput.value.trim().length > 0;
            btn.disabled = !hasText || this.processing;
            
            if (btn.disabled) {
                btn.classList.add('opacity-50', 'cursor-not-allowed');
            } else {
                btn.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        }
    }

    showTypingIndicator() {
        const messagesContainer = document.getElementById('messagesContainer');
        if (!messagesContainer) return;

        const indicator = document.createElement('div');
        indicator.id = 'typing-indicator';
        indicator.className = 'flex items-start space-x-3';
        indicator.innerHTML = `
            <div class="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                AI
            </div>
            <div class="flex-1 max-w-xs lg:max-w-md">
                <div class="bg-gray-100 rounded-lg px-4 py-2">
                    <div class="flex space-x-1">
                        <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.1s"></div>
                        <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
                    </div>
                </div>
                <div class="text-xs text-gray-500 mt-1">방금 전</div>
            </div>
        `;

        messagesContainer.appendChild(indicator);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    hideTypingIndicator() {
        const indicator = document.getElementById('typing-indicator');
        if (indicator) {
            indicator.remove();
        }
    }

    addMessage(type, content) {
        const messagesContainer = document.getElementById('messagesContainer');
        if (!messagesContainer) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = 'flex items-start space-x-3';

        const time = new Date().toLocaleTimeString('ko-KR', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });

        if (type === 'user') {
            messageDiv.innerHTML = `
                <div class="flex-1 max-w-xs lg:max-w-md ml-auto">
                    <div class="bg-blue-500 text-white rounded-lg px-4 py-2">
                        <p class="whitespace-pre-wrap">${this.escapeHtml(content)}</p>
                    </div>
                    <div class="text-xs text-gray-500 mt-1 text-right">${time}</div>
                </div>
                <div class="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    나
                </div>
            `;
        } else {
            messageDiv.innerHTML = `
                <div class="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    AI
                </div>
                <div class="flex-1 max-w-xs lg:max-w-md">
                    <div class="bg-gray-100 rounded-lg px-4 py-2">
                        <div class="whitespace-pre-wrap">${this.formatMessage(content)}</div>
                    </div>
                    <div class="text-xs text-gray-500 mt-1">${time}</div>
                </div>
            `;
        }

        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        // 메시지 저장
        this.messages.push({
            type,
            content,
            timestamp: new Date().toISOString()
        });
    }

    async addTypingMessage(type, content) {
        const messagesContainer = document.getElementById('messagesContainer');
        if (!messagesContainer) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = 'flex items-start space-x-3';

        const time = new Date().toLocaleTimeString('ko-KR', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });

        messageDiv.innerHTML = `
            <div class="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                AI
            </div>
            <div class="flex-1 max-w-xs lg:max-w-md">
                <div class="bg-gray-100 rounded-lg px-4 py-2">
                    <div class="typing-content whitespace-pre-wrap"></div>
                </div>
                <div class="text-xs text-gray-500 mt-1">${time}</div>
            </div>
        `;

        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        // 타이핑 효과
        const contentDiv = messageDiv.querySelector('.typing-content');
        const formattedContent = this.formatMessage(content);
        
        for (let i = 0; i < formattedContent.length; i++) {
            await new Promise(resolve => setTimeout(resolve, this.typingSpeed * 1000));
            contentDiv.innerHTML = formattedContent.substring(0, i + 1);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        // 메시지 저장
        this.messages.push({
            type,
            content,
            timestamp: new Date().toISOString()
        });
    }

    formatMessage(text) {
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code class="bg-gray-200 px-1 rounded">$1</code>')
            .replace(/https?:\/\/[^\s]+/g, '<a href="$&" target="_blank" class="text-blue-500 underline">$&</a>');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    askSuggestedQuestion(question) {
        const input = document.getElementById('messageInput');
        if (input) {
            input.value = question;
            this.sendMessage();
        }
    }

    updateQuestionCount() {
        this.questionCount++;
        const countElement = document.getElementById('questionCount');
        if (countElement) {
            countElement.textContent = `질문 ${this.questionCount}개`;
        }
    }

    updateAPIKeyStatus() {
        const statusElement = document.getElementById('apiStatus');
        const statusTextElement = document.getElementById('apiStatusText');
        
        if (statusElement && statusTextElement) {
            if (this.apiKey) {
                statusElement.className = 'text-green-500';
                statusTextElement.textContent = 'API 키 설정됨';
            } else {
                statusElement.className = 'text-red-500';
                statusTextElement.textContent = 'API 키 미설정';
            }
        }
    }

    loadSuggestedQuestions() {
        // 이미 HTML에 정의되어 있으므로 별도 로딩 불필요
        console.log('자주 묻는 질문 로드 완료');
    }

    clearChat() {
        const messagesContainer = document.getElementById('messagesContainer');
        if (messagesContainer) {
            // 초기 메시지만 남기고 모두 삭제
            const initialMessage = messagesContainer.querySelector('.flex.items-start.space-x-3');
            messagesContainer.innerHTML = '';
            if (initialMessage) {
                messagesContainer.appendChild(initialMessage.cloneNode(true));
            }
        }

        this.messages = [];
        this.questionCount = 0;
        this.updateQuestionCount();
    }

    async handleFileUpload(event) {
        // Cloudflare 환경에서는 실행되지 않음
        if (this.isCloudflareEnv) {
            this.showToast('Cloudflare 환경에서는 파일 업로드가 지원되지 않습니다.', 'warning');
            return;
        }

        const file = event.target.files[0];
        if (!file) return;

        if (file.type !== 'application/pdf') {
            this.showToast('PDF 파일만 업로드 가능합니다.', 'error');
            return;
        }

        if (!this.ragInitialized) {
            this.showToast('문서 처리 기능이 초기화되지 않았습니다.', 'warning');
            return;
        }

        try {
            this.showToast('파일 처리 중...', 'info');
            const chunksCount = await this.ragEngine.loadPDFDocument(file);
            this.showToast(`파일이 성공적으로 처리되었습니다. (${chunksCount}개 청크)`, 'success');
        } catch (error) {
            console.error('파일 처리 오류:', error);
            this.showToast('파일 처리 중 오류가 발생했습니다.', 'error');
        }

        // 파일 입력 초기화
        event.target.value = '';
    }

    openSettingsModal() {
        const modal = document.getElementById('settingsModal');
        const apiKeyInput = document.getElementById('apiKeyInput');
        
        if (modal) {
            modal.classList.remove('hidden');
            if (apiKeyInput && this.apiKey) {
                apiKeyInput.value = this.apiKey;
            }
        }
    }

    closeSettingsModal() {
        const modal = document.getElementById('settingsModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    saveSettings() {
        const apiKeyInput = document.getElementById('apiKeyInput');
        const typingSpeedInput = document.getElementById('typingSpeed');

        if (apiKeyInput) {
            const newApiKey = apiKeyInput.value.trim();
            if (newApiKey) {
                this.apiKey = newApiKey;
                localStorage.setItem('openai_api_key', newApiKey);
                this.updateAPIKeyStatus();
                this.showToast('API 키가 저장되었습니다.', 'success');
            }
        }

        if (typingSpeedInput) {
            this.typingSpeed = parseFloat(typingSpeedInput.value);
            localStorage.setItem('typing_speed', this.typingSpeed.toString());
        }

        this.closeSettingsModal();
    }

    openHelpModal() {
        const modal = document.getElementById('helpModal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    }

    closeHelpModal() {
        const modal = document.getElementById('helpModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        const colors = {
            'success': 'border-green-500 bg-green-50 text-green-800',
            'error': 'border-red-500 bg-red-50 text-red-800',
            'warning': 'border-yellow-500 bg-yellow-50 text-yellow-800',
            'info': 'border-blue-500 bg-blue-50 text-blue-800'
        };

        toast.className = `fixed top-4 right-4 p-4 rounded-lg border-l-4 shadow-lg z-50 ${colors[type] || colors.info}`;
        toast.textContent = message;
        
        document.body.appendChild(toast);

        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 3000);
    }
}

// 전역으로 클래스 export
window.GokseongChatbot = GokseongChatbot;



