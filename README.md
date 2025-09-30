# LONG-RISK-Signals-with-Adaptive-MA-Filter

LONG / RISK Signals with Adaptive MA Filter for **TradingView** (Pine v6)

**Author:** Anthony C.

---

## Overview
This TradingView indicator detects potential **LONG** (`L`, `L+`) and **RISK** (`R`, `R+`) signals using **KDJ crosses**, with confirmations from **VWAP**, **Volume**, **MACD**, and optional filters. Labels are plotted only on **confirmed bar close** to avoid intrabar flicker.

---

## Features
- VWAP / Volume / MACD confirmations  
- Separate K–D minimum spread for L/L+ vs R/R+  
- Optional ATR / ADX market-condition filters  
- Optional MA Slope Filter for L+ / R+  
- Optional extra R via *Near-High + RSI Bearish* combo  
- Anti-flicker: plot only on bar close  

---

## Signal Types
- **L** — Base long  
- **L+** — Strengthened long (VWAP, Volume, MACD, slope)  
- **R** — Base risk / pullback  
- **R+** — Strengthened risk (VWAP, Volume, MACD, slope)  

---

## Installation
1. Open **TradingView → Pine Editor**  
2. Paste the script and save  
3. Click **Add to chart**  

---

## Notes
- Use higher K–D spread values for stricter signals  
- ATR/ADX filters are optional (default affects only L+/R+)  
- Extra *Near-High + RSI* combo adds R signals without filtering originals  

---

## Changelog
- Please refer to release notes

---

### Inspired by
- 通达信 "破坎红 (买入)" 与 "过坎黑 (风险)" 组合指标

---