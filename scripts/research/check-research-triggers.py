#!/usr/bin/env python3
"""Evaluate safe, declarative research triggers from a metrics JSON snapshot."""
from __future__ import annotations

import json
import sys
from pathlib import Path

try:
    import yaml
except ModuleNotFoundError as exc:  # pragma: no cover - environment guard
    raise SystemExit(f"PyYAML is required: {exc}")

ROOT = Path(__file__).resolve().parents[2]
RULES_PATH = ROOT / "research" / "HARNESS_RULES.yaml"


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: check-research-triggers.py metrics.json", file=sys.stderr)
        return 2
    data = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    rules = yaml.safe_load(RULES_PATH.read_text(encoding="utf-8"))
    disk = rules["triggers"]["disk"]
    progress = rules["triggers"]["training_progress"]
    realtime = rules["triggers"]["realtime"]
    repeated = rules["triggers"]["repeated_failure"]
    triggers: list[dict[str, str]] = []
    def add(research_id: str, reason: str, severity: str = "medium") -> None:
        triggers.append({"research_id": research_id, "severity": severity, "reason": reason})
    if float(data.get("root_disk_used_pct", 0)) >= disk["warning_percent"]:
        add("RO-013", f"root disk >= {disk['warning_percent']}%; review cleanup trend", "high" if float(data["root_disk_used_pct"]) >= disk["human_escalation_percent"] else "medium")
    if float(data.get("progress_p95_ms", 0)) > progress["p95_ms"] or float(data.get("progress_recovery_rate", 1)) < progress["recovery_rate_min"]:
        add("RO-012", "progress latency/recovery protection threshold exceeded", "high")
    if float(data.get("job_reject_rate", 0)) > realtime["job_reject_rate_max"] or float(data.get("asr_p95_ms", 0)) > realtime["asr_p95_ms"] or float(data.get("provider_429_rate", 0)) > realtime["provider_429_rate_max"]:
        add("RO-014", "RTC/ASR admission or provider protection threshold exceeded", "high")
    if int(data.get("same_failure_count_7d", 0)) >= repeated["count_min"] and int(data.get("failure_window_days", repeated["window_days"])) <= repeated["window_days"]:
        add(str(data.get("research_id", "RO-012")), "same failure repeated within 7 days", "high")
    print(json.dumps({"triggered": triggers, "manual_confirmation_required": bool(triggers)}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
