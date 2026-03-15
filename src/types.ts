/** A named port (input or output slot) on a system node */
export interface PortDef {
  /** Reusable port name, e.g. "Orders" – same name can appear on multiple nodes */
  name: string
  /** Importance weight 1–10 (higher = more critical to the system) */
  wertigkeit: number
  /** Minimum acceptable flow rate; displayed as a threshold bar in the panel */
  threshold?: number
  /** Display order among sibling ports (ascending = first) */
  order: number
  /** Optional unit label shown alongside the rate, e.g. "orders/day" */
  unit?: string
}

export interface NodeData {
  id: string
  x: number
  y: number
  desc?: string
  kpis?: Record<string, string | number>
  /** Named input ports – receive flow from other nodes or from outside */
  inputs?: PortDef[]
  /** Named output ports – send flow to other nodes or to outside */
  outputs?: PortDef[]
}

export type LinkStatus = 'ok' | 'warning' | 'error'

export interface LinkData {
  /** Source node id, or '_external_' for an environment/outside source */
  from: string
  /** Output port name on the source node */
  fromPort?: string
  /** Target node id, or '_external_' for an environment/outside sink */
  to: string
  /** Input port name on the target node */
  toPort?: string
  rate?: number
  color?: string
  status?: LinkStatus
}

export interface FlowData {
  nodes: NodeData[]
  links: LinkData[]
}
