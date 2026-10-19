# GitHub Pages 公開手順

公開URL: https://tokimeki-marinosuke.github.io/mirror-crack-generator/

## 初回設定

1. リポジトリの Settings → Pages → Build and deployment を開き、Source を **GitHub Actions** にします。
2. Actionsが無効の場合はリポジトリの設定で有効にします。
3. `main` にpushするか、Actions → **Deploy GitHub Pages** → **Run workflow** で `main` を指定して実行します。
4. `build` と `deploy` が成功したら公開URLを開きます。

既にこの設定で公開できている場合、設定をやり直す必要はありません。
ワークフローは `.github/workflows/deploy-pages.yml`、配信パスは `vite.config.ts` の
`/mirror-crack-generator/` です。リポジトリ名や公開パスを変える場合は両者とREADMEのURLを見直してください。

## ビルド・配信の構成

- Node.js 24 / Ubuntu 24.04（OSラベルの自動移行を避けるため固定）
- `npm ci` → `npm test` → `npm run build`
- `actions/upload-pages-artifact` で `dist` をアップロード
- `actions/deploy-pages` でGitHub Pagesにデプロイ
- `pages: write` と `id-token: write` はデプロイジョブだけに付与
- 同時公開を避けるため `github-pages` のconcurrencyグループを使用

画像処理用のバックエンドやAPIキーは不要です。ActionsにはGitHubが提供する認証を使用します。

## 公開後の確認

1. Actionsの対象コミットと、公開したいコミットが一致することを確認します。
2. ログインしていないブラウザでも公開URLが開けることを確認します。
3. PNG / JPEG / WebP を読み込み、衝撃点を追加・移動します。
4. プリセットとスライダーを変更し、合成PNG・亀裂のみPNGを保存します。
5. PNGの寸法が元画像と一致し、亀裂のみPNGが背景透明であることを確認します。

## うまく公開できない場合

| 状況 | 確認する場所・対処 |
| --- | --- |
| ページが白紙 | ソースの `index.html` ではなくビルド済み `dist` を配信しているか、PagesのSourceがGitHub Actionsかを確認。ブラウザのConsole/NetworkでJS・CSSの404を確認します。 |
| JS・CSSが404 | Viteの `base` と実際の公開パスを確認します。ソースを直接開いてもTypeScriptは実行できません。 |
| deployがWaiting / Queued | ランナーや環境承認の待機を確認します。ログの「Waiting for a runner」はコードエラーとは限りません。 |
| buildがFailure | 失敗したステップのログを確認し、同じNode.jsで `npm ci`、`npm test`、`npm run build` を実行します。 |
| deployがFailure | PagesのSource、Actions/Environmentの制限、Pagesの権限をログに従って確認します。 |
| 成功したのに画面が古い | 対象コミットを確認し、強制再読み込みまたはプライベートウィンドウで確認します。 |
| GitHub側の遅延 | [GitHub Status](https://www.githubstatus.com/) のActions / Pagesを確認。復旧後も失敗している場合にRe-run jobsで再実行します。 |

単なる非推奨警告と、実際に失敗したステップは区別してください。
GitHubにpushできたことやローカルビルドの成功だけでは、公開完了を意味しません。
クラウド開発環境の「公開」は開発環境の保存・公開操作で、リポジトリのpushやPagesのデプロイとは別です。
