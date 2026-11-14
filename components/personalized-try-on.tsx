'use client'

import { Canvas } from '@react-three/fiber'
import { RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'

type FitPreference = 'Closer' | 'Relaxed'
type TryOnProduct = { name: string; color: string; fabric: string }

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

export function PersonalizedTryOn({
  heightCm,
  weightKg,
  product,
}: {
  heightCm: number
  weightKg: number
  product: TryOnProduct
}) {
  const [rotation, setRotation] = useState(0)
  const [supportsWebGL, setSupportsWebGL] = useState(false)
  const dragging = useRef(false)
  const lastPointerX = useRef(0)

  useEffect(() => {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('webgl2')
    setSupportsWebGL(Boolean(context))
    context?.getExtension('WEBGL_lose_context')?.loseContext()
  }, [])

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    dragging.current = true
    lastPointerX.current = event.clientX
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return
    const delta = event.clientX - lastPointerX.current
    lastPointerX.current = event.clientX
    setRotation((current) => current + delta * 0.012)
  }

  const stopDragging = (event: PointerEvent<HTMLDivElement>) => {
    dragging.current = false
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      setRotation((current) => current + (event.key === 'ArrowLeft' ? -0.3 : 0.3))
    }
  }

  return (
    <div className="try-on-visual">
      <div
        className="try-on-canvas"
        role="group"
        tabIndex={0}
        aria-label={`Illustrative 3D mannequin wearing ${product.name}. Drag to rotate, or use the left and right arrow keys.`}
        aria-describedby="try-on-rotation-help"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
        onKeyDown={handleKeyDown}
      >
        {supportsWebGL ? <Canvas
          aria-hidden="true"
          shadows
          dpr={[1, 1.5]}
          camera={{ position: [0, 0, 5.4], fov: 34 }}
          fallback={<p className="try-on-fallback">The 3D preview is unavailable in this browser.</p>}
        >
          <color attach="background" args={['#eeece8']} />
          <hemisphereLight args={['#fffdf8', '#c9c2b8', 2.1]} />
          <directionalLight position={[3, 4, 4]} intensity={2.2} castShadow />
          <directionalLight position={[-3, 2, -3]} intensity={0.8} />
          <AvatarFigure heightCm={heightCm} weightKg={weightKg} product={product} rotation={rotation} />
          <mesh position={[0, -1.14, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.62, 36]} />
            <meshBasicMaterial color="#b9b5ae" transparent opacity={0.34} />
          </mesh>
        </Canvas> : <AvatarFallback heightCm={heightCm} weightKg={weightKg} product={product} rotation={rotation}/>}
      </div>
      <div className="try-on-rotation-hint" id="try-on-rotation-help">
        <span><RotateCcw size={14} aria-hidden="true" /></span>
        <span>Drag to rotate 360° <small>or use arrow keys</small></span>
      </div>
    </div>
  )
}

function AvatarFigure({
  heightCm,
  weightKg,
  product,
  rotation,
}: {
  heightCm: number
  weightKg: number
  product: TryOnProduct
  rotation: number
}) {
  const bodyWidth = 0.84 + ((weightKg - 40) / 80) * 0.3
  const heightScale = heightCm / 168
  const isBottomItem = product.name.toLowerCase().includes('denim')
  const colorByProduct: Record<string, string> = {
    Black: '#30302e',
    Ivory: '#e7dfcf',
    Indigo: '#54709a',
    Rose: '#b46e79',
  }
  const itemColor = colorByProduct[product.color] ?? '#8a6d5e'
  const shirtColor = isBottomItem ? '#e8e3db' : itemColor
  const trouserColor = isBottomItem ? itemColor : (['Black', 'Indigo'].includes(product.color) ? '#cfc7ba' : '#4a4b4d')
  const hasLongSleeves = product.name.toLowerCase().includes('shirt') || product.name.toLowerCase().includes('sweatshirt')
  const sleeveColor = hasLongSleeves ? shirtColor : '#d9c4b2'

  return (
    <group position={[0, -1.12, 0]} scale={[bodyWidth, heightScale, 1]} rotation={[0, rotation, 0]}>
      <mesh position={[0, 1.38, 0]} castShadow>
        <capsuleGeometry args={[0.29, 0.54, 7, 16]} />
        <meshStandardMaterial color={shirtColor} roughness={0.78} />
      </mesh>
      <mesh position={[0, 1.99, 0]}>
        <cylinderGeometry args={[0.075, 0.08, 0.16, 16]} />
        <meshStandardMaterial color="#ddc8b6" roughness={0.82} />
      </mesh>
      <mesh position={[0, 2.18, 0]} castShadow>
        <sphereGeometry args={[0.145, 24, 20]} />
        <meshStandardMaterial color="#e2cdbb" roughness={0.82} />
      </mesh>
      <mesh position={[-0.34, 1.55, 0]} rotation={[0, 0, -0.13]} castShadow>
        <capsuleGeometry args={[0.105, 0.37, 5, 12]} />
        <meshStandardMaterial color={shirtColor} roughness={0.78} />
      </mesh>
      <mesh position={[0.34, 1.55, 0]} rotation={[0, 0, 0.13]} castShadow>
        <capsuleGeometry args={[0.105, 0.37, 5, 12]} />
        <meshStandardMaterial color={shirtColor} roughness={0.78} />
      </mesh>
      <mesh position={[-0.39, 1.12, 0]} rotation={[0, 0, -0.08]}>
        <capsuleGeometry args={[0.075, 0.37, 5, 12]} />
        <meshStandardMaterial color={sleeveColor} roughness={0.82} />
      </mesh>
      <mesh position={[0.39, 1.12, 0]} rotation={[0, 0, 0.08]}>
        <capsuleGeometry args={[0.075, 0.37, 5, 12]} />
        <meshStandardMaterial color={sleeveColor} roughness={0.82} />
      </mesh>
      <mesh position={[-0.105, 0.39, 0]} castShadow>
        <capsuleGeometry args={[0.125, 0.57, 6, 14]} />
        <meshStandardMaterial color={trouserColor} roughness={0.86} />
      </mesh>
      <mesh position={[0.105, 0.39, 0]} castShadow>
        <capsuleGeometry args={[0.125, 0.57, 6, 14]} />
        <meshStandardMaterial color={trouserColor} roughness={0.86} />
      </mesh>
      <mesh position={[-0.105, -0.02, 0.1]} castShadow>
        <boxGeometry args={[0.17, 0.1, 0.3]} />
        <meshStandardMaterial color="#f7f5ef" roughness={0.72} />
      </mesh>
      <mesh position={[0.105, -0.02, 0.1]} castShadow>
        <boxGeometry args={[0.17, 0.1, 0.3]} />
        <meshStandardMaterial color="#f7f5ef" roughness={0.72} />
      </mesh>
    </group>
  )
}

function AvatarFallback({
  heightCm,
  weightKg,
  product,
  rotation,
}: {
  heightCm: number
  weightKg: number
  product: TryOnProduct
  rotation: number
}) {
  const width = 0.84 + ((weightKg - 40) / 80) * 0.3
  const isBottomItem = product.name.toLowerCase().includes('denim')
  const colors: Record<string, string> = { Black: '#30302e', Ivory: '#e7dfcf', Indigo: '#54709a', Rose: '#b46e79' }
  const itemColor = colors[product.color] ?? '#8a6d5e'
  const shirtColor = isBottomItem ? '#e8e3db' : itemColor
  const trouserColor = isBottomItem ? itemColor : (['Black', 'Indigo'].includes(product.color) ? '#cfc7ba' : '#4a4b4d')
  const hasLongSleeves = product.name.toLowerCase().includes('shirt') || product.name.toLowerCase().includes('sweatshirt')
  const sleeveColor = hasLongSleeves ? shirtColor : '#d9c4b2'

  return (
    <div className="try-on-css-stage" aria-hidden="true">
      <span className="try-on-css-shadow" />
      <div className="try-on-css-avatar" style={{ transform: `translateX(-50%) rotateY(${rotation}rad) scale(${width}, ${heightCm / 168})` }}>
        <span className="try-on-css-head" />
        <span className="try-on-css-neck" />
        <span className="try-on-css-torso" style={{ backgroundColor: shirtColor }} />
        <span className="try-on-css-upper-arm left" style={{ backgroundColor: shirtColor }} />
        <span className="try-on-css-upper-arm right" style={{ backgroundColor: shirtColor }} />
        <span className="try-on-css-forearm left" style={{ backgroundColor: sleeveColor }} />
        <span className="try-on-css-forearm right" style={{ backgroundColor: sleeveColor }} />
        <span className="try-on-css-leg left" style={{ backgroundColor: trouserColor }} />
        <span className="try-on-css-leg right" style={{ backgroundColor: trouserColor }} />
        <span className="try-on-css-shoe left" />
        <span className="try-on-css-shoe right" />
      </div>
    </div>
  )
}
