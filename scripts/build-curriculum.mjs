import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {groups as shortGroups} from '../content/authoring/short.mjs';
import {groups as readingGroups} from '../content/authoring/reading.mjs';
import {loadContent} from '../src/core/content.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = path.join(root, 'content');
const catalog = {schemaVersion:1, created:'2026-10-05', original:true, sources:[
 {title:'IIBC テストの形式と構成',url:'https://www.iibc-global.org/toeic/test/lr/about/format.html',checked:'2026-10-05'},
 {title:'ETS Listening & Reading Score Descriptors',url:'https://www.ets.org/pdfs/toeic/toeic-listening-reading-score-descriptors.pdf',checked:'2026-10-05'}
],items:[]};
for (const [mode, groups] of [['short',shortGroups],['reading',readingGroups]]) {
 const file = path.join(directory, mode + '.json');
 const legacy = JSON.parse(fs.readFileSync(file, 'utf8')).items.filter(item => [mode+'-001',mode+'-002'].includes(item.id));
 if (legacy.length !== 2) throw Error('Keep original IDs and order for existing history');
 const items = [...legacy];
 for (const item of legacy) catalog.items.push({id:item.id,mode,topic:mode==='short'?'期限・前置詞と動名詞':'対比・因果・指示語',retained:true});
 for (const [topic, text] of groups) for (const line of text.trim().split('\n')) {
  const fields = line.trim().split('|');
  const id = mode + '-' + String(items.length + 1).padStart(3,'0');
  let sentences, note;
  if (mode === 'short') {
   if (fields.length !== 4) throw Error(id+' short field count');
   const [english,japanese,phrase,explanation] = fields;
   sentences = [{english,japanese,markers:[{phrase,kind:'term',explanation}]}];
  } else {
   if (fields.length !== 11) throw Error(id+' reading field count: '+fields.length);
   const [e1,j1,e2,j2,e3,j3,index,phrase,kind,explanation,lesson] = fields;
   sentences = [[e1,j1],[e2,j2],[e3,j3]].map(([english,japanese])=>({english,japanese,markers:[]}));
   const sentence = sentences[Number(index)-1];
   if (!sentence) throw Error(id+' marker sentence');
   sentence.markers.push({phrase,kind,explanation}); note=lesson;
  }
  items.push({id,category:'英語',sentences,...(note?{note}:{})});
  catalog.items.push({id,mode,topic});
 }
 if (items.length !== 100) throw Error(mode+' must contain 100 items, got '+items.length);
 fs.writeFileSync(file,JSON.stringify({schemaVersion:1,setId:'original-toeic-'+mode+'-100',description:'オリジナル学習教材。TOEIC公式問題の転載ではありません。',items},null,2)+'\n');
}
const content=loadContent(directory);
fs.writeFileSync(path.join(directory,'curriculum.json'),JSON.stringify(catalog,null,2)+'\n');
const rows=[];
for (const mode of ['short','reading']) {
 rows.push('\n## '+(mode==='short'?'短文：Part 5の基礎と語法':'読解：Part 6・7の文章理解')+'\n');
 rows.push('| 学習テーマ | 教材ID | 件数 |','| --- | --- | --- |');
 const topics=[...new Set(catalog.items.filter(item=>item.mode===mode).map(item=>item.topic))];
 for(const topic of topics){const entries=catalog.items.filter(item=>item.mode===mode && item.topic===topic);rows.push('| '+topic+' | '+entries[0].id+' ～ '+entries.at(-1).id+' | '+entries.length+' |');}
}
const count=content.reading.reduce((sum,item)=>sum+item.sentences.length,0);
const document=`# オリジナルTOEIC学習教材の収録範囲

作成・公式資料確認：2026年10月5日。本人の追加指示で、初期の少量サンプルから短文100教材・読解100教材へ増量した。元の教材ID・順序を維持し、各モードに98件を追加。単語帳と本人の学習履歴は変更しない。

短文は100英文、読解は100文章・合計${count}英文。短文は1教材1〜2文、読解は1教材2〜4文という元の役割を維持する。全教材に対訳とマーカー解説があり、追加した読解には確認ポイント・推論の根拠・誤読の注意を付ける。問題文を埋めたり自動正誤を判定したりする新モードは追加しない。

教材の英文・対訳・解説はオリジナル。公式資料は形式と能力の確認に使い、公式問題や市販教材の文面を転載していない。以下の分類はこの教材用の学習設計であり、ETSの公式シラバスや出題頻度表ではない。

## 高得点に向けた設計

短文では単語の訳だけでなく品詞、文の骨格、修飾先、目的語、時制、受動・推量、条件、比較、前置詞と接続詞の区別、多義語・定型表現を説明する。読解では因果・対比・例示、指示語、情報の順序、目的・主旨、文脈語彙、言い換え、推論の限界、条件・例外、日付・数値、文挿入の結束性、関連する連絡の照合を扱う。

場面は業務メール、案内、広告、求人、注文・納品、請求、保証、旅行・ホテル・交通、研修、調査報告、ニュース、チャットなどへ分散する。解説を開く前に和訳を考え、読解では誰・何・いつ・どの条件かを特定し、開いた後にマーカーの根拠を確認する。
${rows.join('\n')}

## 収録範囲の限界と補う学習

100件ずつで英語の全語彙・全構文・将来の全出題を漏れなく収録したとは扱わない。短い英文を日常的に読み、主要な判断方法を反復する教材である。Part 5の実際の四択・時間制限、Part 6の穴埋め、Part 7の長い文書・表や図・独立した複数文書の横断読みは公式の演習で補う。関連情報の照合は短い文章内で練習しており、本番の複数文書形式を再現しているとは扱わない。

音声は含まないため、Listening Part 1〜4は別の音声付き教材で学ぶ。閲覧回数から正解・理解・高得点到達を推定しない。今後の追加は診断で判明した弱点に応じて行い、既存IDを再利用しない。

## 原稿・再生成・確認

編集元：content/authoring/short.mjs と reading.mjs。各分類7教材、冒頭の既存2教材を含め各100件。npm run curriculumでcontent/short.json、reading.json、curriculum.jsonと本資料を生成する。JSONを直接変更した場合は原稿にも反映する。再生成は本人のdata/へ書き込まない。

curriculum.jsonはIDとテーマの機械可読台帳。npm testで件数、文数、ID、対訳、説明、重複、マーカー位置、分類を確認する。これは構造の検査であり、学習効果やネイティブ校閲の保証ではない。

## 参考にした公式資料

- [IIBC テストの形式と構成](https://www.iibc-global.org/toeic/test/lr/about/format.html)：Part 5は短文穴埋め、Part 6は長文穴埋め、Part 7は単独・複数文書の読解。形式を確認。
- [ETS Listening & Reading Score Descriptors](https://www.ets.org/pdfs/toeic/toeic-listening-reading-score-descriptors.pdf)：Reading高得点帯の記述にある主旨・推論、言い換え、文全体・関連文書の情報接続、幅広い語彙、複雑な構文を学習設計の参考にした。
`;
fs.writeFileSync(path.join(root,'docs/CURRICULUM.md'),document.trim()+'\n');
console.log('Original curriculum built: 100 short items, 100 reading passages.');
