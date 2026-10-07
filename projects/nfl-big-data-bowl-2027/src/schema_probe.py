from pathlib import Path
import json
import pandas as pd

ROOT = Path("/kaggle/input/nfl-big-data-bowl-2027")

def probe(root: Path = ROOT):
    rows = []
    for p in sorted(root.rglob("*")):
        if not p.is_file():
            continue
        item = {"path": str(p.relative_to(root)), "bytes": p.stat().st_size, "suffix": p.suffix.lower()}
        if p.suffix.lower() == ".csv":
            try:
                sample = pd.read_csv(p, nrows=5)
                item["columns"] = list(sample.columns)
                item["sample_rows"] = len(sample)
            except Exception as e:
                item["error"] = f"{type(e).__name__}: {e}"
        rows.append(item)
    print(json.dumps(rows, indent=2))
    return rows

if __name__ == "__main__":
    probe()
