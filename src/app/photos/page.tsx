import type { Metadata } from 'next';
import { PhotoLibrary } from '@/features/photo-library/photo-library';
import album from '@/features/photo-library/data/cup-2026.json';

export const metadata: Metadata = {
  title: '대회 사진 자료실',
  description: '제1회 FairGround 대회의 순간들. 사진을 선택하고 원본 화질로 바로 저장하세요.',
  alternates: { canonical: '/photos' },
};
export default function PhotosPage() { return <PhotoLibrary photos={album.photos} />; }
