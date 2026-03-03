import { useEffect, useRef } from 'react';
import { useMap } from '@vis.gl/react-maplibre';
import type { Route } from '@weatherchaser/core';

interface RouteLayerProps { route: Route; }

function scoreColor(value: number): string {
  const hue = Math.round((Math.min(Math.max(value, 0), 100) / 100) * 120);
  return `hsl(${hue}, 65%, 45%)`;
}

// Canvas2D overlay — avoids MapLibre's GeoJSON worker (which fails under Vite's bundler)
export function RouteLayer({ route }: RouteLayerProps) {
  const { current: map } = useMap();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!map || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const gl = map.getMap();

    function resize() {
      const container = gl.getContainer();
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    }

    function redraw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < route.stops.length - 1; i++) {
        const from = route.stops[i];
        const to = route.stops[i + 1];
        const p1 = gl.project([from.town.lng, from.town.lat]);
        const p2 = gl.project([to.town.lng, to.town.lat]);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = scoreColor(to.score.composite);
        ctx.lineWidth = 4;
        ctx.globalAlpha = 0.85;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
      }
    }

    resize();
    redraw();

    gl.on('move', redraw);
    gl.on('resize', resize);

    return () => {
      gl.off('move', redraw);
      gl.off('resize', resize);
    };
  }, [map, route]);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}
    />
  );
}
