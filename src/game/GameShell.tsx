"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";
import { useGameStore } from "./store";
import { STAGES, type StageId } from "./stages";

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
  ["E / 右クリック", "標的ロック・対象切替"],
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
  const mission = STAGES[store.selectedStage];
  const resultStage = store.lastResult?.stageId ?? store.selectedStage;

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
              <small>BOUNTY 00{store.selectedStage}</small>
              潜航を開始
            </button>
            <button onClick={() => store.setShowControls(true)}>操作方法</button>
            <p className="best-score">BEST BOUNTY {store.bestScore.toLocaleString()}</p>
          </nav>
          <div className="title-coordinates">{store.selectedStage === 1 ? "71°10'N / " : "CALDERA / "}{mission.sector}</div>
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
              <div className="stage-select" aria-label="ステージ選択">
                {([1, 2] as StageId[]).map((id) => <button key={id}
                  aria-pressed={store.selectedStage === id}
                  onClick={() => store.selectStage(id)}>
                  STAGE 0{id} / {STAGES[id].title}{store.clearedStages.includes(id) ? " ✓" : ""}
                </button>)}
              </div>
              <p className="eyebrow">MISSION 0{store.selectedStage}</p>
              <h2>{mission.title}</h2>
              <div className="mission-visual">
                {store.selectedStage === 2
                  ? <div className="ash-wing-briefing" role="img" aria-label="双発・長翼の飛行機型潜水艦 ASH WING" />
                  : <div className="disc-sub"><i /><i /><i /></div>}
                <span className="scanline" />
              </div>
              <dl>
                <div><dt>海域</dt><dd>{mission.area}</dd></div>
                <div><dt>標的</dt><dd>{mission.bossName}</dd></div>
                <div><dt>護衛</dt><dd>無人潜航艇 10隻</dd></div>
                <div><dt>報酬</dt><dd>{mission.reward}</dd></div>
              </dl>
            </article>
            <article className="briefing-copy">
              <p className="speaker">AI // NIX</p>
              <blockquote>
                「{mission.briefing}」
              </blockquote>
              <h3>任務概要</h3>
              <p>
                {mission.objective}
              </p>
              <h3>選択中の機体</h3>
              <div className="vehicle-select">
                <button
                  className={"ryuou-option " + (store.selectedVehicle === "ryuou" ? "selected" : "")}
                  onClick={() => store.selectVehicle("ryuou")}
                >
                  <strong>りゅうおう <small>RYUOU</small></strong>
                  <span>機動性 A / 耐久 C</span>
                </button>
                <button
                  disabled={!store.unlockedVehicles.includes("corback")}
                  className={"corback-option " + (store.selectedVehicle === "corback" ? "selected" : "")}
                  onClick={() => store.selectVehicle("corback")}
                >
                  <strong>コーバック号 <small>CORBACK II</small></strong>
                  <span>{store.unlockedVehicles.includes("corback") ? "機動性 B / 耐久 A" : "未発見"}</span>
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
          key={store.selectedStage}
          stageId={store.selectedStage}
          vehicle={store.selectedVehicle}
          onExit={() => store.setScreen("title")}
          onComplete={store.completeMission}
        />
      )}

      {store.screen === "result" && store.lastResult && (
        <section className="result-screen">
          <div className="result-panel">
            <p className="eyebrow">MISSION COMPLETE</p>
            <h2>{STAGES[resultStage].title}</h2>
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
                <strong>コーバック号をアンロック</strong>
              </div>
            )}
            <blockquote>
              {STAGES[resultStage].result}
            </blockquote>
            <div className="result-actions">
              <button onClick={() => store.setScreen("title")}>タイトルへ</button>
              <button className="primary-action" onClick={() => store.setScreen("briefing")}>再出撃</button>
              {resultStage === 1 && <button className="primary-action" onClick={() => {
                store.selectStage(2); store.setScreen("briefing");
              }}>ステージ2へ</button>}
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
