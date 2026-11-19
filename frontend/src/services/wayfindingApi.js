import { useEffect, useState } from 'react';
import { getStoredToken } from './authApi';

const endpoint = '/api/v1/wayfinding';

async function request(url, options) {
  const response = await fetch(url, options);
  if (response.ok) return response.json();
  const body = await response.json().catch(() => null);
  const detail = body?.detail;
  const message = Array.isArray(detail)
    ? detail.map((error) => `${error.loc?.slice(1).join('.') || 'Bản đồ'} — ${error.msg}`).join('\n')
    : detail;
  throw new Error(message || `Không thể tải hoặc lưu bản đồ (${response.status}).`);
}

export const fetchWayfinding = (signal) => request(endpoint, { signal });

export const publishWayfinding = (snapshot) => request(endpoint, {
  method: 'PUT',
  headers: { Authorization: `Bearer ${getStoredToken()}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(snapshot),
});

export function uploadWayfindingImage(file) {
  const body = new FormData();
  body.append('file', file);
  return request(`${endpoint}/images`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getStoredToken()}` },
    body,
  });
}

export function usePublishedWayfinding(enabled = true, refreshKey = null) {
  const [snapshot, setSnapshot] = useState(null);

  useEffect(() => {
    if (!enabled) return undefined;
    let controller;
    const load = () => {
      controller?.abort();
      controller = new AbortController();
      const { signal } = controller;
      fetchWayfinding(signal).then((data) => {
        if (!signal.aborted) setSnapshot(data);
      }).catch((error) => {
        if (!signal.aborted) console.warn('Không thể tải bản đồ chỉ đường:', error);
      });
    };
    load();
    window.addEventListener('focus', load);
    return () => {
      controller?.abort();
      window.removeEventListener('focus', load);
    };
  }, [enabled, refreshKey]);

  return snapshot;
}
