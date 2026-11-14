'use client'

import { RotateCcw } from 'lucide-react'
import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'

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
   Three photographed views (front, side, back) are shown one at a time. The mannequin
   stands still and only turns when the user drags it (or uses the arrow keys): no
   auto-rotation, no cross-fade, no breathing. All three photos stay mounted, so
   switching views never reloads an image (that reload was the flicker).
   The figure is scaled from the sliders:
   height  -> overall height against a 205 cm reference
   weight  -> width, through a simple height/weight ratio.
   This is an illustration, not a body scan or a fit calculation. */
const MANNEQUIN_VIEWS = ['front', 'side', 'back'] as const
const MAX_HEIGHT_CM = 205
const STAGE_FIGURE_PX = 246
const FLOOR_PX = 20
const DEGREES_PER_PIXEL = 0.8
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export function MannequinPreview({ heightCm, weightKg }: { heightCm: number; weightKg: number }) {
  const [angle, setAngle] = useState(0)
  const dragging = useRef(false)
  const lastPointerX = useRef(0)

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    dragging.current = true
    lastPointerX.current = event.clientX
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return
    const delta = (event.clientX - lastPointerX.current) * DEGREES_PER_PIXEL
    lastPointerX.current = event.clientX
    setAngle((current) => current + delta)
  }

  const stopDragging = (event: PointerEvent<HTMLDivElement>) => {
    dragging.current = false
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      setAngle((current) => current + (event.key === 'ArrowLeft' ? -30 : 30))
    }
  }

  // 0 = front, 1 = side (right), 2 = back, 3 = side (left, mirrored)
  const step = Math.round((((angle % 360) + 360) % 360) / 90) % 4
  const activeView = step === 3 ? 1 : step

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
          {MANNEQUIN_VIEWS.map((view, index) => (
            <img
              key={view}
              src={`/mannequin/${view}.webp`}
              alt=""
              width={272}
              height={900}
              draggable={false}
              style={{ visibility: index === activeView ? 'visible' : 'hidden', transform: index === 1 && step === 3 ? 'scaleX(-1)' : undefined }}
            />
          ))}
        </div>
        <div className="mannequin-chip" aria-hidden="true">{weightKg} kg</div>
        <div className="mannequin-label" aria-hidden="true">Mannequin · wearing the Cotton T-shirt</div>
      </div>
      <div className="try-on-rotation-hint" id="try-on-rotation-help">
        <span><RotateCcw size={14} aria-hidden="true" /></span>
        <span>Drag to turn the mannequin <small>or use arrow keys</small></span>
      </div>
    </div>
  )
}
