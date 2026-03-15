# AssemblyCockpit

An interactive **2D "systems flow" dashboard** built with React 18, TypeScript, and Vite. Visualise how systems or departments in your organisation exchange information, work items, or value — with animated flow markers, real-time status colours, configurable ports, and an editable data panel.

---

## Quick start

```bash
npm install
npm run dev
```

Open the URL shown in the terminal (default: http://localhost:5173).

### Other scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start the development server |
| `npm run build` | Type-check + production build (output in `dist/`) |
| `npm run preview` | Serve the production build locally |

---

## Data shape

All data is typed via `src/types.ts`.

```ts
/** A named port (input or output slot) on a system node */
interface PortDef {
  name: string          // reusable port name, e.g. "Orders" (same name can appear on multiple nodes)
  wertigkeit: number    // importance weight 1–10 (higher = more critical)
  threshold?: number    // minimum acceptable flow rate; displayed as a progress bar
  order: number         // display order among sibling ports (ascending = first)
  unit?: string         // unit label, e.g. "orders/day"
}

interface NodeData {
  id: string            // unique identifier / display label
  x: number             // canvas X position (arbitrary units)
  y: number             // canvas Y position (arbitrary units)
  desc?: string         // optional description
  kpis?: Record<string, string | number>  // optional KPI badges
  inputs?: PortDef[]    // named input ports (receive flow from nodes or from outside)
  outputs?: PortDef[]   // named output ports (send flow to nodes or to outside)
}

type LinkStatus = 'ok' | 'warning' | 'error'

interface LinkData {
  from: string          // source node id, or '_external_' for an outside/environment source
  fromPort?: string     // output port name on the source node
  to: string            // target node id, or '_external_' for an outside/environment sink
  toPort?: string       // input port name on the target node
  rate?: number         // flow rate (shown on link label)
  color?: string        // override link colour (CSS colour string)
  status?: LinkStatus   // drives colour: ok=green, warning=amber, error=red
}

interface FlowData {
  nodes: NodeData[]
  links: LinkData[]
}
```

### Full example (with ports and external connections)

```json
{
  "nodes": [
    {
      "id": "Sales",
      "x": 150, "y": 220,
      "desc": "Captures customer orders.",
      "inputs":  [{ "name": "Leads",  "wertigkeit": 9, "threshold": 20, "order": 1, "unit": "leads/day" }],
      "outputs": [{ "name": "Orders", "wertigkeit": 10, "threshold": 15, "order": 1, "unit": "orders/day" }]
    },
    {
      "id": "Fulfillment",
      "x": 470, "y": 360,
      "desc": "Picks, packs, and ships orders.",
      "inputs":  [{ "name": "Orders", "wertigkeit": 10, "threshold": 15, "order": 1, "unit": "orders/day" }],
      "outputs": [{ "name": "Shipments", "wertigkeit": 9, "threshold": 12, "order": 1, "unit": "shipments/day" }]
    }
  ],
  "links": [
    { "from": "_external_", "to": "Sales",       "toPort": "Leads",    "rate": 25,  "status": "ok" },
    { "from": "Sales", "fromPort": "Orders", "to": "Fulfillment", "toPort": "Orders", "rate": 11, "status": "warning" },
    { "from": "Fulfillment", "fromPort": "Shipments", "to": "_external_",  "rate": 10, "status": "ok" }
  ]
}
```

> **Tip:** `"_external_"` is a reserved id for connections that originate outside your defined systems (environment, customers, suppliers). It renders as a small diamond marker on the canvas with a dashed link.

### Minimal example (no ports — backward-compatible)

```json
{
  "nodes": [
    { "id": "Sales",       "x": 100, "y": 200 },
    { "id": "Fulfillment", "x": 400, "y": 200 }
  ],
  "links": [
    { "from": "Sales", "to": "Fulfillment", "rate": 95, "status": "ok" }
  ]
}
```

---

## Features

| Feature | Detail |
|---------|--------|
| **Canvas rendering** | Nodes and links drawn on an HTML5 `<canvas>` for smooth 60 fps animation |
| **Named ports** | Each node can declare typed input/output ports; links route to specific port positions |
| **Wertigkeit** | Each port has a weight (1–10) shown as a coloured badge; drives link thickness on canvas |
| **Threshold bars** | Per-port minimum threshold visualised as a green/red progress bar in the side panel |
| **Port order** | Ports sort by `order` field; displayed top-to-bottom in the panel and spread around the node |
| **External connections** | Use `"_external_"` as `from`/`to` to model flow from/to outside the system boundary |
| **Animated markers** | Particles travel along each link; colour driven by `status` |
| **Status colours** | `ok` → green · `warning` → amber · `error` → red · none → grey |
| **Rate labels** | Port name + rate shown at link midpoints |
| **Pan & zoom** | Drag to pan · scroll-wheel to zoom · Fit-view button to reset |
| **Node selection** | Click any node to see desc, KPIs, port table with rates and threshold bars |
| **Manual JSON editor** | Edit the JSON directly in the side panel and click **Apply JSON** |
| **Load from URL** | Enter a URL that returns `FlowData` JSON and click **Load** (requires CORS) |
| **Backward-compatible** | Nodes/links without port definitions still render correctly |

---

## Project structure

```
AssemblyCockpit/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
└── src/
    ├── main.tsx          # React entry point
    ├── App.tsx           # Main component (canvas, side panel, editors)
    ├── index.css         # Tailwind base + global styles
    ├── types.ts          # PortDef, NodeData, LinkData, FlowData, LinkStatus
    └── data/
        └── sampleData.ts # Built-in 4-node sample with ports and external connections
```
