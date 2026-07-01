/* ============================================================
   pyrunner.js — chargement de Pyodide + exécution des tests
   ------------------------------------------------------------
   Chaque test s'exécute dans un espace de noms Python neuf pour
   éviter toute contamination entre tests.

   Types de tests supportés (voir le schéma dans data/worlds/README) :
     - "stdout"     : compare la sortie imprimée
     - "variable"   : vérifie la valeur d'une variable
     - "function"   : appelle une fonction et vérifie son retour
     - "expression" : évalue une expression Python (défaut attendu: True)
   ============================================================ */
window.PyQuest = window.PyQuest || {};

PyQuest.PyRunner = (function () {
  const PYODIDE_URL = 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/';
  let pyodide = null;
  let ready = false;

  /* Harnais Python injecté une seule fois.
     String.raw pour préserver les séquences \n, \r… destinées à Python. */
  const HARNESS = String.raw`
import sys, io, json, traceback

def _to_jsonable(x):
    try:
        json.dumps(x)
        return x
    except (TypeError, ValueError, OverflowError):
        return repr(x)

def _norm(s):
    return str(s).replace('\r\n', '\n').replace('\r', '\n')

def _cmp_stdout(got, expected, match):
    g = _norm(got)
    e = _norm(expected)
    if match == 'exact':
        return g == e
    if match == 'contains':
        return e.strip() in g
    if match == 'regex':
        import re
        return re.search(expected, g) is not None
    # 'smart' (defaut) : ignore les espaces de fin de ligne et lignes vides finales
    def clean(t):
        lines = [ln.rstrip() for ln in t.split('\n')]
        while lines and lines[-1] == '':
            lines.pop()
        return '\n'.join(lines)
    return clean(g) == clean(e)

def _eq(got, expected, tol):
    if tol is not None:
        try:
            return abs(got - expected) <= tol
        except TypeError:
            pass
    return got == expected

def _clean_tb():
    exc_type, exc_val, tb = sys.exc_info()
    frames = []
    for fs in traceback.extract_tb(tb):
        if fs.filename == '<student>':
            frames.append("  ligne %d : %s" % (fs.lineno, (fs.line or '').strip()))
    msg = ''.join(traceback.format_exception_only(exc_type, exc_val)).strip()
    if frames:
        return '\n'.join(frames) + '\n' + msg
    return msg

def _pyquest_run(source, test):
    ttype = test.get('type', 'stdout')
    ns = {'__name__': '__main__'}
    stdin_data = test.get('stdin', '') or ''
    old_stdin, old_stdout = sys.stdin, sys.stdout
    sys.stdin = io.StringIO(stdin_data)
    buf = io.StringIO()
    sys.stdout = buf
    res = {'ok': False, 'error': None, 'stdout': '', 'got': None, 'expected': test.get('expected')}
    try:
        code = compile(source, '<student>', 'exec')
        exec(code, ns)
        if ttype == 'stdout':
            got = buf.getvalue()
            res['got'] = got
            res['ok'] = _cmp_stdout(got, test.get('expected', ''), test.get('match', 'smart'))
        elif ttype == 'variable':
            name = test['name']
            if name not in ns:
                res['error'] = "La variable '%s' n'a pas ete definie." % name
            else:
                got = ns[name]
                res['got'] = _to_jsonable(got)
                res['ok'] = _eq(got, test.get('expected'), test.get('tol'))
        elif ttype == 'function':
            name = test['name']
            fn = ns.get(name)
            if not callable(fn):
                res['error'] = "La fonction '%s' n'a pas ete definie." % name
            else:
                got = fn(*test.get('args', []))
                res['got'] = _to_jsonable(got)
                res['ok'] = _eq(got, test.get('expected'), test.get('tol'))
        elif ttype == 'expression':
            got = eval(test['expression'], ns)
            res['got'] = _to_jsonable(got)
            res['ok'] = _eq(got, test.get('expected', True), test.get('tol'))
        else:
            res['error'] = "Type de test inconnu : %s" % ttype
    except Exception:
        res['error'] = _clean_tb()
    finally:
        sys.stdin, sys.stdout = old_stdin, old_stdout
    res['stdout'] = buf.getvalue()
    return res

def _pyquest_run_json(source, test_json):
    return json.dumps(_pyquest_run(source, json.loads(test_json)), ensure_ascii=False)
`;

  async function init(onProgress) {
    if (ready) return;
    const p = (m) => onProgress && onProgress(m);
    p('Chargement du moteur Python (Pyodide)…');
    pyodide = await loadPyodide({ indexURL: PYODIDE_URL });
    p("Préparation de l'environnement Python…");
    await pyodide.runPythonAsync(HARNESS);
    ready = true;
    p('Python prêt.');
  }

  /** Exécute `source` contre un `test` (objet). Renvoie
   *  { ok, error, stdout, got, expected }. Ne jette pas pour une
   *  erreur de code élève (elle est renvoyée dans `error`). */
  async function runTest(source, test) {
    if (!ready) throw new Error('Pyodide n\'est pas prêt.');
    const fn = pyodide.globals.get('_pyquest_run_json');
    let out;
    try {
      out = fn(source, JSON.stringify(test));
    } finally {
      fn.destroy();
    }
    return JSON.parse(out);
  }

  /** Exécution libre (bouton « Exécuter ») : renvoie { stdout, error }. */
  async function runRaw(source) {
    const r = await runTest(source, { type: 'stdout', expected: '', match: 'contains' });
    return { stdout: r.stdout, error: r.error };
  }

  return { init, runTest, runRaw, isReady: () => ready };
})();
