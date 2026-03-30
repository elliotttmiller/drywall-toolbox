import React, { useEffect, useState, useRef } from 'react';
import { Star } from 'lucide-react';

// Lightweight client-side reviews store with real-time sync via BroadcastChannel.
import io from 'socket.io-client';
// Stores a map of productId -> reviews[] in localStorage under key 'dtb_reviews_v1'.
// Each review: { id, author, rating, text, createdAt }

const STORAGE_KEY = 'dtb_reviews_v1';
const CHANNEL_NAME = 'dtb_reviews_channel_v1';

function readStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.warn('Failed to read reviews store', e);
    return {};
  }
}

function writeStore(store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    return true;
  } catch (e) {
    console.warn('Failed to write reviews store', e);
    return false;
  }
}

export default function Reviews({ productId, allowSubmit = true, filterVerified = false }) {
  const [reviews, setReviews] = useState(() => {
    try {
      const store = readStore();
      return store[productId] || [];
    } catch {
      return [];
    }
  });
  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');
  const [author, setAuthor] = useState('');
  const channelRef = useRef(null);

  useEffect(() => {
    let socket = null;
    let bc = null;
    let mounted = true;

    async function init() {
      // try server
      try {
        const res = await fetch(`/api/reviews/${encodeURIComponent(productId)}`);
        if (res.ok) {
          const data = await res.json();
          if (mounted) setReviews(data.reviews || []);
          try {
            socket = io(undefined, { transports: ['websocket'] });
            socket.on('connect', () => socket.emit('subscribe', productId));
            socket.on('reviewAdded', (payload) => {
              if (payload && payload.productId === productId && mounted) setReviews(payload.reviews || []);
            });
            channelRef.current = socket;
          } catch (e) {
            console.warn('Socket.io connect failed, falling back to local sync', e);
          }
        }
      } catch (e) {
        // server not available; fallback to localStorage/BroadcastChannel
        console.debug('Reviews server unavailable', e && e.message);
      }

      try {
        bc = new BroadcastChannel(CHANNEL_NAME);
        bc.onmessage = (ev) => {
          const { type, payload } = ev.data || {};
          if (type === 'update' && payload && payload.productId === productId && mounted) {
            setReviews(payload.reviews || []);
          }
        };
        if (!channelRef.current) channelRef.current = bc;
      } catch (e) {
        // BroadcastChannel not available
        console.debug('BroadcastChannel unavailable', e && e.message);
      }
    }

    init();

    // Storage event fallback (other tabs)
    function onStorage(e) {
      if (e.key === STORAGE_KEY) {
        const s = readStore();
        setReviews(s[productId] || []);
      }
    }
    window.addEventListener('storage', onStorage);

    return () => {
      mounted = false;
  try { if (bc && typeof bc.close === 'function') bc.close(); } catch (e) { console.debug(e && e.message); }
  try { if (socket && typeof socket.disconnect === 'function') socket.disconnect(); } catch (e) { console.debug(e && e.message); }
  try { if (channelRef.current && typeof channelRef.current.close === 'function') channelRef.current.close(); } catch (e) { console.debug(e && e.message); }
      window.removeEventListener('storage', onStorage);
    };
  }, [productId]);

  function publishUpdate(newReviews) {
    const store = readStore();
    store[productId] = newReviews;
    writeStore(store);
    // Try posting to server (server will broadcast to other clients)
    try {
      fetch(`/api/reviews/${encodeURIComponent(productId)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author: (newReviews[0] && newReviews[0].author) || 'Anonymous', rating: (newReviews[0] && newReviews[0].rating) || 5, text: (newReviews[0] && newReviews[0].text) || '' })
      }).catch(()=>{});
  } catch (e) { console.debug(e && e.message); }

    // local broadcast for tabs
    if (channelRef.current && typeof channelRef.current.postMessage === 'function') {
      channelRef.current.postMessage({ type: 'update', payload: { productId, reviews: newReviews } });
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    const newReview = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      author: author.trim() || 'Anonymous',
      rating: Number(rating) || 5,
      text: text.trim(),
      createdAt: new Date().toISOString(),
    };

    const updated = [newReview, ...reviews];
    setReviews(updated);
    publishUpdate(updated);
    // reset form
    setText('');
    setRating(5);
  }

  const avg = reviews.length ? (reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length) : 0;

  // optionally filter to only verified reviews when requested
  const visibleReviews = filterVerified ? reviews.filter(r => !!r.verified) : reviews;

  return (
    <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm mt-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Star className="text-yellow-400" size={16} />
            <span className="text-lg font-semibold">{avg ? avg.toFixed(1) : '—'}</span>
          </div>
          <div className="text-sm text-gray-500">{reviews.length} review{reviews.length !== 1 ? 's' : ''}</div>
        </div>
        <div className="text-sm text-gray-500">Real-time reviews (local)</div>
      </div>

      {allowSubmit && (
        <form onSubmit={handleSubmit} className="mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-3">
            <label className="text-sm font-medium text-gray-700">Your rating</label>
            <div className="flex items-center gap-1 mt-1">
              {[1,2,3,4,5].map(n => (
                <button type="button" key={n} onClick={() => setRating(n)} className={`p-1 rounded ${n <= rating ? 'bg-yellow-100' : 'bg-transparent'}`} aria-label={`Rate ${n}`}>
                  <Star size={18} className={n <= rating ? 'text-yellow-400' : 'text-gray-300'} />
                </button>
              ))}
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-gray-700">Your name (optional)</label>
            <input className="w-full px-3 py-2 rounded border border-gray-300 mt-1" value={author} onChange={(e)=>setAuthor(e.target.value)} placeholder="Your name" />
          </div>

          <div className="sm:col-span-3">
            <label className="text-sm font-medium text-gray-700">Your review</label>
            <textarea className="w-full px-3 py-2 rounded border border-gray-300 mt-1" rows={4} value={text} onChange={(e)=>setText(e.target.value)} placeholder="Tell other buyers what you thought..." />
          </div>
        </div>

        <div className="mt-3">
          <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700">Submit review</button>
        </div>
        </form>
      )}

      <div className="space-y-4">
        {visibleReviews.length === 0 && <div className="text-sm text-gray-500">No reviews yet — no verified reviews available for this product.</div>}
        {visibleReviews.map(r => (
          <div key={r.id} className="border border-gray-100 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-3">
                <div className="font-medium text-sm">{r.author}</div>
                <div className="flex items-center gap-1 text-sm text-gray-600">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={14} className={i < r.rating ? 'text-yellow-400' : 'text-gray-300'} />
                  ))}
                </div>
              </div>
              <div className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleString()}</div>
            </div>
            <div className="text-sm text-gray-700">{r.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
