const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000/api').replace(/\/$/, '')

function getToken() {
  return localStorage.getItem('token') ?? ''
}

function handleErrorStatus(status) {
  if (status === 401) {
    localStorage.removeItem('token')
    window.location.href = '/auth'
    return true
  }
  if (status === 402) {
    window.location.href = '/legacy/buy-credits'
    return true
  }
  return false
}

export async function legacyGet(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
  })
  if (handleErrorStatus(res.status)) return null
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw Object.assign(new Error(err?.message || `HTTP ${res.status}`), { status: res.status, data: err })
  }
  return res.json()
}

export async function legacyPost(path, data) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(data),
  })
  if (handleErrorStatus(res.status)) return null
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw Object.assign(new Error(err?.message || `HTTP ${res.status}`), { status: res.status, data: err })
  }
  return res.json()
}

export async function legacyPut(path, data) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(data),
  })
  if (handleErrorStatus(res.status)) return null
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw Object.assign(new Error(err?.message || `HTTP ${res.status}`), { status: res.status, data: err })
  }
  return res.json()
}

export async function legacyPostForm(path, formData) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: formData,
  })
  if (handleErrorStatus(res.status)) return null
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw Object.assign(new Error(err?.message || `HTTP ${res.status}`), { status: res.status, data: err })
  }
  return res.json()
}
