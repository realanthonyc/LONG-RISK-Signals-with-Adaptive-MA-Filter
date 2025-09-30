// @version=6
// -------------------------------------------------------------------------------
//  LONG / RISK Signals with Auto MA Filter - v4.7.0
//  - VWAP/Volume/MACD Confirmation
//  - Optional MA Slope Filter for L+ / R+
//  - Long: BreakDown (Bullish Attention) / Risk: BreakUp (Pullback Risk)
//  - Signals: L / L+ / R / R+
//  Author: Anthony C.
// -------------------------------------------------------------------------------
indicator("LONG / RISK Signals", overlay=true, max_labels_count=500)

// === Input Parameters ===
// KDJ
groupKDJ   = "KDJ Parameters"
n_len      = input.int(9,  "KDJ Period (N)",   minval=1, group=groupKDJ)
m1_len     = input.int(3,  "K Smoothing (M1)", minval=1, group=groupKDJ)
m2_len     = input.int(3,  "D Smoothing (M2)", minval=1, group=groupKDJ)

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

// MA display
groupPlot  = "MA Display"
showMA20   = input.bool(true,  "Show MA20",  group=groupPlot)
showMA60   = input.bool(true,  "Show MA60",  group=groupPlot)
showMA100  = input.bool(false, "Show MA100 (default off)", group=groupPlot)
showMA200  = input.bool(true,  "Show MA200", group=groupPlot)

// === KDJ Calculation ===
lowestLow   = ta.lowest(low, n_len)
highestHigh = ta.highest(high, n_len)
rsv         = (highestHigh == lowestLow) ? 50.0 : (close - lowestLow) / (highestHigh - lowestLow) * 100.0
k_line      = ta.sma(rsv, m1_len)
d_line      = ta.sma(k_line, m2_len)

// === MACD Calculation ===
[macd_line, macd_signal, macd_hist] = ta.macd(close, fastLen, slowLen, sigLen)

// === Auto MA Filter by Timeframe ===
isIntraday     = timeframe.isintraday
mult           = timeframe.multiplier
is15mOrLess    = isIntraday and mult <= 15
isAbove15mTo1D = (isIntraday and mult > 15) and not timeframe.isdaily
is1DTo1W       = timeframe.isdaily and not timeframe.isweekly and not timeframe.ismonthly
is1WOrMore     = timeframe.isweekly or timeframe.ismonthly

maLenSel = is15mOrLess ? 20 : (isAbove15mTo1D ? 60 : (is1DTo1W ? 100 : 200))
maSel    = ta.sma(close, maLenSel)

// === Volume Filter ===
volLen = is15mOrLess ? 5 : (isAbove15mTo1D ? 10 : (is1DTo1W ? 20 : 50))
volAvg = ta.sma(volume, volLen)
volOK  = volume > volAvg * volMultiplier

// === VWAP (for intraday only) ===
src       = hlc3
vwap      = ta.vwap(src)
aboveVWAP = not useVwap or not isIntraday or (close >= vwap)
belowVWAP = not useVwap or not isIntraday or (close <= vwap)

// === Reference MAs (optional display) ===
ma20  = ta.sma(close, 20)
ma60  = ta.sma(close, 60)
ma100 = ta.sma(close, 100)
ma200 = ta.sma(close, 200)

// === Market States ===
priceAboveMA = close > maSel
bullishBar   = (close > open) or (close > close[1])
bearishBar   = (close < open) or (close < close[1])

k_cross_down    = ta.crossunder(k_line, 80) or ta.crossunder(k_line, 50) or ta.crossunder(k_line, 20)
d_cross_down    = ta.crossunder(d_line, 80) or ta.crossunder(d_line, 50) or ta.crossunder(d_line, 20)
breakDownSignal = k_cross_down or d_cross_down

k_cross_up      = ta.crossover(k_line, 20) or ta.crossover(k_line, 50) or ta.crossover(k_line, 80)
d_cross_up      = ta.crossover(d_line, 20) or ta.crossover(d_line, 50) or ta.crossover(d_line, 80)
breakUpSignal   = k_cross_up or d_cross_up

prevBearishBar  = (close[1] <= open[1]) and (close[1] <= close[2])

// === Base / Enhanced Signals with Optional Delay ===
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

// === MA slope conditions ===
maSlopeUp   = maSel > maSel[slopeLen]
maSlopeDown = maSel < maSel[slopeLen]

// === Final Signals (slope filter only affects L+ / R+) ===
L_plus = L_base and aboveVWAP and volOK and bullMACD and (not enableSlopeFilter or maSlopeUp)
R_plus = R_base and belowVWAP and volOK and bearMACD and (not enableSlopeFilter or maSlopeDown)

// === Plot MAs ===
plot(showMA20  ? ma20  : na, title="MA20",  color=color.new(#F8BBD0, 0), linewidth=1)
plot(showMA60  ? ma60  : na, title="MA60",  color=color.new(#FFE0B2, 0), linewidth=1)
plot(showMA100 ? ma100 : na, title="MA100", color=color.new(#C8E6C9, 0), linewidth=1)
plot(showMA200 ? ma200 : na, title="MA200", color=color.new(#E1BEE7, 0), linewidth=1)

// === Signal Labels ===
plotshape(L_base and not L_plus, title="L", style=shape.labelup, location=location.belowbar, color=color.new(color.red, 50), text="L", textcolor=color.white, size=size.tiny)
plotshape(R_base and not R_plus, title="R", style=shape.labeldown, location=location.abovebar, color=color.new(color.gray, 50), text="R", textcolor=color.white, size=size.tiny)
plotshape(L_plus, title="L+", style=shape.labelup, location=location.belowbar, color=color.new(color.red, 30), text="L+", textcolor=color.white, size=size.tiny)
plotshape(R_plus, title="R+", style=shape.labeldown, location=location.abovebar, color=color.new(color.black, 30), text="R+", textcolor=color.white, size=size.tiny)