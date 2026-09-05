import BoundingBoxCanvas from './BoundingBoxCanvas'

const PALETTE = [
  '#F97316', '#0F766E', '#E11D48', '#D97706', '#65A30D',
  '#DB2777', '#0891B2', '#EA580C', '#4D7C0F', '#BE123C',
]

const BBOX_TASKS = new Set(['object_detection'])

export default function ResultDisplay({ result, task, imageUrl, imageSize }) {
  if (!result) return null

  const taskKey = Object.keys(result)[0]
  const data = result[taskKey]
  const hasBboxes = BBOX_TASKS.has(task) && Array.isArray(data?.bboxes) && data.bboxes.length > 0

  return (
    <div className="space-y-4 animate-rise">
      {hasBboxes ? (
        <>
          <p className="text-xs text-gray-500">
            {data.bboxes.length} region{data.bboxes.length !== 1 ? 's' : ''} detected
          </p>
          <BoundingBoxCanvas
            imageUrl={imageUrl}
            bboxes={data.bboxes}
            labels={data.labels}
            imageSize={imageSize}
          />
          <ul className="space-y-1 max-h-48 overflow-y-auto">
            {data.labels?.map((label, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-gray-700">
                <span
                  className="w-3 h-3 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
                />
                {label}
              </li>
            ))}
          </ul>
        </>
      ) : typeof data === 'string' ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{data}</p>
        </div>
      ) : (
        <pre className="text-xs text-gray-600 bg-gray-50 rounded-lg p-4 overflow-auto">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  )
}
