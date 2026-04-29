import uuid
from datetime import datetime


class TradeLogger:
    def __init__(self):
        self._decisions: list[dict] = []

    def log_paper_signal(self, decision: dict) -> dict:
        entry = {**decision, "id": str(uuid.uuid4()), "logged_at": datetime.utcnow().isoformat()}
        self._decisions.append(entry)
        return entry

    def get_latest(self) -> dict | None:
        return self._decisions[-1] if self._decisions else None

    def get_all(self) -> list[dict]:
        return list(reversed(self._decisions))

    def get_by_id(self, decision_id: str) -> dict | None:
        return next((d for d in self._decisions if d.get("id") == decision_id), None)
