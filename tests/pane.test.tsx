import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'pixel-office',
  component: 'Pane',
  requestId: 'pixel-office',
  props: {
    title: 'Pixel office',
    isFocused: false,
    bodyColumns: 44,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

const BOARD = {
  folder: 'Sample Project',
  workers: [
    { id: 'lead', name: 'BEA', role: 'lead', status: 'edit', atDesk: true, movedAt: 0, isWalking: false },
    { id: 'crew0', name: 'OTTO', role: 'crew', status: 'read', atDesk: true, movedAt: 0, isWalking: false },
    { id: 'crew1', name: 'MAE', role: 'crew', status: 'idle', atDesk: false, movedAt: 0, isWalking: false },
    { id: 'a1', name: 'IVY', role: 'helper', status: 'run', atDesk: true, movedAt: 0, isWalking: false },
  ],
}

test('the office draws the building with a chip each', async ($, on) => {
  on('state.get', () => ({ value: { value: { shape: 'board-3', value: BOARD }, version: 1 } }))

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /OTTO/ }))?.text).toBe('· OTTO · Reading')
  expect((await ui.find({ type: 'Text', text: /IVY/ }))?.text).toBe('· IVY (helper) · Running')
  const svg = await ui.find({ type: 'Svg' })
  expect(String(svg?.props.source)).toContain('SAMPLE PROJECT OFFICE')
  // MAE is in the break room, strolling.
  expect(String(svg?.props.source)).toContain('class="s2"')
  await ui.unmount()
})

test('the terminal gets the heading and chips alone', async ($, on) => {
  on('state.get', () => ({ value: { value: { shape: 'board-3', value: BOARD }, version: 1 } }))

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /Office/ }))?.text).toBe('Sample Project Office')
  expect((await ui.find({ type: 'Text', text: /BEA/ }))?.text).toBe('■ BEA · Editing')
  await ui.unmount()
})
