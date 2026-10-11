import { useState } from 'react';
import { SUPPORTED, UNKNOWN } from './classifier';
import { useCamera } from './useCamera';
import { AlphabetLab } from './alphabet/AlphabetLab';

const hints: Record<string, { name: string; cue: string }> = {
  F: { name: 'Make a little circle', cue: 'Touch your index fingertip to your thumb. Extend your other three fingers.' },
  I: { name: 'Pinky promise', cue: 'Raise your pinky. Fold your other fingers and tuck your thumb across them.' },
  L: { name: 'Find your right angle', cue: 'Point your index finger up and your thumb out. Fold the other three fingers.' },
  V: { name: 'Give a little peace', cue: 'Raise and spread your index and middle fingers. Fold the others with your thumb tucked.' },
  W: { name: 'Three is the magic number', cue: 'Raise and spread your index, middle, and ring fingers. Fold your pinky and tuck your thumb.' },
  Y: { name: 'Stretch to the sides', cue: 'Extend your thumb and pinky. Fold the three fingers in between.' },
};
function HandArt() {
  return <svg viewBox="0 0 180 210" fill="none" aria-hidden="true"><path d="M49 111V58c0-17 21-17 21 0v37-61c0-17 22-17 22 0v59-68c0-17 22-17 22 0v72-50c0-16 22-16 22 0v89c0 42-21 65-57 65-28 0-40-18-52-42L13 127c-8-17 9-29 21-15l15 18" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/><path d="m56 148 27-31 29 27M83 117l9-24m-9 24-13-22m13 22 31-20" stroke="currentColor" strokeWidth="2" opacity=".5"/>{[[56,148],[83,117],[112,144],[92,93],[70,95],[114,97]].map(([cx,cy])=><circle key={`${cx}${cy}`} cx={cx} cy={cy} r="5" fill="currentColor"/>)}</svg>;
}
export default function App() {
  const researchMode = new URLSearchParams(window.location.search).get('lab') === 'alphabet';
  const camera = useCamera(researchMode);
  const [selected, setSelected] = useState('L');
  const active = ['requesting', 'loading', 'live'].includes(camera.status);
  const live = camera.status === 'live';
  const recognized = camera.label !== UNKNOWN && live;
  return <div className="shell">
    <header className="header"><a className="brand" href="/" aria-label="Signify home"><span className="brand-icon">s<span>✳</span></span>signify<span className="brand-dot">.</span></a><div className="header-right"><span className="private-badge"><span className="tiny-dot"/> Private by design</span><a href="#how-it-works">How it works <span aria-hidden="true">↗</span></a></div></header>
    <main>
      <section className="intro"><div><div className="eyebrow"><span className="small-star">✳</span> YOUR HANDS HAVE SOMETHING TO SAY</div><h1>A little practice.<br/>A little <span>hand magic.</span></h1><p>Meet your new fingerspelling playground. Turn on your camera,<br className="desktop-break"/> try a letter, and see it come to life.</p></div><div className="intro-note"><span>hello, hands.</span><svg width="70" height="40" viewBox="0 0 70 40" aria-hidden="true"><path d="M3 3c30 0 14 36 58 26m-12-9 14 8-9 9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg></div></section>
      <section className="workspace" aria-label="ASL webcam playground">
        <div className="camera-card"><div className="card-top"><div><span className={`tiny-dot ${live ? 'live' : ''}`}/><span>{live ? 'Camera live' : camera.status === 'loading' ? 'Loading hand tracker' : camera.status === 'requesting' ? 'Waiting for permission' : 'Your camera space'}</span></div><span className="mono">{live ? `${camera.fps} FPS · MIRRORED` : 'LIVE VIEW'}</span></div>
          <div className={`viewport ${active ? 'active' : ''}`} style={{ aspectRatio: camera.aspect }}>
            <video ref={camera.video} autoPlay muted playsInline aria-label="Mirrored webcam feed"/><canvas ref={camera.canvas} aria-hidden="true"/>
            {!active && <div className="camera-placeholder"><div className="hand-illustration"><span className="spark spark-one">✧</span><HandArt/><span className="spark spark-two">✳</span></div><h2>Your hands. Center stage.</h2><p>A small gesture is a great place to start.</p></div>}
            {active && !live && <div className="loading-overlay"><span className="spinner"/><p>{camera.status === 'requesting' ? 'Allow camera access to begin' : 'Getting your hand tracker ready…'}</p><small>You can stop at any time.</small></div>}
            {live && <><div className="view-tag"><span className="tiny-dot live"/> {camera.handVisible ? 'Hand in view' : 'No hand detected'}</div><div className="view-guide">One hand · Palm forward · Fingers upright</div></>}
            <span className="corner tl"/><span className="corner tr"/><span className="corner bl"/><span className="corner br"/>
          </div>
          <div className="camera-controls"><p><svg width="16" height="18" viewBox="0 0 16 18" fill="none" aria-hidden="true"><path d="M8 1 2 4v5c0 4 6 7 6 7s6-3 6-7V4L8 1Z" stroke="currentColor" strokeWidth="1.5"/><path d="m5 8 2 2 4-4" stroke="currentColor" strokeWidth="1.5"/></svg> Video stays on your device.</p><button className={active ? 'button stop-button' : 'button start-button'} onClick={active ? camera.stop : camera.start}>{active ? <><span className="stop-icon"/> Stop Camera</> : <><span aria-hidden="true">◉</span> Start Camera <span aria-hidden="true">↗</span></>}</button></div>
          {camera.error && <div className="error-message" role="alert">{camera.error}</div>}
        </div>
        <aside className="result-column"><div className={`result-card ${recognized ? 'recognized' : ''}`}><div className="eyebrow">THE LETTER YOU’RE SIGNING <span aria-hidden="true">✦</span></div><div className="letter-display" aria-live="polite" aria-atomic="true">{recognized ? <span className="big-letter">{camera.label}</span> : <><span className="waiting-mark" aria-hidden="true">—</span><span className="unknown">Unknown</span></>}</div><div className="result-status"><span className="tiny-dot"/>{recognized ? 'Looking good. Hold that shape!' : live ? camera.handVisible ? 'Hold a clear shape for a moment' : 'Bring one hand into view' : 'Ready when you are'}</div><p>Six static letters. A world of small wins.</p></div>
          <div className="tip-card"><span className="tip-icon" aria-hidden="true">☀</span><div><h3>A little light goes a long way</h3><p>Face your palm toward the camera, keep your whole hand in view, and hold each shape briefly.</p></div></div>
        </aside>
      </section>
      <section className="letter-section" aria-labelledby="letters-heading"><div className="section-heading"><div><span className="eyebrow">START SMALL. SIGN SOMETHING.</span><h2 id="letters-heading">Pick a letter to try<span>.</span></h2></div><span className="subset-pill">6 supported letters</span></div><div className="letter-picker">{SUPPORTED.map(letter => <button key={letter} className={`letter-tile ${selected === letter ? 'selected' : ''}`} aria-pressed={selected === letter} onClick={() => setSelected(letter)}><span>{letter}</span><span>{letter === 'F' ? 'The circle' : letter === 'I' ? 'The pinky' : letter === 'L' ? 'The angle' : letter === 'V' ? 'The peace' : letter === 'W' ? 'The trio' : 'The stretch'}</span><span className="tile-arrow" aria-hidden="true">↗</span></button>)}</div><div className="letter-hint" aria-live="polite"><span className="hint-letter">{selected}</span><div><h3>{hints[selected].name}</h3><p>{hints[selected].cue}</p></div><span className="hint-note">Either hand works.</span></div></section>
      <section id="how-it-works" className="how-section"><div><span className="eyebrow">A LITTLE BEHIND THE MAGIC</span><h2>Your browser does <br/>the heavy lifting.</h2></div><div><h3><span>01</span> Find your hand</h3><p>MediaPipe tracks 21 points on your hand, right here in your browser. No video uploads or recordings.</p></div><div><h3><span>02</span> Find your letter</h3><p>Our original hand-shape rules recognize F, I, L, V, W, and Y. A short frame vote keeps the result steady.</p></div></section>
      <div className="limitations"><span aria-hidden="true">ⓘ</span><p>A practice experiment, not a full ASL translator. Other letters are unsupported, including motion letters J and Z. Similar shapes can be confused; no accuracy or confidence score is claimed.</p></div>
      {researchMode && <AlphabetLab live={live} frame={camera.researchFrame} subscribe={camera.subscribeFrames}/>}
    </main><footer><span className="footer-brand">signify.</span><p>Small gestures. New connections.</p><span>Made for curious hands <span aria-hidden="true">✳</span></span></footer>
  </div>;
}
