import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Board, Status, Worker } from '../types'
import { PEOPLE, SPRITES } from './sprites'
import type { SpriteName } from './sprites'

const PANE = 'pixel-office'
// Change the tag when Board's fields change: it declines what an earlier
// version stored, which outlives a reload.
const board = atom({ plugin: 'pixel-office', key: 'board' } as const, { folder: '', workers: [] } as Board, {
  shape: 'board-3',
})

const WALK_MS = 4500
const HELPER_LINGER_MS = 25_000
const MAX_SLOTS = 12
// How many actions in one reply bring in each extra crew member.
const CREW_AT = [5, 15, 30]
const NAMES = ['BEA', 'OTTO', 'MAE', 'RUFUS', 'IVY', 'GUS', 'NELL', 'FINN', 'LOLA', 'MILO', 'PIP', 'SAGE', 'ZED', 'MOSS', 'NOVA', 'RUNE']
const WORDS: Record<Status, string> = {
  idle: 'Idle',
  think: 'Thinking',
  read: 'Reading',
  edit: 'Editing',
  run: 'Running',
  error: 'Hit a snag',
}

type Person = { name: string; status: Status; atDesk: boolean; movedAt: number }
type Helper = Person & { id: string }

let folder = ''
let lead: Person | undefined
let crew: Person[] = []
let helpers: Helper[] = []
let nextName = 0
let actions = 0
// The kinds of this reply's latest actions, newest first: the crew take the older ones.
let recent: Status[] = []
let lastBoard = ''

function kindOf(tool: string): Status {
  if (/^(Read|Grep|Glob|WebFetch|WebSearch|LS)$/.test(tool)) return 'read'
  if (/^(Edit|Write|MultiEdit|NotebookEdit)$/.test(tool)) return 'edit'
  if (/^(Bash|PowerShell)$/.test(tool)) return 'run'

  return 'think'
}

function setStatus(p: Person, status: Status) {
  const atDesk = status !== 'idle'
  if (atDesk !== p.atDesk) {
    p.atDesk = atDesk
    p.movedAt = Date.now()
  }
  p.status = status
}

const person = (name: string): Person => ({ name, status: 'idle', atDesk: false, movedAt: 0 })
const takeName = () => NAMES[nextName++ % NAMES.length] ?? 'HELPER'

function findHelper(id: string) {
  return helpers.find(h => h.id === id)
}

// The bigger the job so far this reply, the more of the crew come in to work.
function staffCrew() {
  const wanted = CREW_AT.filter(n => actions >= n).length
  crew.forEach((c, j) => {
    const kind = recent[j + 1] ?? 'think'
    setStatus(c, j < wanted ? (kind === 'error' ? 'think' : kind) : 'idle')
  })
}

async function publish($: EngineInterface) {
  if (!lead) return
  const now = Date.now()
  const walking = (p: Person) => now - p.movedAt < WALK_MS
  const as = (p: Person, id: string, role: Worker['role']): Worker => ({
    id,
    name: p.name,
    role,
    status: p.status,
    atDesk: p.atDesk,
    movedAt: p.movedAt,
    isWalking: walking(p),
  })
  const next: Board = {
    folder,
    workers: [as(lead, 'lead', 'lead'), ...crew.map((c, j) => as(c, `crew${j}`, 'crew')), ...helpers.map(h => as(h, h.id, 'helper'))],
  }

  const key = JSON.stringify(next)
  if (key !== lastBoard) {
    lastBoard = key
    await update($, board, () => next)
  }
}

// ---- Drawing ---------------------------------------------------------------

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const ROOM_W = 118
const ROOM_H = 78
// The sign with the building's name sits above the offices.
const TOP = 22
// Everyone walks down the middle of the hallway.
const HALL_X = 150
const FLOOR = '#262E47'
const WOOD = '#8F6E53'
// People are drawn half again as big as the furniture tiles.
const PX = 1.5
// Strolling pace in the break room, in drawing units a second.
const STROLL = 22

type Point = { x: number; y: number }

const tile = (name: SpriteName, x: number, y: number, scale = 1) =>
  scale === 1 ? `<use href="#${name}" x="${x}" y="${y}"/>` : `<use href="#${name}" transform="translate(${x},${y}) scale(${scale})"/>`

const spriteDefs = () =>
  Object.entries(SPRITES)
    .map(([name, data]) => `<image id="${name}" width="16" height="16" href="${data}"/>`)
    .join('')

// One person, feet at 0,0, in sprite pixels (the caller scales by PX).
function figure(i: number, atDesk: boolean, extra = '') {
  const cup = atDesk ? '' : '<rect x="5" y="-7" width="2" height="3" fill="#F1EFE8"/>'

  return `<use href="#p${i % PEOPLE}" x="-8" y="-16"/>${cup}${extra}`
}

function layout(count: number) {
  const shown = Math.min(count, MAX_SLOTS)
  const rows = Math.ceil(Math.max(4, shown + (shown % 2)) / 2)
  const officesEnd = 8 + rows * (ROOM_H + 4) - 4
  const kt = officesEnd + 28

  return { slots: rows * 2, officesEnd, kt, H: kt + 112 }
}

// The drawing's height in its own 300-wide units, sign included.
function officeHeight(count: number) {
  return layout(count).H + TOP
}

const isRight = (i: number) => i % 2 === 1
const roomAt = (i: number): Point => ({ x: isRight(i) ? 174 : 8, y: 8 + Math.floor(i / 2) * (ROOM_H + 4) })
const deskSpot = (i: number): Point => ({ x: roomAt(i).x + 46, y: roomAt(i).y + 54 })

// Where people hang out in the break room: sink, fruit, coffee, fridge, the two chairs, the open floor.
const hangouts = (kt: number): Point[] => [
  { x: 40, y: kt + 58 },
  { x: 60, y: kt + 58 },
  { x: 104, y: kt + 56 },
  { x: 276, y: kt + 58 },
  { x: 188, y: kt + 64 },
  { x: 252, y: kt + 64 },
  { x: 220, y: kt + 90 },
  { x: 128, y: kt + 88 },
  { x: 44, y: kt + 92 },
]

type Stop = { t: number; p: Point }

// Each person's own loop round the break room: stroll to a spot, linger, move on.
function stroll(i: number, kt: number) {
  const spots = hangouts(kt)
  const n = spots.length
  const start = (i * 3) % n
  const order = [0, 2, 5, 1, 4].map(k => spots[(start + k) % n] as Point)
  const stops: Stop[] = []
  let t = 0
  order.forEach((p, j) => {
    stops.push({ t, p })
    t += 2500 + ((i * 7 + j * 3) % 5) * 800
    stops.push({ t, p })
    const to = order[(j + 1) % order.length] as Point
    t += (Math.hypot(to.x - p.x, to.y - p.y) / STROLL) * 1000
  })
  stops.push({ t, p: order[0] as Point })

  return { stops, total: t }
}

// Everyone's loop runs on the clock, offset per person, so the drawing and
// the walks to and from the desk agree on where someone is.
const strollClock = (i: number, now: number) => now + i * 1777

function strollAt(i: number, kt: number, now: number): Point {
  const { stops, total } = stroll(i, kt)
  const t = strollClock(i, now) % total
  for (let j = 1; j < stops.length; j++) {
    const a = stops[j - 1] as Stop
    const b = stops[j] as Stop
    if (t <= b.t) {
      const f = b.t > a.t ? (t - a.t) / (b.t - a.t) : 0

      return { x: a.p.x + (b.p.x - a.p.x) * f, y: a.p.y + (b.p.y - a.p.y) * f }
    }
  }

  return (stops[0] as Stop).p
}

function strollCss(i: number, kt: number, now: number) {
  const { stops, total } = stroll(i, kt)
  const steps = stops.map(({ t, p }) => `${((t / total) * 100).toFixed(2)}%{transform:translate(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px) scale(${PX})}`)
  const delay = (strollClock(i, now) % total) / 1000

  return `@keyframes s${i}{${steps.join('')}}.s${i}{animation:s${i} ${(total / 1000).toFixed(2)}s linear -${delay.toFixed(2)}s infinite}`
}

// Desk to break room: to the door, out into the hallway, down it, in the break room door, over to k.
function route(i: number, kt: number, k: Point): Point[] {
  const r = roomAt(i)
  const y = r.y + 66

  return [
    deskSpot(i),
    { x: deskSpot(i).x, y },
    { x: isRight(i) ? r.x + 8 : r.x + ROOM_W - 8, y },
    { x: HALL_X, y },
    { x: HALL_X, y: kt + 16 },
    { x: HALL_X, y: k.y },
    k,
  ]
}

function keyframes(name: string, pts: Point[]) {
  const cum = [0]
  for (let j = 1; j < pts.length; j++) {
    const a = pts[j - 1] as Point
    const b = pts[j] as Point
    cum.push((cum[j - 1] ?? 0) + Math.hypot(b.x - a.x, b.y - a.y))
  }
  const total = cum[cum.length - 1] || 1
  const steps = pts.map((p, j) => `${(((cum[j] ?? 0) / total) * 100).toFixed(1)}%{transform:translate(${p.x}px,${p.y}px) scale(${PX})}`)

  return `@keyframes ${name}{${steps.join('')}}`
}

function office({ folder, workers }: Board, now: number, width: number) {
  const shown = workers.slice(0, MAX_SLOTS)
  const { slots, officesEnd, kt, H: h } = layout(shown.length)
  const H = h + TOP
  const title = esc(`${folder.toUpperCase().slice(0, 22)} OFFICE`)

  const css: string[] = []
  const rooms: string[] = []
  const lounge: string[] = []
  const walkers: string[] = []

  for (let i = 0; i < slots; i++) {
    const r = roomAt(i)
    const w = shown[i]
    const live = w?.atDesk && !w.isWalking
    const dot = !w ? '#444441' : w.status === 'error' ? '#E24B4A' : w.atDesk ? '#5DCAA5' : '#888780'
    const label = w ? esc(w.name.slice(0, 15)) : 'EMPTY OFFICE'
    const role = w?.role === 'crew' ? 'crew' : w?.role === 'helper' ? 'helper agent' : ''
    const sub = role ? `<text x="${r.x + 8}" y="${r.y + 23}" class="sub">${role}</text>` : ''
    const plate = `<rect x="${r.x + 4}" y="${r.y + 4}" width="110" height="${sub ? 23 : 13}" fill="#141A2B" opacity=".85"/>`
    // The door is on the hallway side; the plant goes in the far corner.
    const wallX = isRight(i) ? r.x - 4 : r.x + ROOM_W
    const leafX = isRight(i) ? r.x : r.x + ROOM_W - 16
    const door = `<rect x="${wallX}" y="${r.y + 50}" width="4" height="20" fill="${FLOOR}"/><rect x="${leafX}" y="${r.y + 47}" width="16" height="3" fill="${WOOD}"/>`
    const pot = w?.role === 'lead' ? tile('plant', isRight(i) ? r.x + 94 : r.x + 4, r.y + 52, 1.25) : ''
    let seat = ''
    let onDesk = ''
    let screen = `<rect x="${r.x + 63}" y="${r.y + 43}" width="14" height="9" fill="${live ? '#378ADD' : '#0C447C'}"/>`
    if (w && live) {
      let extra = ''
      let cls = ''
      if (w.status === 'think') extra = '<g class="dots"><rect x="-5" y="-21" width="2" height="2" fill="#F1EFE8"/><rect x="-1" y="-21" width="2" height="2" fill="#F1EFE8"/><rect x="3" y="-21" width="2" height="2" fill="#F1EFE8"/></g>'
      if (w.status === 'error') extra = '<text x="0" y="-18" class="bang">!</text>'
      if (w.status === 'read') {
        cls = 'bob'
        onDesk = `<rect x="${r.x + 33}" y="${r.y + 52}" width="12" height="3" fill="#F1EFE8"/><rect x="${r.x + 34}" y="${r.y + 50}" width="10" height="2" fill="#D3D1C7"/>`
      }
      if (w.status === 'edit') {
        cls = 'typing'
        screen = `<rect class="flicker" x="${r.x + 63}" y="${r.y + 43}" width="14" height="9" fill="#85B7EB"/>`
      }
      if (w.status === 'run') screen += `<rect class="bar" x="${r.x + 64}" y="${r.y + 48}" width="12" height="2" fill="#5DCAA5"/>`
      seat = `<g transform="translate(${deskSpot(i).x},${deskSpot(i).y}) scale(${PX})"><g class="${cls}">${figure(i, true, extra)}</g></g>`
    }
    rooms.push(`<rect x="${r.x}" y="${r.y}" width="${ROOM_W}" height="${ROOM_H}" fill="url(#woodp)"/><rect x="${r.x}" y="${r.y}" width="${ROOM_W}" height="${ROOM_H}" fill="#0E1220" opacity=".3"/>${door}
${plate}<text x="${r.x + 8}" y="${r.y + 13}" class="lbl">${label}</text>${sub}<circle cx="${r.x + 108}" cy="${r.y + 10}" r="3" fill="${dot}"/>${pot}${seat}
${tile('deskL', r.x + 30, r.y + 50)}${tile('deskM', r.x + 46, r.y + 50)}${tile('deskR', r.x + 62, r.y + 50)}
<rect x="${r.x + 67}" y="${r.y + 52}" width="4" height="3" fill="#5F5E5A"/><rect x="${r.x + 62}" y="${r.y + 42}" width="16" height="11" fill="#2C2C2A"/>${screen}${onDesk}`)

    if (!w) continue
    if (w.isWalking) {
      // Leave from, or come back to, wherever the stroll has them.
      const path = route(i, kt, strollAt(i, kt, w.atDesk ? w.movedAt : w.movedAt + WALK_MS))
      if (w.atDesk) path.reverse()
      const delay = Math.min(WALK_MS, Math.max(0, now - w.movedAt)) / 1000
      css.push(`${keyframes(`m${i}`, path)}.w${i}{animation:m${i} ${WALK_MS / 1000}s linear -${delay}s 1 both}`)
      walkers.push(`<g class="w${i}"><g class="walk">${figure(i, w.atDesk)}</g></g>`)
    } else if (!w.atDesk) {
      css.push(strollCss(i, kt, now))
      lounge.push(`<g class="s${i}"><g class="sway" style="animation-delay:-${i * 0.7}s">${figure(i, false)}</g></g>`)
    }
  }

  const hallEnd = officesEnd + 24
  const cy = officesEnd + 6

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 ${H}" width="${width}" height="${Math.round((width * H) / 300)}" shape-rendering="crispEdges">
<style>
image{image-rendering:pixelated}
.lbl{font:9px monospace;fill:#E6E9F0}.sub{font:8px monospace;fill:#9AA3B8}.bang{font:bold 8px monospace;fill:#E24B4A;text-anchor:middle;animation:blink .6s steps(2) infinite}
.ttl{font:bold 10px monospace;fill:#F1EFE8;text-anchor:middle}
@keyframes blink{50%{opacity:0}}@keyframes bob{50%{transform:translateY(-1px)}}
@keyframes flick{50%{opacity:.55}}@keyframes fill{0%{transform:scaleX(0)}100%{transform:scaleX(1)}}@keyframes sway{0%,100%{transform:translateX(-1px)}50%{transform:translateX(1px)}}
.bob{animation:bob 1.2s steps(2) infinite}.typing{animation:bob .25s steps(2) infinite}
.flicker{animation:flick .4s steps(2) infinite}.bar{transform-box:fill-box;transform-origin:left;animation:fill 1.4s linear infinite}
.dots rect{animation:blink 1.2s steps(2) infinite}.dots rect:nth-child(2){animation-delay:.3s}.dots rect:nth-child(3){animation-delay:.6s}
.walk{animation:bob .3s steps(2) infinite}.sway{animation:sway 3s ease-in-out infinite}
${css.join('\n')}
</style>
<defs>${spriteDefs()}
<pattern id="fl" width="16" height="16" patternUnits="userSpaceOnUse"><rect width="16" height="16" fill="#141A2B"/><rect width="8" height="8" fill="#182036"/><rect x="8" y="8" width="8" height="8" fill="#182036"/></pattern>
<pattern id="tile" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="#2A3048"/><rect width="6" height="6" fill="#323A56"/><rect x="6" y="6" width="6" height="6" fill="#323A56"/></pattern>
<pattern id="woodp" width="16" height="16" patternUnits="userSpaceOnUse"><use href="#wood"/></pattern>
<pattern id="runv" x="142" y="0" width="16" height="16" patternUnits="userSpaceOnUse"><use href="#runV"/></pattern>
<pattern id="runh" x="0" y="${cy}" width="16" height="16" patternUnits="userSpaceOnUse"><use href="#runH"/></pattern></defs>
<rect width="300" height="${H}" fill="url(#fl)"/>
<rect x="40" y="4" width="220" height="16" fill="#141A2B" opacity=".9"/><rect x="40" y="19" width="220" height="1" fill="${WOOD}"/>
<text x="150" y="15" class="ttl">${title}</text>
<g transform="translate(0,${TOP})">
<rect x="4" y="4" width="292" height="${h - 8}" fill="#3A4361"/>
<rect x="130" y="8" width="40" height="${hallEnd - 8}" fill="${FLOOR}"/><rect x="8" y="${officesEnd + 4}" width="284" height="20" fill="${FLOOR}"/>
<rect x="8" y="${cy}" width="284" height="16" fill="url(#runh)"/><rect x="142" y="8" width="16" height="${cy - 8}" fill="url(#runv)"/>${tile('runVt', 142, 8)}
${tile('plant', 10, officesEnd + 4, 1.2)}${tile('plant', 271, officesEnd + 4, 1.2)}
${rooms.join('\n')}
<rect x="8" y="${kt}" width="284" height="104" fill="url(#tile)"/>
<rect x="140" y="${kt - 4}" width="20" height="4" fill="${FLOOR}"/><rect x="160" y="${kt}" width="3" height="16" fill="${WOOD}"/>
${tile('counter', 16, kt + 20)}${tile('sink', 32, kt + 20)}${tile('fruit', 48, kt + 20)}${tile('counter2', 64, kt + 20)}${tile('stove', 80, kt + 20)}
<rect x="98" y="${kt + 18}" width="12" height="18" fill="#444441"/><rect x="101" y="${kt + 22}" width="3" height="3" fill="#E24B4A"/><rect x="101" y="${kt + 30}" width="6" height="4" fill="#F1EFE8"/>
${tile('fridgeT', 262, kt + 8, 1.75)}
${tile('chairL', 180, kt + 46)}${tile('tableL', 196, kt + 46)}${tile('tableM', 212, kt + 46)}${tile('tableR', 228, kt + 46)}${tile('chairR', 244, kt + 46)}
<rect x="12" y="${kt + 4}" width="64" height="13" fill="#141A2B" opacity=".85"/><text x="16" y="${kt + 13}" class="lbl">BREAK ROOM</text>
${lounge.join('\n')}
${walkers.join('\n')}
</g>
</svg>`
}

// ---- Hooks -----------------------------------------------------------------

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await $.command.register({ name: 'office', description: 'Open the pixel office pane' })
    const base = e.cwd.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || 'Claude'
    folder = base.startsWith('scratch-') ? 'Claude' : base
    // The same chat gets the same people each time it starts.
    const id = await $.session.id()
    nextName = [...id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 0) % NAMES.length
    lead = person(takeName())
    crew = CREW_AT.map(() => person(takeName()))
    helpers = []
    // Walking in and out of the break room is timed; redraw as people arrive.
    $.clock.every(1000, () => void publish($))
    void publish($)
    void $.ui.open({ id: PANE, title: 'Pixel office' })

    return started
  })

  on('command.run', { command: 'office' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Pixel office' })

    return { text: 'Pixel office opened.' }
  })

  on('agent.spawn', async ($, e, next) => {
    const spawned = await next(e)
    if (lead && spawned.agentId && !findHelper(spawned.agentId)) {
      helpers.push({ id: spawned.agentId, ...person(takeName()) })
      void publish($)
    }

    return spawned
  }).catch(($, e, next) => next(e))

  on('turn.start', async ($, e, next) => {
    const who = e.agentId ? findHelper(e.agentId) : lead
    if (!e.agentId) {
      actions = 0
      recent = []
    }
    if (who) {
      setStatus(who, 'think')
      void publish($)
    }

    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const who = e.agentId ? findHelper(e.agentId) : lead
    const kind = kindOf(e.tool)
    actions++
    if (!e.agentId) recent = [kind, ...recent].slice(0, CREW_AT.length + 1)
    if (who) setStatus(who, kind)
    staffCrew()
    void publish($)
    try {
      const ran = await next(e)
      if (who && who.atDesk) setStatus(who, ran.isError || ran.deny !== undefined ? 'error' : 'think')

      return ran
    } catch (err) {
      if (who && who.atDesk) setStatus(who, 'error')
      throw err
    } finally {
      if (who) void publish($)
    }
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    const agentId = e.agentId
    const who = agentId ? findHelper(agentId) : lead
    if (who) setStatus(who, 'idle')
    if (!agentId) {
      // The reply is done: the crew clock off with the lead.
      actions = 0
      recent = []
      staffCrew()
    }
    void publish($)
    if (agentId && who) {
      $.clock.after(HELPER_LINGER_MS, () => {
        helpers = helpers.filter(h => h.id !== agentId || h.atDesk)
        void publish($)
      })
    }

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const shown = await read($, board)
    const { workers } = shown
    const { Box, Text } = $.ui.resolve(e)
    const heading = <Text>{shown.folder || 'Claude'} Office</Text>
    const chips = workers.map(w => (
      <Text dimColor={!w.atDesk}>
        {w.role === 'lead' ? '■' : '·'} {w.name}
        {w.role === 'helper' ? ' (helper)' : ''} · {WORDS[w.status]}
      </Text>
    ))
    const list = workers.length === 0 ? [<Text dimColor>Nobody's in yet.</Text>] : chips

    if (e.surface === 'terminal') return <Box flexDirection="column">{heading}{list}</Box>

    const { Svg } = $.ui.resolve(e)
    const busy = workers.filter(w => w.atDesk).length
    // Fill the pane: its width in cells, about 8 CSS pixels each.
    const width = Math.max(280, Math.min(900, e.props.bodyColumns * 8))

    return (
      <Box flexDirection="column">
        <Svg
          source={office(shown, Date.now(), width)}
          width={width}
          height={Math.round((width * officeHeight(workers.length)) / 300)}
          alt={`${shown.folder} Office: ${busy} working, ${workers.length - busy} in the break room`}
        />
        {list}
      </Box>
    )
  })
}
