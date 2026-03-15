import { useRef, useEffect, useCallback, useState } from 'react'
import { FlowData, NodeData, LinkData } from './types'
import sampleData from './data/sampleData'

// ─── Constants ───────────────────────────────────────────────────────────────

const NODE_RADIUS = 28
const PARTICLE_COUNT = 3
const STATUS_COLORS: Record<string, string> = {
  ok: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  default: '#64748b',
}

// ─── Canvas rendering helpers ────────────────────────────────────────────────

function statusColor(status?: string): string {
  return STATUS_COLORS[status ?? 'default'] ?? STATUS_COLORS['default']
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  zoom: number,
) {
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len < 1) return
  const ux = dx / len
  const uy = dy / len
  const ex = x2 - ux * NODE_RADIUS
  const ey = y2 - uy * NODE_RADIUS
  const aLen = 10 / zoom
  const aW = 5 / zoom
  ctx.beginPath()
  ctx.moveTo(ex, ey)
  ctx.lineTo(ex - ux * aLen + uy * aW, ey - uy * aLen - ux * aW)
  ctx.lineTo(ex - ux * aLen - uy * aW, ey - uy * aLen + ux * aW)
  ctx.closePath()
  ctx.fill()
}

// ─── Main App ────────────────────────────────────────────────────────────────

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)

  // view transform
  const zoomRef = useRef(1)
  const offsetRef = useRef({ x: 0, y: 0 })
  const draggingRef = useRef(false)
  const lastPosRef = useRef({ x: 0, y: 0 })

  // data
  const [flowData, setFlowData] = useState<FlowData>(sampleData)
  const flowRef = useRef<FlowData>(sampleData)

  // UI state
  const [selected, setSelected] = useState<NodeData | null>(null)
  const [jsonText, setJsonText] = useState(() => JSON.stringify(sampleData, null, 2))
  const [jsonError, setJsonError] = useState('')
  const [dataUrl, setDataUrl] = useState('')
  const [loadError, setLoadError] = useState('')
  const [loadStatus, setLoadStatus] = useState('')

  // keep ref in sync so canvas loop can read without closure stale issues
  useEffect(() => {
    flowRef.current = flowData
  }, [flowData])

  // ─── fit-to-view ─────────────────────────────────────────────────────────

  const fitToView = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const nodes = flowRef.current.nodes
    if (!nodes.length) return
    const xs = nodes.map((n) => n.x)
    const ys = nodes.map((n) => n.y)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    const padW = canvas.clientWidth * 0.15
    const padH = canvas.clientHeight * 0.15
    const dataW = maxX - minX + NODE_RADIUS * 4
    const dataH = maxY - minY + NODE_RADIUS * 4
    const scaleX = (canvas.clientWidth - padW * 2) / (dataW || 1)
    const scaleY = (canvas.clientHeight - padH * 2) / (dataH || 1)
    const z = Math.min(scaleX, scaleY, 2.5)
    zoomRef.current = z
    offsetRef.current = {
      x: canvas.clientWidth / 2 - ((minX + maxX) / 2) * z,
      y: canvas.clientHeight / 2 - ((minY + maxY) / 2) * z,
    }
  }, [])

  // ─── apply data ──────────────────────────────────────────────────────────

  const applyFlowData = useCallback(
    (data: FlowData) => {
      setFlowData(data)
      flowRef.current = data
      setSelected(null)
      setTimeout(fitToView, 50)
    },
    [fitToView],
  )

  // initial fit on mount
  useEffect(() => {
    fitToView()
  }, [fitToView])

  // ─── JSON apply ──────────────────────────────────────────────────────────

  const handleApplyJson = () => {
    try {
      const parsed = JSON.parse(jsonText) as FlowData
      setJsonError('')
      applyFlowData(parsed)
    } catch (e) {
      setJsonError(`Invalid JSON: ${(e as Error).message}`)
    }
  }

  // ─── URL load ────────────────────────────────────────────────────────────

  const handleLoadUrl = async () => {
    if (!dataUrl.trim()) return
    setLoadError('')
    setLoadStatus('Loading…')
    try {
      const res = await fetch(dataUrl.trim())
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
      const data = (await res.json()) as FlowData
      setJsonText(JSON.stringify(data, null, 2))
      setJsonError('')
      setLoadStatus('Loaded ✓')
      applyFlowData(data)
    } catch (e) {
      setLoadError(`Load failed: ${(e as Error).message}`)
      setLoadStatus('')
    }
  }

  // ─── mouse / touch events ────────────────────────────────────────────────

  const screenToWorld = (sx: number, sy: number) => ({
    x: (sx - offsetRef.current.x) / zoomRef.current,
    y: (sy - offsetRef.current.y) / zoomRef.current,
  })

  const hitTest = (wx: number, wy: number): NodeData | undefined => {
    return flowRef.current.nodes.find((n) => {
      const dx = n.x - wx
      const dy = n.y - wy
      return dx * dx + dy * dy < NODE_RADIUS * NODE_RADIUS
    })
  }

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const prevZ = zoomRef.current
    const delta = -e.deltaY * 0.001
    const newZ = Math.min(4, Math.max(0.2, prevZ + delta * prevZ))
    const cx = (e.clientX - rect.left - offsetRef.current.x) / prevZ
    const cy = (e.clientY - rect.top - offsetRef.current.y) / prevZ
    offsetRef.current = {
      x: e.clientX - rect.left - cx * newZ,
      y: e.clientY - rect.top - cy * newZ,
    }
    zoomRef.current = newZ
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    draggingRef.current = true
    lastPosRef.current = { x: e.clientX, y: e.clientY }
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (draggingRef.current) {
      offsetRef.current = {
        x: offsetRef.current.x + (e.clientX - lastPosRef.current.x),
        y: offsetRef.current.y + (e.clientY - lastPosRef.current.y),
      }
      lastPosRef.current = { x: e.clientX, y: e.clientY }
    }
  }, [])

  const handleMouseUp = useCallback(() => {
    draggingRef.current = false
  }, [])

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    const world = screenToWorld(sx, sy)
    const hit = hitTest(world.x, world.y)
    setSelected(hit ?? null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // attach wheel with { passive: false } to allow preventDefault
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.addEventListener('wheel', handleWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  // ─── resize observer ─────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ro = new ResizeObserver(() => {
      canvas.width = canvas.clientWidth
      canvas.height = canvas.clientHeight
    })
    ro.observe(canvas)
    canvas.width = canvas.clientWidth
    canvas.height = canvas.clientHeight
    return () => ro.disconnect()
  }, [])

  // ─── animation loop ──────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const render = (time: number) => {
      const { nodes, links } = flowRef.current
      const z = zoomRef.current
      const off = offsetRef.current

      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.setTransform(z, 0, 0, z, off.x, off.y)

      // ── links ────────────────────────────────────────────────────────────
      const nodeMap = new Map(nodes.map((n) => [n.id, n]))

      links.forEach((link: LinkData, idx: number) => {
        const a = nodeMap.get(link.from)
        const b = nodeMap.get(link.to)
        if (!a || !b) return

        const color = link.color ?? statusColor(link.status)

        // line from border of source to border of target
        const dx = b.x - a.x
        const dy = b.y - a.y
        const len = Math.sqrt(dx * dx + dy * dy)
        if (len < 1) return
        const ux = dx / len
        const uy = dy / len
        const sx = a.x + ux * NODE_RADIUS
        const sy = a.y + uy * NODE_RADIUS

        ctx.strokeStyle = color
        ctx.lineWidth = 2 / z
        ctx.globalAlpha = 0.55
        ctx.beginPath()
        ctx.moveTo(sx, sy)
        ctx.lineTo(b.x - ux * NODE_RADIUS, b.y - uy * NODE_RADIUS)
        ctx.stroke()

        // arrowhead
        ctx.globalAlpha = 1
        ctx.fillStyle = color
        drawArrow(ctx, a.x, a.y, b.x, b.y, z)

        // animated particles
        for (let p = 0; p < PARTICLE_COUNT; p++) {
          const phase = ((time / 900 + idx * 0.37 + p / PARTICLE_COUNT) % 1 + 1) % 1
          const px = sx + (b.x - ux * NODE_RADIUS - sx) * phase
          const py = sy + (b.y - uy * NODE_RADIUS - sy) * phase
          ctx.beginPath()
          ctx.arc(px, py, 4 / z, 0, Math.PI * 2)
          ctx.fillStyle = color
          ctx.globalAlpha = 0.9
          ctx.fill()
        }
        ctx.globalAlpha = 1

        // rate label
        if (link.rate !== undefined) {
          const mx = (sx + b.x - ux * NODE_RADIUS) / 2
          const my = (sy + b.y - uy * NODE_RADIUS) / 2
          ctx.font = `${12 / z}px Inter,system-ui,sans-serif`
          ctx.fillStyle = '#94a3b8'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'bottom'
          ctx.fillText(`${link.rate}/min`, mx, my - 4 / z)
        }
      })

      // ── nodes ────────────────────────────────────────────────────────────
      nodes.forEach((node: NodeData) => {
        const isSel =
          selected?.id === node.id

        // glow for selected
        if (isSel) {
          ctx.shadowColor = '#38bdf8'
          ctx.shadowBlur = 18 / z
        }

        // circle fill
        ctx.beginPath()
        ctx.arc(node.x, node.y, NODE_RADIUS, 0, Math.PI * 2)
        ctx.fillStyle = isSel ? '#1e40af' : '#1d4ed8'
        ctx.fill()

        // stroke
        ctx.lineWidth = 2 / z
        ctx.strokeStyle = isSel ? '#38bdf8' : '#60a5fa'
        ctx.stroke()

        ctx.shadowBlur = 0

        // label
        ctx.font = `bold ${12 / z}px Inter,system-ui,sans-serif`
        ctx.fillStyle = '#e2e8f0'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(node.id, node.x, node.y)
      })

      animRef.current = requestAnimationFrame(render)
    }

    animRef.current = requestAnimationFrame(render)
    return () => cancelAnimationFrame(animRef.current)
  }, [selected])

  // ─── selected node detail helpers ────────────────────────────────────────

  const inputs = selected
    ? flowData.links.filter((l) => l.to === selected.id)
    : []
  const outputs = selected
    ? flowData.links.filter((l) => l.from === selected.id)
    : []

  // ─── render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-100">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 bg-slate-950 border-b border-slate-800 shrink-0">
        <h1 className="text-lg font-semibold tracking-tight text-sky-400">
          AssemblyCockpit
        </h1>
        <div className="flex items-center gap-2">
          <input
            className="w-72 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            placeholder="Data URL (CORS-enabled)"
            value={dataUrl}
            onChange={(e) => setDataUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleLoadUrl() }}
          />
          <button
            onClick={() => void handleLoadUrl()}
            className="px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded text-sm font-medium transition-colors"
          >
            Load
          </button>
          {loadStatus && <span className="text-xs text-green-400">{loadStatus}</span>}
          {loadError && <span className="text-xs text-red-400">{loadError}</span>}
          <button
            onClick={fitToView}
            className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-sm font-medium transition-colors"
          >
            Fit view
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas */}
        <div className="relative flex-1 bg-gradient-to-br from-slate-900 to-slate-950 overflow-hidden">
          <canvas
            ref={canvasRef}
            className="w-full h-full cursor-grab active:cursor-grabbing"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onClick={handleClick}
          />
          <p className="absolute bottom-3 left-3 text-xs text-slate-500 pointer-events-none select-none">
            Scroll to zoom · Drag to pan · Click node to inspect
          </p>
        </div>

        {/* Side panel */}
        <aside className="w-80 shrink-0 bg-slate-900 border-l border-slate-800 flex flex-col overflow-hidden">
          {/* Node details */}
          <div className="p-3 border-b border-slate-800">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">
              Selected system
            </h2>
            {selected ? (
              <div className="space-y-2">
                <p className="font-semibold text-sky-400 text-sm">{selected.id}</p>
                {selected.desc && (
                  <p className="text-xs text-slate-300">{selected.desc}</p>
                )}
                {selected.kpis && Object.keys(selected.kpis).length > 0 && (
                  <div className="mt-1">
                    <p className="text-xs font-medium text-slate-400 mb-1">KPIs</p>
                    <dl className="grid grid-cols-2 gap-x-2 gap-y-1">
                      {Object.entries(selected.kpis).map(([k, v]) => (
                        <div key={k} className="contents">
                          <dt className="text-xs text-slate-400 truncate">{k}</dt>
                          <dd className="text-xs font-semibold text-slate-200">{String(v)}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}
                <div className="flex gap-4 mt-1">
                  <div>
                    <p className="text-xs font-medium text-slate-400 mb-1">Inputs</p>
                    {inputs.length ? (
                      inputs.map((l) => (
                        <div key={l.from} className="flex items-center gap-1 text-xs">
                          <span
                            className="inline-block w-2 h-2 rounded-full"
                            style={{ background: statusColor(l.status) }}
                          />
                          <span className="text-slate-300">
                            {l.from}
                            {l.rate !== undefined ? ` · ${l.rate}/min` : ''}
                          </span>
                        </div>
                      ))
                    ) : (
                      <span className="text-xs text-slate-500">—</span>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-400 mb-1">Outputs</p>
                    {outputs.length ? (
                      outputs.map((l) => (
                        <div key={l.to} className="flex items-center gap-1 text-xs">
                          <span
                            className="inline-block w-2 h-2 rounded-full"
                            style={{ background: statusColor(l.status) }}
                          />
                          <span className="text-slate-300">
                            {l.to}
                            {l.rate !== undefined ? ` · ${l.rate}/min` : ''}
                          </span>
                        </div>
                      ))
                    ) : (
                      <span className="text-xs text-slate-500">—</span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">Click a node on the canvas…</p>
            )}
          </div>

          {/* JSON editor */}
          <div className="flex flex-col flex-1 p-3 overflow-hidden">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">
              Manual data (JSON)
            </h2>
            <textarea
              className="flex-1 w-full bg-slate-950 border border-slate-700 rounded p-2 text-xs font-mono text-slate-200 placeholder-slate-600 resize-none focus:outline-none focus:ring-1 focus:ring-sky-500 overflow-auto"
              spellCheck={false}
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
            />
            {jsonError && (
              <p className="text-xs text-red-400 mt-1 truncate" title={jsonError}>
                {jsonError}
              </p>
            )}
            <button
              onClick={handleApplyJson}
              className="mt-2 w-full py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded text-sm font-medium transition-colors"
            >
              Apply JSON
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}
