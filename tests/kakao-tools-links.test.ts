import assert from "node:assert/strict";
import { getChannelChatUrl, getTournamentShareUrl, getVenueSearchUrl } from "../src/features/kakao-tools/links.ts";

assert.equal(getVenueSearchUrl("  "), null);
assert.equal(getVenueSearchUrl("동해 풋살장"), `https://map.kakao.com/link/search/${encodeURIComponent("동해 풋살장")}`);
assert.equal(getChannelChatUrl("https://pf.kakao.com/_example"), "https://pf.kakao.com/_example/chat");
assert.equal(getChannelChatUrl("https://pf.kakao.com/_example/chat/"), "https://pf.kakao.com/_example/chat");
for (const value of [undefined, "", "javascript:alert(1)", "https://pf.kakao.com.evil.test/_abc", "http://pf.kakao.com/_abc", "https://user:pass@pf.kakao.com/_abc", "https://pf.kakao.com/"]) {
  assert.equal(getChannelChatUrl(value), null);
}
assert.equal(getTournamentShareUrl("https://fairground-kor.com", "cup/1", "match1"), "https://fairground-kor.com/tournaments/cup%2F1#match-match1");
console.log("카카오 도구 링크 검증 통과");
