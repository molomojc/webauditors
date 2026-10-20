import { useEffect, useRef } from 'react'
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  RingGeometry,
  Scene,
  SphereGeometry,
  WebGLRenderer,
} from 'three'

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

/** Evenly distributed directions on a unit sphere. */
function buildDirections(count) {
  const golden = Math.PI * (3 - Math.sqrt(5))
  return Array.from({ length: count }, (_, index) => {
    const y = 1 - (index / (count - 1)) * 2
    const ring = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = golden * index
    return [Math.cos(theta) * ring, y, Math.sin(theta) * ring]
  })
}

function toPositions(directions, radius) {
  const positions = new Float32Array(directions.length * 3)
  directions.forEach(([x, y, z], index) => {
    positions[index * 3] = x * radius
    positions[index * 3 + 1] = y * radius
    positions[index * 3 + 2] = z * radius
  })
  return positions
}

/** Short arcs hugging the surface, so links read as lines around a sphere. */
function buildArcs(directions, radius, step = 18) {
  const vertices = []

  for (let index = 0; index < directions.length; index += 5) {
    const a = directions[index]
    const b = directions[(index * 13 + 7) % directions.length]
    const dot = Math.min(
      1,
      Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]),
    )
    const omega = Math.acos(dot)
    const sinOmega = Math.sin(omega)
    if (omega < 0.35 || sinOmega < 0.05) continue

    let previous = null
    for (let segment = 0; segment <= step; segment += 1) {
      const t = segment / step
      const from = Math.sin((1 - t) * omega) / sinOmega
      const to = Math.sin(t * omega) / sinOmega
      const x = a[0] * from + b[0] * to
      const y = a[1] * from + b[1] * to
      const z = a[2] * from + b[2] * to
      const length = Math.hypot(x, y, z) || 1
      const current = [
        (x / length) * radius,
        (y / length) * radius,
        (z / length) * radius,
      ]

      if (previous) vertices.push(...previous, ...current)
      previous = current
    }
  }

  return new Float32Array(vertices)
}

function buildDust(count) {
  const positions = new Float32Array(count * 3)
  for (let index = 0; index < count; index += 1) {
    const radius = 2.2 + Math.random() * 3.4
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    positions[index * 3] = radius * Math.sin(phi) * Math.cos(theta)
    positions[index * 3 + 1] = radius * Math.cos(phi) * 0.7
    positions[index * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta)
  }
  return positions
}

function pointsGeometry(positions) {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  return geometry
}

function createOrbit(radius, opacity, rotation, satelliteColor) {
  const group = new Group()
  group.rotation.set(...rotation)

  const ring = new Mesh(
    new RingGeometry(radius, radius + 0.015, 160),
    new MeshBasicMaterial({
      color: 0xa9c4e6,
      transparent: true,
      opacity,
      side: DoubleSide,
      blending: AdditiveBlending,
      depthWrite: false,
    }),
  )

  const satellite = new Mesh(
    new SphereGeometry(0.03, 12, 12),
    new MeshBasicMaterial({ color: satelliteColor }),
  )
  satellite.position.set(radius, 0, 0)

  group.add(ring, satellite)
  return { group, satellite, radius }
}

function disposeScene(scene) {
  scene.traverse((object) => {
    if (object.geometry) object.geometry.dispose()
    if (!object.material) return
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material]
    materials.forEach((material) => material.dispose())
  })
}

/**
 * The hero's wireframe globe: surface arcs, nodes, orbit rings and a slow
 * sonar pulse. Plain three.js keeps the lazy chunk small, and the scene pauses
 * off-screen and renders one static frame under reduced motion.
 */
export default function HeroScene() {
  const hostRef = useRef(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return undefined

    const probe = document.createElement('canvas')
    const context = probe.getContext('webgl2') || probe.getContext('webgl')
    if (!context) return undefined

    const renderer = new WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    })
    renderer.setClearColor(0x000000, 0)
    renderer.domElement.style.display = 'block'
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    host.appendChild(renderer.domElement)

    const scene = new Scene()
    const camera = new PerspectiveCamera(45, 1, 0.1, 100)
    camera.position.set(0, 0, 6.6)

    const root = new Group()
    root.position.set(0, 0.1, 0)
    root.scale.setScalar(1.05)
    scene.add(root)

    const core = new Mesh(
      new SphereGeometry(1.3, 48, 48),
      new MeshBasicMaterial({ color: 0x08090b }),
    )

    const spin = new Group()
    const directions = buildDirections(72)
    const wire = new Mesh(
      new IcosahedronGeometry(1.6, 2),
      new MeshBasicMaterial({
        color: 0xa9c4e6,
        wireframe: true,
        transparent: true,
        opacity: 0.17,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    )
    const arcs = new LineSegments(
      pointsGeometry(buildArcs(directions, 1.65)),
      new LineBasicMaterial({
        color: 0x8fb0d9,
        transparent: true,
        opacity: 0.34,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    )
    const nodes = new Points(
      pointsGeometry(toPositions(directions, 1.635)),
      new PointsMaterial({
        color: 0xd6e2f2,
        size: 0.04,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.9,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    )
    const accentNodes = new Points(
      pointsGeometry(
        toPositions(
          directions.filter((_, index) => index % 9 === 0),
          1.64,
        ),
      ),
      new PointsMaterial({
        color: 0xffffff,
        size: 0.06,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.95,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    )
    spin.add(wire, arcs, nodes, accentNodes)

    // A slow sonar pulse makes the object read as an active scan.
    const pulseMaterial = new MeshBasicMaterial({
      color: 0xa9c4e6,
      transparent: true,
      opacity: 0.16,
      side: DoubleSide,
      blending: AdditiveBlending,
      depthWrite: false,
    })
    const pulse = new Mesh(new RingGeometry(1, 1.006, 160), pulseMaterial)
    root.add(pulse)

    const orbitA = createOrbit(2.0, 0.5, [Math.PI / 2.1, 0.15, 0.34], 0xffffff)
    const orbitB = createOrbit(
      2.3,
      0.3,
      [Math.PI / 1.65, -0.55, -0.16],
      0xd6e2f2,
    )

    const dust = new Points(
      pointsGeometry(buildDust(220)),
      new PointsMaterial({
        color: 0xcfd9e6,
        size: 0.022,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.5,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    )

    root.add(core, spin, orbitA.group, orbitB.group, dust)

    const motion = window.matchMedia(REDUCED_MOTION)
    let animated = !motion.matches
    let visible = true
    let running = false
    let frameId = 0
    let last = performance.now()
    const startedAt = last
    const pointer = { x: 0, y: 0 }

    const damp = (current, target, lambda, delta) =>
      current + (target - current) * (1 - Math.exp(-lambda * delta))

    function handlePointer(event) {
      pointer.x = (event.clientX / window.innerWidth) * 2 - 1
      pointer.y = (event.clientY / window.innerHeight) * 2 - 1
    }

    function draw(now) {
      const delta = Math.min((now - last) / 1000, 0.05)
      last = now
      const time = (now - startedAt) / 1000

      spin.rotation.y += delta * 0.085
      dust.rotation.y -= delta * 0.014
      dust.rotation.x = Math.sin(time * 0.08) * 0.05
      root.rotation.x = damp(root.rotation.x, pointer.y * 0.14, 3, delta)
      root.rotation.y = damp(root.rotation.y, pointer.x * 0.24, 3, delta)
      root.position.y = 0.1 + Math.sin(time * 0.55) * 0.06

      orbitA.satellite.position.set(
        Math.cos(time * 0.45) * orbitA.radius,
        Math.sin(time * 0.45) * orbitA.radius,
        0,
      )
      orbitB.satellite.position.set(
        Math.cos(time * -0.3) * orbitB.radius,
        Math.sin(time * -0.3) * orbitB.radius,
        0,
      )

      const pulseCycle = (time % 3.6) / 3.6
      pulse.scale.setScalar(1.18 + pulseCycle * 0.82)
      pulseMaterial.opacity = 0.2 * (1 - pulseCycle)

      renderer.render(scene, camera)
    }

    function loop(now) {
      draw(now)
      if (running) frameId = requestAnimationFrame(loop)
    }

    function start() {
      if (running || !animated || !visible) return
      running = true
      last = performance.now()
      frameId = requestAnimationFrame(loop)
    }

    function stop() {
      running = false
      cancelAnimationFrame(frameId)
    }

    function resize() {
      const width = host.clientWidth
      const height = host.clientHeight
      if (!width || !height) return
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75))
      renderer.setSize(width, height, false)
      if (!running) renderer.render(scene, camera)
    }

    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(host)
    resize()

    const visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting
        if (visible) start()
        else stop()
      },
      { threshold: 0 },
    )
    visibilityObserver.observe(host)

    function syncMotion() {
      animated = !motion.matches
      if (animated) {
        window.addEventListener('pointermove', handlePointer, { passive: true })
        start()
        return
      }

      window.removeEventListener('pointermove', handlePointer)
      stop()
      pointer.x = 0
      pointer.y = 0
      root.rotation.set(0, 0, 0)
      renderer.render(scene, camera)
    }

    syncMotion()
    motion.addEventListener('change', syncMotion)

    return () => {
      stop()
      motion.removeEventListener('change', syncMotion)
      window.removeEventListener('pointermove', handlePointer)
      resizeObserver.disconnect()
      visibilityObserver.disconnect()
      disposeScene(scene)
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    }
  }, [])

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      className="hero-stage pointer-events-none absolute inset-0 select-none"
    />
  )
}
