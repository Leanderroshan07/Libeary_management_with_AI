import os
import shutil
import argparse
from pathlib import Path
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

# ── Load env: library_rag/.env → server/.env fallback ──────────────────────
_BASE = Path(__file__).parent
load_dotenv(_BASE / ".env")
load_dotenv(_BASE.parent / "server" / ".env")

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma
from langchain_core.documents import Document

# ── Config ──────────────────────────────────────────────────────────────────
BOOKS_DIR     = _BASE.parent / "Books"
CHROMA_DIR    = _BASE / "chroma_db"
COLLECTION    = "library_books"
PORT          = int(os.getenv("RAG_PORT", 5001))

CHUNK_SIZE    = 500
CHUNK_OVERLAP = 50
USE_LLM_DEFAULT = os.getenv("USE_LLM", "false").strip().lower() in ("1", "true", "yes", "on")
FOLLOWUP_SIMILARITY_THRESHOLD = float(os.getenv("FOLLOWUP_SIMILARITY_THRESHOLD", "0.62"))

# ── Global singletons ────────────────────────────────────────────────────────
_embeddings   = None
_vectorstore  = None
_llm          = None

# in-memory chat history  { session_id: [ {role, content}, … ] }
history_store: dict[str, list[dict]] = {}


def parse_bool(value, default: bool = False) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in ("1", "true", "yes", "on")


# ── Component initialisation (lazy) ─────────────────────────────────────────
def get_embeddings():
    global _embeddings
    if _embeddings is None:
        print("[RAG] Loading HuggingFace embeddings (sentence-transformers/all-MiniLM-L6-v2)...")
        _embeddings = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2",
            model_kwargs={"device": "cpu"},
            encode_kwargs={"normalize_embeddings": True},
        )
    return _embeddings


def get_vectorstore(embeddings=None):
    global _vectorstore
    if _vectorstore is None:
        CHROMA_DIR.mkdir(parents=True, exist_ok=True)
        _vectorstore = Chroma(
            collection_name=COLLECTION,
            embedding_function=embeddings or get_embeddings(),
            persist_directory=str(CHROMA_DIR),
        )
    return _vectorstore


def get_llm():
    global _llm
    if _llm is not None:
        return _llm

    api_key = (
        os.getenv("Gemini_API_KEY")
        or os.getenv("GOOGLE_API_KEY")
        or os.getenv("GEMINI_KEY")
    )
    if not api_key:
        return None

    try:
        from langchain_google_genai import ChatGoogleGenerativeAI
    except Exception:
        return None

    _llm = ChatGoogleGenerativeAI(
        model="gemini-2.0-flash",
        google_api_key=api_key,
        temperature=0.7,
    )
    return _llm


def build_manual_answer(query: str, docs: list[Document]) -> str:
    if not docs:
        return (
            "Manual retrieval mode (LLM off). "
            "No relevant chunks were found in the Books folder for this query."
        )

    top_chunks = docs[:2]
    lines = [
        "Manual retrieval mode (LLM off). Here are the closest chunks from your books:",
        f"Question: {query}",
        "",
    ]

    for i, doc in enumerate(top_chunks, start=1):
        source = doc.metadata.get("source", "unknown")
        compact = " ".join(doc.page_content.split())
        snippet = compact[:500]
        lines.append(f"[{i}] Source: {source}")
        lines.append(snippet)
        lines.append("")

    return "\n".join(lines).strip()


def build_llm_answer(query: str, docs: list[Document], session_id: str) -> str:
    from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

    model = get_llm()
    if model is None:
        return build_manual_answer(query, docs)

    context = "\n\n---\n\n".join(d.page_content for d in docs)
    messages = [
        SystemMessage(
            content=(
                "You are a helpful library assistant. "
                "Answer the user's question using ONLY the book excerpts provided below.\n"
                "If the answer cannot be found in the excerpts, say so clearly.\n\n"
                f"BOOK EXCERPTS:\n{context}"
            )
        )
    ]

    for turn in history_store.get(session_id, []):
        if turn["role"] == "user":
            messages.append(HumanMessage(content=turn["content"]))
        else:
            messages.append(AIMessage(content=turn["content"]))

    messages.append(HumanMessage(content=query))
    response = model.invoke(messages)
    return response.content


def get_llm_mode(use_llm_requested: bool) -> tuple[bool, str]:
    if not use_llm_requested:
        return False, "manual"
    if get_llm() is None:
        return False, "manual_fallback"
    return True, "gemini"


def llm_warning(mode: str) -> str:
    if mode == "manual_fallback":
        return (
            "\n\n[Notice] Gemini is not available (missing key/package) or request failed. "
            "Returned manual retrieval output instead."
        )
    return ""


def llm_failure_to_manual(query: str, docs: list[Document], error: Exception) -> str:
    answer = build_manual_answer(query, docs)
    err_text = str(error).strip().lower()
    if "resource_exhausted" in err_text or "quota" in err_text:
        reason = "Gemini quota exceeded"
    else:
        reason = "Gemini unavailable"
    return answer + f"\n\n[Notice] {reason}. Returned manual retrieval output."


def selected_use_llm(body: dict) -> bool:
    return parse_bool(body.get("use_llm"), default=USE_LLM_DEFAULT)


def build_answer(query: str, docs: list[Document], session_id: str, use_llm_requested: bool) -> tuple[str, bool, str]:
    llm_enabled, mode = get_llm_mode(use_llm_requested)
    if not llm_enabled:
        return build_manual_answer(query, docs) + llm_warning(mode), False, mode

    try:
        return build_llm_answer(query, docs, session_id), True, mode
    except Exception as exc:
        return llm_failure_to_manual(query, docs, exc), False, "manual_fallback"


def list_sources(docs: list[Document]) -> list[str]:
    return list({d.metadata.get("source", "") for d in docs})


def get_last_user_query(session_id: str) -> str | None:
    turns = history_store.get(session_id, [])
    for turn in reversed(turns):
        if turn.get("role") == "user":
            return str(turn.get("content", "")).strip() or None
    return None


def cosine_similarity(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = sum(x * x for x in a) ** 0.5
    norm_b = sum(y * y for y in b) ** 0.5
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return dot / (norm_a * norm_b)


def looks_like_followup(query: str) -> bool:
    q = query.strip().lower()
    if not q:
        return False
    markers = (
        " it ", " he ", " she ", " they ", " them ", " this ", " that ",
        " his ", " her ", " their ", " also ", " then ", " what about ",
        "which club", "which team", "and after", "next"
    )
    padded = f" {q} "
    short_query = len(q.split()) <= 9
    return short_query and any(marker in padded for marker in markers)


def build_history_aware_retrieval_query(session_id: str, query: str) -> tuple[str, bool, str | None, float]:
    previous_query = get_last_user_query(session_id)
    if not previous_query:
        return query, False, None, 0.0

    emb = get_embeddings()
    current_vec = emb.embed_query(query)
    previous_vec = emb.embed_query(previous_query)
    similarity = cosine_similarity(current_vec, previous_vec)

    related = similarity >= FOLLOWUP_SIMILARITY_THRESHOLD
    if not related and looks_like_followup(query):
        related = similarity >= max(0.45, FOLLOWUP_SIMILARITY_THRESHOLD - 0.12)

    if related:
        retrieval_query = f"{previous_query}\n{query}"
        return retrieval_query, True, previous_query, similarity
    return query, False, previous_query, similarity


def retrieve_docs(query: str) -> list[Document]:
    vs = get_vectorstore()
    return vs.similarity_search(query, k=4)


def retrieve_docs_with_scores(query: str, k: int = 4) -> list[tuple[Document, float | None]]:
    vs = get_vectorstore()
    try:
        return vs.similarity_search_with_score(query, k=k)
    except Exception:
        docs = vs.similarity_search(query, k=k)
        return [(doc, None) for doc in docs]


def append_history(session_id: str, query: str, answer: str):
    session = history_store.setdefault(session_id, [])
    session.append({"role": "user", "content": query})
    session.append({"role": "assistant", "content": answer})


def print_retrieved_chunks(scored_docs: list[tuple[Document, float | None]]):
    print("\n=== Retrieved Chunks ===")
    if not scored_docs:
        print("No chunks found.")
        return

    for idx, (doc, score) in enumerate(scored_docs, start=1):
        source = doc.metadata.get("source", "unknown")
        compact = " ".join(doc.page_content.split())
        snippet = compact[:500]
        if score is None:
            print(f"[{idx}] source={source}")
        else:
            print(f"[{idx}] source={source} score={score:.4f}")
        print(snippet)
        print("-")


def run_cli(session_id: str = "terminal", use_llm: bool = False, k: int = 4):
    cli_use_llm = use_llm
    print("[RAG] Terminal mode started.")
    print("Type your question and press Enter.")
    print("Commands: /exit, /history, /clear, /llm on, /llm off")

    while True:
        try:
            query = input("\nYou> ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\n[RAG] Exiting terminal mode.")
            break

        if not query:
            continue

        lower = query.lower()
        if lower in ("/exit", "/quit", "exit", "quit"):
            print("[RAG] Exiting terminal mode.")
            break
        if lower == "/history":
            turns = history_store.get(session_id, [])
            print(f"\nSession history turns: {len(turns)}")
            for t in turns[-6:]:
                print(f"{t['role']}: {t['content'][:180]}")
            continue
        if lower == "/clear":
            history_store.pop(session_id, None)
            print("[RAG] Session history cleared.")
            continue
        if lower == "/llm on":
            cli_use_llm = True
            print("[RAG] LLM mode enabled for next questions.")
            continue
        if lower == "/llm off":
            cli_use_llm = False
            print("[RAG] LLM mode disabled. Manual retrieval mode active.")
            continue

        retrieval_query, history_related, previous_query, related_score = build_history_aware_retrieval_query(session_id, query)
        if history_related:
            print("\n[History] Related follow-up detected.")
            print(f"[History] similarity={related_score:.3f}")
            print(f"[History] previous question: {previous_query}")
        elif previous_query:
            print(f"\n[History] Not related to previous question (similarity={related_score:.3f}).")

        scored_docs = retrieve_docs_with_scores(retrieval_query, k=k)
        docs = [doc for doc, _ in scored_docs]
        print_retrieved_chunks(scored_docs)

        answer, llm_used, mode = build_answer(query, docs, session_id, cli_use_llm)
        append_history(session_id, query, answer)

        print("\n=== Answer ===")
        print(answer)
        print(f"\nmode={mode} llm_used={llm_used}")


# ── Ingestion ────────────────────────────────────────────────────────────────
def ingest_books(force: bool = False) -> int:
    """
    Load every .txt / .md file from BOOKS_DIR, split into chunks,
    embed with HuggingFace and store in Chroma.
    Skips if the collection is already populated (unless force=True).
    """
    global _vectorstore

    emb = get_embeddings()
    vs  = get_vectorstore(emb)

    existing = vs._collection.count()
    if not force and existing > 0:
        print(f"[RAG] Collection already contains {existing} chunks - skipping ingest.")
        return existing

    # ── Load source documents ─────────────────────────────────────────────
    docs: list[Document] = []
    for pattern in ("*.txt", "*.md"):
        for fp in BOOKS_DIR.glob(pattern):
            text = fp.read_text(encoding="utf-8", errors="ignore").strip()
            if text:
                docs.append(Document(page_content=text, metadata={"source": fp.name}))

    if not docs:
        print("[RAG] No source documents found in Books/")
        return 0

    # ── Split ─────────────────────────────────────────────────────────────
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    chunks = splitter.split_documents(docs)
    print(f"[RAG] Split {len(docs)} document(s) -> {len(chunks)} chunks")

    # ── If force, wipe existing Chroma data ───────────────────────────────
    if force and existing > 0:
        print("[RAG] Force re-ingest: clearing existing collection...")
        shutil.rmtree(str(CHROMA_DIR), ignore_errors=True)
        CHROMA_DIR.mkdir(parents=True, exist_ok=True)
        _vectorstore = Chroma(
            collection_name=COLLECTION,
            embedding_function=emb,
            persist_directory=str(CHROMA_DIR),
        )
        vs = _vectorstore

    # ── Embed + store ──────────────────────────────────────────────────────
    print("[RAG] Generating embeddings and storing in Chroma...")
    vs.add_documents(chunks)
    print(f"[RAG] Done. Total chunks in store: {vs._collection.count()}")
    return vs._collection.count()


# ── Flask app ────────────────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app)


# POST /api/ingest
# Body (optional): { "force": true }
@app.route("/api/ingest", methods=["POST"])
def api_ingest():
    body  = request.get_json(silent=True) or {}
    force = bool(body.get("force", False))
    try:
        count = ingest_books(force=force)
        return jsonify({"status": "ok", "chunks_indexed": count})
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


# POST /api/chat
# Body: { "query": "...", "session_id": "abc" }
@app.route("/api/chat", methods=["POST"])
def api_chat():
    body       = request.get_json(silent=True) or {}
    query      = body.get("query", "").strip()
    session_id = body.get("session_id", "default")
    use_llm_requested = selected_use_llm(body)

    if not query:
        return jsonify({"error": "query is required"}), 400

    try:
        retrieval_query, history_related, previous_query, related_score = build_history_aware_retrieval_query(session_id, query)
        docs = retrieve_docs(retrieval_query)
        sources = list_sources(docs)
        answer, llm_used, mode = build_answer(query, docs, session_id, use_llm_requested)
        append_history(session_id, query, answer)

        return jsonify({
            "answer":     answer,
            "session_id": session_id,
            "sources":    sources,
            "llm_used":   llm_used,
            "mode":       mode,
            "history_related": history_related,
            "history_similarity": round(related_score, 4),
            "history_reference_query": previous_query,
        })

    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


# GET /api/history/<session_id>
@app.route("/api/history/<session_id>", methods=["GET"])
def api_history(session_id: str):
    return jsonify({
        "session_id": session_id,
        "history":    history_store.get(session_id, []),
    })


# DELETE /api/clear/<session_id>
@app.route("/api/clear/<session_id>", methods=["DELETE"])
def api_clear(session_id: str):
    history_store.pop(session_id, None)
    return jsonify({"status": "cleared", "session_id": session_id})


# GET /api/status
@app.route("/api/status", methods=["GET"])
def api_status():
    try:
        vs    = get_vectorstore()
        count = vs._collection.count()
        return jsonify({"status": "ok", "chunks_indexed": count})
    except Exception as exc:
        return jsonify({"status": "error", "detail": str(exc)}), 500


# ── Entry point ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Library RAG: terminal mode by default")
    parser.add_argument("--server", action="store_true", help="Run API server mode (localhost)")
    parser.add_argument("--use-llm", action="store_true", help="Enable Gemini in terminal mode")
    parser.add_argument("--session-id", default="terminal", help="Session ID for chat history")
    parser.add_argument("--k", type=int, default=4, help="Top-k chunks to retrieve")
    parser.add_argument("--reingest", action="store_true", help="Force rebuild of Chroma vector store")
    args = parser.parse_args()

    if args.server:
        print("[RAG] Starting Library RAG server...")
        ingest_books(force=args.reingest)
        app.run(host="0.0.0.0", port=PORT, debug=False, threaded=True)
    else:
        print("[RAG] Starting Library RAG terminal mode...")
        ingest_books(force=args.reingest)
        run_cli(session_id=args.session_id, use_llm=args.use_llm, k=args.k)
