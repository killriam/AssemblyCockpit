import { FlowData } from '../types'

const sampleData: FlowData = {
  nodes: [
    {
      id: 'Sales',
      x: 120,
      y: 200,
      desc: 'Captures customer orders and manages the sales pipeline.',
      kpis: { 'Open deals': 42, 'Win rate': '68%' },
    },
    {
      id: 'Finance',
      x: 420,
      y: 100,
      desc: 'Handles billing, invoicing, and financial reporting.',
      kpis: { 'Invoices/month': 310, 'Overdue': 12 },
    },
    {
      id: 'Fulfillment',
      x: 420,
      y: 300,
      desc: 'Picks, packs, and ships customer orders.',
      kpis: { 'Orders/day': 95, 'On-time rate': '94%' },
    },
    {
      id: 'Support',
      x: 720,
      y: 200,
      desc: 'Handles post-sales customer support and escalations.',
      kpis: { 'Open tickets': 18, 'CSAT': '4.6/5' },
    },
  ],
  links: [
    { from: 'Sales', to: 'Finance', rate: 12, status: 'ok' },
    { from: 'Sales', to: 'Fulfillment', rate: 95, status: 'warning' },
    { from: 'Finance', to: 'Support', rate: 4, status: 'ok' },
    { from: 'Fulfillment', to: 'Support', rate: 8, status: 'error' },
  ],
}

export default sampleData
