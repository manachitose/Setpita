# リリース手順チェックリスト

## 事前準備(完了済み)
- [x] `manifest.json`のバージョンを`1.0.0`に更新
- [x] デバッグ用console.logの整理
- [x] アイコン一式(16/32/48/128px)を配置
- [x] プライバシーポリシー文面を作成([privacy-policy.md](privacy-policy.md))
- [x] ストア掲載用テキストを作成([store-listing.md](store-listing.md))

## これから必要な作業(ユーザー側)

### 1. プライバシーポリシーの公開
Web Storeの審査には、プライバシーポリシーの**公開URL**が必要です。`docs/privacy-policy.md`の内容を、以下のいずれかの方法で公開してください。
- GitHub Pagesで公開する
- Notion / Google Sitesなど無料のページ作成サービスを使う
- (相談すればArtifactとして公開URLを発行することも可能)

### 2. スクリーンショットの準備
Web Storeには最低1枚、スクリーンショット(1280×800 または 640×400)が必要です。サイドパネルの使用画面などを用意してください。

### 3. Chrome Web Store Developerアカウント登録
1. https://chrome.google.com/webstore/devconsole にアクセス
2. Googleアカウントでログイン
3. $5の登録料を支払う(初回のみ)

### 4. 拡張機能をzip化する
`extension`フォルダの中身(`manifest.json`が直下に来るように)をzip圧縮する。
```
cd e:\myTools\Setpeta\extension
# フォルダの中身をzip化(フォルダ自体ではなく中身を圧縮)
```

### 5. Developer Dashboardでアップロード・登録
1. 「新しいアイテムを追加」からzipをアップロード
2. ストア掲載情報([store-listing.md](store-listing.md)の内容)を入力
3. プライバシーポリシーURLを入力
4. 権限の使用目的(host_permissions / storage / sidePanel)を入力
5. カテゴリ(生産性)を選択
6. スクリーンショットをアップロード
7. 公開範囲(公開 / 限定公開)を選択
8. 審査に提出

### 6. 審査後
- 審査には数時間〜数日かかる
- 却下された場合は理由を確認し、該当箇所を修正して再提出
- 承認されればWeb Storeに公開される
