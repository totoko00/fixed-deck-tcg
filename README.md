# 星典戦記

固定順デッキ型 TCG のブラウザプロトタイプです。  
「デッキ順固定」「デッキ = ライフ = リソース源」という構造を中核に、`星典 × 星霊` の世界観で 1v1 の読み合いを組んでいます。

## ざっくり何のゲームか

- 星典を詠むと `SP` が増える
- ただし、詠む行為そのものがライフ消費でもある
- バトルは `星霊 + 星術` の組み合わせで行う
- 属性一致で `共鳴`
- 追加 SP 投入で `過詠`
- ダメージ時は `星典で受ける / 星霊で星護する` の二択

要するに、毎ターン

`今どこまでページをめくるか`

と

`その SP をどこに使うか`

を判断するゲームです。

## 現在の状態

現状は「ブラウザで起動して、プレイヤー vs CPU を最後まで通せる」段階です。

- Phase 1〜5 実装済み
- コアロジックは DOM 非依存で分離
- UI から詠み、召喚、攻防、過詠、星護、決着まで操作可能
- CPU 行動ロジックあり
- 星典プレビューで全 20 ページの内容確認が可能
- フルマッチ用シミュレーションあり

厳密な最終バランス調整やカード追加前の、まず遊べる土台ができている状態です。

## 起動方法

一番簡単なのは `index.html` をそのままブラウザで開く方法です。

```bash
open index.html
```

ローカルサーバー経由で開くならこちらでも動きます。

```bash
python3 -m http.server 8123
```

その後:

- [http://127.0.0.1:8123/index.html](http://127.0.0.1:8123/index.html)

を開いてください。

## 遊び方メモ

1. スタートフェイズで 0〜3 ページ詠む
2. メインフェイズで天窓の星霊 / 星命を使う
3. バトルフェイズで場の星霊をクリックして星撃宣言
4. 攻星術を選び、必要なら過詠
5. 相手の攻撃には守星術かパスで対応
6. ダメージは星典か星護で受ける

画面下の `📜 星典プレビュー` を開くと、自分の 20 ページ全体を見ながら次の詠み判断ができます。

## 実装上の方針

- バニラ HTML / CSS / JS のみ
- 外部ライブラリなし
- モジュール分離はするが、過剰に抽象化しない
- `game.js`, `battle.js`, `player.js`, `cpu.js` はロジック中心
- `ui.js` のみが DOM を触る

このプロジェクトでは「綺麗さ」より先に「最後までプレイできること」を優先しています。

## シミュレーション / 検証

ブラウザコンソールから以下を叩くと、段階ごとの自己検証が走ります。

```js
runPhase2Simulation()
runPhase4Simulation()
runPhase5Simulation()
```

用途はこんな感じです。

- `runPhase2Simulation()`
  - コアロジックの検証
- `runPhase4Simulation()`
  - CPU の攻防判断の検証
- `runPhase5Simulation()`
  - AI 同士の通し対戦検証

検証ログやキャプチャは `output/` 配下に残しています。

## ファイル構成

```text
index.html
css/style.css
js/main.js
js/game.js
js/card.js
js/player.js
js/battle.js
js/cpu.js
js/ui.js
js/logger.js
requirements.md
design.md
tasks.md
AGENTS.md
fixed_deck_tcg_unified_spec.md
```

ざっくり責務:

- `js/card.js`
  - カード定義と固定順星典
- `js/player.js`
  - 星典 / SP / 天窓 / フィールド管理
- `js/battle.js`
  - 共鳴、過詠、星力衝突、ダメージ、星護
- `js/game.js`
  - ターン進行と状態遷移
- `js/cpu.js`
  - CPU のルールベース行動
- `js/ui.js`
  - 描画とイベント接続
- `js/logger.js`
  - ログ文面の整形

## 参照ドキュメント

- [requirements.md](./requirements.md)
- [design.md](./design.md)
- [tasks.md](./tasks.md)
- [fixed_deck_tcg_unified_spec.md](./fixed_deck_tcg_unified_spec.md)

仕様の原本を見るなら `fixed_deck_tcg_unified_spec.md`、実装観点で追うなら `requirements.md` と `design.md` が起点です。

## 補足

このリポジトリは「完成版」ではなく、ゲームループと中核判断をまず固めたプロトタイプです。  
今後やるなら、追加カード、演出、数値調整、UI の詰め、CPU の読み合い強化あたりが次の伸びしろです。
