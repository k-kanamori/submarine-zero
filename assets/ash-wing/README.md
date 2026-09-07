# ASH WING — ステージ2の飛行機型潜水艦

`docs/sample/uav01.jpg`と`uav02.jpg`の正面・側面写真を参照し、Blender MCPで制作しました。橙赤色の中央船体、長い直線翼、双発3枚羽根プロペラ、翼を支えるパイロン、左右のフロート、双胴尾部、水平尾翼を表現しています。撮影用の台車や固定ロープは含めず、ゲーム用の潜水艦として艦首ソナーと魚雷発射管を補っています。

- `ash-wing.blend`：専用の編集用シーン（38パーツ）、ゲーム出力用シーン、プレビュー用スタジオ。
- `build_ash_wing.py`：Blender MCPで実行し、既存のシーンを残して専用シーンにモデルを構築。
- `export_ash_wing.py`：続けて実行し、GLBと編集ファイルを保存。別のチェックアウトでは`ROOT`を変更。
- `../../public/models/ash-wing.glb`：船体と左右プロペラの3ノード、外部テクスチャなし。
- `../../public/images/ash-wing-preview.png`：Blenderレンダー。出力スクリプトの実行後に`bpy.ops.render.render(write_still=True)`で再生成。

Blenderでは艦首+Y・上+Z、ゲームでは艦首-Z・上+Y。全幅約54、全長約28ゲーム単位。`AshWing_Rotor_Left`と`AshWing_Rotor_Right`はゲーム座標(-7,5,-4)と(7,5,-4)を中心にそれぞれ回転します。通常敵と同じソナー対応マテリアルで描画します。
