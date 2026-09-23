import { prizePlans, schedule } from "./data.js?v=20260923-sponsor-cut-guide-v2";

const scheduleList = document.querySelector("#schedule-list");
scheduleList.innerHTML = schedule.map((item) => `
  <article class="schedule-card ${item.kind}${item.highlight ? ` simaek-${item.highlight}` : ""}">
    <div class="schedule-time"><time>${item.time}</time><span>${item.place}</span></div>
    <div class="schedule-body">
      <div class="schedule-title"><h3>${item.title}</h3><span class="tag">${item.tag}</span>${item.highlightLabel ? `<span class="responsibility-tag ${item.highlight}">${item.highlightLabel}</span>` : ""}</div>
      <p>${item.description}</p>
      ${item.link ? `<a class="inline-link" href="${item.link}">대기팀 이벤트 진행 기준 보기 <span aria-hidden="true">↓</span></a>` : ""}
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
