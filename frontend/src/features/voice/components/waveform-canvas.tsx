"use client";

import { useEffect, useRef } from "react";

interface WaveformCanvasProps {
  analyser: AnalyserNode;
  className?: string;
}

const BAR_WIDTH = 3;
const BAR_GAP = 5;
const STRIDE = BAR_WIDTH + BAR_GAP;
const SAMPLE_INTERVAL_MS = 60;
const PADDING_LEFT = 16;
const PADDING_RIGHT = 96; // clears the mic + submit buttons (~80px) plus 1rem gap
const PADDING_Y = 10;
const FADE_BARS_LEFT = 12;
const FADE_BARS_RIGHT = 6;

export function WaveformCanvas({ analyser, className }: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const amplitudeHistoryRef = useRef<number[]>([]);
  const lastSampleTimeRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const ro = new ResizeObserver(() => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    });
    ro.observe(canvas);
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const buffer = new Uint8Array(analyser.frequencyBinCount);

    const draw = (timestamp: number) => {
      rafRef.current = requestAnimationFrame(draw);

      const { width, height } = canvas;
      const drawWidth = width - PADDING_LEFT - PADDING_RIGHT;
      const maxBars = Math.floor(drawWidth / STRIDE);

      if (timestamp - lastSampleTimeRef.current >= SAMPLE_INTERVAL_MS) {
        lastSampleTimeRef.current = timestamp;
        analyser.getByteTimeDomainData(buffer);

        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          const norm = (buffer[i] - 128) / 128;
          sum += norm * norm;
        }
        const rms = Math.sqrt(sum / buffer.length);
        amplitudeHistoryRef.current.push(rms);
        if (amplitudeHistoryRef.current.length > maxBars) {
          amplitudeHistoryRef.current.shift();
        }
      }

      ctx.clearRect(0, 0, width, height);

      const samples = amplitudeHistoryRef.current;
      const midY = height / 2;
      const maxBarHalf = (height - PADDING_Y * 2) / 2;
      const minBarHalf = 2;
      const fillColor = getComputedStyle(canvas).color;

      // Always draw maxBars slots across the full width.
      // Newest sample = rightmost slot; pad empty slots on the left with 0.
      for (let slot = 0; slot < maxBars; slot++) {
        const sampleIndex = samples.length - maxBars + slot;
        const amp = sampleIndex >= 0 ? samples[sampleIndex] : 0;
        const barHalf = minBarHalf + (maxBarHalf - minBarHalf) * Math.pow(Math.min(amp * 4, 1), 0.55);
        const x = PADDING_LEFT + slot * STRIDE;

        // Fade left edge
        const leftAlpha = slot < FADE_BARS_LEFT ? slot / FADE_BARS_LEFT : 1;
        // Fade right edge
        const barsFromRight = maxBars - 1 - slot;
        const rightAlpha = barsFromRight < FADE_BARS_RIGHT ? barsFromRight / FADE_BARS_RIGHT : 1;
        // Also fade slots that haven't received real data yet
        const dataAlpha = sampleIndex >= 0 ? 1 : 0;

        ctx.globalAlpha = Math.min(leftAlpha, rightAlpha) * dataAlpha * 0.35;
        ctx.fillStyle = fillColor;

        const barHeight = barHalf * 2;
        const y = midY - barHalf;

        ctx.beginPath();
        ctx.roundRect(x, y, BAR_WIDTH, barHeight, BAR_WIDTH / 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [analyser]);

  return <canvas ref={canvasRef} className={className} style={{ width: "100%", height: "100%" }} />;
}
