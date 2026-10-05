import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import type {State, Command, Mode, Marker, Sentence, TextItem, CardItem, Block} from '../shared/types';
import {markerRuns} from '../core/markers.mjs';
import './style.css';
const names: Record<Mode, string> = {short: '短文', reading: '読解', flashcard: '単語帳'};
function duration(ms: number) {
 const seconds = Math.floor(ms / 1000), h = Math.floor(seconds / 3600), m = Math.floor(seconds / 60) % 60, s = seconds % 60;
 return (h ? h + '時間 ' : '') + m + '分 ' + s + '秒';
}
function date(at: string | null) {
 return at ? new Intl.DateTimeFormat('ja-JP', {timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'}).format(new Date(at)) : '記録なし';
}
function EnglishRuns({sentence, marked}: {sentence: Sentence; marked: boolean}) {
 const runs = markerRuns(sentence.english, sentence.markers) as {text: string; marker?: Marker}[];
 return <>{runs.map((run, i) => run.marker && marked ? <mark key={i} className={'marker-' + run.marker.kind}>{run.text}</mark> : <React.Fragment key={i}>{run.text}</React.Fragment>)}</>;
}
function Blocks({blocks}: {blocks: Block[]}) {
 return <>{blocks.map((block, i) => <div key={i} className={'block block-' + block.kind}>{block.text}</div>)}</>;
}
function Notes({text}: {text: TextItem}) {
 return <div className="notes">{text.sentences.flatMap(sentence => sentence.markers).filter(marker => marker.explanation).map((marker, i) => <p key={i} className="explanation"><span className={'marker-label marker-' + marker.kind}>{marker.phrase}</span>{marker.explanation}</p>)}{text.note && <p className="explanation">{text.note}</p>}</div>;
}
function Lesson({state}: {state: State}) {
 const item = state.content[state.mode][state.index];
 if (state.mode === 'flashcard') {
  const card = item as CardItem;
  return <div className="card-content"><div className="card-side">{state.revealed ? '裏面' : '表面'}<span>{card.category}</span></div><div className="flashcard" data-testid="card-body"><Blocks blocks={state.revealed ? card.back.blocks : card.front.blocks}/></div>{state.revealed && card.note && <p className="explanation">{card.note}</p>}{!!card.tags?.length && <div className="tags">{card.tags.map(tag => <span key={tag}>{tag}</span>)}</div>}</div>;
 }
 const text = item as TextItem;
 if (state.mode === 'reading') {
  return <article className="reading"><p className="english reading-english" lang="en" data-testid="reading-english">{text.sentences.map((sentence, i) => <React.Fragment key={i}>{i > 0 && ' '}<EnglishRuns sentence={sentence} marked={state.revealed}/></React.Fragment>)}</p>{state.revealed && <><p className="translation reading-translation" data-testid="translation">{text.sentences.map(sentence => sentence.japanese).join('')}</p><Notes text={text}/></>}</article>;
 }
 return <article className="sentences">{text.sentences.map((sentence, i) => <section key={i} className="sentence"><p className="english" lang="en"><EnglishRuns sentence={sentence} marked={state.revealed}/></p>{state.revealed && <p className="translation" data-testid="translation">{sentence.japanese}</p>}</section>)}{state.revealed && <Notes text={text}/>}</article>;
}
function History({state,send,busy}:{state:State;send:(c:Command)=>void;busy:boolean}){const s=state.summary;return <div className="detail history"><div className="detail-title"><h1>利用履歴</h1><span>日本時間</span></div><div className="time-grid"><div><small>本日の学習画面利用</small><strong>{duration(s.todayMs)}</strong></div><div><small>累計利用時間</small><strong>{duration(s.totalMs)}</strong></div></div><p className="caption">表示・裏面閲覧の記録です。理解や習得の判定ではありません。</p><table><thead><tr><th>モード</th><th>利用時間</th><th>表示</th><th>裏面</th></tr></thead><tbody>{(Object.keys(names) as Mode[]).map(m=><tr key={m}><th>{names[m]}</th><td>{duration(s.modeMs[m])}</td><td>{s.modeViews[m]}</td><td>{s.modeReveals[m]}</td></tr>)}</tbody></table><p className="caption">最近の閲覧：{date(s.recent)}</p><h2>最近の閲覧・裏面表示</h2>{s.recentEvents.length?<ul className="event-list">{s.recentEvents.map((e,i)=><li key={i}><div>{names[e.mode]} · {e.type==='view'?'表示':'裏面表示'}<small>{e.contentId}</small></div><time>{date(e.at)}</time></li>)}</ul>:<p className="caption">閲覧記録はありません。</p>}<h2>セッション</h2>{s.sessions.slice(0,10).map(session=><div className="session" key={session.id}><strong>{duration(session.activeMs)}</strong><small>開始 {date(session.startedAt)}<br/>終了 {session.endedAt?date(session.endedAt):'利用中'}{session.endReason==='interrupted'?'（前回の最終保存時刻）':''}<br/>表示 {session.views}回 · 裏面 {session.reveals}回</small></div>)}<button className="danger" data-testid="clear-history" disabled={busy} onClick={()=>send({type:'clearHistory'})}>利用履歴を削除</button></div>;}
function Settings({state, send, busy}: {state: State; send: (command: Command) => void; busy: boolean}) {
 return <div className="detail"><div className="detail-title"><h1>設定</h1><span>このPCに保存</span></div><label className="setting-row"><span>最前面に表示<small>他のウィンドウより上に置く</small></span><input type="checkbox" disabled={busy} checked={state.settings.alwaysOnTop} onChange={event => send({type: 'setting', key: 'alwaysOnTop', value: event.target.checked})}/></label><label className="setting-row"><span>文字サイズ</span><select disabled={busy} value={state.settings.fontSize} onChange={event => send({type: 'setting', key: 'fontSize', value: Number(event.target.value)})}>{[16, 18, 20, 22].map(size => <option key={size} value={size}>{size}px</option>)}</select></label><h2>集中モード</h2><p className="caption">右上の切替ボタン、または ↑ キーで、本文と学習操作を中心に表示します。詳細表示と集中モードのサイズをそれぞれ保存します。</p><h2>キー操作</h2><dl className="key-guide"><div><dt>← / →</dt><dd>前へ / 次へ</dd></div><div><dt>↓</dt><dd>解説の表示・非表示</dd></div><div><dt>↑</dt><dd>詳細表示 / 集中モード</dd></div></dl><p className="caption">学習画面でこのアプリを操作中に使えます。文字入力や設定の選択中は通常のキー操作を優先します。</p><h2>一時非表示と再表示</h2><p className="caption">詳細表示の右上の「−」で隠せます。タスクトレイから再表示・終了・一時停止・集中モード切替ができます。</p><h2>利用時間の記録</h2><p className="caption">学習画面が見えている時間を記録します。一時停止中、設定・履歴画面、非表示中、PCのロック・スリープ中は含めません。</p><h2>保存先</h2><p className="data-path">{state.dataDirectory}</p><p className="caption">history.json：利用履歴<br/>settings.json：位置・サイズ・設定</p><h2>学習コンテンツ</h2><p className="caption">短文 {state.content.short.length}教材：Part 5の語彙・文法・語法。<br/>読解 {state.content.reading.length}教材：Part 6・7の論理・指示語・文脈理解。<br/>和訳・解説付きのオリジナル教材です。</p></div>;
}
function FocusButton({focused, disabled, onClick}: {focused: boolean; disabled: boolean; onClick: () => void}) {
 const label = focused ? '詳細表示に戻す（↑）' : '集中モードに切り替え（↑）';
 return <button className="focus-toggle" data-testid="focus-toggle" aria-pressed={focused} aria-label={label} aria-keyshortcuts="ArrowUp" title={label} disabled={disabled} onClick={onClick}><svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={focused ? 'M8 3H3v5 M16 3h5v5 M21 16v5h-5 M8 21H3v-5' : 'M3 8h5V3 M16 3v5h5 M21 16h-5v5 M8 21v-5H3'}/></svg></button>;
}
interface Slide {previous: State; direction: 1 | -1; scrollTop: number}
function App() {
 const [state, setState] = useState<State | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [slide, setSlide] = useState<Slide | null>(null);
 const current = useRef<State | null>(null), inFlight = useRef(false), navigationPending = useRef(false), animating = useRef(false);
 const timer = useRef<ReturnType<typeof setTimeout> | null>(null), currentPanel = useRef<HTMLDivElement>(null), outgoingPanel = useRef<HTMLDivElement>(null);
 current.current = state;
 useEffect(() => {
  if (!window.desktopPlayer) {setError('Educational Desktop Playerのデスクトップ版から開いてください。'); return;}
  const remove = window.desktopPlayer.onState(next => {if (!navigationPending.current) setState(next);});
  window.desktopPlayer.getState().then(setState).catch(error => setError(error.message));
  return remove;
 }, []);
 useEffect(() => () => {if (timer.current) clearTimeout(timer.current);}, []);
 useLayoutEffect(() => {if (slide && outgoingPanel.current) outgoingPanel.current.scrollTop = slide.scrollTop;}, [slide]);
 function finishSlide() {if (timer.current) clearTimeout(timer.current); timer.current = null; animating.current = false; setSlide(null);}
 async function send(command: Command) {
  if (inFlight.current || animating.current) return;
  const previous = current.current;
  const shouldAnimate = command.type === 'navigate' && previous?.page === 'learn' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const scrollTop = currentPanel.current?.scrollTop || 0;
  inFlight.current = true; navigationPending.current = command.type === 'navigate'; setBusy(true); setError('');
  try {
   const next = await window.desktopPlayer.command(command);
   setState(next);
   if (shouldAnimate && previous && command.type === 'navigate') {
    animating.current = true;
    setSlide({previous, direction: command.step, scrollTop});
    timer.current = setTimeout(finishSlide, 450);
   }
  } catch (error) {setError(error instanceof Error ? error.message : '操作できませんでした。');}
  finally {navigationPending.current = false; inFlight.current = false; setBusy(false);}
 }
 useEffect(() => {
  function keydown(event: KeyboardEvent) {
   if (state?.page !== 'learn' || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
   const target = event.target;
   if (target instanceof Element && target.closest('input, select, textarea, [contenteditable="true"]')) return;
   const command: Command | undefined = event.key === 'ArrowLeft' ? {type: 'navigate', step: -1} : event.key === 'ArrowRight' ? {type: 'navigate', step: 1} : event.key === 'ArrowDown' ? {type: 'reveal'} : event.key === 'ArrowUp' ? {type: 'focus'} : undefined;
   if (!command) return;
   event.preventDefault();
   if (!event.repeat) void send(command);
  }
  window.addEventListener('keydown', keydown);
  return () => window.removeEventListener('keydown', keydown);
 }, [state]);
 const focused = !!state?.settings.focusMode && state.page === 'learn', locked = busy || !!slide;
 const focusButton = <FocusButton focused={focused} disabled={locked} onClick={() => void send({type: 'focus'})}/>;
 const itemKey = state ? state.mode + ':' + state.content[state.mode][state.index].id : '';
 return <div className={'shell ' + (focused ? 'focus-mode' : 'detail-mode')} style={{'--english-size': (state?.settings.fontSize || 18) + 'px'} as React.CSSProperties}>
  {focused ? <><div className="focus-grip" aria-hidden="true"/><div className="focus-controls">{focusButton}</div></> : <header className="titlebar"><div className="brand"><span className="brand-mark">E</span><strong>Educational Desktop Player</strong></div>{state && <div className="window-actions">{focusButton}<button title="一時非表示（トレイから再表示）" aria-label="一時非表示" disabled={locked} onClick={() => void send({type: 'hide'})}>−</button></div>}</header>}
  {error && <div role="alert" className="error">{error}</div>}
  {!state ? <p className="loading">{error ? '' : '読み込み中…'}</p> : state.page === 'learn' ? <>
   {!focused && <><nav className="mode-tabs" aria-label="学習モード">{(Object.keys(names) as Mode[]).map(mode => <button key={mode} data-testid={'mode-' + mode} disabled={locked} aria-pressed={state.mode === mode} className={state.mode === mode ? 'selected' : ''} onClick={() => void send({type: 'mode', mode})}>{names[mode]}</button>)}</nav><div className="lesson-meta"><span>{state.mode === 'short' ? 'SHORT SENTENCE' : state.mode === 'reading' ? 'READING' : 'FLASHCARD'}</span><span data-testid="position">{state.index + 1} / {state.content[state.mode].length}</span></div></>}
   <main className={'carousel ' + (slide ? 'sliding ' + (slide.direction === 1 ? 'forward' : 'backward') : '')} data-testid="lesson" data-transition={slide ? 'active' : 'idle'}>
    {slide && <div ref={outgoingPanel} className="lesson-panel outgoing" aria-hidden="true" inert><Lesson state={slide.previous}/></div>}
    <div key={itemKey} ref={currentPanel} className={'lesson-panel current ' + (slide ? 'incoming' : '')} onAnimationEnd={event => {if (event.target === event.currentTarget) finishSlide();}}><Lesson state={state}/></div>
   </main>
   <footer className="learning-footer"><div className="lesson-actions"><button className="previous" aria-label="前のコンテンツ" aria-keyshortcuts="ArrowLeft" title="前へ（←）" data-testid="previous" disabled={locked} onClick={() => void send({type: 'navigate', step: -1})}>←</button><button className={'reveal ' + (state.revealed ? 'revealed' : '')} data-testid="reveal" aria-pressed={state.revealed} aria-keyshortcuts="ArrowDown" title={state.revealed ? '解説を隠す（↓）' : '解説を表示（↓）'} disabled={locked} onClick={() => void send({type: 'reveal'})}>解説</button><button className="next" data-testid="next" aria-label="次のコンテンツ" aria-keyshortcuts="ArrowRight" title="次へ（→）" disabled={locked} onClick={() => void send({type: 'navigate', step: 1})}>次へ <span aria-hidden="true">→</span></button></div>
    {!focused && <div className="footer-tools"><button className={state.paused ? 'paused' : ''} data-testid="pause" disabled={locked} onClick={() => void send({type: 'pause'})}>{state.paused ? '▶ 再開' : 'Ⅱ 一時停止'}</button><div><button data-testid="history" disabled={locked} onClick={() => void send({type: 'page', page: 'history'})}>履歴</button><button data-testid="settings" disabled={locked} onClick={() => void send({type: 'page', page: 'settings'})}>設定</button></div></div>}
   </footer>
  </> : <><div className="backbar"><button data-testid="back-learn" disabled={locked} onClick={() => void send({type: 'page', page: 'learn'})}>← 学習に戻る</button></div><main className="content">{state.page === 'history' ? <History state={state} send={send} busy={locked}/> : <Settings state={state} send={send} busy={locked}/>}</main></>}
 </div>;
}
createRoot(document.getElementById('root')!).render(<App/>);
