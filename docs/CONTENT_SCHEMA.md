# コンテンツと履歴の形式

`content/` のJSONは学習機能から独立。Windows版では `release/win-unpacked/resources/content/` に外部ファイルとして配置します。変更後はアプリを終了・再起動してください。UIでインポートする機能は未実装です。

## 短文・読解

共通セットは `{schemaVersion:1, setId, description, items:[...]}`。itemは `id`（全モードで一意）、`category`、`sentences`、任意の`note`。文は `english`、`japanese`、`markers`。短文は1〜2文、読解は2〜4文。順番と文中の改行を維持します。

2026年10月5日、短文・読解を各100教材へ増量。現在の短文は100英文、読解は100文章・299英文。`content/authoring/*.mjs` が追加98教材ずつの編集元で、`npm run curriculum` は既存2教材ずつを保持してJSONと `curriculum.json`（ID・学習テーマ・参照資料の台帳）、`docs/CURRICULUM.md` を生成します。本人の履歴・設定には触れません。アプリは従来と同じshort.json／reading.json／flashcard.jsonだけを読み込みます。

マーカーは `phrase`、`kind`（term / connector / reference）、任意の `explanation`、任意の `occurrence`（同じ語句の何回目か、1から）。和訳表示時に色を付けます。語句は英文に実在する必要があります。文字列はHTMLとして解釈しません。

## 汎用カード

itemは `id`、`category`、`front`、`back`、任意の `note` と `tags`。表裏は `{blocks:[{kind:'text'|'math',text:'...'}]}`。英語専用の単語／和訳というキーを使わず、多行・複数ブロックや他分野へ拡張できます。初期例は英単語3枚のみ。

`math` は拡張のための区分で、初期実装では組版せず文字列として表示します。画像ブロックや画像編集は未実装です。

## 履歴

`history.json` はschemaVersion 1、sessions配列。セッションには一意ID、起動時刻startedAt、終了時刻endedAt、最終保存lastSeenAt、利用区間segments、表示イベントeventsを保存します。終了理由quit / interrupted。

segmentsはmodeとミリ秒の開始start・終了end。eventsはtype=view/reveal、mode、contentId、ISO時刻at。revealは非表示から表示にしたときだけ加算。viewは初回表示、モード変更、前後移動、学習画面への復帰・非表示からの復帰を記録。描画更新や5秒の保存ではviewを加算しません。

正誤・理解・習得・難易度・ポイントは保存しません。集計は区間とイベントから導出し、別の成果データに変換しません。
