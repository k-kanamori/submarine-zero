"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";
import { useGameStore } from "./store";

const UnderwaterGame = dynamic(() => import("./UnderwaterGame"), {
  ssr: false,
  loading: () => (
    <div className="loading-screen">
      <div className="loading-sonar" />
      <p>潜航システムを起動中...</p>
    </div>
  ),
});

const controls = [
  ["W / S", "前進・後退"],
  ["A / D", "左右スライド"],
  ["Space / Ctrl", "上昇・下降"],
  ["マウス / 矢印", "旋回"],
  ["Q", "アクティブソナー"],
  ["E / 右クリック", "標的ロック"],
  ["左クリック", "魚雷発射"],
  ["Tab / ホイール", "魚雷切替"],
  ["R", "機雷"],
  ["F", "デコイ"],
  ["Shift", "ブースト"],
  ["Esc", "ポーズ"],
];

function Emblem() {
  return (
    <div className="emblem" aria-hidden="true">
      <span className="emblem-ring ring-a" />
      <span className="emblem-ring ring-b" />
      <span className="emblem-zero">0</span>
    </div>
  );
}

export default function GameShell() {
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const store = useGameStore();

  if (!mounted) return <div className="app-shell" />;

  return (
    <main className="app-shell">
      {store.screen === "title" && (
        <section className="title-screen">
          <div className="ocean-grain" />
          <div className="title-copy">
            <p className="eyebrow">THIRD-PERSON SUBMARINE ACTION</p>
            <h1>
              <span>深海の</span>
              <strong>ゼロ</strong>
            </h1>
            <p className="title-tagline">闇に音を放ち、獲物を見つけ、重い一撃を見届ける。</p>
          </div>
          <Emblem />
          <nav className="title-menu" aria-label="メインメニュー">
            <button className="primary-action" onClick={() => store.setScreen("briefing")}>
              <small>BOUNTY 001</small>
              潜航を開始
            </button>
            <button onClick={() => store.setShowControls(true)}>操作方法</button>
            <p className="best-score">BEST BOUNTY {store.bestScore.toLocaleString()}</p>
          </nav>
          <div className="title-coordinates">71°10&apos;N / ICE SECTOR 04</div>
        </section>
      )}

      {store.screen === "briefing" && (
        <section className="briefing-screen">
          <header className="briefing-header">
            <button className="back-button" onClick={() => store.setScreen("title")}>← 戻る</button>
            <p>BOUNTY NETWORK // SECURE CHANNEL</p>
          </header>
          <div className="briefing-grid">
            <article className="mission-card">
              <p className="eyebrow">MISSION 01</p>
              <h2>白夜の墓標</h2>
              <div className="mission-visual">
                <div className="disc-sub"><i /><i /><i /></div>
                <span className="scanline" />
              </div>
              <dl>
                <div><dt>海域</dt><dd>極域・第4氷海</dd></div>
                <div><dt>標的</dt><dd>円盤型巨大潜水艦</dd></div>
                <div><dt>護衛</dt><dd>無人潜航艇 10隻</dd></div>
                <div><dt>報酬</dt><dd>240,000 CR</dd></div>
              </dl>
            </article>
            <article className="briefing-copy">
              <p className="speaker">AI // NIX</p>
              <blockquote>
                「二十年も一緒にいると、君が無謀な依頼を選ぶ瞬間くらい分かる。
                今回の獲物は氷床の下だ。音を出せば、向こうもこちらを知る」
              </blockquote>
              <h3>任務概要</h3>
              <p>
                観測施設との通信が途絶した。周辺では正体不明の円盤型潜水艦が確認されている。
                護衛艇を突破し、標的を発見・撃破せよ。
              </p>
              <h3>選択中の機体</h3>
              <div className="vehicle-select">
                <button
                  className={store.selectedVehicle === "zero-skiff" ? "selected" : ""}
                  onClick={() => store.selectVehicle("zero-skiff")}
                >
                  <strong>ZERO SKIFF</strong>
                  <span>機動性 A / 耐久 C</span>
                </button>
                <button
                  disabled={!store.unlockedVehicles.includes("manta-x1")}
                  className={store.selectedVehicle === "manta-x1" ? "selected" : ""}
                  onClick={() => store.selectVehicle("manta-x1")}
                >
                  <strong>MANTA X-1</strong>
                  <span>{store.unlockedVehicles.includes("manta-x1") ? "機動性 B / 耐久 A" : "未発見"}</span>
                </button>
              </div>
              <div className="briefing-actions">
                <button onClick={() => store.setShowControls(true)}>操作確認</button>
                <button className="primary-action" onClick={() => store.setScreen("playing")}>出撃する</button>
              </div>
            </article>
          </div>
        </section>
      )}

      {store.screen === "playing" && (
        <UnderwaterGame
          vehicle={store.selectedVehicle}
          onExit={() => store.setScreen("title")}
          onComplete={store.completeMission}
        />
      )}

      {store.screen === "result" && store.lastResult && (
        <section className="result-screen">
          <div className="result-panel">
            <p className="eyebrow">MISSION COMPLETE</p>
            <h2>白夜の墓標</h2>
            <p className="result-rank">
              {store.lastResult.score >= 16000 ? "S" : store.lastResult.score >= 11000 ? "A" : "B"}
            </p>
            <dl>
              <div><dt>撃破数</dt><dd>{store.lastResult.enemiesDestroyed}</dd></div>
              <div>
                <dt>作戦時間</dt>
                <dd>
                  {Math.floor(store.lastResult.elapsedSeconds / 60)}:
                  {String(Math.floor(store.lastResult.elapsedSeconds % 60)).padStart(2, "0")}
                </dd>
              </div>
              <div><dt>獲得報酬</dt><dd>{store.lastResult.score.toLocaleString()} CR</dd></div>
            </dl>
            {store.lastResult.vehicleDiscovered && (
              <div className="unlock-notice">
                <span>NEW VEHICLE</span>
                <strong>MANTA X-1 をアンロック</strong>
              </div>
            )}
            <blockquote>
              NIX「円盤の識別符号、二十年前の記録と一致した。偶然だと思いたい？」
            </blockquote>
            <div className="result-actions">
              <button onClick={() => store.setScreen("title")}>タイトルへ</button>
              <button className="primary-action" onClick={() => store.setScreen("briefing")}>再出撃</button>
            </div>
          </div>
        </section>
      )}

      {store.showControls && (
        <div className="modal-backdrop" onClick={() => store.setShowControls(false)}>
          <section className="controls-modal" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => store.setShowControls(false)}>×</button>
            <p className="eyebrow">CONTROL SCHEME</p>
            <h2>操艦マニュアル</h2>
            <div className="control-grid">
              {controls.map(([key, action]) => (
                <div key={key}><kbd>{key}</kbd><span>{action}</span></div>
              ))}
            </div>
            <p className="controller-note">
              ゲームパッド対応：左スティックで移動、右スティックで旋回、LB/RBで下降・上昇、
              LTでロック、RTで射撃。
            </p>
          </section>
        </div>
      )}
    </main>
  );
}
