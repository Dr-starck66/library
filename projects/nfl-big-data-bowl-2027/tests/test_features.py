import numpy as np
import pandas as pd
from src.features import extract_movement_fingerprint

def test_straight_line_fingerprint():
    df = pd.DataFrame({
        "nflId": [1]*11,
        "frameId": range(11),
        "x": np.arange(11)*0.5,
        "y": np.zeros(11),
        "s": np.ones(11)*5.0,
        "a": np.zeros(11),
        "dir": np.zeros(11),
        "o": np.zeros(11),
    })
    f = extract_movement_fingerprint(df)
    assert len(f) == 1
    assert abs(f.loc[0, "path_length"] - 5.0) < 1e-9
    assert abs(f.loc[0, "displacement"] - 5.0) < 1e-9
    assert abs(f.loc[0, "trajectory_efficiency"] - 1.0) < 1e-9
    assert abs(f.loc[0, "max_speed"] - 5.0) < 1e-9

def test_missing_required_column_fails_closed():
    df = pd.DataFrame({"nflId": [1], "frameId": [1], "x": [0.0]})
    try:
        extract_movement_fingerprint(df)
    except ValueError as e:
        assert "Missing required columns" in str(e)
    else:
        raise AssertionError("Expected fail-closed ValueError")
