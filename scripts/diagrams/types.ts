/** A chord tuple is ordered from string 6 (low E) to string 1 (high e). */
export type StringState = number | "x"
export type Finger = 1 | 2 | 3 | 4 | null
export type GuitarString = 1 | 2 | 3 | 4 | 5 | 6

/** Guitar string numbers are conventional: 1 is high e and 6 is low E. */
export interface Barre {
  fret: number
  fromString: GuitarString
  toString: GuitarString
  finger: Exclude<Finger, null>
}

export interface ChordDefinition {
  id: string
  title: string
  baseFret: number
  frets: [StringState, StringState, StringState, StringState, StringState, StringState]
  fingers: [Finger, Finger, Finger, Finger, Finger, Finger]
  barres: Barre[]
}

export interface FretPosition {
  string: GuitarString
  fret: number
  label: string
  role: "root" | "tone"
}

/** startFret may be 0 so diagrams can represent open-position notes. */
export interface FretboardDefinition {
  id: string
  title: string
  startFret: number
  endFret: number
  positions: FretPosition[]
}

export interface RhythmCell {
  label: string
  stroke: "down" | "up" | "rest" | "mute"
  accent: boolean
}

export interface RhythmDefinition {
  id: string
  title: string
  meter: "3/4" | "4/4" | "6/8"
  subdivision: 4 | 8 | 16
  cells: RhythmCell[]
}
