import React from 'react';

/**
 * The last thing between a thrown error and a white screen.
 *
 * React unmounts the whole tree when a render throws and nothing catches it.
 * In development that is a stack trace in the console; to a player it is a
 * blank page, no explanation, and no way back — and the tab closes.
 *
 * This is not hypothetical. A hook declared below an early return once threw
 * React error #300 and took the arena down on the first fight of a run. The bug
 * was fixed in minutes; a player who hit it would simply have been gone.
 *
 * WHAT IT PROMISES, AND WHY THAT PROMISE IS THE POINT
 *
 * "Your save is safe." Every save in this game is written to localStorage as
 * the state changes, not on exit — so by the time anything can throw, the
 * progress is already on disk. A crash screen that says nothing leaves a player
 * assuming they have lost their party, which is the fear that stops them coming
 * back. Saying so plainly is most of the value here.
 *
 * WHAT IT DOES NOT CATCH
 *
 * Errors thrown outside React's render cycle — an async callback, an event
 * handler that throws after an await, a rejected promise. Those do not unmount
 * the tree, so they do not white-screen; they are logged by the listeners in
 * `main.tsx` instead. This is only for the failure that takes the page.
 */
interface Props {
  children: React.ReactNode;
  /** Wipe the in-progress save and start over — the escape hatch of last resort. */
  onReset?(): void;
}

interface State {
  error: Error | undefined;
  /** Bumped to force a fresh subtree when the player retries. */
  attempt: number;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { attempt: 0, error: undefined };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Console rather than a service: there is no telemetry here, and a player
    // who reports a bug can be asked for this. Keeping the component stack is
    // the difference between a useful report and "it broke".
    console.error('[crash]', error, info.componentStack);
  }

  render(): React.ReactNode {
    const { error, attempt } = this.state;
    if (!error) return <React.Fragment key={attempt}>{this.props.children}</React.Fragment>;
    return (
      <div className="crash">
        <div className="crash-box" role="alert">
          <h2>Something went wrong.</h2>
          {/* First, before anything else, because it is the thing they are
              afraid of and the thing that brings them back. */}
          <p className="crash-safe">✅ Your save is safe — progress is written as you play.</p>
          <p className="muted">
            A part of the game hit an error it could not recover from. Trying again
            usually works; if it does not, reloading will pick up from your last save.
          </p>
          <div className="crash-actions">
            {/* Re-mounting a fresh subtree. Enough for a render that threw on
                one unlucky state, which is most of them. */}
            <button className="primary" onClick={() => this.setState({ attempt: attempt + 1, error: undefined })}>
              Try again
            </button>
            <button onClick={() => window.location.reload()}>Reload</button>
          </div>
          {this.props.onReset && (
            <button
              className="crash-reset"
              onClick={() => {
                if (!window.confirm('Delete the saved game and start fresh? This cannot be undone.')) return;
                this.props.onReset?.();
                window.location.reload();
              }}
            >
              Still stuck? Delete the save and start fresh
            </button>
          )}
          {/* The message itself, last and quiet. Useless to most players and
              exactly what a bug report needs from the rest. */}
          <details className="crash-detail">
            <summary>Technical details</summary>
            <pre>{error.message}</pre>
          </details>
        </div>
      </div>
    );
  }
}
