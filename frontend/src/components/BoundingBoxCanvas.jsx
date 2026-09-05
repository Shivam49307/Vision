import { useEffect, useRef } from 'react'

const PALETTE = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#06B6D4', '#F97316', '#84CC16', '#6366F1',
]

export default function BoundingBoxCanvas({ imageUrl, bboxes, labels, imageSize }) {
  const containerRef = useRef(null)
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!imageUrl || !bboxes?.length || !imageSize) return

    const img = new Image()
    img.src = imageUrl
    img.onload = () => {
      const containerWidth = containerRef.current.clientWidth
      const scale = containerWidth / imageSize.width
      const displayHeight = imageSize.height * scale

      const canvas = canvasRef.current
      canvas.width = containerWidth
      canvas.height = displayHeight

      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, containerWidth, displayHeight)

      bboxes.forEach(([x1, y1, x2, y2], i) => {
        const color = PALETTE[i % PALETTE.length]
        const sx1 = x1 * scale
        const sy1 = y1 * scale
        const sw = (x2 - x1) * scale
        const sh = (y2 - y1) * scale
        const label = labels?.[i] ?? ''

        ctx.strokeStyle = color
        ctx.lineWidth = 2
        ctx.strokeRect(sx1, sy1, sw, sh)

        ctx.font = 'bold 12px sans-serif'
        const tw = ctx.measureText(label).width
        ctx.fillStyle = color
        ctx.fillRect(sx1, sy1 - 18, tw + 8, 18)
        ctx.fillStyle = '#fff'
        ctx.fillText(label, sx1 + 4, sy1 - 4)
      })
    }
  }, [imageUrl, bboxes, labels, imageSize])

  return (
    <div ref={containerRef} className="w-full">
      <canvas ref={canvasRef} className="w-full rounded-lg border border-gray-200" />
    </div>
  )
}
