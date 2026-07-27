/**
 * The quasit's speech bubble.
 *
 * Deliberately a plain block rather than a popup or a toast: it appears where
 * the player is already looking, says its piece once, and never asks to be
 * dismissed. Anything that has to be clicked away becomes a tax on the tenth
 * run, and the tenth run is the one that decides whether a game is worth
 * playing again.
 */
import { CHORUS_SPEAKER } from '../../src/arena/chorus.js';
import { ArtImage } from './ArtImage.js';
import { hasArt, portraitUrl } from './art.js';

export function ChorusBubble({ text }: { text: string }) {
  return (
    <div className="chorus" role="note">
      <div className="chorus-face">
        <ArtImage
          id={CHORUS_SPEAKER.portraitId}
          {...(hasArt(CHORUS_SPEAKER.portraitId) ? { src: portraitUrl(CHORUS_SPEAKER.portraitId) } : {})}
          glyphClassName="chorus-glyph"
          alt={CHORUS_SPEAKER.name}
        />
      </div>
      <div className="chorus-say">
        <b className="chorus-who">{CHORUS_SPEAKER.name}</b>
        <p>{text}</p>
      </div>
    </div>
  );
}
