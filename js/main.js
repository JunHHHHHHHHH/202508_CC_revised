// main.js – 곡성군 AI 민원상담 챗봇 (Cloudflare 호환 버전)

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
        this.initializeWhenReady();
    }

    async initializeWhenReady() {
        // 페이지 로드 완료 대기
        if (document.readyState === 'loading') {
            await new Promise(resolve => {
                document.addEventListener('DOMContentLoaded', resolve);
            });
        }

        // 필요한 라이브러리들 로드 대기 (선택적)
        await this.waitForLibraries();

        // 실제 초기화 진행
        await this.init();
    }

    async waitForLibraries() {
        // TensorFlow.js 로드 대기 (선택적)
        if (typeof tf !== 'undefined') {
            console.log('TensorFlow.js 로드됨');
        } else {
            console.warn('TensorFlow.js가 로드되지 않음 - 기본 모드로 진행');
        }
    }

    async init() {
        this.bindEvents();
        this.updateAPIKeyStatus();
        this.setupMessageInput();
        this.loadSuggestedQuestions();
        
        // RAG 엔진 초기화 (선택적)
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
        }

        // 타이핑 속도 설정
        const savedTypingSpeed = localStorage.getItem('typing_speed');
        if (savedTypingSpeed) {
            const speedSlider = document.getElementById('typingSpeed');
            if (speedSlider) {
                speedSlider.value = savedTypingSpeed;
            }
        }

        console.log('곡성군 AI 챗봇 초기화 완료');
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

        // File upload button
        const fileUploadBtn = document.getElementById('fileUploadBtn');
        const fileUpload = document.getElementById('fileUpload');
        if (fileUploadBtn && fileUpload) {
            fileUploadBtn.addEventListener('click', () => fileUpload.click());
            fileUpload.addEventListener('change', (e) => this.handleFileUpload(e));
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
            if (this.ragInitialized && this.ragEngine) {
                response = await this.processRAGQuery(message);
            } else {
                response = await this.processBasicQuery(message);
            }
            
            this.hideTypingIndicator();
            await this.addTypingMessage('ai', response);
        } catch (error) {
            console.error('Error processing message:', error);
            this.hideTypingIndicator();
            this.addMessage('ai', '죄송합니다. 처리 중 오류가 발생했습니다. 다시 시도해주세요.');
            this.showToast('메시지 처리 중 오류가 발생했습니다.', 'error');
        }

        this.processing = false;
        this.updateSendButton();
    }

    async processBasicQuery(query) {
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
                        content: '당신은 곡성군의 친절한 AI 민원상담봇입니다. 곡성군 민원과 관련된 질문에 도움이 되는 답변을 제공해주세요. 정확하지 않은 정보는 제공하지 말고, 확실하지 않은 경우 곡성군청(061-360-8000)으로 문의하도록 안내해주세요.'
                    },
                    {
                        role: 'user',
                        content: query
                    }
                ],
                max_tokens: 1000,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`OpenAI API 오류: ${response.status} - ${errorData.error?.message || '알 수 없는 오류'}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    }

    async processRAGQuery(query) {
        if (!this.ragInitialized || !this.ragEngine) {
            return await this.processBasicQuery(query);
        }

        try {
            const { context, sources, forms } = await this.ragEngine.buildContext(query);
            
            const systemPrompt = `당신은 곡성군의 AI 민원상담봇입니다. 다음 문서 내용을 참고하여 정확하고 친절한 답변을 제공해주세요.

문서 내용:
${context}

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
            <div class="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                <i class="fas fa-robot text-white text-sm"></i>
            </div>
            <div class="flex-1">
                <div class="bg-gray-50 border border-gray-200 rounded-lg p-4 max-w-2xl">
                    <div class="typing-indicator">
                        <div class="typing-dot"></div>
                        <div class="typing-dot"></div>
                        <div class="typing-dot"></div>
                    </div>
                </div>
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
        messageDiv.className = 'flex items-start space-x-3 message-enter';

        if (type === 'user') {
            messageDiv.innerHTML = `
                <div class="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                    <i class="fas fa-user text-white text-sm"></i>
                </div>
                <div class="flex-1">
                    <div class="bg-blue-500 text-white rounded-lg p-4 max-w-2xl ml-auto user-message">
                        <p>${this.escapeHtml(content)}</p>
                    </div>
                    <p class="text-xs text-gray-500 mt-1 text-right">방금 전</p>
                </div>
            `;
        } else {
            messageDiv.innerHTML = `
                <div class="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                    <i class="fas fa-robot text-white text-sm"></i>
                </div>
                <div class="flex-1">
                    <div class="bg-gray-50 border border-gray-200 rounded-lg p-4 max-w-2xl ai-message">
                        <div class="message-content">${this.formatMessage(content)}</div>
                    </div>
                    <p class="text-xs text-gray-500 mt-1">방금 전</p>
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
        messageDiv.className = 'flex items-start space-x-3 message-enter';

        messageDiv.innerHTML = `
            <div class="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                <i class="fas fa-robot text-white text-sm"></i>
            </div>
            <div class="flex-1">
                <div class="bg-gray-50 border border-gray-200 rounded-lg p-4 max-w-2xl ai-message">
                    <div class="message-content"></div>
                </div>
                <p class="text-xs text-gray-500 mt-1">방금 전</p>
            </div>
        `;

        messagesContainer.appendChild(messageDiv);
        const contentDiv = messageDiv.querySelector('.message-content');

        // 타이핑 효과
        const formattedContent = this.formatMessage(content);
        let currentIndex = 0;
        
        while (currentIndex < formattedContent.length) {
            const char = formattedContent[currentIndex];
            contentDiv.innerHTML += char;
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            
            if (char !== ' ') {
                await new Promise(resolve => setTimeout(resolve, this.typingSpeed * 1000));
            }
            currentIndex++;
        }

        // 메시지 저장
        this.messages.push({
            type,
            content,
            timestamp: new Date().toISOString()
        });
    }

    formatMessage(content) {
        return content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/https?:\/\/[^\s]+/g, '<a href="$&" target="_blank" rel="noopener noreferrer">$&</a>');
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
        toast.className = `toast ${type}`;
        
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


