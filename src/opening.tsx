import { createRoot } from "react-dom/client";
import { ArrowDownRight, ArrowUpRight, Flower2 } from "lucide-react";
import { InteractiveHoverButton } from "./components/interactive-hover-button";

type OpeningProps = { leaving: boolean; onEnter: () => void };

function Opening({ leaving, onEnter }: OpeningProps) {
  return (
    <section
      className={`opening-screen ${leaving ? "is-leaving" : ""}`}
      aria-label="向阳而生，作品入口"
    >
      <div className="opening-shade" aria-hidden="true" />
      <div className="film-grain" aria-hidden="true" />
      <div className="opening-nav entry-reveal">
        <a href="#opening" className="opening-brand" aria-label="向阳而生首页">
          <Flower2 size={26} strokeWidth={1.2} />
          <span>
            向阳而生<small>CODE IN BLOOM</small>
          </span>
        </a>
        <span className="opening-occasion">
          浙江工业大学 · 计算机学院<span>办学四十周年献礼</span>
        </span>
        <span className="edition">
          EST. 1986 <span>—</span> 2026
        </span>
      </div>
      <div className="opening-topline entry-reveal">
        <span>
          / GENERATIVE ART
          <br />/ A COLLECTIVE WISH
          <br />/ GROW TOWARDS THE LIGHT
        </span>
        <p>
          四十载，写下万千可能。
          <br />
          <span>这一束光，等你来点亮。</span>
        </p>
      </div>
      <div className="macro-label entry-reveal" aria-hidden="true">
        <span className="macro-cross">+</span>
        <span>
          光的种子<small>01 / THE SEED OF LIGHT</small>
        </span>
      </div>
      <div className="opening-bottom">
        <div className="opening-copy">
          <p className="opening-badge entry-reveal">
            <span />
            代码亦有诗意 <span className="badge-slash">/</span> 四十正青春
          </p>
          <h1 className="entry-reveal">
            让代码成光
            <br />
            <span>让热爱生长</span>
          </h1>
          <div className="opening-actions entry-reveal">
            <InteractiveHoverButton
              id="enterGarden"
              onClick={onEnter}
              disabled={leaving}
              aria-label="进入花海，开始向阳之旅"
            >
              进入花海
            </InteractiveHoverButton>
            <span className="opening-invitation">
              拾起一句祝福
              <br />
              <span>看万千微光，成为葵仔手中的光。</span>
            </span>
          </div>
        </div>
        <aside className="opening-dedication entry-reveal">
          <span className="dedication-line">
            <span>TO EVERY LINE OF LOVE</span>
            <ArrowUpRight size={17} strokeWidth={1.4} />
          </span>
          <p>
            从一行代码，
            <br />
            到一片向阳的未来。
          </p>
          <div>
            <span>
              学院办学 <b>40</b> 周年
            </span>
            <span>
              学校建校 <b>73</b> 周年
            </span>
          </div>
        </aside>
      </div>
      <div className="opening-foot entry-reveal">
        <span>厚德健行 · 向阳而生</span>
        <span>
          一次由你点亮的生成艺术旅程 <ArrowDownRight size={13} />
        </span>
        <span>INTERACTIVE EXPERIENCE / 2026</span>
      </div>
    </section>
  );
}

// Opening and garden share a renderer; switching UI never creates a second WebGL context.
export function mountOpening({
  onEnter,
  onReturn,
}: {
  onEnter: () => void;
  onReturn: () => void;
}) {
  const host = document.getElementById("opening-root")!;
  const garden = document.getElementById("garden-ui")!;
  const stage = document.getElementById("stage")!;
  const root = createRoot(host);
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let active = true;
  let leaving = false;
  let travel = 0;
  const duration = 3.6;
  function draw() {
    root.render(<Opening leaving={leaving} onEnter={enter} />);
  }
  function enter() {
    if (!active || leaving) return;
    leaving = true;
    travel = 0;
    document.body.dataset.entryTransition = "true";
    host.inert = true;
    host.setAttribute("aria-hidden", "true");
    (document.activeElement as HTMLElement | null)?.blur();
    draw();
    if (reducedMotion.matches) finish();
  }
  function finish() {
    travel = 1;
    active = false;
    leaving = false;
    garden.inert = false;
    garden.removeAttribute("aria-hidden");
    stage.inert = false;
    document.body.dataset.view = "garden";
    onEnter();
    document.body.dataset.entryTransition = "false";
    document.getElementById("awaken")?.focus({ preventScroll: true });
  }
  function advance(dt: number) {
    if (!leaving) return travel;
    // RAF time also pauses on hidden tabs; no detached timeout can skip a half-rendered shot.
    travel = Math.min(1, travel + dt / duration);
    if (reducedMotion.matches || travel >= 1) finish();
    return travel;
  }
  function show() {
    leaving = false;
    travel = 0;
    onReturn();
    active = true;
    garden.inert = true;
    garden.setAttribute("aria-hidden", "true");
    stage.inert = true;
    host.inert = false;
    host.removeAttribute("aria-hidden");
    document.body.dataset.view = "opening";
    document.body.dataset.entryTransition = "false";
    draw();
    requestAnimationFrame(() =>
      document.getElementById("enterGarden")?.focus({ preventScroll: true }),
    );
  }
  stage.inert = true;
  draw();
  document.getElementById("returnOpening")!.onclick = show;
  return {
    get active() {
      return active;
    },
    get transitioning() {
      return leaving;
    },
    get progress() {
      return travel;
    },
    duration,
    advance,
    enter,
    show,
  };
}
