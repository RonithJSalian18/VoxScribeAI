"""In-memory stand-ins for Supabase, embeddings and the LLM so tests never hit the network."""
import uuid
from datetime import datetime, timezone
from types import SimpleNamespace

# Child tables removed when a parent row is deleted (mirrors ON DELETE CASCADE in schema.sql)
CASCADES = {
    "voices": [("vault_sources", "voice_id"), ("documents", "voice_id")],
    "vault_sources": [("documents", "source_id")],
}

class _Query:
    def __init__(self, db: "FakeSupabase", table: str):
        self.db = db
        self.table = table
        self.mode = "select"
        self.payload = None
        self.filters: list[tuple] = []
        self.order_by: tuple | None = None
        self.limit_n: int | None = None
        self.columns: list[str] | None = None

    def select(self, columns: str = "*"):
        self.mode = "select"
        self.columns = None if columns.strip() == "*" else [c.strip() for c in columns.split(",")]
        return self

    def insert(self, payload):
        self.mode, self.payload = "insert", payload
        return self

    def update(self, payload):
        self.mode, self.payload = "update", payload
        return self

    def upsert(self, payload):
        self.mode, self.payload = "upsert", payload
        return self

    def delete(self):
        self.mode = "delete"
        return self

    def eq(self, column, value):
        self.filters.append(("eq", column, value))
        return self

    def gte(self, column, value):
        self.filters.append(("gte", column, value))
        return self

    def in_(self, column, values):
        self.filters.append(("in", column, list(values)))
        return self

    def order(self, column, desc: bool = False):
        self.order_by = (column, desc)
        return self

    def limit(self, n: int):
        self.limit_n = n
        return self

    def _matches(self, row: dict) -> bool:
        for op, column, value in self.filters:
            if op == "eq" and row.get(column) != value:
                return False
            if op == "gte" and (row.get(column) is None or row.get(column) < value):
                return False
            if op == "in" and row.get(column) not in value:
                return False
        return True

    def execute(self):
        rows = self.db.tables.setdefault(self.table, [])

        if self.mode == "insert":
            items = self.payload if isinstance(self.payload, list) else [self.payload]
            created = []
            for item in items:
                row = {"id": str(uuid.uuid4()), "created_at": datetime.now(timezone.utc).isoformat(), **item}
                rows.append(row)
                created.append(dict(row))
            return SimpleNamespace(data=created)

        if self.mode == "upsert":
            key = "video_id" if "video_id" in self.payload else "id"
            existing = next((r for r in rows if key in self.payload and r.get(key) == self.payload[key]), None)
            if existing:
                existing.update(self.payload)
                return SimpleNamespace(data=[dict(existing)])
            row = {"created_at": datetime.now(timezone.utc).isoformat(), **self.payload}
            rows.append(row)
            return SimpleNamespace(data=[dict(row)])

        matched = [r for r in rows if self._matches(r)]

        if self.mode == "update":
            for r in matched:
                r.update(self.payload)
            return SimpleNamespace(data=[dict(r) for r in matched])

        if self.mode == "delete":
            for r in matched:
                self.db.delete_row(self.table, r)
            return SimpleNamespace(data=[dict(r) for r in matched])

        if self.order_by:
            column, desc = self.order_by
            matched = sorted(matched, key=lambda r: r.get(column) or "", reverse=desc)
        if self.limit_n is not None:
            matched = matched[: self.limit_n]
        if self.columns:
            matched = [{c: r.get(c) for c in self.columns} for r in matched]
        return SimpleNamespace(data=[dict(r) for r in matched])

class FakeSupabase:
    def __init__(self):
        self.tables: dict[str, list[dict]] = {}
        self.rpc_calls: list[tuple[str, dict]] = []

    def table(self, name: str) -> _Query:
        return _Query(self, name)

    def delete_row(self, table: str, row: dict) -> None:
        if row in self.tables.get(table, []):
            self.tables[table].remove(row)
        for child, fk in CASCADES.get(table, []):
            for child_row in [r for r in self.tables.get(child, []) if r.get(fk) == row["id"]]:
                self.delete_row(child, child_row)

    def rpc(self, name: str, params: dict):
        self.rpc_calls.append((name, params))
        docs = [
            d for d in self.tables.get("documents", [])
            if d["user_id"] == params["match_user_id"]
            and (params.get("match_voice_id") is None or d.get("voice_id") == params["match_voice_id"])
        ]
        data = [{"id": d["id"], "content": d["content"], "similarity": 1.0} for d in docs]
        return SimpleNamespace(execute=lambda: SimpleNamespace(data=data[: params.get("match_count", 3)]))

class FakeEmbeddings:
    def embed_query(self, text: str) -> list[float]:
        return [0.0] * 384

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [[0.0] * 384 for _ in texts]

class FakeLLM:
    """Returns canned responses; records prompts for assertions."""

    def __init__(self, response: str = "fake response"):
        self.response = response
        self.prompts: list[str] = []

    def invoke(self, messages):
        self.prompts.append(messages[-1].content)
        return SimpleNamespace(content=self.response)
