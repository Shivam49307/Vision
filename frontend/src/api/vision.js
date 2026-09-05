const BASE = `${import.meta.env.VITE_API_URL || ''}/api`

function authHeader() {
  const token = localStorage.getItem('visionai_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function getTasks() {
  const res = await fetch(`${BASE}/tasks`)
  if (!res.ok) throw new Error('Failed to fetch task list')
  return res.json()
}

export async function analyzeImage(imageFile, task) {
  const body = new FormData()
  body.append('image', imageFile)
  body.append('task', task)

  const res = await fetch(`${BASE}/analyze`, {
    method: 'POST',
    headers: authHeader(),
    body,
  })

  if (!res.ok) {
    if (res.status === 401) throw new Error('Session expired — please log in again')
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Server error ${res.status}`)
  }
  return res.json()
}

export async function askVisionAgent(imageFile, message, history) {
  const body = new FormData()
  body.append('image', imageFile)
  body.append('message', message)
  body.append('history', JSON.stringify(history))

  const res = await fetch(`${BASE}/agent/chat`, {
    method: 'POST',
    headers: authHeader(),
    body,
  })

  if (!res.ok) {
    if (res.status === 401) throw new Error('Session expired — please log in again')
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Agent error ${res.status}`)
  }
  return res.json()
}

export async function getAnalysisHistory(limit = 8) {
  const res = await fetch(`${BASE}/history?limit=${limit}`, { headers: authHeader() })
  if (!res.ok) throw new Error('Failed to fetch analysis history')
  return res.json()
}

export async function analyzeBatch(imageFiles, task) {
  const body = new FormData()
  imageFiles.forEach((file) => body.append('images', file))
  body.append('task', task)

  const res = await fetch(`${BASE}/analyze/batch`, {
    method: 'POST',
    headers: authHeader(),
    body,
  })

  if (!res.ok) {
    if (res.status === 401) throw new Error('Session expired — please log in again')
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Batch error ${res.status}`)
  }
  return res.json()
}
