import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import GroupKFold, cross_val_predict
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

def grouped_baseline(df: pd.DataFrame, target: str, group: str, categorical=("position",)) -> dict:
    if target not in df or group not in df:
        raise ValueError("target and group columns must exist")
    y = df[target].astype(float)
    groups = df[group]
    X = df[[c for c in df.columns if c not in {target, group}]].copy()
    cat = [c for c in categorical if c in X.columns]
    num = [c for c in X.columns if c not in cat]
    pre = ColumnTransformer([
        ("num", SimpleImputer(strategy="median"), num),
        ("cat", Pipeline([
            ("imputer", SimpleImputer(strategy="most_frequent")),
            ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
        ]), cat),
    ], remainder="drop")
    model = Pipeline([
        ("pre", pre),
        ("model", HistGradientBoostingRegressor(max_depth=4, learning_rate=0.05, max_iter=300, l2_regularization=1.0, random_state=42)),
    ])
    n_groups = groups.nunique()
    if n_groups < 2:
        raise ValueError("Need at least two groups for grouped cross-validation")
    cv = GroupKFold(n_splits=min(5, n_groups))
    pred = cross_val_predict(model, X, y, groups=groups, cv=cv)
    return {"mae": float(mean_absolute_error(y, pred)), "r2": float(r2_score(y, pred)), "predictions": np.asarray(pred)}
