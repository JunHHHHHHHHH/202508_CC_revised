// main.js – 곡성군 AI 민원상담 챗봇 (완전 수정 버전)

class GokseongChatbot {
    constructor() {
        this.messages = [];
        this.apiKey = localStorage.getItem('openai_api_key') || null;
        this.questionCount = 0;
        this.processing = false;
        this.typingSpeed = parseFloat(localStorage.getItem('typing_speed')) || 0.02;
        this.ragEngine = new RAGEngine();
        this.ragInitialized = false;
        this.fileNames = ['곡성군 민원편람 2025'];
        this.init();
    }

    async init() {
        this.bindEvents();
        this.updateAPIKeyStatus();
        this.setupMessageInput();
        this.loadSuggestedQuestions();
        
        // RAG 엔진 초기화
        try {
            await this.ragEngine.initialize();
            this.ragInitialized = true;
            console.log('RAG 엔진 초기화 완료');
        } catch (e) {
            console.error('RAG 엔진 초기화 실패:', e);
            this.showToast('문서 검색 기능 초기화에 실패했습니다.', 'warning');
        }

        const savedTypingSpeed = localStorage.getItem('typing_speed');
        if (savedTypingSpeed) {
            const speedSlider = document.getElementById('typingSpeed');
            if (speedSlider) {
                speedSlider.value = savedTypingSpeed;
            }
        }
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

        // File upload event
        const fileUpload = document.getElementById('fileUpload');
        if (fileUpload) {
            fileUpload.addEventListener('change', (e) => this.handleFileUpload(e));
        }

        // Suggested questions
        document.querySelectorAll('.suggested-question').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const question = e.currentTarget.getAttribute('data-question');
                this.askSuggestedQuestion(question);
            });
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
            const response = await this.processRAGQuery(message);
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
            <div class="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                AI
            </div>
            <div class="flex-1">
                <div class="ai-message p-4 rounded-lg">
                    <div class="typing-indicator">
                        <span class="typing-dot"></span>
                        <span class="typing-dot"></span>
                        <span class="typing-dot"></span>
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

        const isUser = type === 'user';
        const timestamp = new Date().toLocaleTimeString('ko-KR', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });

        messageDiv.innerHTML = `
            <div class="w-8 h-8 ${isUser ? 'bg-green-500' : 'bg-blue-500'} rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                ${isUser ? '👤' : 'AI'}
            </div>
            <div class="flex-1">
                <div class="${isUser ? 'user-message' : 'ai-message'} p-4 rounded-lg">
                    <div class="message-content">${this.formatMessageContent(content)}</div>
                </div>
                <div class="text-xs text-gray-400 mt-1">${timestamp}</div>
            </div>
        `;

        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        // 메시지 저장
        this.messages.push({
            type,
            content,
            timestamp: new Date().toISOString()
        });
    }

    formatMessageContent(content) {
        // 간단한 마크다운 형식 지원
        return content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br>');
    }

    async addTypingMessage(type, content) {
        let displayedContent = '';
        const speed = Math.max(this.typingSpeed, 0.005);
        
        // 임시 메시지 생성
        this.addMessage(type, '');
        const messagesContainer = document.getElementById('messagesContainer');
        const lastMessage = messagesContainer.lastChild;
        const contentElement = lastMessage.querySelector('.message-content');

        for (let i = 0; i < content.length; i++) {
            displayedContent += content[i];
            contentElement.innerHTML = this.formatMessageContent(displayedContent);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            
            if (i % 2 === 0) { // 2글자마다 딜레이
                await new Promise(resolve => setTimeout(resolve, speed * 1000));
            }
        }

        // 최종 메시지로 업데이트
        this.messages[this.messages.length - 1].content = content;
    }

    updateQuestionCount() {
        this.questionCount += 1;
        const questionCountElement = document.getElementById('questionCount');
        if (questionCountElement) {
            questionCountElement.textContent = `${this.questionCount}`;
        }
    }

    // ======== RAG CORE ========
    async handleFileUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        try {
            FileHandler.validateFile(file, {
                maxSize: 50 * 1024 * 1024, // 50MB
                allowedTypes: ['application/pdf'],
                allowedExtensions: ['.pdf']
            });

            this.showToast('문서 처리 중...', 'info');

            if (!this.ragInitialized) {
                await this.ragEngine.initialize();
                this.ragInitialized = true;
            }

            this.ragEngine.clearVectorStore();
            const chunkCount = await this.ragEngine.loadPDFDocument(file);
            this.showToast(`문서 업로드 완료: ${chunkCount}개 청크 인덱싱`, 'success');
            
            e.target.value = '';
        } catch (error) {
            console.error('File upload error:', error);
            this.showToast(error.message || '파일 처리 오류', 'error');
        }
    }

    async processRAGQuery(query) {
        try {
            let contextData = null;
            
            if (this.ragInitialized && this.ragEngine.getDocumentStats().totalChunks > 0) {
                contextData = await this.ragEngine.buildContext(query);
            }

            const systemPrompt = this.buildSystemPrompt(contextData);

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
                    max_tokens: 800,
                    temperature: 0.1
                })
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }

            const data = await response.json();
            let aiResponse = data.choices[0].message.content;

            if (contextData && contextData.sources.length > 0) {
                aiResponse += '\n\n**참고 자료:**\n';
                contextData.sources.forEach((source, i) => {
                    aiResponse += `${i+1}. ${source}\n`;
                });
            }

            return aiResponse;
        } catch (error) {
            console.error('RAG Query error:', error);
            return this.getFallbackResponse(query);
        }
    }

    buildSystemPrompt(contextData) {
        let systemPrompt = `당신은 곡성군 민원상담 AI 어시스턴트입니다.`;

        if (contextData && contextData.context && contextData.context !== '검색된 문서가 없습니다.') {
            systemPrompt += `\n\n다음 문서 내용을 바탕으로 정확한 답변을 제공해주세요:\n\n${contextData.context}`;
            
            if (contextData.forms && contextData.forms.length > 0) {
                systemPrompt += `\n\n**관련 별지/서식:**\n${contextData.forms.map(form => `- ${form}`).join('\n')}`;
            }

            systemPrompt += `\n\n답변 지침:
- 문서 내용을 우선적으로 참고하여 답변
- 민원업무명, 처리기간, 구비서류, 수수료 포함
- 처리 절차를 단계별로 설명
- 신청방법, 접수처, 담당부서 안내
- 관련 법령/조례 인용
- 별지/서식이 필요한 경우 안내`;
        } else {
            systemPrompt += `\n\n곡성군 민원 관련 질문에 대한 일반적인 안내를 제공하고, 구체적 정보는 해당 부서 연락처를 안내해주세요.`;
        }

        systemPrompt += `\n\n응답은 친근하고 공손한 어조로 작성하며, 도움이 되는 정보를 제공해야 합니다.`;
        return systemPrompt;
    }

    getFallbackResponse(query) {
        const fallbackResponses = {
            '주민등록': '주민등록증 발급은 곡성군청 민원실에서 가능합니다. 신분증과 수수료를 준비해주세요. 문의: 061-360-8000',
            '건축허가': '건축허가 신청은 곡성군청 건축과에서 담당합니다. 관련 서류를 준비하여 방문해주세요. 문의: 061-360-8100',
            '세금': '세금 관련 업무는 곡성군청 세무과에서 처리됩니다. 온라인 납부도 가능합니다. 문의: 061-360-8200',
            '복지': '복지 혜택 관련 상담은 곡성군청 복지정책과에서 받을 수 있습니다. 문의: 061-360-8300'
        };

        for (const [keyword, response] of Object.entries(fallbackResponses)) {
            if (query.includes(keyword)) {
                return `${response}\n\n더 자세한 정보가 필요하시면 해당 부서로 직접 문의해주세요.`;
            }
        }

        return `안녕하세요! 곡성군 민원상담봇입니다.\n\n"${query}"에 대한 구체적인 답변을 위해서는 곡성군청 민원실(061-360-8000)로 직접 문의해주시기 바랍니다.\n\n곡성군청 운영시간: 평일 09:00-18:00\n주소: 전라남도 곡성군 곡성읍 군청로 31`;
    }

    // ======== UI Methods ========
    openSettingsModal() {
        const modal = document.getElementById('settingsModal');
        const apiKeyInput = document.getElementById('openaiApiKey');
        
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
        const apiKeyInput = document.getElementById('openaiApiKey');
        const typingSpeedInput = document.getElementById('typingSpeed');

        if (apiKeyInput) {
            const apiKey = apiKeyInput.value.trim();
            if (apiKey) {
                this.apiKey = apiKey;
                localStorage.setItem('openai_api_key', apiKey);
                this.showToast('API 키가 저장되었습니다.', 'success');
            }
        }

        if (typingSpeedInput) {
            const speed = parseFloat(typingSpeedInput.value);
            this.typingSpeed = speed;
            localStorage.setItem('typing_speed', speed.toString());
        }

        this.updateAPIKeyStatus();
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

    clearChat() {
        const messagesContainer = document.getElementById('messagesContainer');
        if (messagesContainer) {
            // 초기 메시지만 남기고 삭제
            const initialMessage = messagesContainer.querySelector('.message-enter');
            messagesContainer.innerHTML = '';
            if (initialMessage) {
                messagesContainer.appendChild(initialMessage.cloneNode(true));
            }
        }
        
        this.messages = [];
        this.questionCount = 0;
        this.updateQuestionCount();
        this.showToast('대화 기록이 삭제되었습니다.', 'info');
    }

    askSuggestedQuestion(question) {
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            messageInput.value = question;
            messageInput.focus();
            this.autoResizeTextarea({ target: messageInput });
            this.updateSendButton();
        }
    }

    updateAPIKeyStatus() {
        const warning = document.getElementById('apiKeyWarning');
        if (warning) {
            if (!this.apiKey) {
                warning.classList.remove('hidden');
            } else {
                warning.classList.add('hidden');
            }
        }
    }

    loadSuggestedQuestions() {
        // 이미 HTML에 정의되어 있음
        console.log('Suggested questions loaded');
    }

    showToast(message, type = 'info') {
        // Toast 생성
        const toast = document.createElement('div');
        toast.className = `fixed top-4 right-4 px-4 py-3 rounded-lg text-white text-sm z-50 toast`;
        
        // 타입별 색상
        switch (type) {
            case 'success':
                toast.classList.add('bg-green-500');
                break;
            case 'error':
                toast.classList.add('bg-red-500');
                break;
            case 'warning':
                toast.classList.add('bg-yellow-500');
                break;
            default:
                toast.classList.add('bg-blue-500');
        }

        toast.textContent = message;
        document.body.appendChild(toast);

        // 3초 후 자동 제거
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 3000);

        // 클릭시 즉시 제거
        toast.addEventListener('click', () => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        });
    }
}

// Global export
window.GokseongChatbot = GokseongChatbot;

