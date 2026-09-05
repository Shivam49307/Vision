import { useEffect, useState } from 'react'
import { AlertCircle, Eye, Loader2, LogOut, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import ImageUploader from './components/ImageUploader'
import TaskSelector from './components/TaskSelector'
import ResultDisplay from './components/ResultDisplay'
import AgentChat from './components/AgentChat'
import { analyzeImage, getAnalysisHistory, getTasks } from './api/vision'
import { useAuth } from './context/AuthContext'

export default function App() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [tasks, setTasks] = useState([])
  const [selectedTask, setSelectedTask] = useState('caption')
  const [imageFile, setImageFile] = useState(null)
  const [imageUrl, setImageUrl] = useState(null)
  const [imageSize, setImageSize] = useState(null)
  const [result, setResult] = useState(null)
  const [agentMessages, setAgentMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [history, setHistory] = useState([])
  const [activeTab, setActiveTab] = useState('analyze')

  useEffect(() => {
    getTasks()
      .then((d) => setTasks(d.tasks))
      .catch(() => setError('Cannot reach the backend. Make sure the Python server is running on port 8000.'))
    getAnalysisHistory()
      .then((d) => setHistory(d.items))
      .catch(() => {})
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleImageSelect = (file) => {
    setImageFile(file)
    setResult(null)
    setAgentMessages([])
    setError(null)
    const url = URL.createObjectURL(file)
    setImageUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return url })
    const img = new Image()
    img.onload = () => setImageSize({ width: img.naturalWidth, height: img.naturalHeight })
    img.src = url
  }

  const handleAnalyze = async () => {
    if (!imageFile || loading) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const data = await analyzeImage(imageFile, selectedTask)
      setResult(data.result)
      getAnalysisHistory().then((d) => setHistory(d.items)).catch(() => {})
      if (data.image_size) setImageSize(data.image_size)
    } catch (e) {
      setError(e.message)
      if (e.message.includes('log in')) { logout(); navigate('/login') }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-shell min-h-screen">
      <header className="bg-[#fffaf5]/90 backdrop-blur border-b border-orange-100 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm shadow-orange-200">
              <Eye className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-stone-900 leading-tight">Vision AI</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">Hi, <span className="font-medium text-gray-700">{user?.username}</span></span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>

          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-5 sm:px-6 py-8">
        <section className="animate-enter mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-orange-600 mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              Multimodal workspace
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-stone-900">See more in every image.</h2>
            <p className="mt-2 text-sm text-stone-500 max-w-lg">Upload a photo, choose an analysis, then ask the Vision Analyst anything about what it sees.</p>
          </div>
          <div className="inline-flex items-center gap-2 self-start sm:self-auto px-3 py-2 rounded-full bg-white/80 border border-orange-100 text-xs font-medium text-stone-600 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-teal-500 shadow-sm shadow-teal-200" />
            AI system online
          </div>
        </section>

        <div className="flex items-center gap-1 p-1 mb-6 bg-white/80 border border-orange-100 rounded-xl w-fit shadow-sm">
          <button
            onClick={() => setActiveTab('analyze')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'analyze' ? 'bg-orange-500 text-white shadow-sm' : 'text-stone-500 hover:bg-orange-50 hover:text-orange-700'}`}
          >
            New analysis
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'history' ? 'bg-orange-500 text-white shadow-sm' : 'text-stone-500 hover:bg-orange-50 hover:text-orange-700'}`}
          >
            Recent analysis <span className="ml-1 text-xs opacity-75">({history.length})</span>
          </button>
        </div>

        {activeTab === 'history' ? (
          <section className="animate-rise bg-white rounded-2xl border border-orange-100 p-6 shadow-[0_12px_35px_rgba(120,53,15,0.06)]">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-orange-600 mb-1">Activity</p>
                <h2 className="text-lg font-semibold text-stone-800">Recent analysis</h2>
              </div>
              <span className="text-xs text-stone-400">{history.length} saved</span>
            </div>
            {history.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {history.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-4 px-4 py-3.5 rounded-xl bg-stone-50 border border-stone-100">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-stone-700 truncate">{item.filename}</p>
                      <p className="text-xs text-stone-400 mt-1">{item.task} · {item.status}</p>
                    </div>
                    <span className="text-xs text-stone-400 flex-shrink-0">{item.duration_ms ? `${Math.round(item.duration_ms)}ms` : '-'}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-16 text-center text-sm text-stone-400">Your completed analyses will appear here.</p>
            )}
          </section>
        ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] gap-6 items-start">
          <div className="space-y-5">
            <div className="animate-enter card-hover bg-white rounded-2xl border border-orange-100 p-5 shadow-[0_12px_35px_rgba(120,53,15,0.06)]">
              <h2 className="text-sm font-semibold text-stone-800 mb-4"><span className="text-orange-500 mr-2">01</span>Upload Image</h2>
              <ImageUploader onImageSelect={handleImageSelect} disabled={loading} />
            </div>

            {imageUrl && (
              <div className="animate-rise card-hover bg-white rounded-2xl border border-orange-100 p-5 shadow-[0_12px_35px_rgba(120,53,15,0.06)]">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-stone-800">Image preview</h2>
                  {imageSize && <span className="text-xs text-stone-400">{imageSize.width} × {imageSize.height}px</span>}
                </div>
                <div className="rounded-xl overflow-hidden bg-stone-100 ring-1 ring-stone-200/70">
                  <img src={imageUrl} alt="Selected" className="w-full rounded-xl object-contain max-h-72" />
                </div>
              </div>
            )}

            <div className="animate-rise card-hover bg-white rounded-2xl border border-orange-100 p-5 shadow-[0_12px_35px_rgba(120,53,15,0.06)]">
              <h2 className="text-sm font-semibold text-stone-800 mb-4"><span className="text-orange-500 mr-2">02</span>Choose an analysis</h2>
              {tasks.length > 0 ? (
                <TaskSelector tasks={tasks} selectedTask={selectedTask} onSelect={setSelectedTask} disabled={loading} />
              ) : (
                <p className="text-sm text-gray-400">Loading tasks…</p>
              )}
            </div>

            <button
              onClick={handleAnalyze}
              disabled={!imageFile || loading}
              className="w-full py-3 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 active:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors shadow-sm shadow-orange-200"
            >
              {loading ? (<><Loader2 className="w-4 h-4 animate-spin" />Analyzing…</>) : (<><Eye className="w-4 h-4" />Analyze Image</>)}
            </button>
          </div>

          <div className="animate-enter card-hover bg-white rounded-2xl border border-orange-100 p-5 shadow-[0_12px_35px_rgba(120,53,15,0.06)] min-h-80 lg:sticky lg:top-24" style={{ animationDelay: '100ms' }}>
            <h2 className="text-sm font-semibold text-stone-800 mb-4"><span className="text-orange-500 mr-2">03</span>Results & conversation</h2>

            {error && (
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {!result && !error && !loading && (
              <div className="flex flex-col items-center justify-center h-56 text-gray-400">
                <Eye className="w-12 h-12 mb-3 opacity-25" />
                <p className="text-sm">Upload an image and click Analyze</p>
              </div>
            )}

            {loading && (
              <div className="flex flex-col items-center justify-center h-56 gap-3 text-gray-500">
                <Loader2 className="w-9 h-9 animate-spin text-orange-500" />
                <p className="text-sm font-medium">Running Gemini inference…</p>
              </div>
            )}

            {result && !loading && (
              <div className="animate-rise">
                <ResultDisplay result={result} task={selectedTask} imageUrl={imageUrl} imageSize={imageSize} />
              </div>
            )}

            <AgentChat
              imageFile={imageFile}
              messages={agentMessages}
              onMessagesChange={setAgentMessages}
              onSessionExpired={() => { logout(); navigate('/login') }}
            />
          </div>
        </div>
        )}
      </main>
    </div>
  )
}
