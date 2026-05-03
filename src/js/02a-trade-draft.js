// ── TRADE DRAFT MODULE
// Holds in-progress trade form fields and exposes setters that call renderFormDOM(draft)
var TradeDraft = (function(){
  const draft = {
    asset: (typeof sAsset !== 'undefined') ? sAsset : 'BTC',
    type: (typeof sType !== 'undefined') ? sType : 'HOLDING',
    platform: (typeof sPlatform !== 'undefined') ? sPlatform : 'SPOT',
    sizeUnit: (typeof sSizeUnit !== 'undefined') ? sSizeUnit : 'contracts',
    outcome: (typeof sOut !== 'undefined') ? sOut : 'OPEN',
    lotNum: null,
    date: (typeof today === 'function') ? today() : '',
    expiry: '',
    dte: '',
    strike: '',
    size: '',
    premium: '',
    notes: ''
  };
  function renderForm() { if (typeof renderFormDOM === 'function') renderFormDOM(draft); }
  return {
    draft,
    setAsset(a){ draft.asset = a; renderForm(); },
    setType(t){ draft.type = t; renderForm(); },
    setPlatform(p){ draft.platform = p; renderForm(); },
    setSizeUnit(u){ draft.sizeUnit = u; renderForm(); },
    setOut(o){ draft.outcome = o; renderForm(); },
    setLotNum(n){ draft.lotNum = n; renderForm(); },
    setDate(v){ draft.date = v; renderForm(); },
    setExpiry(v){ draft.expiry = v; renderForm(); },
    setDte(v){ draft.dte = v; renderForm(); },
    setStrike(v){ draft.strike = v; renderForm(); },
    setSize(v){ draft.size = v; renderForm(); },
    setPremium(v){ draft.premium = v; renderForm(); },
    setNotes(v){ draft.notes = v; renderForm(); },
    renderForm,
    // initialize draft from current globals when opening drawer
    initFromGlobals(){
      draft.asset = (typeof sAsset !== 'undefined') ? sAsset : draft.asset;
      draft.type = (typeof sType !== 'undefined') ? sType : draft.type;
      draft.platform = (typeof sPlatform !== 'undefined') ? sPlatform : draft.platform;
      draft.sizeUnit = (typeof sSizeUnit !== 'undefined') ? sSizeUnit : draft.sizeUnit;
      draft.outcome = (typeof sOut !== 'undefined') ? sOut : draft.outcome;
      draft.date = (typeof today === 'function') ? today() : draft.date;
      draft.expiry = '';
      draft.dte = '';
      draft.strike = '';
      draft.size = '';
      draft.premium = '';
      draft.notes = '';
      draft.lotNum = null;
      renderForm();
    }
  };
})();
