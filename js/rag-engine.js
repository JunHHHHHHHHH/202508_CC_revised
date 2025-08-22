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
        this.model = await use.load();
        this.isInitialized = true;
    }

    async loadPDFDocument(file, fileName = null) {
        const actualFileName = fileName || file.name;
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({data: arrayBuffer}).promise;
        const documents = [];
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ').replace(/\s+/g, ' ').trim();
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
        const chunks = this.splitDocumentsToChunks(documents);
        await this.embedAndStoreChunks(chunks);
        return chunks.length;
    }

    splitDocumentsToChunks(documents) {
        const chunks = [];
        for (const doc of documents) {
            const splitChunks = this.splitText(doc.content, this.chunkSize, this.chunkOverlap);
            splitChunks.forEach((chunk, idx) => {
                chunks.push({
                    content: chunk,
                    metadata: {...doc.metadata, chunkIndex: idx}
                });
            });
        }
        return chunks;
    }

    splitText(text, chunkSize, chunkOverlap) {
        // simple greedy chunking with overlap
        const out = [];
        let i = 0, len = text.length;
        while (i < len) {
            out.push(text.slice(i, i + chunkSize));
            if ((i + chunkSize) >= len) break;
            i += chunkSize - chunkOverlap;
        }
        return out;
    }

    async embedAndStoreChunks(chunks) {
        if (!this.isInitialized) await this.initialize();
        const batchSize = 10;
        for (let i = 0; i < chunks.length; i += batchSize) {
            const batch = chunks.slice(i, i + batchSize);
            const texts = batch.map(x => x.content);
            const embeddingResult = await this.model.embed(texts);
            const embeddings = await embeddingResult.array();
            batch.forEach((chunk, idx) => {
                const id = i + idx;
                this.vectorStore.set(id, {...chunk, embedding: embeddings[idx], id});
                this.documents.push({...chunk, id});
            });
            embeddingResult.dispose && embeddingResult.dispose();
        }
    }

    async retrieveRelevantDocuments(query, k = 8) {
        if (!this.isInitialized || this.vectorStore.size === 0) return [];
        const queryEmbeddingResult = await this.model.embed([query]);
        const queryEmbedding = (await queryEmbeddingResult.array())[0];
        const scored = [];
        for (const [id, doc] of this.vectorStore.entries()) {
            scored.push({...doc, similarity: this.cosineSimilarity(queryEmbedding, doc.embedding)});
        }
        scored.sort((a, b) => b.similarity - a.similarity);
        queryEmbeddingResult.dispose && queryEmbeddingResult.dispose();
        return scored.slice(0, k);
    }

    cosineSimilarity(vecA, vecB) {
        let dot = 0, normA = 0, normB = 0;
        for (let i = 0; i < vecA.length; i++) {
            dot += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }
        return dot / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    extractFormKeywords(docs) {
        const formKeywords = ['별지', '서식', '신청서', '동의서', '양식', '정정신청서', '변경신고서', '등록신청서'];
        const found = [];
        for (const doc of docs) {
            doc.content.split('\n').forEach(line => {
                const t = line.trim();
                if (formKeywords.some(k => t.includes(k)) && !found.includes(t)) {
                    found.push(t.length > 60 ? t.slice(0, 60) + '...' : t);
                }
            });
        }
        return found;
    }

    formatSourceLine(doc) {
        const file = doc.metadata.fileName || '문서';
        const page = doc.metadata.pageNumber || '?';
        const prev = doc.content.trim().replace(/\n/g, ' ');
        const p = prev.length > 80 ? prev.slice(0, 80) + '...' : prev;
        return `${file} p.${page} — "${p}"`;
    }

    async buildContext(query) {
        const docs = await this.retrieveRelevantDocuments(query);
        if (docs.length === 0) return { context: '검색된 문서가 없습니다.', sources: [], forms: []};
        const sources = docs.map(doc => this.formatSourceLine(doc));
        const forms = this.extractFormKeywords(docs);
        const contextBlocks = docs.map(doc => {
            const src = doc.metadata.sourceInfo || this.formatSourceLine(doc);
            let content = doc.content.trim();
            if (content.length > 1200) content = content.slice(0, 1200) + '...';
            return `[출처: ${src}]\n${content}`;
        });
        const context = contextBlocks.join('\n\n');
        return { context, sources, forms };
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
window.RAGEngine = RAGEngine;
