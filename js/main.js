// main.js – 곡성군 AI 민원상담 챗봇 (Cloudflare 호환 버전)
class GokseongChatbot {
    constructor() {
        this.messages = [];
        this.apiKey = localStorage.getItem('openai_api_key') || null;
        this.questionCount = 0;
        this.processing = false;
        this.typingSpeed = parseFloat(localStorage.getItem('typing_speed')) || 0.02;
        
        // RAG 기능은 비활성화하고, 관련 변수는 초기 상태로 둡니다.
        this.ragEngine = null;
        this.ragInitialized = false;

        this.initializeWhenReady();
    }

    async initializeWhenReady() {
        if (document.readyState === 'loading') {
            await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
        }
        await this.init();
    }

    async init() {
        this.bindEvents();
        this.updateAPIKeyStatus();
        this.setupMessageInput();
        this.loadSuggestedQuestions();
        
        // RAG 엔진 초기화 로직을 제거하여 불필요한 로딩을 방지합니다.
        console.log('RAG 기능은 현재 비활성화되어 있습니다. 기본 OpenAI 채팅 모드로 작동합니다.');
        this.ragInitialized = false;

        const savedTypingSpeed = localStorage.getItem('typing_speed');
        if (savedTypingSpeed) {
            const speedSlider = document.getElementById('typingSpeed');
            if (speedSlider) speedSlider.value = savedTypingSpeed;
        }

        console.log('곡성군 AI 챗봇 초기화 완료');
    }

    bindEvents() {
        // 기존 bindEvents 코드는 변경 없이 그대로 사용합니다.
        const sendButton = document.getElementById('sendButton');
        if (sendButton) sendButton.addEventListener('click', () => this.sendMessage());

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

        const settingsBtn = document.getElementById('settingsBtn');
        const closeSettings = document.getElementById('closeSettings');
        const saveSettings = document.getElementById('saveSettings');
        const cancelSettings = document.getElementById('cancelSettings');
        const settingsModal = document.getElementById('settingsModal');

        if (settingsBtn) settingsBtn.addEventListener('click', () => this.openSettingsModal());
        if (closeSettings) closeSettings.addEventListener('click', () => this.closeSettingsModal());
        if (saveSettings) saveSettings.addEventListener('click', () => this.saveSettings());
        if (cancelSettings) cancelSettings.addEventListener('click', () => this.closeSettingsModal());

        document.querySelectorAll('.suggested-question').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const question = e.currentTarget.getAttribute('data-question');
                this.askSuggestedQuestion(question);
            });
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeSettingsModal();
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
        this.showTypingIndicator();

        try {
            // RAG 기능이 비활성화되었으므로 항상 기본 쿼리(processBasicQuery)를 사용합니다.
            const response = await this.processBasicQuery(message);
            this.hideTypingIndicator();
            await this.addTypingMessage('ai', response);
        } catch (error) {
            console.error('Error processing message:', error);
            this.hideTypingIndicator();
            const errorMessage = `죄송합니다. 처리 중 오류가 발생했습니다: ${error.message}`;
            this.addMessage('ai', errorMessage);
            this.showToast('메시지 처리 중 오류가 발생했습니다.', 'error');
        } finally {
            this.processing = false;
            this.updateSendButton();
        }
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
                    { role: 'system', content: '당신은 곡성군의 친절한 AI 민원상담봇입니다. 곡성군 민원과 관련된 질문에 도움이 되는 답변을 제공해주세요. 정확하지 않은 정보는 제공하지 말고, 확실하지 않은 경우 곡성군청(061-360-8000)으로 문의하도록 안내해주세요.' },
                    { role: 'user', content: query }
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

    updateSendButton() {
        const btn = document.getElementById('sendButton');
        const messageInput = document.getElementById('messageInput');
        if (btn && messageInput) {
            const hasText = messageInput.value.trim().length > 0;
            btn.disabled = !hasText || this.processing;
        }
    }
    
    // addMessage, showTypingIndicator, addTypingMessage 등 나머지 메소드는 변경 없이 그대로 사용합니다.
    addMessage(sender, text) {
        const messagesContainer = document.getElementById('messagesContainer');
        if (!messagesContainer) return;

        const messageWrapper = document.createElement('div');
        const messageContent = this.escapeHtml(text).replace(/\n/g, '<br>');
        
        if (sender === 'user') {
            messageWrapper.className = 'flex justify-end mb-4';
            messageWrapper.innerHTML = `
                <div class="user-message p-4 rounded-lg max-w-lg">
                    ${messageContent}
                    <time class="text-xs text-sky-200 mt-2 block">${new Date().toLocaleTimeString()}</time>
                </div>
            `;
        } else {
            messageWrapper.className = 'flex items-start space-x-3 mb-4';
            messageWrapper.innerHTML = `
                <div class="bg-sky-500 text-white rounded-full h-10 w-10 flex items-center justify-center text-xl flex-shrink-0">🏛️</div>
                <div class="ai-message p-4 rounded-lg text-slate-800 max-w-lg">
                    <p class="font-bold">AI 상담원</p>
                    <div class="message-content">${messageContent}</div>
                    <time class="text-xs text-slate-400 mt-2 block">${new Date().toLocaleTimeString()}</time>
                </div>
            `;
        }
        messagesContainer.appendChild(messageWrapper);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    showTypingIndicator() {
        const messagesContainer = document.getElementById('messagesContainer');
        if (document.getElementById('typing-indicator')) return;
        
        const indicator = document.createElement('div');
        indicator.id = 'typing-indicator';
        indicator.className = 'flex items-start space-x-3 mb-4';
        indicator.innerHTML = `
            <div class="bg-sky-500 text-white rounded-full h-10 w-10 flex items-center justify-center text-xl flex-shrink-0">🏛️</div>
            <div class="ai-message p-4 rounded-lg flex items-center space-x-2">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        `;
        messagesContainer.appendChild(indicator);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    hideTypingIndicator() {
        const indicator = document.getElementById('typing-indicator');
        if (indicator) indicator.remove();
    }
    
    async addTypingMessage(sender, text) {
        // ... 기존 addTypingMessage 코드와 동일하게 구현 ...
        const messagesContainer = document.getElementById('messagesContainer');
        const messageWrapper = document.createElement('div');
        messageWrapper.className = 'flex items-start space-x-3 mb-4';
        messageWrapper.innerHTML = `
            <div class="bg-sky-500 text-white rounded-full h-10 w-10 flex items-center justify-center text-xl flex-shrink-0">🏛️</div>
            <div class="ai-message p-4 rounded-lg text-slate-800 max-w-lg">
                <p class="font-bold">AI 상담원</p>
                <div class="message-content"></div>
                <time class="text-xs text-slate-400 mt-2 block">${new Date().toLocaleTimeString()}</time>
            </div>
        `;
        messagesContainer.appendChild(messageWrapper);
        const messageContentDiv = messageWrapper.querySelector('.message-content');

        for (let i = 0; i < text.length; i++) {
            messageContentDiv.innerHTML += this.escapeHtml(text[i]).replace(/\n/g, '<br>');
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            await new Promise(resolve => setTimeout(resolve, this.typingSpeed * 1000));
        }
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

    updateAPIKeyStatus() {
        const statusTextElement = document.getElementById('apiStatusText');
        if (statusTextElement) {
            statusTextElement.textContent = this.apiKey ? 'API 키가 설정되었습니다.' : 'API 키를 설정해주세요.';
        }
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
    
    showToast(message, type = 'info') {
        // ... 기존 showToast 코드와 동일 ...
        const toast = document.createElement('div');
        const colors = {
            'success': 'bg-green-100 border-green-500 text-green-700',
            'error': 'bg-red-100 border-red-500 text-red-700',
            'info': 'bg-blue-100 border-blue-500 text-blue-700'
        };
        toast.className = `fixed top-5 right-5 p-4 rounded-lg border-l-4 shadow-lg z-50 ${colors[type]}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }
    
    loadSuggestedQuestions() {
        // HTML에 이미 정의되어 있으므로 로직 불필요
    }
}
