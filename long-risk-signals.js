// @version=6
// -----------------------------------------------------------------------------
//  LONG / RISK Signals with Adaptive MA Filter - v5.1.0
//  - VWAP / Volume / MACD confirmations
//  - Separate K–D minimum spread for L/L+ vs R/R+
//  - Optional ATR / ADX market-condition filters (classic lengths hard-coded)
//  - Optional MA Slope Filter for L+ / R+
//  - Optional extra R labels via “Near-High + RSI Bearish” combo
//  - Plot labels only on confirmed bar close (anti-flicker)
//  - Signals: L / L+ / R / R+
//  Author: Anthony C.
// -----------------------------------------------------------------------------
indicator("LONG / RISK Signals - v5.1.0 -", overlay=true, max_labels_count=500)

// === Inputs ===
// KDJ
groupKDJ   = "KDJ Parameters"
n_len      = input.int(9,  "KDJ Period (N)",   minval=1, group=groupKDJ)
m1_len     = input.int(3,  "K Smoothing (M1)", minval=1, group=groupKDJ)
m2_len     = input.int(3,  "D Smoothing (M2)", minval=1, group=groupKDJ)

// Split K–D minimum spread (abs(K-D)) to control signal quality
kdMinSpreadL = input.float(2.0, "K-D Min Spread for L/L+ (higher = stricter)", minval=0.0, step=0.1, group=groupKDJ)
kdMinSpreadR = input.float(6.0, "K-D Min Spread for R/R+ (higher = stricter)", minval=0.0, step=0.1, group=groupKDJ)

// MACD
groupMACD  = "MACD Parameters"
fastLen    = input.int(12, "MACD Fast Length",   minval=1, group=groupMACD)
slowLen    = input.int(26, "MACD Slow Length",   minval=1, group=groupMACD)
sigLen     = input.int(9,  "MACD Signal Length", minval=1, group=groupMACD)

// Volume Filter
groupVOL   = "Volume Filter"
volMultiplier = input.float(0.85, "Volume Multiplier (try 1.0 or 1.5 for stricter signals)", minval=0.1, step=0.05, group=groupVOL)

// VWAP
groupVWAP  = "VWAP Filter"
useVwap        = input.bool(true,  "Enable VWAP Filter", group=groupVWAP)
useSignalDelay = input.bool(false, "Enable Signal Confirmation Delay (2-bar confirmation)", group=groupVWAP)

// Trend Filter (MA Slope)
groupTrend = "Trend Filter"
enableSlopeFilter = input.bool(true, "Enable MA Slope Filter (reduce false signals in sideways/ranging markets)", group=groupTrend)
slopeLen = input.int(2, "MA Slope Lookback in bars (default = 2, higher = stricter, lower = more sensitive)", minval=1, group=groupTrend)

// Extra R via Near-High + RSI Bearish combo (adds signals; does NOT filter)
groupRiskCombo    = "R EXTRA: Near-High + RSI Bearish Combo"
enableTopRSICombo = input.bool(true,  "Enable 'Near-High + RSI Bearish' combo (adds extra R)", group=groupRiskCombo)
topLookback       = input.int(14,    "Near-High Lookback (bars)", minval=5, maxval=200, group=groupRiskCombo)
topTolerancePct   = input.float(0.10,"Near-High Tolerance (%)",   minval=0.05, maxval=2.0, step=0.05, group=groupRiskCombo)
rsiLen            = input.int(21,    "RSI Length (for divergence)", minval=7, maxval=60, group=groupRiskCombo)

// Market condition filters (ATR/ADX)
groupMkt          = "MARKET CONDITION FILTERS"
enableATRFilter   = input.bool(true,  "Enable ATR Filter (volatility check)", group=groupMkt)
atrMult           = input.float(0.8,  "ATR Threshold Multiplier", minval=0.1, step=0.1, group=groupMkt)
enableADXFilter   = input.bool(false, "Enable ADX Filter (trend strength)",   group=groupMkt)
adxThreshold      = input.float(20,   "ADX Threshold (trend strength level)", minval=5, step=0.5, group=groupMkt)
applyToBaseSignals= input.bool(false, "Apply filters also to base L / R (default = only L+ / R+)", group=groupMkt)

// === KDJ Calculation ===
lowestLow   = ta.lowest(low, n_len)
highestHigh = ta.highest(high, n_len)
rsv         = (highestHigh == lowestLow) ? 50.0 : (close - lowestLow) / (highestHigh - lowestLow) * 100.0
k_line      = ta.sma(rsv, m1_len)
d_line      = ta.sma(k_line, m2_len)
kdSpread    = math.abs(k_line - d_line)

// === MACD Calculation ===
[macd_line, macd_signal, macd_hist] = ta.macd(close, fastLen, slowLen, sigLen)

// === Adaptive MA Filter by Timeframe ===
isIntraday     = timeframe.isintraday
mult           = timeframe.multiplier
is15mOrLess    = isIntraday and mult <= 15
isAbove15mTo1D = (isIntraday and mult > 15) and not timeframe.isdaily
is1DTo1W       = timeframe.isdaily and not timeframe.isweekly and not timeframe.ismonthly
is1WOrMore     = timeframe.isweekly or timeframe.ismonthly
maLenSel       = is15mOrLess ? 20 : (isAbove15mTo1D ? 60 : (is1DTo1W ? 100 : 200))
maSel          = ta.sma(close, maLenSel)

// === Volume ===
volLen = is15mOrLess ? 5 : (isAbove15mTo1D ? 10 : (is1DTo1W ? 20 : 50))
volAvg = ta.sma(volume, volLen)
volOK  = volume > volAvg * volMultiplier

// === VWAP (intraday only) ===
src       = hlc3
vwap      = ta.vwap(src)
aboveVWAP = not useVwap or not isIntraday or (close >= vwap)
belowVWAP = not useVwap or not isIntraday or (close <= vwap)

// === Reference MAs ===
ma20  = ta.sma(close, 20)
ma60  = ta.sma(close, 60)
ma100 = ta.sma(close, 100)
ma200 = ta.sma(close, 200)

// === Market states ===
priceAboveMA = close > maSel
bullishBar   = close > open or close > close[1]
bearishBar   = close < open or close < close[1]

// === K/D cross logic (split kdMinSpread) ===
k_cross_down    = (ta.crossunder(k_line, 80) or ta.crossunder(k_line, 50) or ta.crossunder(k_line, 20)) and (kdSpread >= kdMinSpreadL)
d_cross_down    = (ta.crossunder(d_line, 80) or ta.crossunder(d_line, 50) or ta.crossunder(d_line, 20)) and (kdSpread >= kdMinSpreadL)
breakDownSignal = k_cross_down or d_cross_down

k_cross_up      = (ta.crossover(k_line, 20) or ta.crossover(k_line, 50) or ta.crossover(k_line, 80)) and (kdSpread >= kdMinSpreadR)
d_cross_up      = (ta.crossover(d_line, 20) or ta.crossover(d_line, 50) or ta.crossover(d_line, 80)) and (kdSpread >= kdMinSpreadR)
breakUpSignal   = k_cross_up or d_cross_up

prevBearishBar  = (close[1] <= open[1]) and (close[1] <= close[2])

// === Base / Enhanced Signals with Optional Delay (same as v4.7) ===
L_base = if useSignalDelay
    (((breakDownSignal[2] and bullishBar[1]) or (breakDownSignal[2] and prevBearishBar[1] and bullishBar[1])) and priceAboveMA[1])
else
    (((breakDownSignal and bullishBar) or (breakDownSignal[1] and prevBearishBar and bullishBar)) and priceAboveMA)

R_base_raw = if useSignalDelay
    (breakUpSignal[2] and bearishBar[1] and priceAboveMA[1])
else
    (breakUpSignal[1] and bearishBar and priceAboveMA)

// === EXTRA R (adds signals; does NOT filter others) ===
recentHigh    = ta.highest(high, topLookback)
nearHigh      = high >= recentHigh * (1 - topTolerancePct / 100.0)
rsiNow        = ta.rsi(close, rsiLen)
rsiPast       = rsiNow[topLookback]
priceHigherHi = high > high[topLookback]
rsiLowerHi    = rsiNow < nz(rsiPast, rsiNow)
rsiAbove60    = rsiNow > 60
extraR_combo  = enableTopRSICombo and nearHigh and bearishBar and priceAboveMA and priceHigherHi and rsiLowerHi and rsiAbove60

// Final R base
R_base = R_base_raw or extraR_combo

// === MACD & MA slope ===
bullMACD = macd_line > macd_signal
bearMACD = macd_line < macd_signal
maSlopeUp   = maSel > maSel[slopeLen]
maSlopeDown = maSel < maSel[slopeLen]

// === ATR / ADX filters (classic Wilder) ===
atrLen  = 14
atr     = ta.atr(atrLen)
atrMA   = ta.sma(atr, 20)
atrOK   = not enableATRFilter or atr > atrMA * atrMult

adxLen       = 14
adxSmoothing = 14
upMove   = high - high[1]
downMove = low[1] - low
plusDM   = (upMove > 0 and upMove > downMove)   ? upMove   : 0.0
minusDM  = (downMove > 0 and downMove > upMove) ? downMove : 0.0
tr1 = high - low
tr2 = math.abs(high - close[1])
tr3 = math.abs(low  - close[1])
TR = math.max(tr1, math.max(tr2, tr3))
plusDI  = 100.0 * ta.rma(plusDM,  adxLen) / ta.rma(TR, adxLen)
minusDI = 100.0 * ta.rma(minusDM, adxLen) / ta.rma(TR, adxLen)
DX      = 100.0 * math.abs(plusDI - minusDI) / math.max(plusDI + minusDI, 1e-10)
adxVal  = ta.rma(DX, adxSmoothing)
adxOK   = not enableADXFilter or adxVal > adxThreshold

marketOK = atrOK and adxOK

// === Apply market filters ===
applyFilters(sig) => applyToBaseSignals ? (sig and marketOK) : sig

// L+/R+ with filters; slope filter仍只作用於加強訊號
L_plus      = applyFilters(L_base and aboveVWAP and volOK and bullMACD and (not enableSlopeFilter or maSlopeUp))
R_plus      = applyFilters(R_base and belowVWAP and volOK and bearMACD and (not enableSlopeFilter or maSlopeDown))

// 若選擇也過濾基礎訊號，這裡會套用；否則維持原始
L_baseFinal = applyToBaseSignals ? (L_base and marketOK) : L_base
R_baseFinal = applyToBaseSignals ? (R_base and marketOK) : R_base

// === MA display (UI) ===
groupPlot  = "MA Display"
showMA20   = input.bool(true,  "Show MA20",  group=groupPlot)
showMA60   = input.bool(true,  "Show MA60",  group=groupPlot)
showMA100  = input.bool(false, "Show MA100 (default off)", group=groupPlot)
showMA200  = input.bool(true,  "Show MA200", group=groupPlot)

// === Plot MAs ===
plot(showMA20  ? ma20  : na, title="MA20",  color=color.new(#F8BBD0, 0), linewidth=1)
plot(showMA60  ? ma60  : na, title="MA60",  color=color.new(#FFE0B2, 0), linewidth=1)
plot(showMA100 ? ma100 : na, title="MA100", color=color.new(#C8E6C9, 0), linewidth=1)
plot(showMA200 ? ma200 : na, title="MA200", color=color.new(#E1BEE7, 0), linewidth=1)

// === Labels (confirmed close only) ===
canL    = barstate.isconfirmed and L_baseFinal and not L_plus
canR    = barstate.isconfirmed and R_baseFinal and not R_plus
canLpls = barstate.isconfirmed and L_plus
canRpls = barstate.isconfirmed and R_plus

plotshape(canL,    title="L",  style=shape.labelup,   location=location.belowbar, color=color.new(color.red, 50),  text="L",  textcolor=color.white, size=size.tiny)
plotshape(canR,    title="R",  style=shape.labeldown, location=location.abovebar, color=color.new(color.gray, 50), text="R",  textcolor=color.white, size=size.tiny)
plotshape(canLpls, title="L+", style=shape.labelup,   location=location.belowbar, color=color.new(color.red, 30),  text="L+", textcolor=color.white, size=size.tiny)
plotshape(canRpls, title="R+", style=shape.labeldown, location=location.abovebar, color=color.new(color.black,30), text="R+", textcolor=color.white, size=size.tiny)