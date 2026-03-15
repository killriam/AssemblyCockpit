import { FlowData } from '../types'

const sampleData: FlowData = {
  nodes: [
    {
      id: 'Sales',
      x: 150,
      y: 220,
      desc: 'Captures customer orders and manages the sales pipeline.',
      kpis: { 'Open deals': 42, 'Win rate': '68%' },
      inputs: [
        { name: 'Leads', wertigkeit: 9, threshold: 20, order: 1, unit: 'leads/day' },
      ],
      outputs: [
        { name: 'Orders', wertigkeit: 10, threshold: 15, order: 1, unit: 'orders/day' },
        { name: 'Invoice requests', wertigkeit: 6, threshold: 8, order: 2, unit: 'reqs/day' },
      ],
    },
    {
      id: 'Finance',
      x: 470,
      y: 80,
      desc: 'Handles billing, invoicing, and financial reporting.',
      kpis: { 'Invoices/month': 310, 'Overdue': 12 },
      inputs: [
        { name: 'Invoice requests', wertigkeit: 6, threshold: 8, order: 1, unit: 'reqs/day' },
      ],
      outputs: [
        { name: 'Invoices', wertigkeit: 8, threshold: 10, order: 1, unit: 'invoices/day' },
      ],
    },
    {
      id: 'Fulfillment',
      x: 470,
      y: 360,
      desc: 'Picks, packs, and ships customer orders.',
      kpis: { 'Orders/day': 95, 'On-time rate': '94%' },
      inputs: [
        { name: 'Orders', wertigkeit: 10, threshold: 15, order: 1, unit: 'orders/day' },
        { name: 'Stock', wertigkeit: 8, threshold: 50, order: 2, unit: 'units/day' },
      ],
      outputs: [
        { name: 'Shipments', wertigkeit: 9, threshold: 12, order: 1, unit: 'shipments/day' },
      ],
    },
    {
      id: 'Support',
      x: 790,
      y: 220,
      desc: 'Handles post-sales customer support and escalations.',
      kpis: { 'Open tickets': 18, 'CSAT': '4.6/5' },
      inputs: [
        { name: 'Invoices', wertigkeit: 4, threshold: 5, order: 1, unit: 'invoices/day' },
        { name: 'Shipments', wertigkeit: 7, threshold: 12, order: 2, unit: 'shipments/day' },
      ],
      outputs: [
        { name: 'Resolved tickets', wertigkeit: 8, threshold: 15, order: 1, unit: 'tickets/day' },
      ],
    },
  ],
  links: [
    // External leads flow into Sales
    { from: '_external_', to: 'Sales', toPort: 'Leads', rate: 25, status: 'ok' },
    // Sales sends orders to Fulfillment – rate is below threshold → warning
    { from: 'Sales', fromPort: 'Orders', to: 'Fulfillment', toPort: 'Orders', rate: 11, status: 'warning' },
    // Sales sends invoice requests to Finance – healthy
    { from: 'Sales', fromPort: 'Invoice requests', to: 'Finance', toPort: 'Invoice requests', rate: 12, status: 'ok' },
    // External stock supply to Fulfillment – healthy
    { from: '_external_', to: 'Fulfillment', toPort: 'Stock', rate: 200, status: 'ok' },
    // Finance sends invoices to Support – healthy
    { from: 'Finance', fromPort: 'Invoices', to: 'Support', toPort: 'Invoices', rate: 10, status: 'ok' },
    // Fulfillment shipments to Support – rate below threshold → error
    { from: 'Fulfillment', fromPort: 'Shipments', to: 'Support', toPort: 'Shipments', rate: 6, status: 'error' },
    // Support resolved tickets go outside
    { from: 'Support', fromPort: 'Resolved tickets', to: '_external_', rate: 22, status: 'ok' },
  ],
}

export default sampleData
