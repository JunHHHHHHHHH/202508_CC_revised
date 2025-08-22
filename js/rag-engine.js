// RAG Engine for client-side document processing and retrieval (PDF.js + USE)

class RAGEngine {
    constructor() {
        this.vectorStore = new Map();
        this.documents = [];
        this.model = null;
        this.isInitialized = false;
        this.chunkSize = 500;
        this.chunkOverlap = 50;
    }

    async initialize() {
        if (this.isInitialized) return;
        
        try {
            // Universal Sentence Encoder 로드
            this.model = await use.load();
            this.isInitialized = true;
            console.log('RAG Engine initialized successfully');
        } catch (error) {
            console.error('Failed to initialize RAG Engine:', error);
            throw error;
        }
    }

    async loadPDFDocument(file, fileName = null) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const actualFileName = fileName || file.name;
        const arrayBuffer = await file.arrayBuffer();
        
        try {
            const pdf = await pdfjsLib.getDocument({data: arrayBuffer}).promise;
            const documents = [];

            // 각 페이지 텍스트 추출
            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                const page = await pdf.getPage(pageNum);
                const textContent = await page.getTextContent();
                const pageText = textContent.items
                    .map(item => item.str)
                    .join(' ')
                    .replace(/\s+/g, ' ')
                    .trim();

                if (pageText.length > 0) {
                    documents.push({
                        content: pageText,
                        metadata: {
                            fileName: actualFileName,
                            pageNumber: pageNum,
                            sourceInfo: `${actualFileName.replace('.pdf', '')} ${pageNum}p`
                        }
                    });
                }
            }

            // 청크 분할 및 임베딩
            const chunks = this.splitDocumentsToChunks(documents);
            await this.embedAndStoreChunks(chunks);
            
            return chunks.length;
        } catch (error) {
            console.error('PDF processing error:', error);
            throw new Error('PDF 문서 처리 중 오류가 발생했습니다.');
        }
    }

    splitDocumentsToChunks(documents) {
        const chunks = [];
        
        for (const doc of documents) {
            const splitChunks = this.splitText(doc.content, this.chunkSize, this.chunkOverlap);
            splitChunks.forEach((chunk, idx) => {
                chunks.push({
                    content: chunk,
                    metadata: {
                        ...doc.metadata, 
                        chunkIndex: idx
                    }
                });
            });
        }

        return chunks;
    }

    splitText(text, chunkSize, chunkOverlap) {
        const chunks = [];
        let i = 0;
        const textLength = text.length;

        while (i < textLength) {
            const end = Math.min(i + chunkSize, textLength);
            chunks.push(text.slice(i, end));
            
            if (end >= textLength) break;
            i += chunkSize - chunkOverlap;
        }

        return chunks;
    }

    async embedAndStoreChunks(chunks) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const batchSize = 10;
        
        for (let i = 0; i < chunks.length; i += batchSize) {
            const batch = chunks.slice(i, i + batchSize);
            const texts = batch.map(chunk => chunk.content);
            
            try {
                // 텍스트를 임베딩으로 변환
                const embeddingResult = await this.model.embed(texts);
                const embeddings = await embeddingResult.array();

                // 각 청크에 임베딩 저장
                batch.forEach((chunk, idx) => {
                    const id = i + idx;
                    const chunkWithEmbedding = {
                        ...chunk, 
                        embedding: embeddings[idx], 
                        id
                    };
                    
                    this.vectorStore.set(id, chunkWithEmbedding);
                    this.documents.push(chunkWithEmbedding);
                });

                // 메모리 정리
                if (embeddingResult.dispose) {
                    embeddingResult.dispose();
                }
            } catch (error) {
                console.error('Embedding batch error:', error);
                throw error;
            }
        }
    }

    async retrieveRelevantDocuments(query, k = 8) {
        if (!this.isInitialized || this.vectorStore.size === 0) {
            return [];
        }

        try {
            // 쿼리 임베딩
            const queryEmbeddingResult = await this.model.embed([query]);
            const queryEmbedding = (await queryEmbeddingResult.array())[0];

            // 유사도 계산
            const scored = [];
            for (const [id, doc] of this.vectorStore.entries()) {
                const similarity = this.cosineSimilarity(queryEmbedding, doc.embedding);
                scored.push({
                    ...doc, 
                    similarity
                });
            }

            // 유사도 순으로 정렬
            scored.sort((a, b) => b.similarity - a.similarity);

            // 메모리 정리
            if (queryEmbeddingResult.dispose) {
                queryEmbeddingResult.dispose();
            }

            return scored.slice(0, k);
        } catch (error) {
            console.error('Document retrieval error:', error);
            return [];
        }
    }

    cosineSimilarity(vecA, vecB) {
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }

        const denominator = Math.sqrt(normA) * Math.sqrt(normB);
        return denominator === 0 ? 0 : dotProduct / denominator;
    }

    extractFormKeywords(docs) {
        const formKeywords = ['별지', '서식', '신청서', '동의서', '양식', '정정신청서', '변경신고서', '등록신청서'];
        const foundForms = [];

        for (const doc of docs) {
            const lines = doc.content.split('\n');
            for (const line of lines) {
                const trimmedLine = line.trim();
                
                if (formKeywords.some(keyword => trimmedLine.includes(keyword))) {
                    const form = trimmedLine.length > 60 
                        ? trimmedLine.slice(0, 60) + '...' 
                        : trimmedLine;
                    
                    if (!foundForms.includes(form)) {
                        foundForms.push(form);
                    }
                }
            }
        }

        return foundForms;
    }

    formatSourceLine(doc) {
        const fileName = doc.metadata.fileName || '문서';
        const pageNumber = doc.metadata.pageNumber || '?';
        const preview = doc.content.trim().replace(/\n/g, ' ');
        const shortPreview = preview.length > 80 
            ? preview.slice(0, 80) + '...' 
            : preview;

        return `${fileName} p.${pageNumber} — "${shortPreview}"`;
    }

    async buildContext(query) {
        try {
            const relevantDocs = await this.retrieveRelevantDocuments(query);
            
            if (relevantDocs.length === 0) {
                return { 
                    context: '검색된 문서가 없습니다.', 
                    sources: [], 
                    forms: []
                };
            }

            const sources = relevantDocs.map(doc => this.formatSourceLine(doc));
            const forms = this.extractFormKeywords(relevantDocs);

            const contextBlocks = relevantDocs.map(doc => {
                const sourceInfo = doc.metadata.sourceInfo || this.formatSourceLine(doc);
                let content = doc.content.trim();
                
                // 컨텍스트 길이 제한
                if (content.length > 1200) {
                    content = content.slice(0, 1200) + '...';
                }

                return `[출처: ${sourceInfo}]\n${content}`;
            });

            const context = contextBlocks.join('\n\n');

            return { 
                context, 
                sources, 
                forms 
            };
        } catch (error) {
            console.error('Context building error:', error);
            return { 
                context: '문서 검색 중 오류가 발생했습니다.', 
                sources: [], 
                forms: []
            };
        }
    }

    getDocumentStats() {
        return {
            totalDocuments: this.documents.length,
            totalChunks: this.vectorStore.size,
            isInitialized: this.isInitialized
        };
    }

    clearVectorStore() {
        this.vectorStore.clear();
        this.documents = [];
    }
}

// Global export
window.RAGEngine = RAGEngine;

