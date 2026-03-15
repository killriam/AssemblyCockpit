import { useRef, useEffect, useCallback, useState } from 'react'
import { FlowData, NodeData, LinkData, PortDef } from './types'
import sampleData from './data/sampleData'

// ─── Constants ───────────────────────────────────────────────────────────────

const NODE_RADIUS = 28
const PARTICLE_COUNT = 3
const EXT_DIST = 100      // distance of external placeholder from port
const STATUS_COLORS: Record<string, string> = {
  ok: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  default: '#64748b',
}

// ─── Port helpers ────────────────────────────────────────────────────────────

function wertigkeitColor(w: number): string {
  if (w >= 8) return '#22c55e'
  if (w >= 5) return '#f59e0b'
  return '#94a3b8'
}

/** Spread `count` ports evenly across ±60° around a center angle */
function portAngle(idx: number, count: number, center: number): number {
  if (count <= 1) return center
  return center + ((idx / (count - 1)) - 0.5) * (Math.PI / 1.5)
}

/** World position of a named port on the node's circle perimeter */
function portPos(
  node: NodeData,
  portName: string,
  direction: 'in' | 'out',
): { x: number; y: number } {
  const ports = ((direction === 'in' ? node.inputs : node.outputs) ?? [])
    .slice()
    .sort((a, b) => a.order - b.order)
  const idx = ports.findIndex((p) => p.name === portName)
  const center = direction === 'in' ? Math.PI : 0
  const angle = portAngle(Math.max(0, idx), Math.max(1, ports.length), center)
  return {
    x: node.x + Math.cos(angle) * NODE_RADIUS,
    y: node.y + Math.sin(angle) * NODE_RADIUS,
  }
}

/** Position of an external placeholder: EXT_DIST further outward from the port */
function extPos(
  refNode: NodeData,
  connectedPos: { x: number; y: number },
): { x: number; y: number } {
  const angle = Math.atan2(connectedPos.y - refNode.y, connectedPos.x - refNode.x)
  return {
    x: connectedPos.x + Math.cos(angle) * EXT_DIST,
    y: connectedPos.y + Math.sin(angle) * EXT_DIST,
  }
}

/** Compute the start and end world positions for a link, accounting for ports and external nodes */
function getLinkEndpoints(
  link: LinkData,
  nodeMap: Map<string, NodeData>,
): {
  start: { x: number; y: number }
  end: { x: number; y: number }
  isFromExt: boolean
  isToExt: boolean
} | null {
  const isFromExt = link.from === '_external_'
  const isToExt = link.to === '_external_'
  const a = isFromExt ? null : nodeMap.get(link.from)
  const b = isToExt ? null : nodeMap.get(link.to)
  if (!isFromExt && !a) return null
  if (!isToExt && !b) return null

  let aAnchor: { x: number; y: number } | null = null
  if (a) {
    if (link.fromPort) {
      aAnchor = portPos(a, link.fromPort, 'out')
    } else {
      const tx = b?.x ?? a.x + NODE_RADIUS
      const ty = b?.y ?? a.y
      const dx = tx - a.x
      const dy = ty - a.y
      const len = Math.sqrt(dx * dx + dy * dy) || 1
      aAnchor = { x: a.x + (dx / len) * NODE_RADIUS, y: a.y + (dy / len) * NODE_RADIUS }
    }
  }

  let bAnchor: { x: number; y: number } | null = null
  if (b) {
    if (link.toPort) {
      bAnchor = portPos(b, link.toPort, 'in')
    } else {
      const sx = a?.x ?? b.x - NODE_RADIUS
      const sy = a?.y ?? b.y
      const dx = sx - b.x
      const dy = sy - b.y
      const len = Math.sqrt(dx * dx + dy * dy) || 1
      bAnchor = { x: b.x + (dx / len) * NODE_RADIUS, y: b.y + (dy / len) * NODE_RADIUS }
    }
  }

  if (isFromExt) {
    const ep = extPos(b!, bAnchor!)
    return { start: ep, end: bAnchor!, isFromExt: true, isToExt: false }
  }
  if (isToExt) {
    const ep = extPos(a!, aAnchor!)
    return { start: aAnchor!, end: ep, isFromExt: false, isToExt: true }
  }
  return { start: aAnchor!, end: bAnchor!, isFromExt: false, isToExt: false }
}

// ─── Canvas draw helpers ─────────────────────────────────────────────────────

function statusColor(status?: string): string {
  return STATUS_COLORS[status ?? 'default'] ?? STATUS_COLORS['default']
}

function drawArrowhead(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
  zoom: number,
) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len < 1) return
  const ux = dx / len
  const uy = dy / len
  const aLen = 9 / zoom
  const aW = 5 / zoom
  ctx.beginPath()
  ctx.moveTo(to.x, to.y)
  ctx.lineTo(to.x - ux * aLen + uy * aW, to.y - uy * aLen - ux * aW)
  ctx.lineTo(to.x - ux * aLen - uy * aW, to.y - uy * aLen + ux * aW)
  ctx.closePath()
  ctx.fill()
}

function drawDiamond(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x, y - r)
  ctx.lineTo(x + r, y)
  ctx.lineTo(x, y + r)
  ctx.lineTo(x - r, y)
  ctx.closePath()
}

// ─── Small UI components ─────────────────────────────────────────────────────

function WertigkeitBadge({ value }: { value: number }) {
  const cls =
    value >= 8
      ? 'bg-green-900/60 text-green-400'
      : value >= 5
        ? 'bg-amber-900/60 text-amber-400'
        : 'bg-slate-800 text-slate-400'
  return (
    <span
      className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold leading-none shrink-0 ${cls}`}
      title="Wertigkeit (importance 1–10)"
    >
      {value}
    </span>
  )
}

function ThresholdBar({ rate, threshold }: { rate?: number; threshold?: number }) {
  if (threshold === undefined || rate === undefined) return null
  const pct = threshold > 0 ? Math.min(100, Math.round((rate / threshold) * 100)) : 100
  const ok = rate >= threshold
  return (
    <div className="flex items-center gap-1 mt-0.5">
      <div className="flex-1 h-1 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${ok ? 'bg-green-500' : 'bg-red-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-[10px] font-mono w-7 text-right shrink-0 ${ok ? 'text-green-400' : 'text-red-400'}`}>
        {pct}%
      </span>
    </div>
  )
}

/** Sum of rates flowing into/out of a specific named port */
function portCurrentRate(
  portName: string,
  nodeId: string,
  direction: 'in' | 'out',
  links: LinkData[],
): number | undefined {
  const matching = links.filter((l) =>
    direction === 'in'
      ? l.to === nodeId && l.toPort === portName
      : l.from === nodeId && l.fromPort === portName,
  )
  const rates = matching.flatMap((l) => (l.rate !== undefined ? [l.rate] : []))
  if (rates.length === 0) return undefined
  return rates.reduce((a, b) => a + b, 0)
}

function PortSection({
  ports,
  direction,
  nodeId,
  links,
}: {
  ports: PortDef[]
  direction: 'in' | 'out'
  nodeId: string
  links: LinkData[]
}) {
  const sorted = [...ports].sort((a, b) => a.order - b.order)
  return (
    <div>
      <p className="text-xs font-medium text-slate-400 mb-1.5">
        {direction === 'in' ? '← Inputs' : 'Outputs →'}
      </p>
      <div className="space-y-1.5">
        {sorted.map((port) => {
          const rate = portCurrentRate(port.name, nodeId, direction, links)
          return (
            <div key={port.name} className="bg-slate-950 rounded p-1.5 space-y-0.5">
              <div className="flex items-center gap-1.5">
                <WertigkeitBadge value={port.wertigkeit} />
                <span className="text-xs font-medium text-slate-200 flex-1 truncate" title={port.name}>
                  {port.name}
                </span>
                {rate !== undefined && (
                  <span className="text-[11px] font-mono text-slate-300 shrink-0">
                    {rate} <span className="text-slate-500">{port.unit ?? '/min'}</span>
                  </span>
                )}
              </div>
              {port.threshold !== undefined && (
                <>
                  <ThresholdBar rate={rate} threshold={port.threshold} />
                  <p className="text-[10px] text-slate-500">
                    min&nbsp;{port.threshold}&nbsp;{port.unit ?? '/min'}
                  </p>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
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

  // keep ref in sync so canvas loop can read without stale closure issues
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
    const dataW = maxX - minX + NODE_RADIUS * 4 + EXT_DIST * 2
    const dataH = maxY - minY + NODE_RADIUS * 4 + EXT_DIST * 2
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

  // ─── mouse events ────────────────────────────────────────────────────────

  const screenToWorld = (sx: number, sy: number) => ({
    x: (sx - offsetRef.current.x) / zoomRef.current,
    y: (sy - offsetRef.current.y) / zoomRef.current,
  })

  const hitTest = (wx: number, wy: number): NodeData | undefined =>
    flowRef.current.nodes.find((n) => {
      const dx = n.x - wx
      const dy = n.y - wy
      return dx * dx + dy * dy < NODE_RADIUS * NODE_RADIUS
    })

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

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const world = screenToWorld(e.clientX - rect.left, e.clientY - rect.top)
      setSelected(hitTest(world.x, world.y) ?? null)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

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

      const nodeMap = new Map(nodes.map((n) => [n.id, n]))

      // ── links ──────────────────────────────────────────────────────────
      links.forEach((link: LinkData, idx: number) => {
        const ep = getLinkEndpoints(link, nodeMap)
        if (!ep) return

        const { start, end, isFromExt, isToExt } = ep
        const color = link.color ?? statusColor(link.status)

        // Line width from fromPort wertigkeit
        const srcNode = nodeMap.get(link.from)
        const fromPort = srcNode && link.fromPort
          ? (srcNode.outputs ?? []).find((p) => p.name === link.fromPort)
          : null
        const lineW = fromPort ? 0.8 + (fromPort.wertigkeit - 1) * 0.22 : 1.5

        ctx.strokeStyle = color
        ctx.lineWidth = lineW / z
        ctx.globalAlpha = 0.6
        if (isFromExt || isToExt) ctx.setLineDash([6 / z, 4 / z])

        ctx.beginPath()
        ctx.moveTo(start.x, start.y)
        ctx.lineTo(end.x, end.y)
        ctx.stroke()

        ctx.setLineDash([])
        ctx.globalAlpha = 1

        // Arrowhead at end
        ctx.fillStyle = color
        drawArrowhead(ctx, start, end, z)

        // External diamond marker
        if (isFromExt) {
          drawDiamond(ctx, start.x, start.y, 7 / z)
          ctx.fillStyle = '#334155'
          ctx.fill()
          ctx.strokeStyle = color
          ctx.lineWidth = 1.5 / z
          ctx.stroke()
          ctx.fillStyle = '#94a3b8'
          ctx.font = `${9 / z}px Inter,system-ui,sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'bottom'
          ctx.fillText('Ext', start.x, start.y - 9 / z)
        }
        if (isToExt) {
          drawDiamond(ctx, end.x, end.y, 7 / z)
          ctx.fillStyle = '#334155'
          ctx.fill()
          ctx.strokeStyle = color
          ctx.lineWidth = 1.5 / z
          ctx.stroke()
          ctx.fillStyle = '#94a3b8'
          ctx.font = `${9 / z}px Inter,system-ui,sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'top'
          ctx.fillText('Ext', end.x, end.y + 9 / z)
        }

        // Animated particles
        ctx.globalAlpha = 0.85
        for (let p = 0; p < PARTICLE_COUNT; p++) {
          const phase = ((time / 900 + idx * 0.37 + p / PARTICLE_COUNT) % 1 + 1) % 1
          const px = start.x + (end.x - start.x) * phase
          const py = start.y + (end.y - start.y) * phase
          ctx.beginPath()
          ctx.arc(px, py, 3.5 / z, 0, Math.PI * 2)
          ctx.fillStyle = color
          ctx.fill()
        }
        ctx.globalAlpha = 1

        // Rate + port label
        const mx = (start.x + end.x) / 2
        const my = (start.y + end.y) / 2
        const labelParts: string[] = []
        if (link.fromPort) labelParts.push(link.fromPort)
        if (link.rate !== undefined) labelParts.push(`${link.rate}/min`)
        if (labelParts.length > 0) {
          ctx.font = `${11 / z}px Inter,system-ui,sans-serif`
          ctx.fillStyle = '#94a3b8'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'bottom'
          ctx.fillText(labelParts.join(' · '), mx, my - 4 / z)
        }
      })

      // ── nodes ──────────────────────────────────────────────────────────
      nodes.forEach((node: NodeData) => {
        const isSel = selected?.id === node.id

        if (isSel) {
          ctx.shadowColor = '#38bdf8'
          ctx.shadowBlur = 18 / z
        }

        ctx.beginPath()
        ctx.arc(node.x, node.y, NODE_RADIUS, 0, Math.PI * 2)
        ctx.fillStyle = isSel ? '#1e40af' : '#1d4ed8'
        ctx.fill()

        ctx.lineWidth = 2 / z
        ctx.strokeStyle = isSel ? '#38bdf8' : '#60a5fa'
        ctx.stroke()
        ctx.shadowBlur = 0

        ctx.font = `bold ${11 / z}px Inter,system-ui,sans-serif`
        ctx.fillStyle = '#e2e8f0'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(node.id, node.x, node.y)

        // Port dots
        const allPorts = [
          ...(node.inputs ?? []).map((p) => ({ ...p, dir: 'in' as const })),
          ...(node.outputs ?? []).map((p) => ({ ...p, dir: 'out' as const })),
        ]
        allPorts.forEach((port) => {
          const sorted = (port.dir === 'in' ? node.inputs : node.outputs)!
            .slice()
            .sort((a, b) => a.order - b.order)
          const idx = sorted.findIndex((p) => p.name === port.name)
          const center = port.dir === 'in' ? Math.PI : 0
          const angle = portAngle(idx, sorted.length, center)
          const px = node.x + Math.cos(angle) * NODE_RADIUS
          const py = node.y + Math.sin(angle) * NODE_RADIUS

          ctx.beginPath()
          ctx.arc(px, py, 4 / z, 0, Math.PI * 2)
          ctx.fillStyle = wertigkeitColor(port.wertigkeit)
          ctx.fill()
          ctx.lineWidth = 1 / z
          ctx.strokeStyle = '#0f172a'
          ctx.stroke()
        })
      })

      animRef.current = requestAnimationFrame(render)
    }

    animRef.current = requestAnimationFrame(render)
    return () => cancelAnimationFrame(animRef.current)
  }, [selected])

  // ─── Side panel helpers ───────────────────────────────────────────────────

  const simpleInputs = selected ? flowData.links.filter((l) => l.to === selected.id) : []
  const simpleOutputs = selected ? flowData.links.filter((l) => l.from === selected.id) : []
  const hasPorts = selected && ((selected.inputs?.length ?? 0) + (selected.outputs?.length ?? 0) > 0)

  // ─── render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-100">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 bg-slate-950 border-b border-slate-800 shrink-0">
        <h1 className="text-lg font-semibold tracking-tight text-sky-400">AssemblyCockpit</h1>
        <div className="flex items-center gap-2">
          <input
            className="w-72 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            placeholder="Data URL (CORS-enabled)"
            value={dataUrl}
            onChange={(e) => setDataUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleLoadUrl()
            }}
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
          <div className="p-3 border-b border-slate-800 overflow-y-auto flex-1">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">
              Selected system
            </h2>

            {selected ? (
              <div className="space-y-3">
                <p className="font-semibold text-sky-400 text-sm">{selected.id}</p>

                {selected.desc && (
                  <p className="text-xs text-slate-300 leading-relaxed">{selected.desc}</p>
                )}

                {selected.kpis && Object.keys(selected.kpis).length > 0 && (
                  <div>
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

                {/* Port-aware detail */}
                {hasPorts ? (
                  <div className="space-y-3">
                    {selected.inputs && selected.inputs.length > 0 && (
                      <PortSection
                        ports={selected.inputs}
                        direction="in"
                        nodeId={selected.id}
                        links={flowData.links}
                      />
                    )}
                    {selected.outputs && selected.outputs.length > 0 && (
                      <PortSection
                        ports={selected.outputs}
                        direction="out"
                        nodeId={selected.id}
                        links={flowData.links}
                      />
                    )}
                  </div>
                ) : (
                  /* Fallback: simple link-based view (backward-compat for data without ports) */
                  <div className="flex gap-4">
                    <div>
                      <p className="text-xs font-medium text-slate-400 mb-1">Inputs</p>
                      {simpleInputs.length ? (
                        simpleInputs.map((l) => (
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
                      {simpleOutputs.length ? (
                        simpleOutputs.map((l) => (
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
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-500">Click a node on the canvas…</p>
            )}
          </div>

          {/* JSON editor */}
          <div className="flex flex-col p-3 border-t border-slate-800 h-64 shrink-0">
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
