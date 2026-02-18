"use client";

import { useState, useEffect, useCallback } from "react";
import { ref, get, push, set, remove } from "firebase/database";
import { database, isDemoMode } from "@/config/firebase";
import { useAuthStore } from "@/stores/authStore";
import { PenLine, X, Heart, CheckCircle, Send } from "lucide-react";

export interface BoardComment {
  id: string;
  authorId: string;
  authorName: string;
  authorPhotoUrl?: string;
  teamName?: string;
  content: string;
  createdAt: number;
}

export interface BoardPost {
  id: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  authorPhotoUrl?: string;
  teamName?: string;
  createdAt: number;
  likes?: Record<string, boolean>;
  confirms?: Record<string, boolean>;
}

type WriteRole = "admin" | "any" | "team";

interface BoardPageProps {
  pageTitle: string;
  pageSubtitle: string;
  label: string;
  accentColor: string;
  dbPath: string;
  writeRole: WriteRole;
  demoPosts: BoardPost[];
  showTeamBadge?: boolean;
  requiredTeamId?: string;
  hideHeader?: boolean;
}

const AVATAR_COLORS = [
  "#00C853", "#4FC3F7", "#FFD700", "#FF6B6B", "#CE93D8",
  "#FFA726", "#69F0AE", "#42A5F5", "#FF80AB",
];
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[Math.abs(h)];
}
function formatDate(ts: number) {
  const diffMs = Date.now() - ts;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}시간 전`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}일 전`;
  const d = new Date(ts);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function Avatar({ name, photoUrl, size = 9 }: { name: string; photoUrl?: string; size?: number }) {
  const color = avatarColor(name);
  const cls = `w-${size} h-${size} rounded-full flex-shrink-0`;
  if (photoUrl) return <img src={photoUrl} alt={name} className={`${cls} object-cover`} />;
  return (
    <div className={`${cls} flex items-center justify-center font-black text-xs`} style={{ background: `${color}22`, color }}>
      {name.slice(0, 1)}
    </div>
  );
}

// Demo comments seeded per post
const DEMO_COMMENTS: Record<string, BoardComment[]> = {
  tb1: [
    { id: "c1", authorId: "u1", authorName: "박상훈", content: "저도 컨디션 관리 중입니다! 화이팅!", createdAt: Date.now() - 1000 * 60 * 40 },
    { id: "c2", authorId: "u2", authorName: "김도현", content: "부상 조심하세요 다들~", createdAt: Date.now() - 1000 * 60 * 20 },
  ],
  tb2: [
    { id: "c3", authorId: "u3", authorName: "이준혁", content: "목요일 미팅 참석합니다!", createdAt: Date.now() - 1000 * 60 * 50 },
  ],
  b1: [{ id: "c4", authorId: "u4", authorName: "최서연", content: "저도 참가하고 싶어요!", createdAt: Date.now() - 1000 * 60 * 10 }],
  n1: [],
};

export function BoardPage({
  pageTitle, pageSubtitle, label, accentColor, dbPath, writeRole,
  demoPosts, showTeamBadge, requiredTeamId, hideHeader,
}: BoardPageProps) {
  const { user, player } = useAuthStore();
  const [posts, setPosts] = useState<BoardPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Per-post interactions (demo state)
  const [localLikes, setLocalLikes] = useState<Record<string, boolean>>({});
  const [localConfirms, setLocalConfirms] = useState<Record<string, boolean>>({});
  const [comments, setComments] = useState<Record<string, BoardComment[]>>(DEMO_COMMENTS);
  const [commentInput, setCommentInput] = useState<Record<string, string>>({});
  const [submittingComment, setSubmittingComment] = useState<Record<string, boolean>>({});

  const canWrite =
    writeRole === "any" ? user !== null
    : writeRole === "admin" ? player?.role === "admin"
    : writeRole === "team" ? user !== null && player?.teamId === requiredTeamId
    : false;

  const fetchPosts = useCallback(async () => {
    if (isDemoMode) { setPosts(demoPosts); setLoading(false); return; }
    try {
      const snap = await get(ref(database, dbPath));
      if (snap.exists()) {
        const data = snap.val() as Record<string, Omit<BoardPost, "id">>;
        const list = Object.entries(data).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.createdAt - a.createdAt);
        setPosts(list.length > 0 ? list : demoPosts);
      } else setPosts(demoPosts);
    } catch { setPosts(demoPosts); }
    setLoading(false);
  }, [dbPath, demoPosts]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const handleSubmit = async () => {
    if (!formTitle.trim() || !formContent.trim() || !user || !player) return;
    setSubmitting(true);
    const post: Omit<BoardPost, "id"> = {
      title: formTitle.trim(), content: formContent.trim(),
      authorId: user.uid, authorName: player.name,
      authorPhotoUrl: player.profilePhotoUrl || player.photoUrl || "",
      teamName: player.teamName || "",
      createdAt: Date.now(),
    };
    if (!isDemoMode) {
      const newRef = push(ref(database, dbPath));
      await set(newRef, post);
    } else {
      setPosts((prev) => [{ id: `local_${Date.now()}`, ...post }, ...prev]);
    }
    setFormTitle(""); setFormContent(""); setShowForm(false); setSubmitting(false);
    if (!isDemoMode) fetchPosts();
  };

  const toggleLike = async (postId: string) => {
    if (!user) return;
    const already = localLikes[postId] || (posts.find(p => p.id === postId)?.likes?.[user.uid]);
    if (isDemoMode) {
      setLocalLikes(prev => ({ ...prev, [postId]: !already }));
      setPosts(prev => prev.map(p => {
        if (p.id !== postId) return p;
        const likes = { ...(p.likes || {}) };
        if (already) delete likes[user.uid]; else likes[user.uid] = true;
        return { ...p, likes };
      }));
      return;
    }
    const likeRef = ref(database, `${dbPath}/${postId}/likes/${user.uid}`);
    if (already) await remove(likeRef); else await set(likeRef, true);
    fetchPosts();
  };

  const toggleConfirm = async (postId: string) => {
    if (!user) return;
    const already = localConfirms[postId] || (posts.find(p => p.id === postId)?.confirms?.[user.uid]);
    if (isDemoMode) {
      setLocalConfirms(prev => ({ ...prev, [postId]: !already }));
      setPosts(prev => prev.map(p => {
        if (p.id !== postId) return p;
        const confirms = { ...(p.confirms || {}) };
        if (already) delete confirms[user.uid]; else confirms[user.uid] = true;
        return { ...p, confirms };
      }));
      return;
    }
    const confirmRef = ref(database, `${dbPath}/${postId}/confirms/${user.uid}`);
    if (already) await remove(confirmRef); else await set(confirmRef, true);
    fetchPosts();
  };

  const loadComments = async (postId: string) => {
    if (isDemoMode || comments[postId]) return;
    try {
      const snap = await get(ref(database, `${dbPath}/${postId}/comments`));
      if (snap.exists()) {
        const data = snap.val() as Record<string, Omit<BoardComment, "id">>;
        const list = Object.entries(data).map(([id, v]) => ({ id, ...v })).sort((a, b) => a.createdAt - b.createdAt);
        setComments(prev => ({ ...prev, [postId]: list }));
      } else setComments(prev => ({ ...prev, [postId]: [] }));
    } catch { setComments(prev => ({ ...prev, [postId]: [] })); }
  };

  const submitComment = async (postId: string) => {
    const text = commentInput[postId]?.trim();
    if (!text || !user || !player) return;
    setSubmittingComment(prev => ({ ...prev, [postId]: true }));
    const comment: Omit<BoardComment, "id"> = {
      authorId: user.uid, authorName: player.name,
      authorPhotoUrl: player.profilePhotoUrl || player.photoUrl || "",
      teamName: player.teamName || "",
      content: text, createdAt: Date.now(),
    };
    if (!isDemoMode) {
      const cRef = push(ref(database, `${dbPath}/${postId}/comments`));
      await set(cRef, comment);
      await loadComments(postId);
    } else {
      const newC: BoardComment = { id: `lc_${Date.now()}`, ...comment };
      setComments(prev => ({ ...prev, [postId]: [...(prev[postId] || []), newC] }));
    }
    setCommentInput(prev => ({ ...prev, [postId]: "" }));
    setSubmittingComment(prev => ({ ...prev, [postId]: false }));
  };

  return (
    <div className={hideHeader ? "" : "pt-[60px] min-h-screen"} style={{ background: hideHeader ? "#F0F4F8" : "#0D1B2A" }}>
      {/* Page header */}
      {!hideHeader && (
        <div className="py-16 px-6 md:px-10" style={{ background: "#0D1B2A" }}>
          <div className="max-w-4xl mx-auto">
            <p className="text-[11px] uppercase tracking-[3px] mb-4" style={{ fontFamily: "var(--font-space-mono)", color: accentColor }}>{label}</p>
            <h1 className="font-black leading-none mb-2" style={{ fontFamily: "var(--font-outfit)", fontSize: "clamp(36px, 6vw, 64px)", letterSpacing: "-2px", color: "#FAFCFF" }}>{pageTitle}</h1>
            <p className="text-sm" style={{ color: "#627D98" }}>{pageSubtitle}</p>
          </div>
        </div>
      )}

      {/* Board body */}
      <div style={{ background: "#F0F4F8" }}>
        <div className="px-4 md:px-8 py-6 max-w-3xl mx-auto">
          {/* Toolbar */}
          <div className="flex items-center justify-between mb-5">
            <span className="text-xs font-medium" style={{ color: "#8FA3B8", fontFamily: "var(--font-space-mono)" }}>{posts.length}개의 게시물</span>
            {canWrite && (
              <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-80 transition-opacity" style={{ background: accentColor, color: "#fff" }}>
                <PenLine className="w-3.5 h-3.5" /> 글쓰기
              </button>
            )}
          </div>

          {/* Write form */}
          {showForm && (
            <div className="mb-4 rounded-2xl p-5 shadow-sm" style={{ background: "#fff", border: `2px solid ${accentColor}40` }}>
              <div className="flex items-center justify-between mb-4">
                <span className="font-bold text-sm" style={{ color: "#0D1B2A" }}>새 글 작성</span>
                <button onClick={() => setShowForm(false)} style={{ color: "#8FA3B8" }}><X className="w-4 h-4" /></button>
              </div>
              <div className="space-y-2.5">
                <input type="text" placeholder="제목" value={formTitle} onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={{ background: "#F0F4F8", border: "1px solid #D9E2EC", color: "#0D1B2A" }} />
                <textarea placeholder="내용을 입력하세요" value={formContent} onChange={(e) => setFormContent(e.target.value)}
                  rows={5} className="w-full px-4 py-2.5 rounded-xl text-sm outline-none resize-none" style={{ background: "#F0F4F8", border: "1px solid #D9E2EC", color: "#0D1B2A" }} />
              </div>
              <div className="flex gap-2.5 mt-3">
                <button onClick={() => setShowForm(false)} className="flex-1 py-2 rounded-xl text-sm font-semibold" style={{ background: "#D9E2EC", color: "#627D98" }}>취소</button>
                <button onClick={handleSubmit} disabled={!formTitle.trim() || !formContent.trim() || submitting}
                  className="flex-1 py-2 rounded-xl text-sm font-semibold disabled:opacity-40" style={{ background: accentColor, color: "#fff" }}>
                  {submitting ? "등록 중..." : "등록"}
                </button>
              </div>
            </div>
          )}

          {/* Post feed */}
          {loading ? (
            <div className="py-12 text-center text-sm" style={{ color: "#8FA3B8" }}>불러오는 중...</div>
          ) : posts.length === 0 ? (
            <div className="py-12 text-center text-sm rounded-2xl" style={{ background: "#fff", color: "#8FA3B8" }}>아직 게시물이 없습니다.</div>
          ) : (
            <div className="space-y-3">
              {posts.map((post) => {
                const likeCount = Object.keys(post.likes || {}).length;
                const confirmCount = Object.keys(post.confirms || {}).length;
                const commentList = comments[post.id] || [];
                const isLiked = user ? !!(post.likes?.[user.uid] || localLikes[post.id]) : false;
                const isConfirmed = user ? !!(post.confirms?.[user.uid] || localConfirms[post.id]) : false;

                return (
                  <div key={post.id} className="rounded-2xl overflow-hidden shadow-sm" style={{ background: "#fff" }}>
                    {/* Post body */}
                    <div className="p-5">
                      {/* Author */}
                      <div className="flex items-center gap-3 mb-3">
                        <Avatar name={post.authorName} photoUrl={post.authorPhotoUrl} size={9} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm" style={{ color: "#0D1B2A" }}>
                              {post.authorName}{post.teamName ? ` / ${post.teamName}` : ""}
                            </span>
                          </div>
                          <span className="text-xs" style={{ color: "#8FA3B8", fontFamily: "var(--font-space-mono)" }}>{formatDate(post.createdAt)}</span>
                        </div>
                      </div>
                      <p className="font-bold text-sm mb-2 leading-snug" style={{ color: "#0D1B2A" }}>{post.title}</p>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "#4A5568" }}>{post.content}</p>
                    </div>

                    {/* Action bar — 좋아요 + 확인 */}
                    <div className="flex items-center gap-1 px-4 py-2.5" style={{ borderTop: "1px solid #F0F4F8" }}>
                      {/* 좋아요 */}
                      <button
                        onClick={() => toggleLike(post.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                        style={{ background: isLiked ? "#FCE4EC" : "transparent", color: isLiked ? "#E91E63" : "#8FA3B8" }}
                      >
                        <Heart className="w-3.5 h-3.5" fill={isLiked ? "#E91E63" : "none"} />
                        좋아요 {likeCount > 0 ? likeCount : ""}
                      </button>
                      {/* 확인 */}
                      <button
                        onClick={() => toggleConfirm(post.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                        style={{ background: isConfirmed ? "#E3F2FD" : "transparent", color: isConfirmed ? "#1E88E5" : "#8FA3B8" }}
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        확인 {confirmCount > 0 ? confirmCount : ""}
                      </button>
                    </div>

                    {/* Comment section — always visible */}
                    <div className="px-4 pb-4" style={{ borderTop: "1px solid #F0F4F8" }}>
                      {/* Comment list */}
                      {commentList.length > 0 && (
                        <div className="pt-3 space-y-3 mb-3">
                          {commentList.map((c) => (
                            <div key={c.id} className="flex items-start gap-2.5">
                              <Avatar name={c.authorName} photoUrl={c.authorPhotoUrl} size={7} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-baseline gap-2 mb-0.5">
                                  <span className="font-semibold text-xs" style={{ color: "#0D1B2A" }}>{c.authorName}{c.teamName ? ` / ${c.teamName}` : ""}</span>
                                  <span className="text-[10px]" style={{ color: "#8FA3B8", fontFamily: "var(--font-space-mono)" }}>{formatDate(c.createdAt)}</span>
                                </div>
                                <p className="text-xs leading-relaxed" style={{ color: "#4A5568" }}>{c.content}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Comment input */}
                      {user ? (
                        <div className="flex items-center gap-2 pt-3" style={{ borderTop: commentList.length > 0 ? "1px solid #F0F4F8" : "none" }}>
                          <Avatar name={player?.name || "?"} photoUrl={player?.profilePhotoUrl || player?.photoUrl} size={7} />
                          <div className="flex-1 flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "#F0F4F8" }}>
                            <input
                              type="text"
                              placeholder="댓글 달기..."
                              value={commentInput[post.id] || ""}
                              onChange={(e) => setCommentInput(prev => ({ ...prev, [post.id]: e.target.value }))}
                              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitComment(post.id); } }}
                              className="flex-1 text-xs outline-none bg-transparent"
                              style={{ color: "#0D1B2A" }}
                            />
                            <button
                              onClick={() => submitComment(post.id)}
                              disabled={!commentInput[post.id]?.trim() || submittingComment[post.id]}
                              className="disabled:opacity-30 transition-opacity"
                              style={{ color: accentColor }}
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs pt-3 text-center" style={{ color: "#8FA3B8" }}>로그인 후 댓글을 달 수 있습니다</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
