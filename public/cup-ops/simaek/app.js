import { prizePlans, schedule } from "./data.js?v=20260923-challenge-roles-v3";
import { cupAwards } from "../data.js?v=20260923-awards-summerholic-v1";

const scheduleList = document.querySelector("#schedule-list");
scheduleList.innerHTML = schedule.map((item) => `
  <article class="schedule-card ${item.kind}${item.highlight ? ` simaek-${item.highlight}` : ""}">
    <div class="schedule-time"><time>${item.time}</time><span>${item.place}</span></div>
    <div class="schedule-body">
      <div class="schedule-title"><h3>${item.title}</h3><span class="tag">${item.tag}</span>${item.highlightLabel ? `<span class="responsibility-tag ${item.highlight}">${item.highlightLabel}</span>` : ""}</div>
      <p>${item.description}</p>
      ${item.link ? `<a class="inline-link" href="${item.link}">${item.linkLabel || "대기팀 이벤트 진행 기준 보기"} <span aria-hidden="true">↓</span></a>` : ""}
      ${item.kind === "close" ? `<details class="official-award-reference"><summary>공식 시상 상품 확인</summary><div class="official-award-content"><p>챌린지·대회 공식 시상 상품입니다. 아래 즉석 이벤트 배정 상품과 별도로 관리합니다.</p><div class="official-award-groups">${cupAwards.map((group) => `<section><h4>${group.title}</h4>${group.awards.map((award) => `<article><strong>${award.title}</strong><ul>${award.items.map((product) => `<li>${product}</li>`).join("")}</ul></article>`).join("")}</section>`).join("")}</div></div></details>` : ""}
    </div>
  </article>
`).join("");

const prizePlansRoot = document.querySelector("#prize-plans");
prizePlansRoot.innerHTML = prizePlans.map((plan) => `
  <article class="prize-card">
    <div class="prize-heading"><div><span>${plan.award}</span><h3>${plan.title}</h3></div><span class="proposal-label">${plan.badge}</span></div>
    <p class="prize-note">${plan.note}</p>
    <div class="products ${plan.products.length === 2 ? "paired" : ""}">
      ${plan.products.map((product) => `
        <figure class="product">
          <div class="product-image"><img src="/cup-ops/simaek/assets/products/${product.image}" alt="${product.alt}" loading="lazy"></div>
          <figcaption><strong>${product.name}</strong><span>${product.quantity}</span></figcaption>
        </figure>
      `).join("")}
    </div>
    <div class="product-guidance">
      <section><h4>촬영할 컷</h4><ol>${plan.shots.map((shot) => `<li>${shot}</li>`).join("")}</ol></section>
      <section><h4>배분 가이드</h4><p>${plan.distribution}</p></section>
    </div>
  </article>
`).join("");

let toastTimer;
function toast(message) {
  const element = document.querySelector("#share-status");
  element.textContent = message;
  element.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove("visible"), 3200);
}

async function sharePage() {
  const url = location.href;
  if (navigator.share) {
    try {
      await navigator.share({ title: document.title, url });
      return;
    } catch (error) {
      if (error.name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast("진행 페이지 링크를 복사했습니다.");
  } catch {
    const dialog = document.querySelector("#share-dialog");
    const input = document.querySelector("#share-url");
    input.value = url;
    dialog.showModal();
    input.select();
  }
}

document.querySelectorAll("[data-share]").forEach((button) => button.addEventListener("click", sharePage));
