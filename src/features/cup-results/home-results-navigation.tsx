import { useRef, type KeyboardEvent } from "react";
import { ListOrdered, Medal, Shield, Star, Target, Trophy, type LucideIcon } from "lucide-react";
import { HOME_RESULT_TABS, HOME_RESULTS_PANEL_ID, homeResultTabId, type HomeResultTab } from "./home-result-tabs";
import styles from "./home-results-navigation.module.css";

const icons: Record<HomeResultTab, LucideIcon> = {
  overview: Trophy,
  "top-scorer": Target,
  goalkeeper: Shield,
  "mens-mom": Medal,
  "womens-mom": Star,
  "match-moms": ListOrdered,
};

export function HomeResultsNavigation({ selected, onSelect }: {
  selected: HomeResultTab;
  onSelect: (id: HomeResultTab, scrollToResult: boolean) => void;
}) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  function moveFocus(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    if (event.key === "ArrowRight") next = (index + 1) % HOME_RESULT_TABS.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + HOME_RESULT_TABS.length) % HOME_RESULT_TABS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = HOME_RESULT_TABS.length - 1;
    else return;

    event.preventDefault();
    onSelect(HOME_RESULT_TABS[next].id, false);
    buttons.current[next]?.focus({ preventScroll: true });
    buttons.current[next]?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  return (
    <div className={styles.rail} role="tablist" aria-label="대회 결과와 개인상" aria-orientation="horizontal">
      {HOME_RESULT_TABS.map((tab, index) => {
        const Icon = icons[tab.id];
        return (
          <button
            key={tab.id}
            ref={node => { buttons.current[index] = node; }}
            type="button"
            role="tab"
            id={homeResultTabId(tab.id)}
            aria-controls={HOME_RESULTS_PANEL_ID}
            aria-selected={selected === tab.id}
            tabIndex={selected === tab.id ? 0 : -1}
            className={styles.tab}
            onClick={() => onSelect(tab.id, true)}
            onKeyDown={event => moveFocus(event, index)}
          >
            <Icon size={17} strokeWidth={1.8} aria-hidden />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
