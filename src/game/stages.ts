export type StageId = 1 | 2;

export const STAGES = {
  1: {
    title: "白夜の墓標", sector: "ICE SECTOR 04", area: "極域・第4氷海",
    bossName: "円盤型巨大潜水艦", bossCode: "UNKNOWN DISC", bossHp: 600,
    reward: "240,000 CR", startDepth: 25, checkpointDepth: 105,
    briefing: "二十年も一緒にいると、君が無謀な依頼を選ぶ瞬間くらい分かる。今回の獲物は氷床の下だ。音を出せば、向こうもこちらを知る",
    objective: "観測施設との通信が途絶した。護衛艇を突破し、氷床下に潜む円盤型潜水艦を発見・撃破せよ。",
    intro: "NIX「氷床下へ侵入。静かすぎるね。嫌な意味で」",
    result: "NIX「円盤の識別符号、二十年前の記録と一致した。次の信号は火山海域からだ」",
  },
  2: {
    title: "灰燼の翼", sector: "VOLCANIC SECTOR 02", area: "海底火山帯・黒煙カルデラ",
    bossName: "飛行機型潜水艦〈ASH WING〉", bossCode: "ASH WING", bossHp: 840,
    reward: "360,000 CR", startDepth: 130, checkpointDepth: 155,
    briefing: "海底火山が活動中だ。黒い噴煙で目は役に立たない。音で進路を探してくれ。ここには、海を飛ぶ翼がいる",
    objective: "噴煙が立ち上る火山帯へ潜航せよ。ソナーで岩盤と護衛艇を捉え、カルデラ深部の飛行機型潜水艦を撃破せよ。",
    intro: "NIX「火山海域に侵入。噴煙の中では視界が落ちる。Qのソナーで地形を確認して」",
    result: "NIX「飛行する潜水艦、沈黙。火山の音だけが残った。今回も帰還できたね」",
  },
} as const;

export const VOLCANIC_FLOOR = -279;
export const VOLCANOES = [
  { x: 45, z: -5, radius: 46, height: 136 },
  { x: -64, z: -220, radius: 52, height: 128 },
  { x: 76, z: -365, radius: 58, height: 118 },
  { x: -70, z: -535, radius: 55, height: 138 },
  { x: 92, z: -710, radius: 56, height: 114 },
  { x: -80, z: -885, radius: 65, height: 132 },
] as const;

/** Same truncated-cone surface used by the visible volcanic terrain. */
export function volcanicHeightAt(x: number, z: number): number {
  let height = VOLCANIC_FLOOR;
  for (const vent of VOLCANOES) {
    const distance = Math.hypot(x - vent.x, z - vent.z);
    const rise = vent.height * Math.min(1, Math.max(0, (vent.radius - distance) / (vent.radius - 7)));
    height = Math.max(height, VOLCANIC_FLOOR + rise);
  }
  return height;
}

/** Local smoke obscures sight above a vent; sonar remains usable. */
export function smokeDensityAt(x: number, y: number, z: number): number {
  let density = 0;
  for (const vent of VOLCANOES) {
    const rise = y - (VOLCANIC_FLOOR + vent.height);
    if (rise < -8 || rise > 175) continue;
    const radius = 17 + Math.max(0, rise) * .17;
    density = Math.max(density, Math.max(0, 1 - Math.hypot(x - vent.x, z - vent.z) / radius));
  }
  return density;
}
