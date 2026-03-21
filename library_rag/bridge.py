import argparse
import json
import traceback

import app as rag_app


def run_ingest(payload: dict):
    force = bool(payload.get("force", True))
    chunks = rag_app.ingest_books(force=force)
    return {
        "ok": True,
        "chunks_indexed": chunks,
    }


def run_chat(payload: dict):
    query = str(payload.get("query", "")).strip()
    session_id = str(payload.get("session_id", "default")).strip() or "default"
    use_llm = bool(payload.get("use_llm", True))
    require_llm = bool(payload.get("require_llm", False))

    if not query:
        return {"ok": False, "error": "query is required"}

    history = payload.get("history", [])
    if isinstance(history, list):
        rag_app.history_store[session_id] = history

    retrieval_query, history_related, previous_query, related_score = rag_app.build_history_aware_retrieval_query(
        session_id,
        query,
    )
    docs = rag_app.retrieve_docs(retrieval_query)
    sources = rag_app.list_sources(docs)
    chunk_previews = []
    for doc in docs[:3]:
        source = doc.metadata.get("source", "unknown")
        text = " ".join(doc.page_content.split())
        chunk_previews.append({
            "source": source,
            "text": text[:500],
        })

    answer, llm_used, mode = rag_app.build_answer(query, docs, session_id, use_llm)
    rag_app.append_history(session_id, query, answer)

    if require_llm and not llm_used:
        answer = "llm is not available\n\n" + rag_app.build_manual_answer(query, docs)

    return {
        "ok": True,
        "answer": answer,
        "llm_used": llm_used,
        "mode": mode,
        "sources": sources,
        "chunk_previews": chunk_previews,
        "history": rag_app.history_store.get(session_id, []),
        "history_related": history_related,
        "history_similarity": round(related_score, 4),
        "history_reference_query": previous_query,
    }


def main():
    parser = argparse.ArgumentParser(description="Bridge commands for Node server")
    parser.add_argument("--action", required=True, choices=["ingest", "chat"])
    parser.add_argument("--payload", default="{}")
    args = parser.parse_args()

    payload = json.loads(args.payload)

    if args.action == "ingest":
        result = run_ingest(payload)
    else:
        result = run_chat(payload)

    print(json.dumps(result, ensure_ascii=True))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(json.dumps({
            "ok": False,
            "error": str(exc),
            "traceback": traceback.format_exc(),
        }, ensure_ascii=True))
