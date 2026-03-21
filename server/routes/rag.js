const express = require('express');
const router = express.Router();

const { authMiddleware } = require('../middleware/auth');
const { chatWithRag } = require('../services/ragService');

// Keeps conversation context across back-to-back queries per user session.
const ragSessionHistory = new Map();

function buildChunkFallbackText(chunkPreviews = []) {
    if (!Array.isArray(chunkPreviews) || chunkPreviews.length === 0) {
        return 'No matching chunks were found in the current vector database.';
    }

    const lines = ['Retrieved chunks:'];
    chunkPreviews.forEach((chunk, idx) => {
        lines.push(`[${idx + 1}] Source: ${chunk.source || 'unknown'}`);
        lines.push(chunk.text || '');
        lines.push('');
    });
    return lines.join('\n').trim();
}

router.post('/chat', authMiddleware, async (req, res) => {
    try {
        const query = String(req.body?.query || '').trim();
        if (!query) {
            return res.status(400).json({ message: 'query is required' });
        }

        const sessionId = String(req.body?.sessionId || `user-${req.user._id}`);
        const history = ragSessionHistory.get(sessionId) || [];

        const result = await chatWithRag({
            query,
            sessionId,
            history,
        });

        ragSessionHistory.set(sessionId, result.history || []);

        if (!result.llmUsed) {
            const answerBody = (result.answer || '').trim();
            const lowerAnswerBody = answerBody.toLowerCase();
            const bodyIsOnlyUnavailable = lowerAnswerBody === 'llm is not available';
            const fallbackBody = (!answerBody || bodyIsOnlyUnavailable)
                ? buildChunkFallbackText(result.chunkPreviews)
                : answerBody;

            return res.json({
                answer: `llm is not available\n\n${fallbackBody}`.trim(),
                llmAvailable: false,
                mode: result.mode,
                sources: result.sources,
                chunkPreviews: result.chunkPreviews,
                historyRelated: result.historyRelated,
            });
        }

        return res.json({
            answer: result.answer,
            llmAvailable: true,
            mode: result.mode,
            sources: result.sources,
            historyRelated: result.historyRelated,
        });
    } catch (err) {
        return res.status(500).json({
            message: 'RAG chat error',
            detail: err.message,
        });
    }
});

router.delete('/chat/:sessionId', authMiddleware, (req, res) => {
    ragSessionHistory.delete(req.params.sessionId);
    res.json({ message: 'RAG session cleared' });
});

module.exports = router;
