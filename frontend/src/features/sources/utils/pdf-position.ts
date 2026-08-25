import type { PdfPosition } from "@/features/sources/utils/location";

export function roundPdfPosition(position: PdfPosition, decimals: number): PdfPosition {
  if (!position.boundingRect) return position;
  const factor = Math.pow(10, decimals);
  const round = (value: number) => Math.round(value * factor) / factor;
  const roundRect = (rect: NonNullable<PdfPosition["boundingRect"]>) => ({
    ...rect,
    x1: round(rect.x1),
    y1: round(rect.y1),
    x2: round(rect.x2),
    y2: round(rect.y2),
    width: round(rect.width),
    height: round(rect.height),
  });

  return {
    ...position,
    boundingRect: roundRect(position.boundingRect),
    rects: position.rects?.map(roundRect),
  };
}
