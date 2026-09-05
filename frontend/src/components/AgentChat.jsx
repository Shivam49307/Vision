import { useState } from 'react'
import { Bot, Loader2, Send, User } from 'lucide-react'
import { askVisionAgent } from '../api/vision'

export default function AgentChat({ imageFile, messages, onMessagesChange, onSessionExpired }) {
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (event) => {
    event.preventDefault()
    const content = question.trim()
    if (!imageFile || !content || loading) return

    const userMessage = { role: 'user', content }
    const nextMessages = [...messages, userMessage]
    onMessagesChange(nextMessages)
    setQuestion('')
    setError(null)
    setLoading(true)

    try {
      const data = await askVisionAgent(imageFile, content, messages)
      onMessagesChange([...nextMessages, { role: 'assistant', content: data.response }])
    } catch (err) {
      setError(err.message)
      if (err.message.includes('log in')) onSessionExpired()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="animate-rise mt-6 bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <Bot className="w-4 h-4 text-teal-600" />
        <h2 className="text-sm font-semibold text-gray-700">Ask Vision Analyst</h2>
      </div>
      <p className="text-xs text-gray-500 mb-4">Ask follow-up questions about the selected image.</p>

      {messages.length > 0 && (
        <div className="space-y-3 max-h-72 overflow-y-auto mb-4 pr-1">
          {messages.map((item, index) => (
            <div key={`${item.role}-${index}`} className={`animate-rise flex gap-2 ${item.role === 'user' ? 'justify-end' : ''}`} style={{ animationDelay: `${index * 45}ms` }}>
              {item.role === 'assistant' && <Bot className="w-4 h-4 text-teal-600 mt-1 flex-shrink-0" />}
              <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                item.role === 'user' ? 'bg-orange-500 text-white' : 'bg-stone-50 border border-stone-200 text-stone-700'
              }`}>
                {item.content}
              </div>
              {item.role === 'user' && <User className="w-4 h-4 text-gray-400 mt-1 flex-shrink-0" />}
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder={imageFile ? 'What would you like to know?' : 'Upload an image first'}
          disabled={!imageFile || loading}
          className="min-w-0 flex-1 px-3 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:bg-stone-50"
        />
        <button
          type="submit"
          disabled={!imageFile || !question.trim() || loading}
          aria-label="Ask Vision Analyst"
          className="px-3 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </form>
    </div>
  )
}
