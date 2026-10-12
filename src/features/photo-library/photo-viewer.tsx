'use client';
/* eslint-disable @next/next/no-img-element -- Originals are loaded as local blobs without recompression. */
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { fetchOriginal, saveBlob } from './download';
import { formatBytes, type LibraryPhoto } from './model';
import styles from './photo-library.module.css';

export function PhotoViewer({ photo, onClose }: { photo: LibraryPhoto; onClose: () => void }) {
  const [original, setOriginal] = useState<{ blob: Blob; url: string } | null>(null);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let url: string | undefined;
    fetchOriginal(photo, controller.signal, setProgress).then(blob => {
      if (controller.signal.aborted) return;
      url = URL.createObjectURL(blob);
      setOriginal({ blob, url });
    }).catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : '원본을 불러오지 못했습니다.'); });
    return () => { controller.abort(); if (url) URL.revokeObjectURL(url); };
  }, [photo, retry]);
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="w-[96vw] max-w-[96vw] sm:max-w-[96vw] h-[90dvh] flex flex-col p-4">
      <DialogTitle className="pr-8 text-sm break-all">{photo.name}</DialogTitle>
      <DialogDescription>원본 화질 · {formatBytes(photo.size)} · 확대하면 스크롤로 자세히 볼 수 있어요.</DialogDescription>
      <div className={styles.viewerImage}>
        {original ? <img src={original.url} alt={photo.name} className={zoom ? styles.zoomed : styles.fitted} /> : <div role="status">{error || `원본 불러오는 중 ${Math.min(100, Math.round(progress / photo.size * 100))}%`}</div>}
      </div>
      <div className={styles.viewerActions}>
        {error && <button onClick={() => { setError(''); setProgress(0); setRetry(retry + 1); }}>다시 시도</button>}
        <button disabled={!original} aria-pressed={zoom} onClick={() => setZoom(!zoom)}>{zoom ? '화면에 맞추기' : '원본 크기로 확대'}</button>
        <button disabled={!original} onClick={() => original && saveBlob(original.blob, photo.name)}>원본 저장</button>
      </div>
    </DialogContent>
  </Dialog>;
}
