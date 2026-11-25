import {Candle, ChartStyle, TimeUnit} from "./types.ts";
import {Series} from "./indicators.ts";
import {formatPercent, formatPrice, formatTime} from "./scale.ts";
import {
    AXIS_LABEL_OFFSET, AXIS_TAG_HEIGHT, AXIS_TAG_PADDING, LEGEND_GAP, LEGEND_HEIGHT, LEGEND_ITEM_GAP, LEGEND_LEFT,
    PADDING_TOP,
} from "./constants.ts";
import {clamp, isNumber, Layout, Pane, paneToValue, paneToY, Point} from "./layout.ts";
import {lineColor, Painter, textColorOf} from "./painter.ts";
import {LegendItem} from "./indicatorPanes.ts";

// 위 장: 십자선과 값 표시. 마우스가 움직일 때마다 다시 그린다.

const CROSSHAIR_DASH = [4, 3];
const TOOLTIP_PADDING = 6;      // 내 매매 상자의 안쪽 여백
const TOOLTIP_OFFSET = 12;      // 마우스와 내 매매 상자 사이

/**
 * 내 매매 상자: 십자선이 매매가 있는 캔들에 오면 마우스 옆에 그 내역을 적는다.
 * 오른쪽에 자리가 없으면 마우스 왼쪽에, 아래에 자리가 없으면 위로 올려 그림 영역 안에 둔다.
 */
export const drawTradeTooltip = (
    painter: Painter, layout: Layout, style: ChartStyle, pointer: Point, lines: { text: string, color: string }[],
) => {
    if (lines.length === 0) return;
    const ctx = painter.ctx;
    const padding = painter.px(TOOLTIP_PADDING);
    const offset = painter.px(TOOLTIP_OFFSET);
    const lineHeight = painter.px(LEGEND_HEIGHT);
    const width = Math.max(...lines.map(({text}) => ctx.measureText(text).width)) + padding * 2;
    const height = lineHeight * lines.length + padding * 2;
    const plotRight = painter.px(layout.plotWidth);
    const plotBottom = painter.px(layout.plotBottom);
    const pointerX = painter.px(pointer.x);
    const pointerY = painter.px(pointer.y);
    const left = pointerX + offset + width <= plotRight ? pointerX + offset : Math.max(0, pointerX - offset - width);
    const top = clamp(pointerY + offset, 0, Math.max(0, plotBottom - height));
    const line = painter.lineWidth();

    ctx.fillStyle = style.backgroundColor;
    ctx.fillRect(left, top, width, height);
    ctx.strokeStyle = style.textColor;
    ctx.lineWidth = line;
    ctx.strokeRect(left + line / 2, top + line / 2, width - line, height - line);
    ctx.textAlign = 'left';
    lines.forEach(({text, color}, order) => {
        ctx.fillStyle = color;
        ctx.fillText(text, left + padding, top + padding + lineHeight * order + lineHeight / 2);
    });
};
const CHANGE_RATE_DECIMALS = 2;     // 값 표시의 등락률 소수 자릿수

/**
 * 십자선과 축 위의 값·날짜 라벨.
 * 마우스가 가리키는 캔들의 순번을 돌려주고, 없으면 null
 */
export const drawCrosshair = (
    painter: Painter, layout: Layout, style: ChartStyle,
    pointer: Point | null, candles: Candle[], timeUnit: TimeUnit,
): number | null => {
    if (!pointer) return null;

    const {range, plotBottom} = layout;
    const insidePlot = pointer.x >= 0 && pointer.x < layout.plotWidth
        && pointer.y >= 0 && pointer.y <= plotBottom;
    if (!insidePlot) return null;

    // 세로선은 마우스가 올라간 캔들의 가운데에 붙인다. 캔들이 없는 빈 자리면 그리지 않는다.
    const index = Math.floor(range.leftEdge + pointer.x / range.spacing);
    const candle = candles[index];
    if (!candle) return null;

    // 오른쪽 축 라벨: 마우스가 올라간 영역(가격·거래량·보조지표)의 값
    const pane = layout.panes.find(candidate => pointer.y >= candidate.top && pointer.y <= candidate.bottom);
    drawCrosshairLines(painter, layout, style, index, candle, timeUnit, pointer.y, pane ?? null);
    return index;
};

/**
 * 다른 차트에서 옮겨 온 십자선(멀티 화면의 연동). 세로선은 index 캔들에, 가로선은 price 가 있고 가격 영역 안일 때만 긋는다.
 * index 캔들이 화면 밖이면 그리지 않고 false 를 돌려준다.
 */
export const drawLinkedCrosshair = (
    painter: Painter, layout: Layout, style: ChartStyle,
    index: number, price: number | null, candles: Candle[], timeUnit: TimeUnit,
): boolean => {
    const candle = candles[index];
    const {range} = layout;
    // 캔들 가운데가 그림 영역 안일 때만 그린다(가장자리에 반쯤 걸린 캔들은 세로선이 그림 밖이다).
    const center = (index + 0.5 - range.leftEdge) * range.spacing;
    if (!candle || center < 0 || center >= layout.plotWidth) return false;
    const pane = layout.panes[0];
    const y = price !== null && pane ? paneToY(pane)(price) : null;
    const inside = pane && y !== null && y >= pane.top && y <= pane.bottom;
    drawCrosshairLines(painter, layout, style, index, candle, timeUnit, inside ? y : null, inside ? pane : null);
    return true;
};

/**
 * 십자선의 선과 축 라벨. 세로선과 날짜 라벨은 index 캔들에, 가로선은 y 가 있을 때만 긋고,
 * 오른쪽 축 라벨은 pane 이 있을 때 그 영역의 값으로 적는다.
 */
const drawCrosshairLines = (
    painter: Painter, layout: Layout, style: ChartStyle,
    index: number, candle: Candle, timeUnit: TimeUnit, pointerY: number | null, pane: Pane | null,
) => {
    const ctx = painter.ctx;
    const line = painter.lineWidth();
    const plotRightPx = painter.px(layout.plotWidth);
    const plotBottomPx = painter.px(layout.plotBottom);
    const x = painter.centerX(index, layout.range) - Math.floor(line / 2) + line / 2;
    const y = pointerY === null ? null : painter.px(pointerY) + line / 2;

    ctx.strokeStyle = style.textColor;
    ctx.lineWidth = line;
    ctx.setLineDash(CROSSHAIR_DASH.map(length => painter.px(length)));
    ctx.beginPath();
    if (x >= 0 && x <= plotRightPx) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, plotBottomPx);
    }
    if (y !== null) {
        ctx.moveTo(0, y);
        ctx.lineTo(plotRightPx, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    const labelHeight = painter.px(AXIS_TAG_HEIGHT);
    const labelPadding = painter.px(AXIS_TAG_PADDING);

    if (pane && pointerY !== null && y !== null) {
        const value = paneToValue(pane)(pointerY);
        ctx.fillStyle = style.textColor;
        ctx.fillRect(plotRightPx, Math.round(y - labelHeight / 2), painter.px(layout.axisWidth), labelHeight);
        ctx.fillStyle = style.backgroundColor;
        ctx.textAlign = 'left';
        ctx.fillText((pane.axisFormat ?? pane.format)(value), plotRightPx + painter.px(AXIS_LABEL_OFFSET), y);
    }

    // 아래 축 라벨: 캔들 날짜. 그림 영역 밖으로 나가지 않게 밀어 넣는다.
    const timeLabel = formatTime(candle.time, timeUnit, true);
    const timeWidth = ctx.measureText(timeLabel).width + labelPadding * 2;
    const timeLeft = Math.round(clamp(x - timeWidth / 2, 0, Math.max(0, plotRightPx - timeWidth)));
    const timeTop = plotBottomPx + line;
    ctx.fillStyle = style.textColor;
    ctx.fillRect(timeLeft, timeTop, timeWidth, labelHeight);
    ctx.fillStyle = style.backgroundColor;
    ctx.textAlign = 'center';
    ctx.fillText(timeLabel, timeLeft + timeWidth / 2, timeTop + labelHeight / 2);
};

/**
 * 바로 앞 캔들의 종가 대비 등락: "+1,200 (+1.53%)". 색은 캔들 색과 별개로 부호를 따른다.
 * 앞 캔들이 없으면(previousClose 가 null) 항목이 없다.
 */
const changeItem = (candle: Candle, previousClose: number | null, decimals: number, style: ChartStyle): LegendItem[] => {
    if (previousClose === null) return [];
    // 소수 계산의 오차로 0 이 -0.00 처럼 적히지 않게 가격의 자릿수로 맞춘다.
    const change = Number((candle.close - previousClose).toFixed(decimals));
    const amount = `${change > 0 ? '+' : ''}${formatPrice(change, decimals)}`;
    const rate = previousClose > 0 ? ` (${formatPercent(change / previousClose * 100, CHANGE_RATE_DECIMALS)})` : '';
    const color = textColorOf(style, change > 0 ? style.upColor : change < 0 ? style.downColor : style.textColor);
    return [[`${amount}${rate}`, color]];
};

/**
 * 왼쪽 위에 시가·고가·저가·종가·등락·거래량을 한 줄로 표시한다. 시고저종과 거래량의 값은 캔들 색(valueColor)을 따른다.
 * previousClose: 바로 앞 캔들의 종가. 맨 첫 캔들이면 null
 */
export const drawCandleLegend = (
    painter: Painter, layout: Layout, style: ChartStyle, candle: Candle, valueColor: string, previousClose: number | null,
) => {
    const ctx = painter.ctx;
    // [이름, 값, 값의 색]. 이름이 없는 항목은 값만 적는다
    const items: [string, string, string][] = [
        ['시', formatPrice(candle.open, layout.valueDecimals), valueColor],
        ['고', formatPrice(candle.high, layout.valueDecimals), valueColor],
        ['저', formatPrice(candle.low, layout.valueDecimals), valueColor],
        ['종', formatPrice(candle.close, layout.valueDecimals), valueColor],
        ...changeItem(candle, previousClose, layout.valueDecimals, style)
            .map(([text, color]): [string, string, string] => ['', text, color]),
        ['거래량', candle.volume.toLocaleString('ko-KR'), valueColor],
    ];
    const itemGap = painter.px(LEGEND_ITEM_GAP);
    const gapOf = (name: string) => name ? painter.px(LEGEND_GAP) : 0;
    const widths = items.map(([name, value]) => [ctx.measureText(name).width + gapOf(name), ctx.measureText(value).width]);
    const left = painter.px(LEGEND_LEFT);
    const top = painter.px(PADDING_TOP);
    const height = painter.px(LEGEND_HEIGHT);
    const padding = painter.px(AXIS_TAG_PADDING);

    // 좁은 화면에서는 뒤쪽 항목(거래량, 등락 순서)을 빼서 그림 영역 안에 들어가게 한다.
    const maxWidth = painter.px(layout.plotWidth) - left - padding;
    const widthOf = (count: number) => widths.slice(0, count)
        .reduce((sum, [nameWidth, valueWidth]) => sum + nameWidth + valueWidth, 0) + itemGap * (count - 1);
    let shown = items.length;
    while (shown > 1 && widthOf(shown) > maxWidth) shown--;
    const totalWidth = widthOf(shown);

    // 캔들 위에 겹쳐도 읽히도록 바탕을 깐다.
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = style.backgroundColor;
    ctx.fillRect(left - padding, top, totalWidth + padding * 2, height);
    ctx.globalAlpha = 1;

    const middle = top + height / 2;
    ctx.textAlign = 'left';
    let cursor = left;
    items.slice(0, shown).forEach(([name, value, color], index) => {
        const [nameWidth, valueWidth] = widths[index];
        ctx.fillStyle = style.textColor;
        ctx.fillText(name, cursor, middle);
        ctx.fillStyle = color;
        ctx.fillText(value, cursor + nameWidth, middle);
        cursor += nameWidth + valueWidth + itemGap;
    });
};

/**
 * 한 줄에 여러 항목을 왼쪽부터 이어 적는다. middle: 줄 가운데 높이 (기기 픽셀)
 * backdrop: 막대나 캔들 위에 겹치는 자리면 글자 뒤에 깔 바탕색
 */
const writeLegendLine = (painter: Painter, layout: Layout, middle: number, items: LegendItem[], backdrop?: string) => {
    const ctx = painter.ctx;
    const itemGap = painter.px(LEGEND_ITEM_GAP);
    const left = painter.px(LEGEND_LEFT);
    // 그림 영역을 넘는 항목부터는 적지 않는다(좁은 화면에서 글자가 잘려 보이지 않게).
    const maxRight = painter.px(layout.plotWidth);
    const placed: { text: string, color: string, x: number }[] = [];
    let cursor = left;
    for (const [text, color] of items) {
        const width = ctx.measureText(text).width;
        if (cursor + width > maxRight) break;
        placed.push({text, color, x: cursor});
        cursor += width + itemGap;
    }
    if (placed.length === 0) return;

    if (backdrop) {
        const padding = painter.px(AXIS_TAG_PADDING);
        const height = painter.px(LEGEND_HEIGHT);
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = backdrop;
        ctx.fillRect(left - padding, Math.round(middle - height / 2), cursor - itemGap - left + padding * 2, height);
        ctx.globalAlpha = 1;
    }
    ctx.textAlign = 'left';
    placed.forEach(({text, color, x}) => {
        ctx.fillStyle = color;
        ctx.fillText(text, x, middle);
    });
};

/**
 * 겹쳐 그린 선들의 값을 선 색으로 적는다.
 * 이동평균과 가격 영역 지표는 값 표시 아랫줄에, 거래량 영역 지표는 거래량 영역 왼쪽 위에 적는다.
 * comparisonItems: 비교 종목의 이름과 등락률. 이동평균 줄 다음에 적는다.
 */
export const drawOverlayLegends = (
    painter: Painter, layout: Layout, style: ChartStyle,
    periods: number[], averages: Series[], averageColors: number[], index: number,
    comparisonItems: LegendItem[] = [],
) => {
    const [pricePane, volumePane] = layout.panes;
    const priceItems: LegendItem[] = [
        ...(periods.length > 0 ? [['이평', style.textColor] as LegendItem] : []),
        ...periods.map((period, order): LegendItem => {
            const value = averages[order]?.[index];
            return [
                `${period} ${isNumber(value) ? formatPrice(value, layout.priceDecimals) : '-'}`,
                lineColor(style, averageColors[order] ?? order),
            ];
        }),
        ...layout.priceOverlays.flatMap(overlay => overlay.legend(index, style, pricePane.format)),
    ];
    if (priceItems.length > 0) {
        const middle = painter.px(PADDING_TOP + LEGEND_HEIGHT) + painter.px(LEGEND_HEIGHT) / 2;
        writeLegendLine(painter, layout, middle, priceItems);
    }
    if (comparisonItems.length > 0) {
        // 이동평균 줄이 비어 있으면 그 줄에 적고, 차 있으면 한 줄 아래에 적는다. 아래 줄은 캔들과 겹치는 자리라 바탕을 깐다.
        const row = priceItems.length > 0 ? 2 : 1;
        const middle = painter.px(PADDING_TOP + LEGEND_HEIGHT * row) + painter.px(LEGEND_HEIGHT) / 2;
        writeLegendLine(painter, layout, middle, comparisonItems, row === 2 ? style.backgroundColor : undefined);
    }

    const volumeItems = layout.volumeOverlays.flatMap(overlay => overlay.legend(index, style, volumePane.format));
    if (volumeItems.length > 0) {
        // 거래량 막대 위에 겹치는 자리라 바탕을 깐다.
        const middle = painter.px(volumePane.top) + painter.px(LEGEND_HEIGHT) / 2;
        writeLegendLine(painter, layout, middle, volumeItems, style.backgroundColor);
    }
};

/** 보조지표 영역마다 왼쪽 위에 이름과 값을 적는다. */
export const drawIndicatorLegends = (painter: Painter, layout: Layout, style: ChartStyle, index: number) => {
    layout.indicators.forEach(({instance, top}) => {
        const middle = painter.px(top) + painter.px(LEGEND_HEIGHT) / 2 + painter.lineWidth();
        writeLegendLine(painter, layout, middle, instance.legend(index, style));
    });
};
