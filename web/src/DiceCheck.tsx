/**
 * The dice-check ritual: one component behind every visible skill check
 * (adventure scenes today, the shop tomorrow), fed the engine's own `SkillRoll`
 * shape. A d20 tumbles, the natural lands, bonus chips count on, a DC bar fills,
 * and a success/failure stamp drops. Never gates on the animation — a tap
 * completes it instantly.
 */
import { useEffect, useState, type CSSProperties } from 'react';
import type { SkillRoll } from '../../src/campaign/campaign.js';
import { SKILL_LABEL } from '../../src/data/classes.js';
import { sfx, haptic } from './sound.js';

interface Props {
  roll: SkillRoll;
  rollerName: string;
  onDone(): void;
}

type Stage = 'tumbling' | 'landed' | 'resolved';

export function DiceCheck({ roll, rollerName, onDone }: Props) {
  const [stage, setStage] = useState<Stage>('tumbling');
  const [face, setFace] = useState(1);

  const nat20 = roll.natural === 20;
  const nat1 = roll.natural === 1;

  useEffect(() => {
    if (stage !== 'tumbling') return;
    sfx('dice');
    // Tumble: flash random faces, then land on the natural roll.
    let ticks = 0;
    const iv = setInterval(() => {
      ticks++;
      setFace(1 + Math.floor(Math.random() * 20));
      if (ticks >= 12) {
        clearInterval(iv);
        setFace(roll.natural);
        setStage('landed');
      }
    }, 55);
    return () => clearInterval(iv);
  }, [stage, roll.natural]);

  useEffect(() => {
    if (stage !== 'landed') return;
    haptic(nat20 || nat1 ? [20, 40, 20] : 14);
    const t = setTimeout(() => setStage('resolved'), 650);
    return () => clearTimeout(t);
  }, [stage, nat20, nat1]);

  useEffect(() => {
    if (stage !== 'resolved') return;
    sfx(nat20 ? 'crit-pass' : nat1 ? 'crit-fail' : roll.success ? 'check-pass' : 'check-fail');
    if (nat20) haptic([30, 30, 30]);
  }, [stage, nat20, nat1, roll.success]);

  const skip = () => { setFace(roll.natural); setStage('resolved'); };
  const bonus = roll.total - roll.natural - (roll.guidance ?? 0);
  const pct = Math.max(0, Math.min(100, (roll.total / Math.max(roll.dc, roll.total, 1)) * 100));

  return (
    <div className={`dicecheck ${stage === 'resolved' && nat1 ? 'shake' : ''}`}
      onClick={stage === 'resolved' ? onDone : skip}>
      {stage === 'resolved' && nat20 && <Confetti />}
      <div className="dc-roller">{rollerName} · {SKILL_LABEL[roll.skill]}</div>

      <div className={`d20 ${stage} ${nat20 ? 'nat20' : ''} ${nat1 ? 'nat1' : ''}`}>
        <span>{face}</span>
      </div>

      {stage !== 'tumbling' && (
        <div className="dc-math">
          <span className="chip nat">d20 {roll.natural}</span>
          {bonus !== 0 && <span className="chip">{bonus >= 0 ? '+' : ''}{bonus}</span>}
          {roll.guidance ? <span className="chip guide">+{roll.guidance} guidance</span> : null}
          <span className="chip total">= {roll.total}</span>
        </div>
      )}

      {stage !== 'tumbling' && (
        <div className="dc-bar" aria-label={`total ${roll.total} vs DC ${roll.dc}`}>
          <div className="dc-fill" style={{ width: `${pct}%` }} />
          <div className="dc-mark" style={{ left: `${Math.min(100, (roll.dc / Math.max(roll.dc, roll.total, 1)) * 100)}%` }} />
          <span className="dc-label">DC {roll.dc}</span>
        </div>
      )}

      {stage === 'resolved' && (
        <div className={`dc-stamp ${roll.success ? 'ok' : 'fail'}`}>
          {roll.success ? (nat20 ? 'CRITICAL!' : 'SUCCESS') : (nat1 ? 'CRITICAL FAIL' : 'FAILURE')}
        </div>
      )}

      <div className="dc-hint">{stage === 'resolved' ? 'Tap to continue' : 'Tap to skip'}</div>
    </div>
  );
}

/** A one-shot particle burst for a natural 20. Pure CSS, no assets. */
function Confetti() {
  const colors = ['#ffd166', '#6ee7a0', '#4a9eff', '#ff5a5a', '#c792ff'];
  const bits = Array.from({ length: 24 }, (_, i) => {
    const angle = (i / 24) * Math.PI * 2;
    const dist = 90 + (i % 5) * 22;
    return {
      x: Math.cos(angle) * dist, y: Math.sin(angle) * dist,
      color: colors[i % colors.length], delay: (i % 6) * 0.02,
    };
  });
  return (
    <div className="confetti" aria-hidden>
      {bits.map((b, i) => (
        <span key={i} style={{
          '--cx': `${b.x}px`, '--cy': `${b.y}px`, background: b.color,
          animationDelay: `${b.delay}s`,
        } as CSSProperties} />
      ))}
    </div>
  );
}
