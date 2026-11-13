import {Candle, ChartStyle, TimeUnit} from "./types.ts";
import {Series} from "./indicators.ts";
import {createInverseScale, formatPrice, formatTime} from "./scale.ts";
import {
    AXIS_LABEL_OFFSET, AXIS_TAG_HEIGHT, AXIS_TAG_PADDING, LEGEND_GAP, LEGEND_HEIGHT, LEGEND_ITEM_GAP, LEGEND_LEFT,
    PADDING_TOP, PRICE_AXIS_WIDTH,
} from "./constants.ts";
import {clamp, isNumber, Layout, Point} from "./layout.ts";
import {lineColor, Painter} from "./painter.ts";
import {LegendItem} from "./indicatorPanes.ts";

// 위 장: 십자선과 값 표시. 마우스가 움직일 때마다 다시 그린다.

const CROSSHAIR_DASH = [4, 3];

/**
 * 십자선과 축 위의 값·날짜 라벨.
 * 마우스가 가리키는 캔들의 순번을 돌려주고, 없으면 null
 */
export const drawCrosshair = (
    painter: Painter, layout: Layout, style: ChartStyle,
    pointer: Point | null, candles: Candle[], timeUnit: TimeUnit,
): number | null => {
    const ctx = painter.ctx;
    if (!pointer) return null;

    const {range, plotBottom} = layout;
    const insidePlot = pointer.x >= 0 && pointer.x < layout.plotWidth
        && pointer.y >= 0 && pointer.y <= plotBottom;
    if (!insidePlot) return null;

    // 세로선은 마우스가 올라간 캔들의 가운데에 붙인다. 캔들이 없는 빈 자리면 그리지 않는다.
    const index = Math.floor(range.leftEdge + pointer.x / range.spacing);
    const candle = candles[index];
    if (!candle) return null;

    const line = painter.lineWidth();
    const plotRightPx = painter.px(layout.plotWidth);
    const plotBottomPx = painter.px(plotBottom);
    const x = painter.centerX(index, range) - Math.floor(line / 2) + line / 2;
    const y = painter.px(pointer.y) + line / 2;

    ctx.strokeStyle = style.textColor;
    ctx.lineWidth = line;
    ctx.setLineDash(CROSSHAIR_DASH.map(length => painter.px(length)));
    ctx.beginPath();
    if (x >= 0 && x <= plotRightPx) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, plotBottomPx);
    }
    ctx.moveTo(0, y);
    ctx.lineTo(plotRightPx, y);
    ctx.stroke();
    ctx.setLineDash([]);

    const labelHeight = painter.px(AXIS_TAG_HEIGHT);
    const labelPadding = painter.px(AXIS_TAG_PADDING);

    // 오른쪽 축 라벨: 마우스가 올라간 영역(가격·거래량·보조지표)의 값
    const pane = layout.panes.find(candidate => pointer.y >= candidate.top && pointer.y <= candidate.bottom);
    if (pane) {
        const value = createInverseScale(pane.min, pane.max, pane.scaleTop, pane.scaleBottom)(pointer.y);
        ctx.fillStyle = style.textColor;
        ctx.fillRect(plotRightPx, Math.round(y - labelHeight / 2), painter.px(PRICE_AXIS_WIDTH), labelHeight);
        ctx.fillStyle = style.backgroundColor;
        ctx.textAlign = 'left';
        ctx.fillText(pane.format(value), plotRightPx + painter.px(AXIS_LABEL_OFFSET), y);
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

    return index;
};

/** 왼쪽 위에 시가·고가·저가·종가·거래량을 한 줄로 표시한다. 값은 캔들 색(valueColor)을 따른다. */
export const drawCandleLegend = (
    painter: Painter, layout: Layout, style: ChartStyle, candle: Candle, valueColor: string,
) => {
    const ctx = painter.ctx;
    const items: [string, string][] = [
        ['시', candle.open.toLocaleString('ko-KR')],
        ['고', candle.high.toLocaleString('ko-KR')],
        ['저', candle.low.toLocaleString('ko-KR')],
        ['종', candle.close.toLocaleString('ko-KR')],
        ['거래량', candle.volume.toLocaleString('ko-KR')],
    ];
    const gap = painter.px(LEGEND_GAP);
    const itemGap = painter.px(LEGEND_ITEM_GAP);
    const widths = items.map(([name, value]) => [ctx.measureText(name).width, ctx.measureText(value).width]);
    const left = painter.px(LEGEND_LEFT);
    const top = painter.px(PADDING_TOP);
    const height = painter.px(LEGEND_HEIGHT);
    const padding = painter.px(AXIS_TAG_PADDING);

    // 좁은 화면에서는 뒤쪽 항목(거래량부터)을 빼서 그림 영역 안에 들어가게 한다.
    const maxWidth = painter.px(layout.plotWidth) - left - padding;
    const widthOf = (count: number) => widths.slice(0, count)
        .reduce((sum, [nameWidth, valueWidth]) => sum + nameWidth + gap + valueWidth, 0) + itemGap * (count - 1);
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
    items.slice(0, shown).forEach(([name, value], index) => {
        const [nameWidth, valueWidth] = widths[index];
        ctx.fillStyle = style.textColor;
        ctx.fillText(name, cursor, middle);
        ctx.fillStyle = valueColor;
        ctx.fillText(value, cursor + nameWidth + gap, middle);
        cursor += nameWidth + gap + valueWidth + itemGap;
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
 */
export const drawOverlayLegends = (
    painter: Painter, layout: Layout, style: ChartStyle, periods: number[], averages: Series[], index: number,
) => {
    const [pricePane, volumePane] = layout.panes;
    const priceItems: LegendItem[] = [
        ...(periods.length > 0 ? [['이평', style.textColor] as LegendItem] : []),
        ...periods.map((period, order): LegendItem => {
            const value = averages[order]?.[index];
            return [
                `${period} ${isNumber(value) ? formatPrice(value, layout.priceDecimals) : '-'}`,
                lineColor(style, order),
            ];
        }),
        ...layout.priceOverlays.flatMap(overlay => overlay.legend(index, style, pricePane.format)),
    ];
    if (priceItems.length > 0) {
        const middle = painter.px(PADDING_TOP + LEGEND_HEIGHT) + painter.px(LEGEND_HEIGHT) / 2;
        writeLegendLine(painter, layout, middle, priceItems);
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
