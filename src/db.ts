import Dexie, { type EntityTable } from 'dexie'

export type InstrumentType = 'Flow' | 'Pressure' | 'Level'
export type SyncState = 'pending' | 'synced'

export interface CalibrationLog {
  id?: number
  assetTag: string
  instrumentType: InstrumentType
  rawmA: number
  scaledValue: number
  unit: string
  rangeLow: number
  rangeHigh: number
  technician: string
  status: SyncState
  timestamp: string // ISO 8601
}

export const db = new Dexie('CalibrationDB') as Dexie & {
  logs: EntityTable<CalibrationLog, 'id'>
}

db.version(1).stores({
  logs: '++id, assetTag, instrumentType, status, timestamp',
})
