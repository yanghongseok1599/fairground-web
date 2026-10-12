'use client';
/* eslint-disable @next/next/no-img-element -- Drive thumbnails are separate from downloadable original files. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Search, ArrowUpRight, Check } from 'lucide-react';
import { formatBytes, MAX_ZIP_BYTES, PAGE_SIZE, thumbnailUrl, type LibraryPhoto } from './model';
import { createPhotoZip, fetchOriginal, saveBlob } from './download';
import { PhotoViewer } from './photo-viewer';
import styles from './photo-library.module.css';

export function PhotoLibrary({ photos }: { photos: LibraryPhoto[] }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [onlySelected, setOnlySelected] = useState(false);
  const [page, setPage] = useState(1);
  const [viewer, setViewer] = useState<LibraryPhoto | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [percent, setPercent] = useState(0);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  const chosen = useMemo(() => photos.filter(p => selected.has(p.id)), [photos, selected]);
  const bytes = chosen.reduce((sum, photo) => sum + photo.size, 0);
  const filtered = useMemo(() => photos.filter(p => (!onlySelected || selected.has(p.id)) && p.name.toLowerCase().includes(query.trim().toLowerCase())), [photos, query, onlySelected, selected]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  function toggle(id: string) { setSelected(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }
  async function download() {
    if (busy || !chosen.length || bytes > MAX_ZIP_BYTES) return;
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true); setPercent(0);
    try {
      const files: { name: string; blob: Blob }[] = [];
      let completed = 0;
      for (const [index, photo] of chosen.entries()) {
        setStatus(`원본 준비 중 · ${index + 1}/${chosen.length}`);
        const blob = await fetchOriginal(photo, controller.signal, received => setPercent(Math.floor((completed + received) / bytes * 100)));
        files.push({ name: photo.name, blob });
        completed += blob.size;
      }
      setStatus('저장 파일 만드는 중…');
      const result = files.length === 1 ? files[0].blob : await createPhotoZip(files);
      controller.signal.throwIfAborted();
      saveBlob(result, files.length === 1 ? files[0].name : '페어그라운드_1회대회_선택사진.zip');
      setStatus('파일 준비 완료. 브라우저의 다운로드 목록을 확인해 주세요.');
    } catch (error) {
      setStatus(controller.signal.aborted ? '다운로드를 취소했습니다. 선택한 사진은 유지됩니다.' : error instanceof Error ? error.message : '다운로드에 실패했습니다. 다시 시도해 주세요.');
    } finally { setBusy(false); abort.current = null; }
  }
  return <main className={styles.library}>
    <header className={styles.hero}>
      <div className={styles.eyebrow}>FAIRGROUND ARCHIVE / 001</div>
      <div className={styles.headingRow}><h1>함께 뛴 순간,<br /><span>그대로 간직해요.</span></h1><div className={styles.albumStamp}>제1회 FAIRGROUND CUP<br /><strong>2026. 10. 03</strong><br />{photos.length.toLocaleString()}장의 기록</div></div>
      <p>마음에 드는 사진을 골라 원본으로 저장하세요.<br />사진을 누르면 원본 화질로 크게 볼 수 있어요.</p>
    </header>
    <section aria-label="사진 자료실" className={styles.collection}>
      <div className={styles.toolbar}>
        <div><h2>대회 사진 자료실 <ArrowUpRight size={20} /></h2><p>제1회 대회 · 원본 JPG</p></div>
        <label className={styles.search}><Search size={18} /><span className="sr-only">사진 파일명 검색</span><input placeholder="사진 번호 또는 파일명 검색" value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} /></label>
      </div>
      <div className={styles.filterbar}><span>{filtered.length.toLocaleString()}장</span><button aria-pressed={onlySelected} onClick={() => { setOnlySelected(!onlySelected); setPage(1); }}>{onlySelected ? '전체 사진 보기' : `선택한 사진만 보기 (${selected.size})`}</button></div>
      {filtered.length === 0 ? <div className={styles.empty}>표시할 사진이 없습니다. 검색어나 선택 목록을 확인해 주세요.</div> : <div className={styles.grid}>
        {visible.map(photo => <article key={photo.id} className={`${styles.card} ${selected.has(photo.id) ? styles.selected : ''}`}>
          <button className={styles.imageButton} onClick={() => setViewer(photo)} disabled={busy} aria-label={`${photo.name} 원본 보기`}><img src={thumbnailUrl(photo.id)} alt={photo.name} loading="lazy" decoding="async" referrerPolicy="no-referrer" /><span className={styles.viewLabel}>원본 보기 ↗</span></button>
          <label className={styles.checkbox}><input type="checkbox" checked={selected.has(photo.id)} disabled={busy} onChange={() => toggle(photo.id)} aria-label={`${photo.name} 선택`} /><span><Check size={17} /></span></label>
          <div className={styles.caption}><span>{photo.name.replace('20261003_페어그라운드', 'PHOTO')}</span><small>{formatBytes(photo.size)}</small></div>
        </article>)}
      </div>}
      <nav aria-label="사진 페이지" className={styles.pagination}><button disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>← 이전</button><label><span className="sr-only">페이지 선택</span><select value={currentPage} onChange={e => setPage(Number(e.target.value))}>{Array.from({ length: pages }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1} / {pages}</option>)}</select></label><button disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}>다음 →</button></nav>
    </section>
    <aside className={styles.downloadBar} aria-label="선택 사진 다운로드">
      <div><strong>{selected.size}장 선택 <span>· {formatBytes(bytes)}</span></strong><p>{bytes > MAX_ZIP_BYTES ? '한 번에 200 MB까지 저장할 수 있어요. 선택을 줄여 주세요.' : '여러 장은 ZIP으로 저장 · 한 번에 최대 200 MB'}</p></div>
      <div className={styles.downloadActions}><button disabled={busy || !selected.size} onClick={() => setSelected(new Set())}>선택 해제</button><button className={styles.primary} disabled={busy || !selected.size || bytes > MAX_ZIP_BYTES} onClick={download}><Download size={18} />{busy ? `${percent}%` : '선택한 원본 저장'}</button>{busy && <button onClick={() => abort.current?.abort()}>취소</button>}</div>
      {status && <div role="status" className={styles.status}>{status}{busy && <progress max={100} value={percent} aria-label="다운로드 진행률" />}</div>}
    </aside>
    {viewer && <PhotoViewer key={viewer.id} photo={viewer} onClose={() => setViewer(null)} />}
  </main>;
}
