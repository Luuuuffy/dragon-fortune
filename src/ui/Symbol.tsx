import type { ReactNode } from 'react'
import { money, SYMBOLS } from '../game/config'
import type { SymbolId } from '../game/config'
import type { Orb } from '../game/engine'

export function SymbolPaint() {
  return <svg className="paint" aria-hidden="true">
    <defs>
      <linearGradient id="gold-foil" x2=".25" y2="1">
        <stop stopColor="#fff4bd"/><stop offset=".35" stopColor="#ffcb58"/>
        <stop offset=".65" stopColor="#b86613"/><stop offset=".85" stopColor="#ffdb73"/><stop offset="1" stopColor="#8e4310"/>
      </linearGradient>
      <linearGradient id="gold-edge" x2="0.2" y2="1">
        <stop stopColor="#fff3bd"/><stop offset=".5" stopColor="#eca342"/><stop offset="1" stopColor="#863b15"/>
      </linearGradient>
      <radialGradient id="lantern-silk" cx=".36" cy=".28" r=".74">
        <stop stopColor="#ff9178"/><stop offset=".34" stopColor="#ef443f"/><stop offset=".76" stopColor="#ad132c"/>
        <stop offset="1" stopColor="#580e29"/>
      </radialGradient>
      <linearGradient id="phoenix-foil" x2=".5" y2="1">
        <stop stopColor="#fff1a4"/><stop offset=".37" stopColor="#ff8848"/><stop offset=".75" stopColor="#d92738"/><stop offset="1" stopColor="#6c0c31"/>
      </linearGradient>
      <linearGradient id="jade-foil" x2=".4" y2="1">
        <stop stopColor="#d8ffbb"/><stop offset=".42" stopColor="#62dda2"/><stop offset=".72" stopColor="#0f7e67"/><stop offset="1" stopColor="#036451"/>
      </linearGradient>
      <radialGradient id="orb-foil" cx=".4" cy=".32" r=".7">
        <stop stopColor="#fff4b0"/><stop offset=".36" stopColor="#ffcd4c"/><stop offset=".72" stopColor="#d68317"/><stop offset="1" stopColor="#6f2909"/>
      </radialGradient>
      <radialGradient id="panda-ivory" cx=".42" cy=".3" r=".78">
        <stop stopColor="#fffdf4"/><stop offset=".66" stopColor="#f1dfca"/><stop offset="1" stopColor="#c69d82"/>
      </radialGradient>
      <linearGradient id="rank-a" x2="0" y2="1"><stop stopColor="#fac3bd"/><stop offset=".48" stopColor="#ee526e"/><stop offset="1" stopColor="#8d193e"/></linearGradient>
      <linearGradient id="rank-k" x2="0" y2="1"><stop stopColor="#d2f7ff"/><stop offset=".48" stopColor="#58bbfe"/><stop offset="1" stopColor="#245fa6"/></linearGradient>
      <linearGradient id="rank-q" x2="0" y2="1"><stop stopColor="#f0d0ff"/><stop offset=".48" stopColor="#bd78e8"/><stop offset="1" stopColor="#642b98"/></linearGradient>
      <linearGradient id="rank-j" x2="0" y2="1"><stop stopColor="#d4ffd8"/><stop offset=".48" stopColor="#64d293"/><stop offset="1" stopColor="#267354"/></linearGradient>
      <linearGradient id="rank-10" x2="0" y2="1"><stop stopColor="#fff4c9"/><stop offset=".48" stopColor="#eeab61"/><stop offset="1" stopColor="#ae4f28"/></linearGradient>
    </defs>
  </svg>
}

const gold = 'url(#gold-foil)'
const edge = 'url(#gold-edge)'
const shapes: Partial<Record<SymbolId, ReactNode>> = {
  lantern: <>
    <path d="M54 20V13a6 6 0 0 1 12 0v7" fill="none" stroke={edge} strokeWidth="3"/>
    <path d="M22 47C22 28 38 23 60 23s38 5 38 24S82 75 60 75 22 66 22 47Z"
      fill="url(#lantern-silk)" stroke={edge} strokeWidth="2.4"/>
    <path d="M45 25C33 35 32 59 46 72M75 25c12 10 13 34-1 47M60 25v47"
      fill="none" stroke="#ffc075" strokeOpacity=".47" strokeWidth="1.75"/>
    <path d="M37 28h46l-5-8H42Zm4 43h38l-5 8H46Z" fill={gold} stroke="#f6d598"/>
    <path d="m60 34 13 13-13 13-13-13Z" fill="#9d122a" stroke="#ffce77" strokeWidth="1.8"/>
    <path d="M60 39v16m-8-8h16m-12-4 8 8m0-8-8 8" stroke="#ffdf8e" strokeWidth="1.6" strokeLinecap="round"/>
    <circle cx="60" cy="83" r="3.7" fill={gold} stroke="#ffc875"/>
    <path d="M56 87h8l3 11H53Z" fill={gold} stroke="#e9a044"/>
    <path d="m57 90-1 8m4-8v8m3-8 1 8" stroke="#a95120" strokeWidth="1"/>
    <path d="m28 37 2 5 5 2-5 2-2 5-2-5-5-2 5-2Zm67 23 1 4 4 1-4 1-1 4-1-4-4-1 4-1Z" fill="#ffdc8b"/>
  </>,
  dragon: <>
    <circle cx="60" cy="52" r="39" fill="#421311" stroke="#713821" strokeWidth="1.5"/>
    <circle cx="60" cy="52" r="33" fill="none" stroke="#a95024" strokeDasharray="2 4"/>
    <path d="M31 79C24 66 37 63 49 68C66 76 88 68 86 53C84 41 73 40 64 44L56 53L42 52L34 43L41 37L52 37L57 29L68 28L70 18L76 26L84 23L82 34C98 39 104 55 97 69C89 86 70 89 52 82C42 77 37 77 40 84C42 88 51 90 54 86C53 94 40 96 34 88Z" fill={gold} stroke="#ffe6a1" strokeWidth="1.3"/>
    <path d="M84 43C97 64 79 80 58 75L49 72M92 51l8-2M93 57l8 1M92 63l7 4M89 70l6 5M84 75l4 7M76 79l3 8M68 81v6" fill="none" stroke="#89410e" strokeWidth="1.9" strokeLinecap="round"/>
    <path d="M47 43Q36 44 25 36M49 47Q33 54 19 48M65 34l6-3" fill="none" stroke="#ffd77d" strokeWidth="1.8" strokeLinecap="round"/>
    <circle cx="65" cy="35" r="2" fill="#77192a"/>
    <path d="M29 24l3 6 6 3-6 3-3 6-3-6-6-3 6-3zM96 21l2 4 5 2-5 2-2 5-2-5-4-2 4-2z" fill="#ffc875"/>
  </>,
  phoenix: <>
    <path d="M62 49C55 22 34 23 12 22c9 8 18 12 24 14-8 1-13 0-22-2 11 13 22 15 30 16-7 3-13 3-23 1 9 9 21 12 31 10l10 5c-2 11-15 16-31 12 11 9 24 10 37 0-1 9-8 14-14 19 20-3 30-21 25-40 16-5 25-19 27-35-9 11-16 15-25 17 6-8 8-16 8-24-9 12-19 16-27 34z" fill="url(#phoenix-foil)" stroke={edge} strokeWidth="1.6"/>
    <path d="M51 41q-12-10-30-15m29 26q-13-10-27-11m32 20q-14-6-23-5m49-8q18-8 22-20m-27 10q8-12 8-16" fill="none" stroke="#ffbd76" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M56 71c13-11 18-14 18-25 0-5-3-8-8-8l-8 3 6 2c5 14-11 22-19 29z" fill={gold} stroke="#ffda82" strokeWidth="1.25"/>
    <path d="M68 39l5-8-9 6" fill={gold}/><circle cx="67" cy="41" r="1.4" fill="#3e1625"/>
  </>,
  ingot: <>
    <ellipse cx="61" cy="77" rx="45" ry="9" fill="#381408"/>
    <path d="M13 43q11 10 27 9c4-11 9-23 20-23s17 12 21 23q15 1 26-9c-2 26-21 38-47 38S16 69 13 43z" fill={gold} stroke="#ffe5a0" strokeWidth="2"/>
    <path d="M14 43q13 20 46 21t46-21M25 63q33 20 69 0" fill="none" stroke="#a95b19" strokeWidth="1.8"/>
    <path d="M43 51c7-18 24-22 33 0q-13 11-33 0z" fill="url(#orb-foil)" stroke={edge}/>
    <path d="M32 30l3 7 8 3-8 3-3 7-3-7-8-3 8-3zm56-9 2 6 6 2-6 2-2 6-2-6-6-2 6-2z" fill="#ffe5a0"/>
  </>,
  jade: <>
    <path d="M59 75q17 9 13 20m-13-20q-2 10-9 18m7-17q11 14 6 21" fill="none" stroke="#dc514e" strokeWidth="3" strokeLinecap="round"/>
    <path d="M60 26c-18-3-13-19 0-7 13-12 18 4 0 7z" fill="none" stroke={edge} strokeWidth="3"/>
    <rect x="34" y="28" width="52" height="52" rx="13" transform="rotate(45 60 54)" fill="url(#jade-foil)" stroke={edge} strokeWidth="3"/>
    <circle cx="60" cy="54" r="21" fill="none" stroke="#d5ffb8" strokeWidth="1.5"/>
    <path d="M60 35c5 8 10 14 19 19-9 5-14 10-19 19-5-9-10-14-19-19 9-5 14-11 19-19z" fill="none" stroke="#20765b" strokeWidth="2"/>
    <circle cx="60" cy="54" r="7" fill="#143b37" stroke="#c8ffc1" strokeWidth="2"/>
    <path d="M51 28l6-5 6 5-6 5z" fill={gold}/>
  </>,
  coin: <>
    <circle cx="63" cy="56" r="36" fill="#8e4115" stroke={edge} strokeWidth="3"/>
    <circle cx="58" cy="51" r="35" fill={gold} stroke="#fff1a9" strokeWidth="2.5"/>
    <circle cx="58" cy="51" r="28" fill="none" stroke="#aa601a" strokeWidth="2"/>
    <circle cx="58" cy="51" r="23" fill="none" stroke="#fff1a9" strokeWidth="3" strokeDasharray="3 6"/>
    <rect x="49" y="42" width="18" height="18" rx="2" fill="#5c2c1a" stroke="#ffde7c" strokeWidth="3" transform="rotate(-12 58 51)"/>
    <path d="M94 23l3 7 7 3-7 3-3 7-3-7-7-3 7-3zM27 70l2 4 4 2-4 2-2 4-2-4-4-2 4-2z" fill="#fff0b4"/>
  </>,
  wild: <>
    <circle cx="60" cy="50" r="41" fill="#421420" stroke={edge} strokeWidth="2.5"/>
    <circle cx="60" cy="50" r="36" fill="none" stroke="#bd683b" strokeDasharray="1.5 3"/>
    <path d="M16 50l5-4 5 4-5 4Zm78 0 5-4 5 4-5 4Z" fill={gold}/>
    <g fill="#231b26" stroke="#9e6b52" strokeWidth="1.5">
      <circle cx="37" cy="28" r="12"/><circle cx="83" cy="28" r="12"/>
    </g>
    <path d="M31 28a6 6 0 0 1 8-6m42 0a6 6 0 0 1 8 6" fill="none" stroke="#76616a" strokeWidth="2" strokeLinecap="round"/>
    <path d="M60 24c-18 0-32 11-33 27-1 16 13 25 33 25s34-9 33-25c-1-16-15-27-33-27Z"
      fill="url(#panda-ivory)" stroke="#fff2cf" strokeWidth="1.6"/>
    <ellipse cx="46" cy="49" rx="9" ry="11" transform="rotate(28 46 49)" fill="#2c2330"/>
    <ellipse cx="74" cy="49" rx="9" ry="11" transform="rotate(-28 74 49)" fill="#2c2330"/>
    <g fill="#fff6e2"><circle cx="48" cy="46" r="2.8"/><circle cx="72" cy="46" r="2.8"/></g>
    <path d="M55 56q5-3 10 0-2 5-5 5t-5-5Z" fill="#2c2330"/>
    <path d="M53 62q3 5 7 0 4 5 7 0" fill="none" stroke="#2c2330" strokeWidth="1.6" strokeLinecap="round"/>
    <path d="M30 74h60l8 10-8 10H30l-8-10Z" fill="#671f2d" stroke={edge} strokeWidth="2"/>
    <text className="symbol-wild" x="60" y="90" textAnchor="middle" fill={gold}>WILD</text>
  </>,
}

export function OrbSymbol({ orb }: { orb?: Orb }) {
  const tier = orb && 'tier' in orb ? orb.tier : ''
  const amount = orb && 'tier' in orb ? money(orb.payoutSen) : ''
  const value = orb && 'value' in orb ? String(orb.value) : ''
  const label = tier ? `${tier.toUpperCase()} ${amount}`.trim() : value ? `Gold orb ${value}` : 'Gold orb'
  return <span className={`orb-symbol ${tier}`} role="img" aria-label={label}>
    <svg aria-hidden="true" viewBox="0 0 120 104">
      <circle cx="60" cy="52" r="41" fill="#8f4314" stroke={edge} strokeWidth="2"/>
      <circle className="orb-disc" cx="60" cy="52" r="36" fill="url(#orb-foil)" stroke="#ffefaa" strokeWidth="1.5"/>
      <circle cx="60" cy="52" r="32" fill="none" stroke="#fff1ad" strokeOpacity=".65" strokeWidth="1.5" strokeDasharray="2 3"/>
      <path d="M35 24l2 5 6 2-6 2-2 5-2-5-6-2 6-2zm52 44 2 4 4 2-4 2-2 4-2-4-4-2 4-2z" fill="#fff5b9"/>
      {value && <text className="orb-value" x="60" y="52" textAnchor="middle" dominantBaseline="central"
        fontSize={Math.min(28, 100 / value.length)}>{value}</text>}
    </svg>
    {tier && <span className="orb-caption"><b>{tier.toUpperCase()}</b><small>{amount}</small></span>}
  </span>
}

export function Symbol({ symbol }: { symbol: SymbolId }) {
  if (symbol === 'orb') return <OrbSymbol/>
  const shape = shapes[symbol]
  return <svg className={`slot-symbol symbol-${symbol}`} viewBox="0 0 120 104" role="img" aria-label={SYMBOLS[symbol].name}>
    {shape ?? <>
      <path d="M26 17h68M26 87h68" stroke="#c09258" strokeOpacity=".28" strokeDasharray="2 4"/>
      <text className="symbol-rank" x="60" y="75" textAnchor="middle" fill={`url(#rank-${symbol.toLowerCase()})`} stroke={edge} strokeWidth=".95" paintOrder="stroke">{symbol}</text>
    </>}
  </svg>
}
