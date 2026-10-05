# Educational Desktop Player開発の引き継ぎ

最初に `REQUIREMENTS.md` とプロジェクトのREADMEを読む。本人が指定した3モード、常駐UI、履歴保存を維持する。2026年10月5日の追加指示により、初期の少量サンプル方針は短文100教材・読解100教材へ更新済み。最新の教材方針は `CURRICULUM.md` を優先する。ゲーム要素や正答・習得の自動判定を追加しない。

現在の配置はワークスペースの `apps/EducationalDesktopPlayer/`。このアプリ内にGit・依存・データ・ビルド出力を保つ。共通資料はワークスペースの `shared/`、別アプリは `apps/Exam-Dashboard-Planner/`。全体配置はワークスペースの `WORKSPACE.json` に登録されている。

2026年10月4日の追加指示を優先する。本人は複数のプロジェクトを同じ略称になるよう命名しているため、呼称は「Educational Desktop Player」とする。原文の `REQUIREMENTS.md` にある略称は提出仕様の保存用であり、画面や説明へ再導入しない。ダッシュボードのリポジトリ「Exam-Dashboard-Planner」と区別する。

ソースはこのプロジェクトの `src/`、コンテンツは `content/`。Windows版は `release/win-unpacked/`。起動用cmdは `DESKTOP_PLAYER_DATA_DIR` をプロジェクトの `data/` に指定する。ローカル履歴をGitへ入れない。学習ダッシュボードとは独立したアプリで、本人のプロフィールやダッシュボードの記録を初期化しない。

画面状態と操作は本体に集中し、UIは限定したpreload APIを使用する。JSON書込みは原子的置換。非表示・設定・履歴・停止・ロック・スリープは学習時間から除く。閲覧回数を習得度として使わない。

2026年10月5日のUI変更は `UI_UPDATE_2026-10-05.md` を優先する。「コンパクト」は廃止し、本文・学習操作中心の集中モードに置き換えた。`settings.focusMode`、`detailSize`、`focusSize` を保存する。旧 `compact` と `normalSize` は `src/core/settings.mjs` で読込み時に移行し、既存の表示番号・フォント・位置を維持する。

読解は英文・和訳をそれぞれ単一段落にまとめる。文データの配列とマーカーの指定は維持する。操作は「解説」と同じ幅の「次へ」。学習画面の矢印キーは左右が移動、下が解説、上が詳細／集中モード。globalShortcutを登録しない。

続く本人指示で、和訳を濃い本文色・16px（旧14pxから一段階上げる）とし、区切りの上側余白を12→6px、下側を10→5pxにした。短文はPart 5の単語・イディオム・慣用表現・文法語法、読解はPart 6・7の接続関係・指示語・文章構造・文脈理解という元の役割を維持する。読解は100件の文章で、各2〜4文。原稿は `content/authoring/`、再生成は `npm run curriculum`。`content/curriculum.json` は教材IDとテーマの台帳。既存の冒頭2教材・ID・順序は保持しており、履歴のIDを再利用しない。公式資料は範囲設計の参考で、本文・対訳・解説はオリジナル。

カード演出は描画側に限る。退出カードを非対話・aria-hiddenにし、スクロール位置を保持して、次のカードを右から表示する。演出中の連打を防ぐ。prefers-reduced-motionでは演出を省略する。履歴や設定の保存は本体側のまま。

修正後はtypecheck、影響するコアテスト、ビルドを行い、常駐・操作・履歴に触れた場合はWindows smokeを実行する。パッケージ化したexeも同じsmokeに渡して検証できる。実績と制約は `IMPLEMENTATION.md` を確認し、更新する。

パッケージ版の検証例（PowerShell）：

```powershell
$env:DESKTOP_PLAYER_SMOKE_EXE = (Resolve-Path -LiteralPath 'release/win-unpacked/Educational Desktop Player.exe').Path
npm run smoke
Remove-Item Env:DESKTOP_PLAYER_SMOKE_EXE
```

検証スクリプトは毎回独立した `.test-data/desktop-*` を作る。削除確認の自動承認はその検証プロセスだけで有効で、本番の確認ダイアログを省略しない。結果の場所は `artifacts/smoke/latest.json`。成功時だけ更新されるため、失敗調査では直近の `run-*` も確認する。

Windowsの枠なしウィンドウは作成時にリサイズ用の枠の分だけ外寸が増えることがある。作成直後の `setBounds` で保存済みの外寸を適用している。この処理を外すと、再起動のたびにサイズが増えるため、外寸復元のsmokeチェックを維持する。

cmd起動の回帰検証も必要。`DESKTOP_PLAYER_SMOKE_LAUNCHER=1` を指定して `npm run smoke` を行うと、実際のcmdから配布用exeを起動する。cmdはASCII・CRLFにする。通常のダブルクリックと、検証用の `--wait` の両方を維持する。cmdには本人のデータをテストへ固定して書き込まず、未指定のときだけ専用 `data/` を設定する。

Gitのoriginは `https://github.com/HondaEnlightea/EducationalDesktopPlayer.git`。今回、ソースはローカルに作成し、コミット・pushは実施していない。`data/`、`.test-data/`、ビルド出力はGit対象外。ローカルの完全な引き継ぎにはソース・`data/`・Windows版フォルダーを含める。

次の拡張候補は本人の承認・指示を確認してから扱う：セット切替、JSONインポート、数式組版、画像、クリック透過。クリック透過を付ける場合はトレイから必ず解除できるようにする。
