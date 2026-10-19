# 技術設計 v0.1

## 採用技術
Vite + TypeScript、HTML/CSS、Canvas 2D API。バックエンド不要。アルゴリズムの単体テストはVitest。静的ホスティングで公開。

## 責務分離
- `src/core/geometry.ts`: 座標、線分、クリッピングなどの純粋関数
- `src/core/random.ts`: シード付き疑似乱数
- `src/core/generateCracks.ts`: 亀裂の幾何生成（DOMに依存しない）
- `src/render/renderCracks.ts`: 亀裂の描画（スタイル別の線幅、色、ハイライト）
- `src/image/loadImage.ts`: 画像の読み込みと検証
- `src/image/exportPng.ts`: 元解像度でのオフスクリーン描画とPNG出力
- `src/ui/`: 操作UIとイベント
- `src/state/`: 編集状態とパラメータ
実装に応じてファイル構成は調整してよいが、責務は維持する。

## データモデル案
```ts
type Point = { x: number; y: number };
type CrackType = 'radial' | 'concentric' | 'branch';
type CrackSegment = { start: Point; end: Point; type: CrackType };
type CrackPattern = { origin: Point; segments: CrackSegment[]; seed: number };
type StylePreset = 'realistic' | 'anime';
type Impact = { id: string; origin: Point; seed: number; preset: StylePreset; params: CrackParams };
```
`CrackParams`は要件の調整項目を持つ。位置は元画像のピクセル座標で保持。将来の拡張に備え、必要なら共有頂点IDを持つグラフ表現へ移行する。

## 亀裂生成の初期案
1. シード付き乱数を初期化する。
2. 衝撃点からランダムに偏りを持つ角度をサンプリングし、主要な放射状亀裂を生成する。
3. 各亀裂は複数の短い線分で構成し、方向の揺らぎを加える。
4. 隣接する放射状亀裂間を、不完全な弧状／多角形状の同心円亀裂で結ぶ。
5. 主要亀裂上の一部の頂点から分岐亀裂を生成する。
6. 無限ループや爆発的な線分数を防ぐため、最大反復数・最大線分数を設定する。
7. 画像境界でクリッピングする。
8. 幾何データを返し、別モジュールでスタイルに応じて描画する。

## 表示と書き出し
- プレビューは画面サイズに合わせて縮小するが、編集座標は元画像基準。
- 画面上のポインター位置をCanvas表示矩形・変換行列から画像座標へ逆変換する。
- 書き出しは元画像サイズのオフスクリーンCanvasで再描画する。
- 合成PNGでは元画像の上にヒビを描画し、透過PNGでは透明Canvasにヒビだけ描画する。
- 高解像度画像ではCanvas上限とメモリ消費を検知し、失敗時に説明する。

## テスト例
- 同一シードで同一亀裂データ。
- 亀裂の各点が有限数値であり、生成量が上限以内。
- 座標変換の往復誤差が許容範囲。
- 出力PNGの解像度が入力と同一。
- 不透明度0%では亀裂が不可視。
