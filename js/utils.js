// Utility functions for Gokseong AI Chatbot

// Text processing utilities
class TextProcessor {
    static formatMessage(text) {
        return text
            .replace(/\n\n+/g, '\n\n')  // Remove excessive line breaks
            .replace(/\s+/g, ' ')       // Replace multiple spaces with single space
            .trim();
    }

    static highlightKeywords(text, keywords) {
        if (!keywords || keywords.length === 0) return text;
        
        const regex = new RegExp(`(${keywords.join('|')})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }

    static extractPhoneNumbers(text) {
        const phoneRegex = /(\d{2,3})-(\d{3,4})-(\d{4})/g;
        return text.match(phoneRegex) || [];
    }

    static extractEmails(text) {
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        return text.match(emailRegex) || [];
    }

    static truncateText(text, maxLength = 100) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }
}

// Local storage utilities
class StorageManager {
    static saveConversation(messages) {
        const conversation = {
            messages,
            timestamp: new Date().toISOString(),
            id: this.generateId()
        };
        
        const saved = this.getSavedConversations();
        saved.push(conversation);
        
        // Keep only last 10 conversations
        if (saved.length > 10) {
            saved.shift();
        }
        
        localStorage.setItem('gokseong_conversations', JSON.stringify(saved));
        return conversation.id;
    }

    static getSavedConversations() {
        const saved = localStorage.getItem('gokseong_conversations');
        return saved ? JSON.parse(saved) : [];
    }

    static deleteConversation(id) {
        const saved = this.getSavedConversations();
        const filtered = saved.filter(conv => conv.id !== id);
        localStorage.setItem('gokseong_conversations', JSON.stringify(filtered));
    }

    static exportConversation(messages, format = 'json') {
        const data = {
            title: '곡성군 AI 민원상담 기록',
            timestamp: new Date().toISOString(),
            messages: messages.map(msg => ({
                type: msg.type,
                content: msg.content,
                timestamp: msg.timestamp
            }))
        };

        if (format === 'json') {
            return JSON.stringify(data, null, 2);
        } else if (format === 'txt') {
            let text = `${data.title}\n생성일시: ${new Date(data.timestamp).toLocaleString('ko-KR')}\n\n`;
            data.messages.forEach(msg => {
                const sender = msg.type === 'user' ? '사용자' : 'AI 상담원';
                const time = new Date(msg.timestamp).toLocaleTimeString('ko-KR');
                text += `[${time}] ${sender}: ${msg.content}\n\n`;
            });
            return text;
        }
    }

    static generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
}

// File handling utilities
class FileHandler {
    static async readPDFAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = function(e) {
                // This would require a PDF.js implementation
                // For now, just return basic file info
                resolve({
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    text: '파일 내용 분석 중...' // Placeholder
                });
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    static downloadFile(content, filename, type = 'text/plain') {
        const blob = new Blob([content], { type });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    }

    static validateFile(file, options = {}) {
        const {
            maxSize = 10 * 1024 * 1024, // 10MB
            allowedTypes = ['application/pdf'],
            allowedExtensions = ['.pdf']
        } = options;

        if (file.size > maxSize) {
            throw new Error(`파일 크기가 너무 큽니다. 최대 ${maxSize / 1024 / 1024}MB까지 허용됩니다.`);
        }

        if (!allowedTypes.includes(file.type)) {
            throw new Error(`지원하지 않는 파일 형식입니다. 허용된 형식: ${allowedTypes.join(', ')}`);
        }

        const extension = '.' + file.name.split('.').pop().toLowerCase();
        if (!allowedExtensions.includes(extension)) {
            throw new Error(`지원하지 않는 파일 확장자입니다. 허용된 확장자: ${allowedExtensions.join(', ')}`);
        }

        return true;
    }
}

// Animation utilities
class AnimationHelper {
    static fadeIn(element, duration = 300) {
        element.style.opacity = '0';
        element.style.display = 'block';
        
        const start = performance.now();
        
        const animate = (currentTime) => {
            const elapsed = currentTime - start;
            const progress = Math.min(elapsed / duration, 1);
            
            element.style.opacity = progress.toString();
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        requestAnimationFrame(animate);
    }

    static fadeOut(element, duration = 300) {
        const start = performance.now();
        const initialOpacity = parseFloat(window.getComputedStyle(element).opacity);
        
        const animate = (currentTime) => {
            const elapsed = currentTime - start;
            const progress = Math.min(elapsed / duration, 1);
            
            element.style.opacity = (initialOpacity * (1 - progress)).toString();
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                element.style.display = 'none';
            }
        };
        
        requestAnimationFrame(animate);
    }

    static slideIn(element, direction = 'down', duration = 300) {
        const transforms = {
            down: 'translateY(-20px)',
            up: 'translateY(20px)',
            left: 'translateX(20px)',
            right: 'translateX(-20px)'
        };

        element.style.transform = transforms[direction];
        element.style.opacity = '0';
        element.style.display = 'block';
        
        const start = performance.now();
        
        const animate = (currentTime) => {
            const elapsed = currentTime - start;
            const progress = Math.min(elapsed / duration, 1);
            
            const easeOut = 1 - Math.pow(1 - progress, 3);
            
            element.style.opacity = easeOut.toString();
            element.style.transform = `${transforms[direction].replace(/[-\d]+px/, (match) => {
                const value = parseInt(match);
                return (value * (1 - easeOut)) + 'px';
            })}`;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                element.style.transform = 'none';
            }
        };
        
        requestAnimationFrame(animate);
    }
}

// Network utilities
class NetworkHelper {
    static async checkConnection() {
        if (!navigator.onLine) {
            return false;
        }
        
        try {
            const response = await fetch('/ping', {
                method: 'HEAD',
                mode: 'no-cors',
                timeout: 5000
            });
            return true;
        } catch {
            return false;
        }
    }

    static async retryRequest(requestFn, maxRetries = 3, delay = 1000) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                return await requestFn();
            } catch (error) {
                if (i === maxRetries - 1) throw error;
                await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
            }
        }
    }
}

// Analytics utilities
class Analytics {
    static trackEvent(event, data = {}) {
        console.log(`Analytics Event: ${event}`, data);
        
        // In a real implementation, this would send to analytics service
        const eventData = {
            event,
            timestamp: new Date().toISOString(),
            data,
            sessionId: this.getSessionId()
        };
        
        // Store locally for now
        const events = JSON.parse(localStorage.getItem('analytics_events') || '[]');
        events.push(eventData);
        
        // Keep only last 100 events
        if (events.length > 100) {
            events.shift();
        }
        
        localStorage.setItem('analytics_events', JSON.stringify(events));
    }

    static getSessionId() {
        let sessionId = sessionStorage.getItem('session_id');
        if (!sessionId) {
            sessionId = StorageManager.generateId();
            sessionStorage.setItem('session_id', sessionId);
        }
        return sessionId;
    }

    static getUsageStats() {
        const events = JSON.parse(localStorage.getItem('analytics_events') || '[]');
        
        return {
            totalEvents: events.length,
            messagesSent: events.filter(e => e.event === 'message_sent').length,
            settingsChanged: events.filter(e => e.event === 'settings_changed').length,
            filesUploaded: events.filter(e => e.event === 'file_uploaded').length,
            sessionsStarted: new Set(events.map(e => e.sessionId)).size
        };
    }
}

// Performance monitoring
class PerformanceMonitor {
    static measureTime(name, fn) {
        const start = performance.now();
        const result = fn();
        const end = performance.now();
        
        console.log(`Performance: ${name} took ${end - start} milliseconds`);
        Analytics.trackEvent('performance_measure', {
            name,
            duration: end - start
        });
        
        return result;
    }

    static async measureAsyncTime(name, asyncFn) {
        const start = performance.now();
        const result = await asyncFn();
        const end = performance.now();
        
        console.log(`Performance: ${name} took ${end - start} milliseconds`);
        Analytics.trackEvent('performance_measure', {
            name,
            duration: end - start
        });
        
        return result;
    }

    static getMemoryUsage() {
        if (performance.memory) {
            return {
                used: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize,
                limit: performance.memory.jsHeapSizeLimit
            };
        }
        return null;
    }
}

// Export utilities for use in other modules
window.TextProcessor = TextProcessor;
window.StorageManager = StorageManager;
window.FileHandler = FileHandler;
window.AnimationHelper = AnimationHelper;
window.NetworkHelper = NetworkHelper;
window.Analytics = Analytics;
window.PerformanceMonitor = PerformanceMonitor;