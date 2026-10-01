import CalibrationForm from './components/CalibrationForm'
import LogViewer from './components/LogViewer'
import SyncStatus from './components/SyncStatus'

export default function App() {
  return (
    <div className="mx-auto max-w-2xl px-4 pb-16">
      <header className="sticky top-0 z-10 -mx-4 mb-4 bg-[var(--ink)] px-4 py-3 text-white">
        <h1 className="text-lg font-bold">Calibration log</h1>
        <SyncStatus />
      </header>
      <CalibrationForm />
      <LogViewer />
    </div>
  )
}
