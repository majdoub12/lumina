'use client'

import { RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'

type FitPreference = 'Closer' | 'Relaxed'

type FitSlidersProps = {
  heightInput: string
  setHeightInput: (value: string) => void
  weightInput: string
  setWeightInput: (value: string) => void
  fitPreference: FitPreference
  setFitPreference: (value: FitPreference) => void
  idPrefix: string
}

export function FitSliders({
  heightInput,
  setHeightInput,
  weightInput,
  setWeightInput,
  fitPreference,
  setFitPreference,
  idPrefix,
}: FitSlidersProps) {
  const height = Number(heightInput) || 168
  const weight = Number(weightInput) || 68

  return (
    <div className="fit-controls">
      <label className="fit-slider" htmlFor={`${idPrefix}-height`}>
        <span>Height <output htmlFor={`${idPrefix}-height`}>{height} cm</output></span>
        <input
          id={`${idPrefix}-height`}
          type="range"
          min="140"
          max="205"
          step="1"
          value={height}
          aria-label="Height in centimeters"
          aria-valuetext={`${height} centimeters`}
          onChange={(event) => setHeightInput(event.target.value)}
        />
        <span className="fit-slider-range" aria-hidden="true"><small>140 cm</small><small>205 cm</small></span>
      </label>
      <label className="fit-slider" htmlFor={`${idPrefix}-weight`}>
        <span>Weight <output htmlFor={`${idPrefix}-weight`}>{weight} kg</output></span>
        <input
          id={`${idPrefix}-weight`}
          type="range"
          min="40"
          max="120"
          step="1"
          value={weight}
          aria-label="Weight in kilograms"
          aria-valuetext={`${weight} kilograms`}
          onChange={(event) => setWeightInput(event.target.value)}
        />
        <span className="fit-slider-range" aria-hidden="true"><small>40 kg</small><small>120 kg</small></span>
      </label>
      <div className="fit-preference">
        <span>Preferred feel</span>
        <div role="group" aria-label="How would you like it to fit?">
          {(['Closer', 'Relaxed'] as const).map((option) => (
            <button
              key={option}
              type="button"
              className={fitPreference === option ? 'active' : ''}
              aria-pressed={fitPreference === option}
              onClick={() => setFitPreference(option)}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ---------- Mannequin turntable ----------
   Three photographed views (front, side, back) are blended as the user drags, so the
   mannequin appears to turn. The figure is then scaled from the sliders:
   height  -> overall height against a 205 cm reference
   weight  -> width, through a simple height/weight ratio.
   This is an illustration, not a body scan or a fit calculation. */
const MANNEQUIN_VIEWS = ['front', 'side', 'back', 'side'] as const
const SIDE_WIDTH_RATIO = 165 / 270
const MAX_HEIGHT_CM = 205
const STAGE_FIGURE_PX = 246
const FLOOR_PX = 20
const lerp = (from: number, to: number, amount: number) => from + (to - from) * amount
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export function MannequinPreview({ heightCm, weightKg }: { heightCm: number; weightKg: number }) {
  const [angle, setAngle] = useState(24)
  const dragging = useRef(false)
  const lastPointerX = useRef(0)
  const velocity = useRef(0)
  const lastInteraction = useRef(0)

  useEffect(() => {
    if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let frame = 0
    const tick = () => {
      if (!dragging.current) {
        if (Math.abs(velocity.current) > 0.03) {
          velocity.current *= 0.93
          setAngle((current) => current + velocity.current)
        } else if (lastInteraction.current === 0 || Date.now() - lastInteraction.current > 6000) {
          setAngle((current) => current + 0.2)
        }
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    dragging.current = true
    velocity.current = 0
    lastInteraction.current = Date.now()
    lastPointerX.current = event.clientX
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return
    const delta = (event.clientX - lastPointerX.current) * 0.8
    lastPointerX.current = event.clientX
    velocity.current = delta
    lastInteraction.current = Date.now()
    setAngle((current) => current + delta)
  }

  const stopDragging = (event: PointerEvent<HTMLDivElement>) => {
    dragging.current = false
    lastInteraction.current = Date.now()
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      lastInteraction.current = Date.now()
      setAngle((current) => current + (event.key === 'ArrowLeft' ? -18 : 18))
    }
  }

  const normalized = ((angle % 360) + 360) % 360
  const segment = Math.floor(normalized / 90)
  const progress = (normalized % 90) / 90
  const eased = progress * progress * (3 - 2 * progress)
  const fromIndex = segment
  const toIndex = (segment + 1) % 4
  const widthOf = (view: (typeof MANNEQUIN_VIEWS)[number]) => (view === 'side' ? SIDE_WIDTH_RATIO : 1)
  const fromWidth = widthOf(MANNEQUIN_VIEWS[fromIndex])
  const toWidth = widthOf(MANNEQUIN_VIEWS[toIndex])
  const layers = [
    { index: fromIndex, scale: lerp(1, toWidth / fromWidth, eased), opacity: eased < 0.55 ? 1 : clamp((1 - eased) / 0.45, 0, 1) },
    { index: toIndex, scale: lerp(fromWidth / toWidth, 1, eased), opacity: clamp(eased / 0.55, 0, 1) },
  ]

  const bmi = weightKg / ((heightCm / 100) ** 2)
  const widthFactor = clamp(0.84 + (bmi - 18) * 0.034, 0.84, 1.32)
  const figureHeight = Math.round((STAGE_FIGURE_PX * heightCm) / MAX_HEIGHT_CM)
  const markerBottom = FLOOR_PX + figureHeight
  const rulerMarks = [150, 160, 170, 180, 190, 200]

  return (
    <div className="try-on-visual">
      <div
        className="try-on-canvas mannequin-stage"
        role="group"
        tabIndex={0}
        aria-label={`Illustrative mannequin, ${heightCm} centimetres and ${weightKg} kilograms. Drag to rotate, or use the left and right arrow keys.`}
        aria-describedby="try-on-rotation-help"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
        onKeyDown={handleKeyDown}
      >
        <div className="mannequin-floor" aria-hidden="true" />
        <div className="mannequin-ruler" aria-hidden="true">
          {rulerMarks.map((mark) => (
            <span key={mark} style={{ bottom: FLOOR_PX + Math.round((STAGE_FIGURE_PX * mark) / MAX_HEIGHT_CM) }}><i />{mark}</span>
          ))}
        </div>
        <div className="mannequin-marker" aria-hidden="true" style={{ bottom: markerBottom }}><b>{heightCm} cm</b></div>
        <div className="mannequin-shadow" aria-hidden="true" style={{ width: Math.round(96 * widthFactor) }} />
        <div className="mannequin-figure" style={{ height: figureHeight, transform: `translateX(-50%) scaleX(${widthFactor.toFixed(3)})` }}>
          <div className="mannequin-breathe">
            {layers.map(({ index, scale, opacity }, order) => (
              <img
                key={`${order}-${index}`}
                src={`/mannequin/${MANNEQUIN_VIEWS[index]}.webp`}
                alt=""
                width={272}
                height={900}
                draggable={false}
                style={{ opacity, transform: `scaleX(${((index === 3 ? -1 : 1) * scale).toFixed(3)})` }}
              />
            ))}
          </div>
        </div>
        <div className="mannequin-chip" aria-hidden="true">{weightKg} kg</div>
        <div className="mannequin-label" aria-hidden="true">Mannequin · wearing the Cotton T-shirt</div>
      </div>
      <div className="try-on-rotation-hint" id="try-on-rotation-help">
        <span><RotateCcw size={14} aria-hidden="true" /></span>
        <span>Drag to rotate 360° <small>or use arrow keys</small></span>
      </div>
    </div>
  )
}
