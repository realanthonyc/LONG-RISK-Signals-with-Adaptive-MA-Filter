// @version=6
// -----------------------------------------------------------------------------
//  LONG / RISK Signals with Adaptive MA Filter - v4.9.3
//  - VWAP / Volume / MACD confirmations
//  - Separate K–D minimum spread for L/L+ vs R/R+
//  - Optional overbought gating for R (default OFF)
//  - Strict "Near-High + RSI Bearish divergence" combo as additive R (default ON)
//  - Optional MA Slope Filter for L+ / R+
//  - Optional ATR / ADX market-condition filters (classic lengths hard-coded)
//  - Separate minimum bars between signals for L vs R
//  - Plot only on confirmed bar close
//  - Signals: L / L+ / R / R+
//  Author: Anthony C.
// -----------------------------------------------------------------------------
indicator("LONG / RISK Signals v4.9.3", overlay=true, max_labels_count=500)

// === Inputs ===
// KDJ
groupKDJ          = "KDJ Parameters"
n_len             = input.int(9,  "KDJ Period (N)",   minval=1, group=groupKDJ)
m1_len            = input.int(3,  "K Smoothing (M1)", minval=1, group=groupKDJ)
m2_len            = input.int(3,  "D Smoothing (M2)", minval=1, group=groupKDJ)
kdMinSpreadL      = input.float(2.0, "K-D Min Spread for L/L+ (higher = stricter)", minval=0.0, step=0.1, group=groupKDJ)
kdMinSpreadR      = input.float(6.0, "K-D Min Spread for R/R+ (higher = stricter)", minval=0.0, step=0.1, group=groupKDJ)

// MACD
groupMACD         = "MACD Parameters"
fastLen           = input.int(12, "MACD Fast Length",   minval=1, group=groupMACD)
slowLen           = input.int(26, "MACD Slow Length",   minval=1, group=groupMACD)
sigLen            = input.int(9,  "MACD Signal Length", minval=1, group=groupMACD)

// Volume
groupVOL          = "Volume Filter"
volMultiplier     = input.float(0.85, "Volume Multiplier (try 1.0–1.5 for stricter signals)", minval=0.1, step=0.05, group=groupVOL)

// VWAP & Delay
groupVWAP         = "VWAP / Delay"
useVwap           = input.bool(true,  "Enable VWAP Filter", group=groupVWAP)
useSignalDelay    = input.bool(false, "Enable Signal Confirmation Delay (2-bar confirmation)", group=groupVWAP)

// Trend (MA slope)
groupTrend        = "Trend Filter"
enableSlopeFilter = input.bool(true, "Enable MA Slope Filter (reduces false signals in sideways/ranging markets)", group=groupTrend)
slopeLen          = input.int(2, "MA Slope Lookback in bars (default = 2; higher = stricter, lower = more sensitive)", minval=1, group=groupTrend)

// R / R+ logic
groupRisk         = "R / R+ Logic"
useOverboughtGate = input.bool(false, "Require recent overbought for R (narrower, stricter)", group=groupRisk)
rOverboughtBand   = input.int(85, "Overbought Band (70–95)", minval=70, maxval=95, group=groupRisk)
rObLookback       = input.int(5,  "Overbought Lookback (bars)", minval=3, maxval=20, group=groupRisk)
minConfRplus      = input.int(2,  "R+ confirmations required (of: below VWAP, Volume OK, Bearish MACD, MA slope down)", minval=1, maxval=4, group=groupRisk)

// Optional combo add-on for extra R
groupRiskCombo    = "R Extra: Near-High + RSI Bearish Combo"
enableTopRSICombo = input.bool(true, "Enable 'Near-High + RSI Bearish' combo (adds extra R)", group=groupRiskCombo)
topLookback       = input.int(14, "Near-High Lookback (bars)", minval=5, maxval=200, group=groupRiskCombo)
topTolerancePct   = input.float(0.10, "Near-High Tolerance (%)", minval=0.05, maxval=2.0, step=0.05, group=groupRiskCombo)
rsiLen            = input.int(21, "RSI Length (for divergence)", minval=7, maxval=60, group=groupRiskCombo)

// Market condition filters (ATR/ADX)
groupMkt          = "Market Condition Filters"
enableATRFilter   = input.bool(true,  "Enable ATR Filter (volatility check)", group=groupMkt)
atrMult           = input.float(0.8, "ATR Threshold Multiplier", minval=0.1, step=0.1, group=groupMkt)
enableADXFilter   = input.bool(false, "Enable ADX Filter (trend strength)",   group=groupMkt)
adxThreshold      = input.float(20,  "ADX Threshold (trend strength level)", minval=5, step=0.5, group=groupMkt)
applyToBaseSignals= input.bool(false, "Apply filters also to base L / R (default = only L+ / R+)", group=groupMkt)

// Signal spacing
groupSpacing      = "Signal Spacing"
minBarsBetween    = input.int(0, "Minimum Bars Between Signals (0 = disabled)", minval=0, group=groupSpacing)

// MA display
groupPlot         = "MA Display"
showMA20          = input.bool(true,  "Show MA20",  group=groupPlot)
showMA60          = input.bool(true,  "Show MA60",  group=groupPlot)
showMA100         = input.bool(false, "Show MA100 (default off)", group=groupPlot)
showMA200         = input.bool(true,  "Show MA200", group=groupPlot)

// === KDJ ===
lowestLow   = ta.lowest(low, n_len)
highestHigh = ta.highest(high, n_len)
rsv         = (highestHigh == lowestLow) ? 50.0 : (close - lowestLow) / (highestHigh - lowestLow) * 100.0
k_line      = ta.sma(rsv, m1_len)
d_line      = ta.sma(k_line, m2_len)
kdSpread    = math.abs(k_line - d_line)

// === MACD ===
[macd_line, macd_signal, macd_hist] = ta.macd(close, fastLen, slowLen, sigLen)

// === Adaptive MA Filter by timeframe ===
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

// === KD crosses ===
k_cross_down_L = (ta.crossunder(k_line, 80) or ta.crossunder(k_line, 50) or ta.crossunder(k_line, 20)) and (kdSpread >= kdMinSpreadL)
d_cross_down_L = (ta.crossunder(d_line, 80) or ta.crossunder(d_line, 50) or ta.crossunder(d_line, 20)) and (kdSpread >= kdMinSpreadL)
breakDownSignal = k_cross_down_L or d_cross_down_L

k_cross_up_R = (ta.crossover(k_line, 20) or ta.crossover(k_line, 50) or ta.crossover(k_line, 80)) and (kdSpread >= kdMinSpreadR)
d_cross_up_R = (ta.crossover(d_line, 20) or ta.crossover(d_line, 50) or ta.crossover(d_line, 80)) and (kdSpread >= kdMinSpreadR)
breakUpSignal = k_cross_up_R or d_cross_up_R

prevBearishBar = close[1] <= open[1] and close[1] <= close[2]

// === Overbought gating (optional) ===
recentPeak = math.max(ta.highest(k_line, rObLookback), ta.highest(d_line, rObLookback))
recentlyOverbought = recentPeak >= rOverboughtBand
obGateOK = not useOverboughtGate or recentlyOverbought

// === Base signals (with optional delay) ===
L_base = if useSignalDelay
    (((breakDownSignal[2] and bullishBar[1]) or (breakDownSignal[2] and prevBearishBar[1] and bullishBar[1])) and priceAboveMA[1])
else
    (((breakDownSignal and bullishBar) or (breakDownSignal[1] and prevBearishBar and bullishBar)) and priceAboveMA)

R_base_core = if useSignalDelay
    (breakUpSignal[2] and bearishBar[1] and priceAboveMA[1] and obGateOK[1])
else
    (breakUpSignal[1] and bearishBar and priceAboveMA and obGateOK)

// === Extra combo: Near-High + RSI Bearish (strict, additive) ===
recentHigh    = ta.highest(high, topLookback)
nearHigh      = high >= recentHigh * (1 - topTolerancePct / 100.0)
rsiVal        = ta.rsi(close, rsiLen)
rsiPrev       = rsiVal[topLookback]
priceHigherHi = high > high[topLookback]
rsiLowerHi    = rsiVal < nz(rsiPrev, rsiVal)
rsiAbove60    = rsiVal > 60
rsiBearishDiv = priceHigherHi and rsiLowerHi and rsiAbove60
comboTopRSI   = enableTopRSICombo and nearHigh and bearishBar and rsiBearishDiv

// Final R base = core OR combo (combo only adds signals)
R_base = R_base_core or comboTopRSI

// === MACD & MA slope ===
bullMACD = macd_line > macd_signal
bearMACD = macd_line < macd_signal
maSlopeUp   = maSel > maSel[slopeLen]
maSlopeDown = maSel < maSel[slopeLen]

// === ATR / ADX filters ===
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

// === R+ confirmations ===
rplusCount = (belowVWAP ? 1 : 0) + (volOK ? 1 : 0) + (bearMACD ? 1 : 0) + (maSlopeDown ? 1 : 0)
rplusOK    = rplusCount >= minConfRplus

// === Apply filters ===
applyFilters(sig) => applyToBaseSignals ? (sig and marketOK) : sig

L_plus       = applyFilters(L_base and aboveVWAP and volOK and bullMACD and (not enableSlopeFilter or maSlopeUp))
R_plus_raw   = R_base and rplusOK
R_plus       = applyFilters(R_plus_raw)

L_baseFinal  = applyToBaseSignals ? (L_base and marketOK) : L_base
R_baseFinal  = applyToBaseSignals ? (R_base and marketOK) : R_base

// === Separate min spacing for L vs R ===
var int lastLBar = na
var int lastRBar = na
signalAllowedL() => na(lastLBar) or (bar_index - lastLBar >= minBarsBetween)
signalAllowedR() => na(lastRBar) or (bar_index - lastRBar >= minBarsBetween)

canL    = barstate.isconfirmed and L_baseFinal and not L_plus and signalAllowedL()
canLpls = barstate.isconfirmed and L_plus       and signalAllowedL()
if canL or canLpls
    lastLBar := bar_index

canR    = barstate.isconfirmed and R_baseFinal and not R_plus and signalAllowedR()
canRpls = barstate.isconfirmed and R_plus       and signalAllowedR()
if canR or canRpls
    lastRBar := bar_index

// === Plots ===
plot(showMA20  ? ma20  : na, title="MA20",  color=color.new(#F8BBD0, 0), linewidth=1)
plot(showMA60  ? ma60  : na, title="MA60",  color=color.new(#FFE0B2, 0), linewidth=1)
plot(showMA100 ? ma100 : na, title="MA100", color=color.new(#C8E6C9, 0), linewidth=1)
plot(showMA200 ? ma200 : na, title="MA200", color=color.new(#E1BEE7, 0), linewidth=1)

// === Labels ===
plotshape(canL,    title="L",  style=shape.labelup,   location=location.belowbar, color=color.new(color.red, 50),  text="L",  textcolor=color.white, size=size.tiny)
plotshape(canR,    title="R",  style=shape.labeldown, location=location.abovebar, color=color.new(color.gray, 50), text="R",  textcolor=color.white, size=size.tiny)
plotshape(canLpls, title="L+", style=shape.labelup,   location=location.belowbar, color=color.new(color.red, 30),  text="L+", textcolor=color.white, size=size.tiny)
plotshape(canRpls, title="R+", style=shape.labeldown, location=location.abovebar, color=color.new(color.black,30), text="R+", textcolor=color.white, size=size.tiny)