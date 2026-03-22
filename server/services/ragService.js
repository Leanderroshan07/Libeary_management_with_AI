const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const LIBRARY_RAG_DIR = path.join(ROOT_DIR, 'library_rag');
const BRIDGE_PATH = path.join(LIBRARY_RAG_DIR, 'bridge.py');

const PYTHON_CANDIDATES = [
    path.join(ROOT_DIR, '.venv', 'Scripts', 'python.exe'),
    path.join(ROOT_DIR, '.venv', 'bin', 'python'),
    process.env.RAG_PYTHON,
    'python3',
    'python',
].filter(Boolean).filter((candidate, index) => {
    if (index >= 4) return true;
    return fs.existsSync(candidate);
});

function parseLastJsonLine(stdoutText) {
    const lines = String(stdoutText || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i -= 1) {
        try {
            return JSON.parse(lines[i]);
        } catch (err) {
            // keep scanning
        }
    }
    throw new Error('Could not parse bridge output as JSON');
}

function execBridgeWithPython(pythonCommand, action, payload) {
    return new Promise((resolve, reject) => {
        const args = [BRIDGE_PATH, '--action', action, '--payload', JSON.stringify(payload || {})];
        execFile(
            pythonCommand,
            args,
            {
                cwd: LIBRARY_RAG_DIR,
                maxBuffer: 1024 * 1024 * 8,
                windowsHide: true,
            },
            (error, stdout, stderr) => {
                if (error) {
                    const msg = stderr ? String(stderr).trim() : error.message;
                    reject(new Error(msg));
                    return;
                }

                try {
                    resolve(parseLastJsonLine(stdout));
                } catch (parseErr) {
                    reject(new Error(`${parseErr.message}. Raw output: ${stdout || stderr}`));
                }
            },
        );
    });
}

async function execBridge(action, payload) {
    let lastError = null;

    for (const pythonCommand of PYTHON_CANDIDATES) {
        try {
            const result = await execBridgeWithPython(pythonCommand, action, payload);
            if (result && result.ok === false) {
                throw new Error(result.error || 'Bridge returned error');
            }
            return result;
        } catch (err) {
            lastError = err;
        }
    }

    throw lastError || new Error('No Python runtime available for RAG bridge');
}

async function syncBooksToVectorDb() {
    const result = await execBridge('ingest', { force: true });
    return {
        success: true,
        chunksIndexed: result.chunks_indexed || 0,
    };
}

async function chatWithRag({ query, sessionId, history }) {
    try {
        const result = await execBridge('chat', {
            query,
            session_id: sessionId,
            history,
            use_llm: true,
            require_llm: false,
        });

        return {
            answer: result.answer,
            llmUsed: !!result.llm_used,
            mode: result.mode,
            sources: result.sources || [],
            chunkPreviews: Array.isArray(result.chunk_previews) ? result.chunk_previews : [],
            history: Array.isArray(result.history) ? result.history : [],
            historyRelated: !!result.history_related,
        };
    } catch (error) {
        // Keep API available when optional Python RAG runtime is missing on deployment.
        return {
            answer: 'RAG service is temporarily unavailable. Please try again later.',
            llmUsed: false,
            mode: 'rag_unavailable',
            sources: [],
            chunkPreviews: [],
            history: Array.isArray(history) ? history : [],
            historyRelated: false,
            error: error.message,
        };
    }
}

module.exports = {
    syncBooksToVectorDb,
    chatWithRag,
};
