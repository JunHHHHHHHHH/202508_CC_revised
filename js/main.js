// main.js – 곡성군 AI 민원상담 챗봇 (RAG 반영 전체 코드)

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
        } catch (e) {
            this.showToast('문서 검색 기능 초기화에 실패했습니다.', 'warning');
        }
        const savedTypingSpeed = localStorage.getItem('typing_speed');
        if (savedTypingSpeed) {
            document.getElementById('typingSpeed').value = savedTypingSpeed;
        }
    }

    bindEvents() {
        document.getElementById('sendButton').addEventListener('click', () => this.sendMessage());
        document.getElementById('messageInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        document.getElementById('settingsBtn').addEventListener('click', () => this.openSettingsModal());
        document.getElementById('closeSettings').addEventListener('click', () => this.closeSettingsModal());
        document.getElementById('saveSettings').addEventListener('click', () => this.saveSettings());
        document.getElementById('cancelSettings').addEventListener('click', () => this.closeSettingsModal());
        document.getElementById('helpBtn').addEventListener('click', () => this.openHelpModal());
        document.getElementById('closeHelp').addEventListener('click', () => this.closeHelpModal());
        document.getElementById('clearChat').addEventListener('click', () => this.clearChat());
        document.getElementById('fileUpload').addEventListener('change', (e) => this.handleFileUpload(e));
        document.querySelectorAll('.suggested-question').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const question = e.currentTarget.getAttribute('data-question');
                this.askSuggestedQuestion(question);
            });
        });
        document.getElementById('messageInput').addEventListener('input', this.autoResizeTextarea);
        document.getElementById('settingsModal').addEventListener('click', (e) => {
            if (e.target.id === 'settingsModal') this.closeSettingsModal();
        });
        document.getElementById('helpModal').addEventListener('click', (e) => {
            if (e.target.id === 'helpModal') this.closeHelpModal();
        });
    }

    setupMessageInput() {
        const input = document.getElementById('messageInput');
        const sendButton = document.getElementById('sendButton');
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
        const hasText = document.getElementById('messageInput').value.trim().length > 0;
        btn.disabled = !hasText || this.processing;
        if (btn.disabled) {
            btn.classList.add('opacity-50', 'cursor-not-allowed');
        } else {
            btn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }

    showTypingIndicator() {
        const messagesContainer = document.getElementById('messagesContainer');
        const indicator = document.createElement('div');
        indicator.id = 'typing-indicator';
        indicator.innerHTML = `
            <div class="flex items-center space-x-2 ai-message message-enter">
                <div class="typing-indicator">
                    <span class="typing-dot"></span>
                    <span class="typing-dot"></span>
                    <span class="typing-dot"></span>
                </div>
                <span>AI가 작성 중...</span>
            </div>
        `;
        messagesContainer.appendChild(indicator);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    hideTypingIndicator() {
        const ti = document.getElementById('typing-indicator');
        if (ti) ti.remove();
    }

    addMessage(type, content) {
        const messagesContainer = document.getElementById('messagesContainer');
        const messageDiv = document.createElement('div');
        messageDiv.className = `flex items-start space-x-3 message-enter`;
        const isUser = type === 'user';
        const timestamp = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
        messageDiv.innerHTML = `
            <div class="${isUser ? 'user-message' : 'ai-message'} p-3 rounded-lg shadow-sm max-w-xl">
                <div class="text-sm">${content.replace(/\n/g, '<br>')}</div>
                <div class="text-xs text-right text-gray-400 mt-1">${timestamp}</div>
            </div>
        `;
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        // 메시지 저장 (생략)
    }

    async addTypingMessage(type, content) {
        let i = 0;
        let out = '';
        const speed = Math.max(this.typingSpeed, 0.005);
        while (i < content.length) {
            out += content[i];
            if (i % 4 === 0 || i === content.length - 1) {
                this.addMessage(type, out);
                // 삭제 후 재추가: 메시지 새로 고침 (타이핑 효과 흉내)
                const messagesContainer = document.getElementById('messagesContainer');
                messagesContainer.lastChild.remove();
            }
            await new Promise(res => setTimeout(res, speed * 1000));
            i++;
        }
        this.addMessage(type, out);
    }

    updateQuestionCount() {
        this.questionCount += 1;
        document.getElementById('questionCount').textContent = `${this.questionCount}`;
    }

    // ======== RAG CORE ========

    async handleFileUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        try {
            FileHandler.validateFile(file, {
                maxSize: 50 * 1024 * 1024,
                allowedTypes: ['application/pdf'],
                allowedExtensions: ['.pdf']
            });
            this.showToast('문서 처리 중...', 'info');
            if (!this.ragInitialized) {
                await this.ragEngine.initialize();
                this.ragInitialized = true;
            }
            this.ragEngine.clearVectorStore();
            const chunkCnt = await this.ragEngine.loadPDFDocument(file);
            this.showToast(`문서 업로드 완료: ${chunkCnt}개 청크 인덱싱`, 'success');
            e.target.value = '';
        } catch (error) {
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
            if (!response.ok) throw new Error(`API Error: ${response.status}`);
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
            systemPrompt += `\n\n답변 지침:\n- 문서 내용을 우선적으로 참고하여 답변\n- 민원업무명, 처리기간, 구비서류, 수수료 포함\n- 처리 절차를 단계별로 설명\n- 신청방법, 접수처, 담당부서 안내\n- 관련 법령/조례 인용\n- 별지/서식이 필요한 경우 안내`;
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

    showToast(message, type = 'info') {
        // 간단 Toast UI
        const toastElem = document.createElement('div');
        toastElem.className = `toast ${type === 'error' ? 'border-l-4 border-red-500' : type === 'success' ? 'border-l-4 border-green-500' : 'border-l-4 border-blue-500'}`;
        toastElem.innerText = message;
        document.body.appendChild(toastElem);
        setTimeout(() => {
            toastElem.remove();
        }, 3000);
    }

    // 나머지 유틸리티(설정, 도움말, 대화 초기화 등) 메서드들은 기존과 동일하게 구현하시면 됩니다
}
