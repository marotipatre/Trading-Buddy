"""
Optional local forecasting service for Trading Buddy, using the open-source Kronos model
(https://github.com/shiyu-coder/Kronos, MIT licence; weights from Hugging Face).

Kronos is a research model for candlestick sequences. Nothing here shows it beats a simple baseline: Trading Buddy
shows its output as an experiment and never uses it in scores, picks or orders.

Setup (once, in a terminal):
    git clone https://github.com/shiyu-coder/Kronos ~/Kronos
    python3 -m venv ~/kronos-env && source ~/kronos-env/bin/activate
    pip install -r ~/Kronos/requirements.txt fastapi uvicorn
Run:
    KRONOS_REPO=~/Kronos uvicorn kronos_service:app --port 8765 --app-dir scripts
Then add  KRONOS_URL=http://localhost:8765  to .env.local and restart `npm run dev`.

It listens on localhost only and is called by the app's server; do not expose it to a network.
"""
import os
import sys
from typing import List

import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

REPO = os.path.expanduser(os.environ.get("KRONOS_REPO", "~/Kronos"))
sys.path.insert(0, REPO)
from model import Kronos, KronosTokenizer, KronosPredictor  # noqa: E402  (from the cloned repo)

MODEL = os.environ.get("KRONOS_MODEL", "NeoQuasar/Kronos-small")
TOKENIZER = os.environ.get("KRONOS_TOKENIZER", "NeoQuasar/Kronos-Tokenizer-base")
DEVICE = os.environ.get("KRONOS_DEVICE", "cpu")

app = FastAPI(title="Kronos forecast service")
_predictor = None


def predictor() -> KronosPredictor:
    global _predictor
    if _predictor is None:
        tok = KronosTokenizer.from_pretrained(TOKENIZER)
        mdl = Kronos.from_pretrained(MODEL)
        _predictor = KronosPredictor(mdl, tok, device=DEVICE, max_context=512)
    return _predictor


class Bar(BaseModel):
    time: int
    open: float
    high: float
    low: float
    close: float
    volume: float = 0


class Req(BaseModel):
    candles: List[Bar] = Field(min_length=64, max_length=512)
    pred_len: int = Field(default=5, ge=1, le=30)
    samples: int = Field(default=8, ge=1, le=30)
    step_seconds: int = Field(default=86400, ge=60, le=7 * 86400)


@app.get("/health")
def health():
    return {"ok": True, "model": MODEL, "device": DEVICE}


@app.post("/forecast")
def forecast(r: Req):
    df = pd.DataFrame([b.model_dump() for b in r.candles])
    x_ts = pd.to_datetime(df["time"], unit="s")
    last = int(df["time"].iloc[-1])
    y_ts = pd.Series(pd.to_datetime([last + (i + 1) * r.step_seconds for i in range(r.pred_len)], unit="s"))
    paths = []
    for _ in range(r.samples):  # independent samples give a spread, not a single averaged line
        out = predictor().predict(df=df[["open", "high", "low", "close", "volume"]], x_timestamp=x_ts, y_timestamp=y_ts,
                                  pred_len=r.pred_len, T=1.0, top_p=0.9, sample_count=1)
        paths.append([float(v) for v in out["close"].tolist()])
    if not paths:
        raise HTTPException(500, "no forecast produced")
    return {"closes": paths, "model": MODEL}
