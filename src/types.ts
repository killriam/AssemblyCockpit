export interface NodeData {
  id: string
  x: number
  y: number
  desc?: string
  kpis?: Record<string, string | number>
}

export type LinkStatus = 'ok' | 'warning' | 'error'

export interface LinkData {
  from: string
  to: string
  rate?: number
  color?: string
  status?: LinkStatus
}

export interface FlowData {
  nodes: NodeData[]
  links: LinkData[]
}
