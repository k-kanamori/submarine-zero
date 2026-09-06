# たいげい型潜水艦 / Taigei class

[指定された参考画像](https://newsatcl-pctr.c.yimg.jp/t/iwiz-yn/rpr/takahashikosuke/01692354/image-1709862130379.jpeg?fill=1&fc=fff&exp=10800)をもとにBlenderで制作した、通常敵3種類（scout / hunter / layer）用の外観モデルです。丸い艦首、黒い船体、前寄りの艦橋と潜舵、X字尾舵、側面アレイ、7枚羽根のスクリューを表現しています。写真から確認できない細部はゲーム用に簡略化・補完しています。

- `taigei.blend`: 編集用47パーツ、ゲーム出力用シーン、プレビュー用スタジオ。
- `build_taigei.py`: Blenderで実行すると既存シーンを残して専用シーンにモデルを作成します。
- `export_taigei.py`: 上記に続けて実行し、GLBと編集用ファイルを保存します。別のチェックアウトでは`ROOT`を変更してください。
- `preview.png`: Blenderによる確認用レンダー。出力後に`bpy.ops.render.render(write_still=True)`で再生成できます。
- `../../public/models/taigei.glb`: 10,448三角形、2ノード、5描画、253,764バイト。外部テクスチャ不要。

Blenderでは艦首+Y・上+Z、glTFでは艦首-Z・上+Y。ゲーム内の全長は約9.57単位、hunterのみ1.15倍です。既存の敵AI・当たり判定・魚雷発射位置を維持する寸法で、スクリューの独立ノード`Taigei_Propeller`はゲーム座標Z=4.82を中心に回転します。艦首は通常Z=-4.55、hunterでは約-5.23に収まり、魚雷は船体の前から発射されます。

ゲームではBlenderの色・金属度・粗さを引き継いだソナー対応マテリアルで表示します。ボスの円盤型モデルは別の敵として維持しています。
