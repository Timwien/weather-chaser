import { Marker } from '@vis.gl/react-maplibre';
import { useRouteVan } from '../../hooks/useRouteVan.ts';
import { useGlidedTime } from '../../hooks/useGlidedTime.ts';
import { useWeatherLayerStore } from '../../stores/weatherLayerStore.ts';
import { CADENCE_MS } from '../../services/playbackEngine.ts';
import { positionAt } from '../../utils/routeSchedule.ts';
import './RouteVan.css';

/** Vertical lift (px) while the camper stands at a stop. */
const VAN_PARKED_LIFT_PX = 24;

/** Small campervan (faces right); white outline keeps it readable on light and dark maps. */
function VanIcon() {
  return (
    <svg className="route-van-svg" width="44" height="30" viewBox="0 0 48 32" aria-hidden="true">
      <g strokeLinejoin="round" strokeLinecap="round">
        <rect x="12" y="3.5" width="17" height="4" rx="2" fill="var(--color-accent)" stroke="#fff" strokeWidth="2.4" />
        <path
          d="M4 22V11.5Q4 7 8.5 7H30Q33 7 35 9L42.5 15.5Q45.5 17 45.5 20.5V22Q45.5 24.5 43 24.5H6.5Q4 24.5 4 22Z"
          fill="var(--color-accent)" stroke="#fff" strokeWidth="2.4" paintOrder="stroke"
        />
        <path d="M4 20.2H45.5" stroke="#fff" strokeOpacity="0.55" strokeWidth="1.4" />
        <rect x="9" y="10.5" width="8" height="6" rx="1.2" fill="#fff" fillOpacity="0.92" />
        <rect x="19" y="10.5" width="8" height="6" rx="1.2" fill="#fff" fillOpacity="0.92" />
        <path d="M30 10.5H33.2L39.5 16H30Z" fill="#fff" fillOpacity="0.92" />
        <circle cx="14" cy="25" r="4.4" fill="#263238" stroke="#fff" strokeWidth="2.2" />
        <circle cx="37" cy="25" r="4.4" fill="#263238" stroke="#fff" strokeWidth="2.2" />
        <circle cx="14" cy="25" r="1.4" fill="#fff" />
        <circle cx="37" cy="25" r="1.4" fill="#fff" />
      </g>
    </svg>
  );
}

/**
 * The camper on the route at the time of the weather picture on screen. It follows a display clock
 * that glides from the previous to the current frame instant, so it never runs ahead of the weather.
 */
export function RouteVan() {
  const van = useRouteVan();
  const playing = useWeatherLayerStore((s) => s.playing);
  const t = useGlidedTime(van?.shownMs ?? null, playing ? CADENCE_MS : 450);
  if (!van || t === null) return null;
  const pos = positionAt(van.schedule, t);
  return (
    <Marker longitude={pos.lng} latitude={pos.lat} anchor="center" style={{ zIndex: 4, pointerEvents: 'none' }}>
      <div
        className="route-van"
        data-route-van=""
        data-t={Math.round(t)}
        data-shown={van.shownMs}
        data-stop={pos.stopIndex ?? ''}
        data-heading={pos.heading}
        // parked: lift the camper just above the stop marker so the (highlighted) marker stays visible
        style={{ transform: `translateY(${pos.stopIndex !== null ? -VAN_PARKED_LIFT_PX : 0}px)${pos.heading < 0 ? ' scaleX(-1)' : ''}` }}
      >
        <VanIcon />
      </div>
    </Marker>
  );
}
