window.__ModuleLoader__.load({
  id: 'dsh-read-aloud',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    // ---------------------------------------------------------------- locale
    const NS = 'readAloud';
    const en = {
      'read.result': 'Read result',
      'read.stop': 'Stop',
      'read.none': 'Nothing to read yet',
      'read.tip': 'Read the latest result aloud (Windows text-to-speech)',
      'read.msg.tip': 'Read this message aloud',
      'voice.open': 'Voice and speed settings',
      'voice.label': 'Voice',
      'voice.default': 'Default',
      'voice.local': 'offline',
      'rate.label': 'Speed',
      'support.title': 'Enjoying Read Aloud?',
      'support.paypal': 'Buy me a coffee (PayPal)',
    };
    const zh = {
      'read.result': '朗读结果',
      'read.stop': '停止朗读',
      'read.none': '暂无可朗读的内容',
      'read.tip': '用 Windows 语音朗读最新结果',
      'read.msg.tip': '朗读这条消息',
      'voice.open': '语音与语速设置',
      'voice.label': '语音',
      'voice.default': '默认',
      'voice.local': '离线',
      'rate.label': '语速',
      'support.title': '喜欢「朗读」插件吗？',
      'support.paypal': '用 PayPal 请我喝杯咖啡',
    };

    // ---------------------------------------------------------------- voices
    const PREF_KEY = 'rdaloud:pref';
    function loadPref() {
      try {
        const p = JSON.parse(localStorage.getItem(PREF_KEY) || '{}');
        return { voiceName: typeof p.voiceName === 'string' ? p.voiceName : '', rate: Number(p.rate) || 1 };
      } catch { return { voiceName: '', rate: 1 }; }
    }
    function savePref(pref) {
      try { localStorage.setItem(PREF_KEY, JSON.stringify(pref)); } catch {}
    }
    /** Sync voice pick: named voice, else browser default, else first English, else first. */
    function pickVoice(voiceName) {
      const synth = window.speechSynthesis;
      if (!synth) return null;
      const voices = synth.getVoices();
      if (!voices.length) return null;
      if (voiceName) {
        const v = voices.find((x) => x.name === voiceName);
        if (v) return v;
      }
      return voices.find((v) => v.default)
        || voices.find((v) => /^en([-_]|$)/i.test(v.lang))
        || voices[0];
    }
    /** Windows loads the voice list asynchronously; wait for it (bounded). */
    function ensureVoices(timeoutMs) {
      const synth = window.speechSynthesis;
      if (!synth || synth.getVoices().length) return Promise.resolve();
      return new Promise((resolve) => {
        let done = false;
        const on = () => {
          if (done) return;
          done = true;
          synth.removeEventListener('voiceschanged', on);
          resolve();
        };
        synth.addEventListener('voiceschanged', on);
        setTimeout(on, timeoutMs);
      });
    }

    // ---------------------------------------------------------------- text
    /**
     * Locate the text of the last assistant message in the rendered
     * conversation, using structural class-suffix markers (the semantic
     * suffix after the CSS-module hash is stable across builds):
     *   _column  conversation column
     *   _flowItem one row of the conversation flow
     *   _userRow  user message row (excluded)
     *   _title    collapsible tool/analysis block title button (excluded)
     *   _body     message text body
     */
    function findLastAssistantText() {
      let col = null;
      for (const e of document.querySelectorAll('div[class*="_column"]')) {
        if (e.scrollHeight > 400 && e.querySelector('[class*="_flowItem"]')) { col = e; break; }
      }
      if (!col) return null;
      let wrapper = null, best = 0;
      for (const e of col.querySelectorAll('div')) {
        const n = [...e.children].filter((c) => /_flowItem/.test(c.className || '')).length;
        if (n > best) { best = n; wrapper = e; }
      }
      if (!wrapper) return null;
      const items = [...wrapper.children].filter((e) => /_flowItem/.test(e.className || ''));
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        if (it.querySelector('[class*="_userRow"]')) continue;
        if (it.querySelector('button[class*="_title"]')) continue;
        const body = it.querySelector('[class*="_body"]');
        if (!body) continue;
        const t = (body.textContent || '').trim();
        if (t.length < 3) continue;
        if (/^think(ing)?\w/i.test(t)) continue;
        return t;
      }
      return null;
    }

    // ---------------------------------------------------------------- speak
    function makeUtterance(text, pref) {
      const u = new SpeechSynthesisUtterance(text.length > 20000 ? text.slice(0, 20000) : text);
      const v = pickVoice(pref.voiceName);
      if (v) {
        u.voice = v;
        u.lang = v.lang;
      } else {
        u.lang = navigator.language || 'en-US';
      }
      u.rate = pref.rate || 1;
      return u;
    }

    // ---------------------------------------------------------------- icons
    const SPEAKER_SVG = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M2 6h2.5L8 2.5v11L4.5 10H2z" fill="currentColor"/><path d="M10 5.5c.9.6 1.5 1.5 1.5 2.5s-.6 1.9-1.5 2.5" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><path d="M12 3.8c1.6 1 2.6 2.5 2.6 4.2s-1 3.2-2.6 4.2" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>';
    const GEAR_SVG = '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path fill="currentColor" d="M8 5.5A2.5 2.5 0 1 0 8 10.5 2.5 2.5 0 0 0 8 5.5zm6 2.5c0-.35-.03-.69-.09-1.02l1.19-.93-1.5-2.6-1.42.56a5.9 5.9 0 0 0-1.77-1.03L10.06 1.5h-3l-.35 1.48c-.65.27-1.25.63-1.77 1.03l-1.42-.56-1.5 2.6 1.19.93c-.06.33-.09.67-.09 1.02s.03.69.09 1.02l-1.19.93 1.5 2.6 1.42-.56c.52.4 1.12.76 1.77 1.03l.35 1.48h3l.35-1.48c.65-.27 1.25-.63 1.77-1.03l1.42.56 1.5-2.6-1.19-.93c.06-.33.09-.67.09-1.02z"/></svg>';
    const PAYPAL_DONATE_URL = 'https://www.paypal.com/donate/?hosted_button_id=YHFEX4KPGJ9R2';
    const QR_DATA_URI = 'data:image/png;base64,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';

    // ---------------------------------------------------------------- styles
    const CSS = [
      '.rdaloud-btn { appearance: none; background: transparent; border: 1px solid transparent; color: inherit; border-radius: 999px; padding: 3px 10px; font: inherit; font-size: 12.5px; line-height: 1.2; display: inline-flex; align-items: center; gap: 5px; cursor: pointer; opacity: .8; transition: background-color .12s ease, opacity .12s ease, border-color .12s ease; }',
      '.rdaloud-btn:hover { opacity: 1; background: rgba(127,127,127,.16); }',
      '.rdaloud-btn:focus-visible { outline: 2px solid currentColor; outline-offset: 1px; opacity: 1; }',
      '.rdaloud-btn[data-speaking="true"] { opacity: 1; border-color: currentColor; }',
      '.rdaloud-gear { appearance: none; background: transparent; border: none; color: inherit; border-radius: 6px; width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; opacity: .6; padding: 0; transition: background-color .12s ease, opacity .12s ease; }',
      '.rdaloud-gear:hover { opacity: 1; background: rgba(127,127,127,.16); }',
      '.rdaloud-gear:focus-visible { outline: 2px solid currentColor; outline-offset: 1px; }',
      '.rdaloud-pop { position: absolute; bottom: calc(100% + 6px); right: 0; z-index: 50; background: var(--dsw-alias-button-floating-fill, #f5f5f5); color: var(--dsw-alias-label-primary, #161617); border: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.35)); border-radius: 8px; padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; min-width: 240px; box-shadow: 0 4px 16px rgba(0,0,0,.28); }',
      '.rdaloud-pop label { display: flex; flex-direction: column; gap: 3px; font-size: 11.5px; opacity: .85; }',
      '.rdaloud-pop select { font: inherit; font-size: 12.5px; padding: 3px 6px; border-radius: 6px; border: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.4)); background: transparent; color: inherit; max-width: 240px; }',
      '.rdaloud-msg { position: absolute; top: 2px; right: 2px; width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center; background: transparent; border: none; color: inherit; opacity: .45; cursor: pointer; border-radius: 6px; padding: 0; transition: opacity .12s ease, background-color .12s ease; }',
      '.rdaloud-msg:hover { opacity: 1; background: rgba(127,127,127,.18); }',
      '.rdaloud-msg:focus-visible { outline: 2px solid currentColor; outline-offset: 1px; opacity: 1; }',
      '.rdaloud-msg[data-speaking="true"] { opacity: 1; }',
      '.rdaloud-donate { margin-top: 2px; padding-top: 8px; border-top: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.25)); display: flex; align-items: center; gap: 10px; }',
      '.rdaloud-donate img { width: 64px; height: 64px; flex: none; border-radius: 6px; padding: 3px; background: #ffffff; }',
      '.rdaloud-donate-title { display: block; font-size: 11.5px; opacity: .85; margin-bottom: 4px; }',
      '.rdaloud-donate-btn { display: inline-block; font-size: 12px; font-weight: 600; color: #ffffff; background: #0070e0; text-decoration: none; padding: 4px 12px; border-radius: 999px; transition: background-color .12s ease; }',
      '.rdaloud-donate-btn:hover { background: #005bbf; }',
    ].join('\n');

    // ------------------------------------------- per-message speaker buttons
    /** True when the element is an assistant message text body (not yet decorated). */
    function isAssistantBody(el) {
      if (!el || el.nodeType !== 1) return false;
      if (!/_body/.test(el.className || '')) return false;
      if (el.dataset.rdaloud) return false;
      const text = (el.textContent || '').trim();
      if (text.length < 3 || /^think(ing)?\w/i.test(text)) return false;
      const item = el.closest('[class*="_flowItem"]');
      if (!item) return false;
      if (item.querySelector('[class*="_userRow"]')) return false;
      if (item.querySelector('button[class*="_title"]')) return false;
      return true;
    }
    function decorateBody(el, t) {
      el.dataset.rdaloud = '1';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'rdaloud-msg';
      btn.title = t('read.msg.tip');
      btn.setAttribute('aria-label', t('read.msg.tip'));
      btn.innerHTML = SPEAKER_SVG;
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const synth = window.speechSynthesis;
        if (!synth) return;
        if (synth.speaking || synth.pending) synth.cancel();
        const text = (el.textContent || '').trim();
        if (!text) return;
        const go = async () => {
          if (!synth.getVoices().length) await ensureVoices(5000);
          const u = makeUtterance(text, loadPref());
          u.onstart = () => btn.setAttribute('data-speaking', 'true');
          u.onend = () => btn.removeAttribute('data-speaking');
          u.onerror = (e) => {
            btn.removeAttribute('data-speaking');
            if (!(e && (e.error === 'canceled' || e.error === 'interrupted'))) {
              btn.title = t('read.none');
            }
          };
          synth.speak(u);
        };
        void go();
      });
      el.style.position = 'relative';
      el.appendChild(btn);
    }

    // ---------------------------------------------------------- dock control
    function ReadAloud({ t }) {
      const [speaking, setSpeaking] = React.useState(false);
      const [failed, setFailed] = React.useState(false);
      const [open, setOpen] = React.useState(false);
      const [voices, setVoices] = React.useState([]);
      const [pref, setPref] = React.useState(loadPref);
      const wrapRef = React.useRef(null);
      const myUtter = React.useRef(null);

      const stop = React.useCallback(() => {
        try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch {}
        setSpeaking(false);
      }, []);
      // Silence any running utterance when this control unmounts.
      React.useEffect(() => stop, [stop]);

      // Load the voice list once the settings panel is opened.
      React.useEffect(() => {
        if (!open) return;
        const synth = window.speechSynthesis;
        if (!synth) return;
        let done = false;
        const refresh = () => {
          if (done) return;
          const list = synth.getVoices();
          if (list.length) {
            done = true;
            synth.removeEventListener('voiceschanged', refresh);
            setVoices(list.sort((a, b) => (a.lang + a.name).localeCompare(b.lang + b.name)));
          }
        };
        refresh();
        synth.addEventListener('voiceschanged', refresh);
        const to = setTimeout(refresh, 5000);
        return () => { done = true; clearTimeout(to); synth.removeEventListener('voiceschanged', refresh); };
      }, [open]);

      // Close the panel on outside interaction or Escape.
      React.useEffect(() => {
        if (!open) return;
        const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
      }, [open]);

      const onClick = async () => {
        const synth = window.speechSynthesis;
        if (!synth) return;
        if (synth.speaking || synth.pending) { stop(); return; }
        const text = findLastAssistantText();
        if (!text) { setFailed(true); return; }
        if (!synth.getVoices().length) await ensureVoices(5000);
        setFailed(false);
        const u = makeUtterance(text, pref);
        u.onstart = () => setSpeaking(true);
        u.onend = () => setSpeaking(false);
        u.onerror = (e) => {
          setSpeaking(false);
          if (e && (e.error === 'canceled' || e.error === 'interrupted')) return;
          setFailed(true);
        };
        myUtter.current = u;
        synth.speak(u);
      };

      const onVoiceChange = (e) => {
        const next = { ...pref, voiceName: e.target.value };
        setPref(next);
        savePref(next);
      };
      const onRateChange = (e) => {
        const next = { ...pref, rate: Number(e.target.value) };
        setPref(next);
        savePref(next);
      };

      const label = failed ? t('read.none') : speaking ? t('read.stop') : t('read.result');
      return h('span', { ref: wrapRef, style: { position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 4 } },
        h('style', null, CSS),
        h('button', {
          type: 'button',
          className: 'rdaloud-btn',
          'data-speaking': speaking || undefined,
          onClick,
          title: failed ? t('read.none') : (speaking ? t('read.stop') : t('read.tip')),
          'aria-label': failed ? t('read.none') : (speaking ? t('read.stop') : t('read.tip')),
        },
          h('span', { dangerouslySetInnerHTML: { __html: SPEAKER_SVG } }),
          h('span', null, label)
        ),
        h('button', {
          type: 'button',
          className: 'rdaloud-gear',
          onClick: () => setOpen((o) => !o),
          title: t('voice.open'),
          'aria-label': t('voice.open'),
          'aria-expanded': open || undefined,
        },
          h('span', { dangerouslySetInnerHTML: { __html: GEAR_SVG } })
        ),
        open ? h('div', { className: 'rdaloud-pop', role: 'group', 'aria-label': t('voice.open') },
          h('label', null,
            t('voice.label'),
            h('select', { value: pref.voiceName || '', onChange: onVoiceChange },
              h('option', { value: '' }, t('voice.default')),
              voices.map((v) => h('option', { key: v.name, value: v.name },
                v.name + ' — ' + v.lang + (v.localService ? ' (' + t('voice.local') + ')' : '')))
            )
          ),
          h('label', null,
            t('rate.label'),
            h('select', { value: String(pref.rate || 1), onChange: onRateChange },
              ['0.75', '1', '1.25', '1.5', '2'].map((r) => h('option', { key: r, value: r }, r))
            )
          ),
          h('div', { className: 'rdaloud-donate' },
            h('img', { src: QR_DATA_URI, alt: 'PayPal QR code', width: 64, height: 64 }),
            h('span', null,
              h('span', { className: 'rdaloud-donate-title' }, t('support.title')),
              h('a', { className: 'rdaloud-donate-btn', href: PAYPAL_DONATE_URL, target: '_blank', rel: 'noopener noreferrer' }, t('support.paypal'))
            )
          )
        ) : null
      );
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'read-aloud: dictionaries');
        const t = ctx.locale.bind(NS);
        ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
          name: 'conversation.composer.dock', id: 'read-aloud', locale: NS, order: 5,
        }, ReadAloud));
        // Per-message speaker icons, maintained as the conversation renders.
        ctx.effect(() => {
          const scanNode = (n) => {
            if (n.nodeType !== 1) return;
            if (isAssistantBody(n)) decorateBody(n, t);
            if (n.querySelectorAll) {
              for (const b of n.querySelectorAll('div[class*="_body"]')) {
                if (isAssistantBody(b)) decorateBody(b, t);
              }
            }
          };
          document.querySelectorAll('div[class*="_body"]').forEach((b) => {
            if (isAssistantBody(b)) decorateBody(b, t);
          });
          const obs = new MutationObserver((mutations) => {
            for (const m of mutations) for (const n of m.addedNodes) scanNode(n);
          });
          obs.observe(document.body, { childList: true, subtree: true });
          return () => obs.disconnect();
        }, 'read-aloud: message buttons');
      },
    };
  },
});
