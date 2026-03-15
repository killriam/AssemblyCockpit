# AssemblyCockpit

An interactive **2D "systems flow" dashboard** built with React 18, TypeScript, and Vite. Visualise how systems or departments in your organisation exchange information, work items, or value — with animated flow markers, real-time status colours, pan/zoom, and an editable data panel.

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
interface NodeData {
  id: string          // unique identifier / display label
  x: number           // canvas X position (arbitrary units)
  y: number           // canvas Y position (arbitrary units)
  desc?: string       // optional description
  kpis?: Record<string, string | number>  // optional KPI badges
}

type LinkStatus = 'ok' | 'warning' | 'error'

interface LinkData {
  from: string        // source node id
  to: string          // target node id
  rate?: number       // flow rate (displayed as "/min")
  color?: string      // override link colour (CSS colour string)
  status?: LinkStatus // drives colour: ok=green, warning=amber, error=red
}

interface FlowData {
  nodes: NodeData[]
  links: LinkData[]
}
```

### Minimal example

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
| **Animated markers** | Multiple particles travel along each link, speed/colour driven by status |
| **Status colours** | `ok` → green · `warning` → amber · `error` → red · none → grey |
| **Rate labels** | Link rates rendered along the midpoint of each edge |
| **Pan & zoom** | Drag to pan · scroll-wheel to zoom · Fit-view button to reset |
| **Node selection** | Click any node to see its description, KPIs, and input/output rates in the side panel |
| **Manual JSON editor** | Edit the JSON directly in the side panel and click **Apply JSON** |
| **Load from URL** | Enter a URL that returns `FlowData` JSON and click **Load** (requires CORS) |
| **Sample data** | A 4-node / 4-link sample is shown on first load |

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
    ├── types.ts          # NodeData, LinkData, FlowData, LinkStatus
    └── data/
        └── sampleData.ts # Built-in sample flow
```
