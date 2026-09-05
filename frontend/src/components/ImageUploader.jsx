import { useRef, useState } from 'react'
import { Image as ImageIcon, Upload, X } from 'lucide-react'

export default function ImageUploader({ onImageSelect, disabled }) {
  const [dragOver, setDragOver] = useState(false)
  const [showUrl, setShowUrl] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const inputRef = useRef(null)

  const handleFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return
    onImageSelect(file)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    handleFile(e.dataTransfer.files[0])
  }

  const handleUrlLoad = async () => {
    if (!urlInput.trim()) return
    try {
      const res = await fetch(urlInput)
      const blob = await res.blob()
      const file = new File([blob], 'image.jpg', { type: blob.type || 'image/jpeg' })
      onImageSelect(file)
      setUrlInput('')
      setShowUrl(false)
    } catch {
      alert('Could not load image from that URL.')
    }
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`group border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all select-none hover:-translate-y-0.5 hover:shadow-sm ${
          dragOver ? 'border-orange-500 bg-orange-50' : 'border-stone-300 hover:border-orange-400 hover:bg-orange-50/40'
        } ${disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
      >
        <Upload className="w-10 h-10 mx-auto mb-3 text-gray-400 transition-transform duration-300 group-hover:-translate-y-1 group-hover:text-orange-500" />
        <p className="text-sm font-medium text-gray-700">Drop an image here or click to browse</p>
        <p className="text-xs text-gray-400 mt-1">PNG · JPG · WEBP</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files[0])}
          disabled={disabled}
        />
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-xs text-gray-400">or</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      {showUrl ? (
        <div className="flex gap-2">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleUrlLoad()}
            placeholder="https://example.com/photo.jpg"
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
            autoFocus
          />
          <button
            onClick={handleUrlLoad}
            className="px-3 py-2 bg-orange-500 text-white text-sm rounded-lg hover:bg-orange-600 transition-colors"
          >
            Load
          </button>
          <button
            onClick={() => setShowUrl(false)}
            className="px-2 py-2 text-gray-500 hover:text-gray-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowUrl(true)}
          disabled={disabled}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ImageIcon className="w-4 h-4" />
          Load from URL
        </button>
      )}
    </div>
  )
}
