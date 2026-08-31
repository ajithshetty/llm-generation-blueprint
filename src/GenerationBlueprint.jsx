import React, { useState, useRef } from "react";

const VOCAB = [
  { word: "cat", logit: 9.0 },
  { word: "dog", logit: 6.5 },
  { word: "bird", logit: 6.0 },
  { word: "tree", logit: 5.5 },
  { word: "bench", logit: 5.0 },
  { word: "squirrel", logit: 4.5 },
  { word: "duck", logit: 4.0 },
  { word: "path", logit: 3.5 },
  { word: "flower", logit: 3.0 },
  { word: "fountain", logit: 2.5 },
  { word: "jogger", logit: 2.0 },
  { word: "leaf", logit: 1.5 },
];

const C = {
  bg: "#0a1420",
  panel: "#0e1d30",
  panelBorder: "#1e3a56",
  grid: "#152c44",
  cyan: "#38bdf8",
  cyanDim: "#0e7490",
  amber: "#fbbf24",
  red: "#f87171",
  text: "#dce6f0",
  textMuted: "#5f7c99",
};

function softmax(logits) {
  const max = Math.max(...logits);
  const exps = logits.map((l) => Math.exp(l - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

function stepProbs(counts, temperature, topK, topP, repPenalty) {
  const adj = VOCAB.map((t, i) => {
    let l = t.logit;
    if (counts[i] > 0) l = l > 0 ? l / repPenalty : l * repPenalty;
    return l / temperature;
  });
  const probs = softmax(adj);
  const order = probs
    .map((p, i) => i)
    .sort((a, b) => probs[b] - probs[a]);
  const keptK = new Set(order.slice(0, topK));
  let cum = 0;
  const kept = new Set();
  for (const i of order) {
    if (!keptK.has(i)) continue;
    if (cum >= topP && kept.size > 0) break;
    cum += probs[i];
    kept.add(i);
  }
  const sum = [...kept].reduce((s, i) => s + probs[i], 0);
  const final = VOCAB.map((_, i) => (kept.has(i) ? probs[i] / sum : 0));
  return { final, order };
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

export default function GenerationBlueprint() {
  const [temperature, setTemperature] = useState(0.6);
  const [topK, setTopK] = useState(12);
  const [topP, setTopP] = useState(1.0);
  const [repPenalty, setRepPenalty] = useState(1.0);
  const [maxTokens, setMaxTokens] = useState(12);
  const [stopSeq, setStopSeq] = useState("duck");
  const [output, setOutput] = useState([]);
  const [reason, setReason] = useState(null);
  const [running, setRunning] = useState(false);
  const [lastStep, setLastStep] = useState(null);
  const runId = useRef(0);

  const generate = async () => {
    const id = ++runId.current;
    setOutput([]);
    setReason(null);
    setLastStep(null);
    setRunning(true);

    const counts = new Array(VOCAB.length).fill(0);
    const produced = [];

    for (let step = 0; step < maxTokens; step++) {
      if (runId.current !== id) return;
      const { final, order } = stepProbs(
        counts,
        temperature,
        topK,
        topP,
        repPenalty
      );
      const r = Math.random();
      let acc = 0;
      let chosen = order[0];
      for (let i = 0; i < VOCAB.length; i++) {
        acc += final[i];
        if (r <= acc) {
          chosen = i;
          break;
        }
      }
      counts[chosen] += 1;
      produced.push(VOCAB[chosen].word);
      setOutput([...produced]);
      setLastStep(
        order
          .slice(0, 4)
          .map((i) => ({ word: VOCAB[i].word, p: final[i] }))
      );

      if (
        stopSeq.trim() &&
        VOCAB[chosen].word.toLowerCase() === stopSeq.trim().toLowerCase()
      ) {
        setReason("stop");
        setRunning(false);
        return;
      }
      await delay(260);
    }
    if (runId.current === id) {
      setReason("max");
      setRunning(false);
    }
  };

  const slider = (label, value, display, min, max, step, set, note) => (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 12,
          marginBottom: 6,
        }}
      >
        <span style={{ color: C.text, fontWeight: 600 }}>{label}</span>
        <span style={{ color: C.amber }}>{display}</span>
      </div>
      <input
        className="gb-slider"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={running}
        onChange={(e) => set(parseFloat(e.target.value))}
      />
      {note && (
        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 5, lineHeight: 1.4 }}>
          {note}
        </div>
      )}
    </div>
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.bg,
        color: C.text,
        fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
        padding: "20px 14px 40px",
        boxSizing: "border-box",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');
        .gb-slider {
          -webkit-appearance: none; appearance: none;
          width: 100%; height: 4px; border-radius: 2px;
          background: linear-gradient(90deg, ${C.cyanDim}, ${C.grid});
          outline: none;
        }
        .gb-slider:disabled { opacity: 0.5; }
        .gb-slider::-webkit-slider-thumb {
          -webkit-appearance: none; appearance: none;
          width: 16px; height: 16px; border-radius: 3px;
          background: ${C.cyan}; border: 2px solid ${C.bg};
          box-shadow: 0 0 0 1px ${C.cyan}; cursor: pointer;
        }
        .gb-slider::-moz-range-thumb {
          width: 16px; height: 16px; border-radius: 3px;
          background: ${C.cyan}; border: 2px solid ${C.bg};
          box-shadow: 0 0 0 1px ${C.cyan}; cursor: pointer;
        }
        @keyframes gb-blink { 0%,100% { opacity: 1; } 50% { opacity: 0.2; } }
        .gb-cursor { animation: gb-blink 0.9s step-start infinite; }
      `}</style>

      <div style={{ maxWidth: 660, margin: "0 auto", position: "relative" }}>
        {[
          { top: -8, left: -8, bt: true, bl: true },
          { top: -8, right: -8, bt: true, br: true },
          { bottom: -8, left: -8, bb: true, bl: true },
          { bottom: -8, right: -8, bb: true, br: true },
        ].map((c, idx) => (
          <div
            key={idx}
            style={{
              position: "absolute", width: 14, height: 14,
              top: c.top, bottom: c.bottom, left: c.left, right: c.right,
              borderTop: c.bt ? `2px solid ${C.cyanDim}` : "none",
              borderBottom: c.bb ? `2px solid ${C.cyanDim}` : "none",
              borderLeft: c.bl ? `2px solid ${C.cyanDim}` : "none",
              borderRight: c.br ? `2px solid ${C.cyanDim}` : "none",
              pointerEvents: "none",
            }}
          />
        ))}

        <div style={{ marginBottom: 4, fontSize: 11, color: C.textMuted, letterSpacing: 1 }}>
          SPEC · MULTI-STEP GENERATION
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px" }}>
          Repetition penalty, max tokens, stop sequence
        </h1>
        <p style={{ fontSize: 13, lineHeight: 1.5, color: C.textMuted, margin: "0 0 18px" }}>
          These only make sense across a sequence, so this runs a real
          step-by-step generation loop instead of a single distribution.
        </p>

        <div
          style={{
            border: `1px dashed ${C.panelBorder}`,
            background: C.panel,
            padding: "10px 12px",
            marginBottom: 18,
            fontSize: 13,
          }}
        >
          <span style={{ color: C.textMuted }}>PROMPT&nbsp;</span>
          "Describe a walk in the park:"
        </div>

        {/* output tape */}
        <div
          style={{
            border: `1px solid ${C.panelBorder}`,
            background: C.panel,
            padding: "14px 12px",
            marginBottom: 10,
            minHeight: 70,
            fontSize: 14,
            lineHeight: 1.7,
          }}
        >
          {output.length === 0 && !running && (
            <span style={{ color: C.textMuted }}>— press generate —</span>
          )}
          {output.map((w, i) => (
            <span key={i} style={{ color: C.text }}>
              {w}{" "}
            </span>
          ))}
          {running && <span className="gb-cursor" style={{ color: C.cyan }}>▍</span>}
        </div>

        {/* termination reason */}
        <div style={{ minHeight: 20, marginBottom: 16, fontSize: 11 }}>
          {reason === "max" && (
            <span style={{ color: C.amber }}>■ STOPPED — max tokens ({maxTokens}) reached</span>
          )}
          {reason === "stop" && (
            <span style={{ color: C.red }}>
              ■ STOPPED — stop sequence "{stopSeq}" matched
            </span>
          )}
        </div>

        {/* mini live distribution */}
        {lastStep && (
          <div
            style={{
              border: `1px dashed ${C.panelBorder}`,
              padding: "8px 10px",
              marginBottom: 20,
              fontSize: 11,
            }}
          >
            <div style={{ color: C.textMuted, marginBottom: 6 }}>
              LAST STEP · TOP CANDIDATES
            </div>
            {lastStep.map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                <div style={{ width: 60, color: C.text }}>{s.word}</div>
                <div style={{ flex: 1, height: 8, background: C.grid }}>
                  <div
                    style={{
                      width: `${Math.min(100, s.p * 100)}%`,
                      height: "100%",
                      background: i === 0 ? C.amber : C.cyan,
                    }}
                  />
                </div>
                <div style={{ width: 36, textAlign: "right", color: C.textMuted }}>
                  {(s.p * 100).toFixed(0)}%
                </div>
              </div>
            ))}
          </div>
        )}

        {/* new controls */}
        {slider(
          "Repetition Penalty",
          repPenalty,
          repPenalty <= 1.0 ? "off" : repPenalty.toFixed(2),
          1.0,
          2.0,
          0.05,
          setRepPenalty,
          repPenalty <= 1.0
            ? "No penalty — a strongly favored word (like \"cat\") can repeat every step."
            : "Already-used words get pushed down each step, so the output diversifies."
        )}
        {slider(
          "Max Tokens",
          maxTokens,
          maxTokens,
          1,
          24,
          1,
          (v) => setMaxTokens(Math.round(v)),
          "Hard cap on generation length — the loop stops here regardless of anything else."
        )}

        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12, color: C.text, fontWeight: 600, marginBottom: 6 }}>
            Stop Sequence
          </div>
          <input
            type="text"
            value={stopSeq}
            disabled={running}
            onChange={(e) => setStopSeq(e.target.value)}
            placeholder="e.g. duck"
            style={{
              width: "100%",
              boxSizing: "border-box",
              background: C.grid,
              border: `1px solid ${C.panelBorder}`,
              color: C.text,
              fontFamily: "inherit",
              fontSize: 13,
              padding: "8px 10px",
              outline: "none",
            }}
          />
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 5, lineHeight: 1.4 }}>
            Generation stops the instant this exact word appears — even if
            max tokens hasn't been reached yet. Leave blank to disable.
          </div>
        </div>

        <details style={{ marginBottom: 18 }}>
          <summary style={{ fontSize: 12, color: C.textMuted, cursor: "pointer" }}>
            Temperature / top-k / top-p (same as before)
          </summary>
          <div style={{ marginTop: 12 }}>
            {slider("Temperature", temperature, temperature.toFixed(2), 0.1, 2.5, 0.05, setTemperature)}
            {slider("Top-K", topK, topK >= 12 ? "off" : topK, 1, 12, 1, (v) => setTopK(Math.round(v)))}
            {slider("Top-P", topP, topP >= 1.0 ? "off" : topP.toFixed(2), 0.05, 1.0, 0.05, setTopP)}
          </div>
        </details>

        <button
          onClick={generate}
          disabled={running}
          style={{
            width: "100%",
            background: running ? C.grid : C.cyan,
            color: running ? C.textMuted : C.bg,
            border: "none",
            padding: "12px",
            fontFamily: "inherit",
            fontWeight: 700,
            fontSize: 13,
            letterSpacing: 0.5,
            cursor: running ? "default" : "pointer",
          }}
        >
          {running ? "GENERATING…" : "GENERATE"}
        </button>

        {/* sources */}
        <div style={{ marginTop: 22, fontSize: 11, color: C.textMuted, lineHeight: 1.9 }}>
          <div style={{ letterSpacing: 1, marginBottom: 4, color: C.textMuted }}>
            LEARN MORE
          </div>
          <div>
            <a href="https://arxiv.org/abs/1909.05858" target="_blank" rel="noopener noreferrer" style={{ color: C.cyan }}>
              Keskar et al. 2019 — CTRL paper (repetition penalty origin)
            </a>
          </div>
          <div>
            <a href="https://github.com/huggingface/transformers/blob/main/src/transformers/generation/logits_process.py" target="_blank" rel="noopener noreferrer" style={{ color: C.cyan }}>
              HF source: RepetitionPenaltyLogitsProcessor implementation
            </a>
          </div>
          <div>
            <a href="https://help.openai.com/en/articles/5072263-how-do-i-use-stop-sequences-in-the-openai-api" target="_blank" rel="noopener noreferrer" style={{ color: C.cyan }}>
              OpenAI: how stop sequences work
            </a>
          </div>
          <div>
            <a href="https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters.html" target="_blank" rel="noopener noreferrer" style={{ color: C.cyan }}>
              AWS Bedrock: inference request parameters reference
            </a>
          </div>
          <div>
            <a href="https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-anthropic-claude-messages-request-response.html" target="_blank" rel="noopener noreferrer" style={{ color: C.cyan }}>
              AWS Bedrock: Claude request/response (max_tokens, stop_sequences)
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
