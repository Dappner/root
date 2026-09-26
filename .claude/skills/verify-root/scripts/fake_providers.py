#!/usr/bin/env python3
"""Local stand-in for Voyage (embeddings + rerank) and Gemini (generateContent).

Verification scaffolding only. Stdlib, no deps. Deterministic:

- Embeddings: hashed bag-of-words, L2-normalised, so texts sharing words land
  near each other and hybrid search returns sensible hits.
- Rerank: token-overlap score.
- Gemini: returns "[stub-llm] ..." text (plain and SSE streaming). When the
  request forces a tool call (toolConfig mode ANY) and the function is in
  FORCED_CALL_ARGS, returns that functionCall instead (e.g. follow-up chips).

Every request is appended as one JSON line to $FAKE_PROVIDERS_LOG so a
verification run can prove the app actually called the provider.

Usage: fake_providers.py <port>
"""

import base64
import hashlib
import json
import math
import os
import re
import struct
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

DIM_DEFAULT = 1024
LOG_PATH = os.environ.get("FAKE_PROVIDERS_LOG")
TOKEN_RE = re.compile(r"[a-z0-9]+")


def tokens(text: str) -> list[str]:
    return TOKEN_RE.findall(text.lower())


def embed(text: str, dim: int) -> list[float]:
    vec = [0.0] * dim
    for tok in tokens(text) or ["<empty>"]:
        h = hashlib.sha256(tok.encode()).digest()
        idx = int.from_bytes(h[:4], "little") % dim
        vec[idx] += 1.0 if h[4] & 1 else -1.0
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]


def overlap(query: str, doc: str) -> float:
    q, d = set(tokens(query)), set(tokens(doc))
    return len(q & d) / (len(q) or 1)


def log(entry: dict) -> None:
    if not LOG_PATH:
        return
    with open(LOG_PATH, "a") as f:
        f.write(json.dumps({"ts": time.time(), **entry}) + "\n")


# Canned args for forced function calls, keyed by Jetflow action name.
FORCED_CALL_ARGS = {
    "FollowUpPrompts": {"prompts": ["[stub-llm] Tell me more", "[stub-llm] How does this connect?"]},
    "AutoSectionList": {"sections": [{"start_sec": 0, "end_sec": 60, "title": "[stub-llm] Section 1"}]},
}


def forced_call(body: dict) -> dict | None:
    config = (body.get("toolConfig") or {}).get("functionCallingConfig") or {}
    if config.get("mode") != "ANY":
        return None
    names = config.get("allowedFunctionNames") or [
        decl["name"]
        for tool in body.get("tools") or []
        for decl in tool.get("functionDeclarations") or []
    ]
    name = next((n for n in names if n in FORCED_CALL_ARGS), None)
    return {"functionCall": {"name": name, "args": FORCED_CALL_ARGS[name]}} if name else None


def gemini_text(body: dict) -> str:
    last = ""
    for content in body.get("contents") or []:
        for part in content.get("parts") or []:
            if part.get("text"):
                last = part["text"]
    snippet = " ".join(last.split())[:160]
    return f"[stub-llm] Stubbed answer (no real model). Last input: {snippet}"


def gemini_response(text: str, model: str, part: dict | None = None) -> dict:
    return {
        "candidates": [
            {
                "content": {"role": "model", "parts": [part or {"text": text}]},
                "finishReason": "STOP",
                "index": 0,
            }
        ],
        "usageMetadata": {
            "promptTokenCount": 1,
            "candidatesTokenCount": len(text.split()),
            "totalTokenCount": 1 + len(text.split()),
        },
        "modelVersion": model,
    }


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *_args) -> None:  # silence default stderr logging
        pass

    def _json(self, status: int, payload: dict) -> None:
        raw = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self) -> None:
        if self.path == "/health":
            self._json(200, {"ok": True, "service": "fake-providers"})
        else:
            self._json(404, {"error": "not found"})

    def do_POST(self) -> None:
        length = int(self.headers.get("Content-Length") or 0)
        body = json.loads(self.rfile.read(length) or b"{}")
        path = self.path.split("?")[0]

        if path.endswith("/embeddings"):
            return self._embeddings(body)
        if path.endswith("/rerank"):
            return self._rerank(body)
        m = re.search(r"/models/([^/:]+):(generateContent|streamGenerateContent)$", path)
        if m:
            return self._gemini(body, m.group(1), stream=m.group(2) == "streamGenerateContent")
        log({"provider": "unknown", "path": path})
        self._json(404, {"error": f"fake-providers: no stub for {path}"})

    def _embeddings(self, body: dict) -> None:
        texts = body.get("input") or []
        texts = [texts] if isinstance(texts, str) else texts
        dim = body.get("output_dimension") or DIM_DEFAULT
        b64 = body.get("encoding_format") == "base64"
        data = []
        for i, text in enumerate(texts):
            vec = embed(text, dim)
            emb = base64.b64encode(struct.pack(f"<{dim}f", *vec)).decode() if b64 else vec
            data.append({"object": "embedding", "embedding": emb, "index": i})
        log({"provider": "voyage", "op": "embed", "n": len(texts), "input_type": body.get("input_type")})
        self._json(200, {
            "object": "list",
            "data": data,
            "model": body.get("model"),
            "usage": {"total_tokens": sum(len(tokens(t)) for t in texts)},
        })

    def _rerank(self, body: dict) -> None:
        query, docs = body.get("query", ""), body.get("documents") or []
        scored = sorted(
            ({"index": i, "relevance_score": overlap(query, d)} for i, d in enumerate(docs)),
            key=lambda r: r["relevance_score"],
            reverse=True,
        )
        if body.get("top_k"):
            scored = scored[: body["top_k"]]
        if body.get("return_documents"):
            for r in scored:
                r["document"] = docs[r["index"]]
        log({"provider": "voyage", "op": "rerank", "n": len(docs)})
        self._json(200, {
            "object": "list",
            "data": scored,
            "model": body.get("model"),
            "usage": {"total_tokens": len(tokens(query))},
        })

    def _gemini(self, body: dict, model: str, stream: bool) -> None:
        text = gemini_text(body)
        call = forced_call(body)
        log({
            "provider": "gemini",
            "op": "stream" if stream else "generate",
            "model": model,
            **({"function_call": call["functionCall"]["name"]} if call else {}),
        })
        if call and not stream:
            return self._json(200, gemini_response("", model, part=call))
        if not stream:
            return self._json(200, gemini_response(text, model))
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Connection", "close")
        self.end_headers()
        words = text.split(" ")
        chunks = [" ".join(words[i : i + 4]) + " " for i in range(0, len(words), 4)]
        if call:
            chunks = [""]
        for i, chunk in enumerate(chunks):
            payload = gemini_response(chunk, model, part=call)
            if i < len(chunks) - 1:
                payload["candidates"][0].pop("finishReason")
            self.wfile.write(f"data: {json.dumps(payload)}\r\n\r\n".encode())
            self.wfile.flush()
        self.close_connection = True


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 18090
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
