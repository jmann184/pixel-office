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
    { id: 'lead', name: 'BEA', role: 'lead', status: 'edit', atDesk: true, movedAt: 0, isWalking: false, doing: '' },
    { id: 'crew0', name: 'OTTO', role: 'crew', status: 'read', atDesk: true, movedAt: 0, isWalking: false, doing: '' },
    { id: 'crew1', name: 'MAE', role: 'crew', status: 'idle', atDesk: false, movedAt: 0, isWalking: false, doing: 'Making toast' },
    { id: 'a1', name: 'IVY', role: 'helper', status: 'run', atDesk: true, movedAt: 0, isWalking: false, doing: '' },
  ],
}

test('the office draws the building with a chip each', async ($, on) => {
  on('state.get', () => ({ value: { value: { shape: 'board-4', value: BOARD }, version: 1 } }))

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /OTTO/ }))?.text).toBe('· OTTO · Reading')
  expect((await ui.find({ type: 'Text', text: /IVY/ }))?.text).toBe('· IVY (helper) · Running')
  const svg = await ui.find({ type: 'Svg' })
  expect(String(svg?.props.source)).toContain('SAMPLE PROJECT OFFICE')
  expect((await ui.find({ type: 'Text', text: /MAE/ }))?.text).toBe('· MAE · Making toast')
  // MAE is in the break room, strolling.
  expect(String(svg?.props.source)).toContain('class="s2"')
  await ui.unmount()
})

test('the terminal gets the heading and chips alone', async ($, on) => {
  on('state.get', () => ({ value: { value: { shape: 'board-4', value: BOARD }, version: 1 } }))

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /Office/ }))?.text).toBe('Sample Project Office')
  expect((await ui.find({ type: 'Text', text: /BEA/ }))?.text).toBe('■ BEA · Editing')
  await ui.unmount()
})

test('/office names saves the names for every chat', async ($, on) => {
  let saved: unknown
  on('command.register', () => ({ value: { command: 'office' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('store.get', () => ({ value: saved }))
  on('store.set', (_, e) => {
    saved = e.value
    return { value: undefined }
  })

  await $.session.start({ cwd: '/work/my-project', surface: 'desktop', isInteractive: true })
  const ran = await $.command.run({ command: 'office', args: 'names Dave, Sue, Max, Lily' })
  expect(ran.text).toContain('Dave, Sue, Max, Lily')
  expect(saved).toEqual(['Dave', 'Sue', 'Max', 'Lily'])
})

test('/office names also takes names with only spaces between', async ($, on) => {
  let saved: unknown
  on('command.register', () => ({ value: { command: 'office' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('store.get', () => ({ value: saved }))
  on('store.set', (_, e) => {
    saved = e.value
    return { value: undefined }
  })

  await $.session.start({ cwd: '/work/my-project', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'office', args: 'names Dave Sue Max Lily' })
  expect(saved).toEqual(['Dave', 'Sue', 'Max', 'Lily'])
})
