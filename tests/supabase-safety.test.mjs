import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const scriptPath = fileURLToPath(
  new URL("../scripts/supabase/check-safety.mjs", import.meta.url),
);

function createFixture({ developmentUrl, productionUrl, developmentFile = ".env.local" }) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "fairground-supabase-safety-"));
  fs.writeFileSync(
    path.join(directory, developmentFile),
    `NEXT_PUBLIC_SUPABASE_URL=${developmentUrl}\n`,
  );
  fs.writeFileSync(
    path.join(directory, ".env.production"),
    `NEXT_PUBLIC_SUPABASE_URL=${productionUrl}\n`,
  );
  return directory;
}

function runCheck(directory, command = "dev", env = {}) {
  return spawnSync(process.execPath, [scriptPath, command], {
    cwd: directory,
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

function removeFixture(directory) {
  fs.rmSync(directory, { recursive: true, force: true });
}

test("운영 프로젝트를 개발 환경에서 사용하면 차단하고 전체 ref는 숨긴다", () => {
  const productionRef = "productionref123456";
  const directory = createFixture({
    developmentUrl: `https://${productionRef}.supabase.co`,
    productionUrl: `https://${productionRef}.supabase.co`,
  });

  try {
    const result = runCheck(directory);
    const output = `${result.stdout}${result.stderr}`;

    assert.equal(result.status, 1);
    assert.match(output, /차단: 개발 환경이 운영 Supabase를 사용하고 있습니다/);
    assert.doesNotMatch(output, new RegExp(productionRef));
  } finally {
    removeFixture(directory);
  }
});
test(".env.development.local의 별도 개발 프로젝트를 우선 사용한다", () => {
  const productionRef = "productionref123456";
  const developmentRef = "developmentref654321";
  const directory = createFixture({
    developmentUrl: `https://${productionRef}.supabase.co`,
    productionUrl: `https://${productionRef}.supabase.co`,
  });
  fs.writeFileSync(
    path.join(directory, ".env.development.local"),
    `NEXT_PUBLIC_SUPABASE_URL=https://${developmentRef}.supabase.co\n`,
  );

  try {
    const result = runCheck(directory);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /안전 확인: 개발 환경과 운영 Supabase가 분리되어 있습니다/);
  } finally {
    removeFixture(directory);
  }
});

test("로컬 Supabase URL은 안전한 개발 대상으로 허용한다", () => {
  const directory = createFixture({
    developmentFile: ".env.development.local",
    developmentUrl: "http://127.0.0.1:54321",
    productionUrl: "https://productionref123456.supabase.co",
  });

  try {
    const result = runCheck(directory);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /개발 환경: 로컬 Supabase/);
  } finally {
    removeFixture(directory);
  }
});

test("명시적 우회는 dev 검사 한 번에만 적용한다", () => {
  const productionRef = "productionref123456";
  const directory = createFixture({
    developmentUrl: `https://${productionRef}.supabase.co`,
    productionUrl: `https://${productionRef}.supabase.co`,
  });

  try {
    const devResult = runCheck(directory, "dev", {
      FAIRGROUND_ALLOW_PRODUCTION_SUPABASE_DEV: "1",
    });
    const statusResult = runCheck(directory, "status", {
      FAIRGROUND_ALLOW_PRODUCTION_SUPABASE_DEV: "1",
    });

    assert.equal(devResult.status, 0);
    assert.equal(statusResult.status, 1);
  } finally {
    removeFixture(directory);
  }
});
