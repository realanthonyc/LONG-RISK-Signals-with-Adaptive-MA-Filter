// @version=6
// -----------------------------------------------------------------------------
//  LONG / RISK Signals with Auto MA Filter - v4.8.6
//  - VWAP / Volume / MACD confirmations
//  - K-D minimum spread (kdMinSpread) to filter weak crosses
//  - Optional MA slope filter (applies to L+ / R+)
//  - Optional ATR / ADX market-condition filters
//  - Minimum bars between signals
//  - Plot only on confirmed bar close (avoid intrabar flicker)
//  - Signals: L / L+ / R / R+
//  Author: Anthony C.
// -----------------------------------------------------------------------------
indicator("LONG / RISK Signals", overlay=true, max_labels_count=500)

// === Inputs ===
// KDJ
groupKDJ       = "KDJ Parameters"
n_len          = input.int(9,  "KDJ Period (N)",   minval=1, group=groupKDJ)
m1_len         = input.int(3,  "K Smoothing (M1)", minval=1, group=groupKDJ)
m2_len         = input.int(3,  "D Smoothing (M2)", minval=1, group=groupKDJ)
kdMinSpread    = input.float(5.0, "K-D Minimum Spread (filter weak crosses)", minval=0.0, step=0.1, group=groupKDJ)

// MACD
groupMACD      = "MACD Parameters"
fastLen        = input.int(12, "MACD Fast Length",   minval=1, group=groupMACD)
slowLen        = input.int(26, "MACD Slow Length",   minval=1, group=groupMACD)
sigLen         = input.int(9,  "MACD Signal Length", minval=1, group=groupMACD)

// Volume
groupVOL       = "Volume Filter"
volMultiplier  = input.float(0.85, "Volume Multiplier (try 1.0–1.5 for stricter signals)", minval=0.1, step=0.05, group=groupVOL)

// VWAP
groupVWAP      = "VWAP Filter"
useVwap        = input.bool(true,  "Enable VWAP Filter", group=groupVWAP)
useSignalDelay = input.bool(false, "Enable Signal Confirmation Delay (2-bar confirmation)", group=groupVWAP)

// Trend (MA slope)
groupTrend         = "Trend Filter"
enableSlopeFilter  = input.bool(true, "Enable MA Slope Filter (reduce false signals in sideways/ranging markets)", group=groupTrend)
slopeLen           = input.int(2, "MA Slope Lookback in bars (default = 2; higher = stricter, lower = more sensitive)", minval=1, group=groupTrend)

// Market condition filters
groupMkt           = "Market Condition Filters"
enableATRFilter    = input.bool(true,  "Enable ATR Filter (volatility check)", group=groupMkt)
atrMult            = input.float(0.8, "ATR Threshold Multiplier", minval=0.1, step=0.1, group=groupMkt)
enableADXFilter    = input.bool(false, "Enable ADX Filter (trend strength)",   group=groupMkt)
adxThreshold       = input.float(20,  "ADX Threshold (trend strength level)", minval=1, step=0.5, group=groupMkt)
applyToBaseSignals = input.bool(false, "Apply filters also to base L / R (default = only L+ / R+)", group=groupMkt)

// Signal spacing
groupSpacing      = "Signal Spacing"
minBarsBetween    = input.int(0, "Minimum Bars Between Signals (0 = disabled)", minval=0, group=groupSpacing)

// MA display
groupPlot   = "MA Display"
showMA20    = input.bool(true,  "Show MA20",  group=groupPlot)
showMA60    = input.bool(true,  "Show MA60",  group=groupPlot)
showMA100   = input.bool(false, "Show MA100 (default off)", group=groupPlot)
showMA200   = input.bool(true,  "Show MA200", group=groupPlot)

// === KDJ ===
lowestLow   = ta.lowest(low, n_len)
highestHigh = ta.highest(high, n_len)
rsv         = (highestHigh == lowestLow) ? 50.0 : (close - lowestLow) / (highestHigh - lowestLow) * 100.0
k_line      = ta.sma(rsv, m1_len)
d_line      = ta.sma(k_line, m2_len)
kdSpread    = math.abs(k_line - d_line)

// === MACD ===
[macd_line, macd_signal, macd_hist] = ta.macd(close, fastLen, slowLen, sigLen)

// === Auto MA Filter by timeframe ===
isIntraday     = timeframe.isintraday
mult           = timeframe.multiplier
is15mOrLess    = isIntraday and mult <= 15
isAbove15mTo1D = (isIntraday and mult > 15) and not timeframe.isdaily
is1DTo1W       = timeframe.isdaily and not timeframe.isweekly and not timeframe.ismonthly
is1WOrMore     = timeframe.isweekly or timeframe.ismonthly

maLenSel = is15mOrLess ? 20 : (isAbove15mTo1D ? 60 : (is1DTo1W ? 100 : 200))
maSel    = ta.sma(close, maLenSel)

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

// Keep 20/50/80 levels; add K-D spread filter
k_cross_down    = (ta.crossunder(k_line, 80) or ta.crossunder(k_line, 50) or ta.crossunder(k_line, 20)) and (kdSpread >= kdMinSpread)
d_cross_down    = (ta.crossunder(d_line, 80) or ta.crossunder(d_line, 50) or ta.crossunder(d_line, 20)) and (kdSpread >= kdMinSpread)
breakDownSignal = k_cross_down or d_cross_down

k_cross_up      = (ta.crossover(k_line, 20) or ta.crossover(k_line, 50) or ta.crossover(k_line, 80)) and (kdSpread >= kdMinSpread)
d_cross_up      = (ta.crossover(d_line, 20) or ta.crossover(d_line, 50) or ta.crossover(d_line, 80)) and (kdSpread >= kdMinSpread)
breakUpSignal   = k_cross_up or d_cross_up

prevBearishBar  = close[1] <= open[1] and close[1] <= close[2]

// === Base / Enhanced signals (optional 2-bar delay) ===
L_base = if useSignalDelay
    (((breakDownSignal[2] and bullishBar[1]) or (breakDownSignal[2] and prevBearishBar[1] and bullishBar[1])) and priceAboveMA[1])
else
    (((breakDownSignal and bullishBar) or (breakDownSignal[1] and prevBearishBar and bullishBar)) and priceAboveMA)

R_base = if useSignalDelay
    (breakUpSignal[2] and bearishBar[1] and priceAboveMA[1])
else
    (breakUpSignal[1] and bearishBar and priceAboveMA)

bullMACD = macd_line > macd_signal
bearMACD = macd_line < macd_signal

// === MA slope ===
maSlopeUp   = maSel > maSel[slopeLen]
maSlopeDown = maSel < maSel[slopeLen]

// === ATR / ADX (classic Wilder defaults hard-coded) ===
// ATR uses classic length 14; require ATR > SMA(ATR,20) * multiplier
atrLen  = 14
atr     = ta.atr(atrLen)
atrMA   = ta.sma(atr, 20)
atrOK   = not enableATRFilter or atr > atrMA * atrMult

// Manual ADX per Wilder so it works across Pine versions:
// DI/TR smoothing length = 14; ADX smoothing (RMA of DX) = 14
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

// === Final signals (apply filters) ===
applyFilters(sig) => applyToBaseSignals ? (sig and marketOK) : sig

L_plus = applyFilters(L_base and aboveVWAP and volOK and bullMACD and (not enableSlopeFilter or maSlopeUp))
R_plus = applyFilters(R_base and belowVWAP and volOK and bearMACD and (not enableSlopeFilter or maSlopeDown))

L_baseFinal = applyToBaseSignals ? (L_base and marketOK) : L_base
R_baseFinal = applyToBaseSignals ? (R_base and marketOK) : R_base

// === Minimum bars between signals ===
var int lastSignalBar = na
signalAllowed() =>
    na(lastSignalBar) or (bar_index - lastSignalBar >= minBarsBetween)

// Build draw-conditions (confirmed bars only)
canL    = barstate.isconfirmed and L_baseFinal and not L_plus and signalAllowed()
canR    = barstate.isconfirmed and R_baseFinal and not R_plus and signalAllowed()
canLpls = barstate.isconfirmed and L_plus and signalAllowed()
canRpls = barstate.isconfirmed and R_plus and signalAllowed()

// Update spacing state
if canL or canR or canLpls or canRpls
    lastSignalBar := bar_index

// === Plots ===
plot(showMA20  ? ma20  : na, title="MA20",  color=color.new(#F8BBD0, 0), linewidth=1)
plot(showMA60  ? ma60  : na, title="MA60",  color=color.new(#FFE0B2, 0), linewidth=1)
plot(showMA100 ? ma100 : na, title="MA100", color=color.new(#C8E6C9, 0), linewidth=1)
plot(showMA200 ? ma200 : na, title="MA200", color=color.new(#E1BEE7, 0), linewidth=1)

// Labels (confirmed close only)
plotshape(canL,    title="L",  style=shape.labelup,   location=location.belowbar, color=color.new(color.red, 50),  text="L",  textcolor=color.white, size=size.tiny)
plotshape(canR,    title="R",  style=shape.labeldown, location=location.abovebar, color=color.new(color.gray, 50), text="R",  textcolor=color.white, size=size.tiny)
plotshape(canLpls, title="L+", style=shape.labelup,   location=location.belowbar, color=color.new(color.red, 30),  text="L+", textcolor=color.white, size=size.tiny)
plotshape(canRpls, title="R+", style=shape.labeldown, location=location.abovebar, color=color.new(color.black,30), text="R+", textcolor=color.white, size=size.tiny)