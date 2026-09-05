# りゅうおう / RYUOU

『青の6号』の「りゅうおう」を、指定された[模型製作記事](http://blog.livedoor.jp/yoshikawa_amm/archives/2189583.html)の形状資料を参考にBlender 4.5.13 LTSでモデリングしました。

紫の中央船体と左右上下の船体、船体間の隙間、背びれ・腹びれとX型の尾翼、後部の開放ダクトと二重反転スクリュー、青いMHDスリット、船首の発射口と下面のライトを表現しています。細部はゲーム表示向けに簡略化しています。

## ファイル

- `ryuou.blend`: 編集用の67パーツと、軽量化したゲーム出力用シーン。元のシーンも保持。
- `build_ryuou.py`: 新しいシーンに編集用モデルを作るスクリプト。
- `export_ryuou.py`: 同じBlenderセッションで続けて実行し、ゲーム用メッシュ・GLB・プレビュー用カメラを用意するスクリプト。
- `../../public/models/ryuou.glb`: 実行時データ（14,390三角形、8描画、約265KiB、テクスチャなし）。
- `../../public/images/ryuou-preview.png`: Blenderでレンダリングした機体選択用プレビュー。

スクリプト内の`ROOT`は出力先のプロジェクト絶対パスです。別環境では変更してください。プレビューを書き出すには、出力スクリプト実行後に`bpy.ops.render.render(write_still=True)`を実行します。

Blenderでは船首が+Y、上方向が+Zです。glTFでは船首が-Z、上方向が+Yとなり、既存の操艦・カメラ・衝突判定に合わせた全長約12ゲーム単位で読み込みます。`Ryuou_Rotor_Front_Game`と`Ryuou_Rotor_Rear_Game`は独立ノードで、ゲーム中はZ軸の周りに逆方向へ回転します。
