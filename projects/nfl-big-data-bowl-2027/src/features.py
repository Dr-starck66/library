from __future__ import annotations
import numpy as np
import pandas as pd

def _angle_diff_deg(a: pd.Series) -> pd.Series:
    d = a.diff().astype(float)
    return ((d + 180.0) % 360.0) - 180.0

def extract_movement_fingerprint(
    tracking: pd.DataFrame,
    player_col: str = "nflId",
    frame_col: str = "frameId",
    x_col: str = "x",
    y_col: str = "y",
    speed_col: str = "s",
    accel_col: str = "a",
    direction_col: str = "dir",
    orientation_col: str = "o",
    hz: float = 10.0,
) -> pd.DataFrame:
    required = {player_col, frame_col, x_col, y_col}
    missing = required - set(tracking.columns)
    if missing:
        raise ValueError(f"Missing required columns: {sorted(missing)}")
    df = tracking.sort_values([player_col, frame_col]).copy()
    dt = 1.0 / hz
    out = []
    for player_id, g in df.groupby(player_col, dropna=False):
        g = g.sort_values(frame_col).copy()
        dx = g[x_col].astype(float).diff()
        dy = g[y_col].astype(float).diff()
        step = np.sqrt(dx * dx + dy * dy)
        speed_geom = step / dt
        speed = g[speed_col].astype(float) if speed_col in g else speed_geom
        accel = g[accel_col].astype(float) if accel_col in g else speed.diff() / dt
        jerk = accel.diff() / dt
        displacement = float(np.hypot(g[x_col].iloc[-1] - g[x_col].iloc[0], g[y_col].iloc[-1] - g[y_col].iloc[0])) if len(g) > 1 else 0.0
        path = float(step.fillna(0).sum())
        efficiency = displacement / path if path > 0 else 0.0
        turn_rate = np.nan
        turn_cost = np.nan
        if direction_col in g:
            turn = _angle_diff_deg(g[direction_col].astype(float)).abs()
            turn_rate = float((turn / dt).replace([np.inf, -np.inf], np.nan).mean())
            sharp = turn >= 20.0
            if sharp.any():
                before = speed.shift(1)[sharp]
                after = speed[sharp]
                valid = (before > 0) & before.notna() & after.notna()
                if valid.any():
                    turn_cost = float((1.0 - (after[valid] / before[valid])).median())
        orient_motion_gap = np.nan
        if orientation_col in g and direction_col in g:
            gap = ((g[orientation_col].astype(float) - g[direction_col].astype(float) + 180) % 360) - 180
            orient_motion_gap = float(gap.abs().mean())
        out.append({
            player_col: player_id,
            "frames": int(len(g)),
            "duration_s": float(max(len(g) - 1, 0) * dt),
            "max_speed": float(speed.max(skipna=True)),
            "mean_speed": float(speed.mean(skipna=True)),
            "max_accel": float(accel.max(skipna=True)),
            "mean_abs_accel": float(accel.abs().mean(skipna=True)),
            "max_abs_jerk": float(jerk.abs().max(skipna=True)),
            "path_length": path,
            "displacement": displacement,
            "trajectory_efficiency": efficiency,
            "mean_turn_rate_deg_s": turn_rate,
            "median_speed_loss_on_sharp_turn": turn_cost,
            "mean_orientation_motion_gap_deg": orient_motion_gap,
        })
    return pd.DataFrame(out)
