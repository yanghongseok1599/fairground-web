#!/usr/bin/env node
/**
 * legal_documents 시드 행을 출력한다. 약관·처리방침·동의 문구를 바꿔 version 을 올렸을 때,
 * 새 마이그레이션의 insert ... values 에 이 출력을 붙여 넣는다. DB 에는 아무것도 쓰지 않는다.
 *   node scripts/legal/print-legal-documents-sql.mjs
 * tests/site-essentials.test.mjs 가 마이그레이션의 해시·본문과 src/content 문서를 대조한다.
 */
import { createHash } from "node:crypto";
import { moduleLoader } from "../../tests/helpers/load-ts-module.mjs";

const { SEEDED_LEGAL_DOCUMENTS } = moduleLoader()("src/content/signup-consents.ts");
const quote = (value) => `'${value.replaceAll("'", "''")}'`;
const rows = SEEDED_LEGAL_DOCUMENTS.map((doc) => {
  const hash = createHash("sha256").update(JSON.stringify({ kind: doc.kind, version: doc.version, sections: doc.sections })).digest("hex");
  // effective_at 은 비워 둔다. 시행일은 운영자가 정해 별도 마이그레이션으로 기록한다.
  return `  (${quote(doc.kind)}, ${quote(doc.version)}, ${quote(hash)}, ${quote(JSON.stringify(doc))}::jsonb)`;
});
console.log(`${rows.join(",\n")}`);
