# Validateur des mondes PyQuest.
# Usage : py tools/validate_worlds.py   (depuis la racine du projet)
# Sortie : rapport + code retour 0 (OK) / 1 (echecs).
import sys, io, json, os, traceback

# Console Windows : forcer UTF-8 pour les accents.
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORLDS_DIR = os.path.join(ROOT, 'data', 'worlds')
TEST_TYPES = {'stdout', 'variable', 'function', 'expression'}
errors = []

def err(msg):
    errors.append(msg)
    print('  [ERREUR]', msg)

# ---------- réplique exacte du harnais de pyrunner.js ----------
def _norm(s):
    return str(s).replace('\r\n', '\n').replace('\r', '\n')

def _cmp_stdout(got, expected, match):
    g, e = _norm(got), _norm(expected)
    if match == 'exact':
        return g == e
    if match == 'contains':
        return e.strip() in g
    if match == 'regex':
        import re
        return re.search(expected, g) is not None
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

def run_test(source, test):
    ttype = test.get('type', 'stdout')
    ns = {'__name__': '__main__'}
    old_in, old_out = sys.stdin, sys.stdout
    sys.stdin = io.StringIO(test.get('stdin', '') or '')
    buf = io.StringIO()
    sys.stdout = buf
    ok, error = False, None
    try:
        exec(compile(source, '<student>', 'exec'), ns)
        if ttype == 'stdout':
            ok = _cmp_stdout(buf.getvalue(), test.get('expected', ''), test.get('match', 'smart'))
        elif ttype == 'variable':
            ok = (test['name'] in ns) and _eq(ns[test['name']], test.get('expected'), test.get('tol'))
        elif ttype == 'function':
            fn = ns.get(test['name'])
            ok = callable(fn) and _eq(fn(*test.get('args', [])), test.get('expected'), test.get('tol'))
        elif ttype == 'expression':
            ok = _eq(eval(test['expression'], ns), test.get('expected', True), test.get('tol'))
    except Exception:
        error = traceback.format_exc().strip().splitlines()[-1]
    finally:
        sys.stdin, sys.stdout = old_in, old_out
    return ok, error

# ---------- validation de schéma ----------
def check_level_schema(wid, lv, seen_ids):
    lid = lv.get('id')
    where = f"{wid}/{lid or '??'}"
    if not lid or lid in seen_ids:
        err(f"{where} : id manquant ou duplique")
    seen_ids.add(lid)
    if not lv.get('title'):
        err(f"{where} : title manquant")
    if not lv.get('statement'):
        err(f"{where} : statement manquant")
    if not isinstance(lv.get('xp'), int) or lv['xp'] <= 0:
        err(f"{where} : xp doit etre un entier > 0")
    hints = lv.get('hints')
    if not isinstance(hints, list) or len(hints) < 1:
        err(f"{where} : au moins 1 indice requis")
    tests = lv.get('tests')
    if not isinstance(tests, list) or not tests:
        err(f"{where} : au moins 1 test requis")
        return
    for i, t in enumerate(tests):
        tw = f"{where} test#{i+1}"
        tt = t.get('type', 'stdout')
        if tt not in TEST_TYPES:
            err(f"{tw} : type inconnu '{tt}'")
            continue
        if tt in ('variable', 'function') and not t.get('name'):
            err(f"{tw} : champ 'name' requis pour type {tt}")
        if tt == 'expression' and not t.get('expression'):
            err(f"{tw} : champ 'expression' requis")
        # Piege JSON : tuple/set impossibles a representer.
        if tt in ('variable', 'function') and isinstance(t.get('expected'), list):
            print(f"  [note] {tw} : expected est une liste JSON — si la valeur Python "
                  f"attendue est un tuple ou un set, ce test echouera toujours ; "
                  f"utiliser un test 'expression'.")

def main():
    manifest = json.load(open(os.path.join(WORLDS_DIR, 'manifest.json'), encoding='utf-8'))
    ids = [w['id'] for w in manifest['worlds']]
    if len(ids) != len(set(ids)):
        err('manifest : ids de mondes dupliques')
    for w in manifest['worlds']:
        req = w.get('requires')
        if req is not None and req not in ids:
            err(f"manifest {w['id']} : requires '{req}' inconnu")
        node = w.get('node') or {}
        if not (0 <= node.get('x', -1) <= 100 and 0 <= node.get('y', -1) <= 100):
            err(f"manifest {w['id']} : node.x/y doivent etre en 0..100")
        if w.get('banner') and not os.path.exists(os.path.join(ROOT, w['banner'])):
            err(f"manifest {w['id']} : banner introuvable ({w['banner']})")
        if not w.get('file'):
            continue
        path = os.path.join(WORLDS_DIR, w['file'])
        if not os.path.exists(path):
            err(f"manifest {w['id']} : fichier introuvable ({w['file']})")
            continue

        world = json.load(open(path, encoding='utf-8'))
        print(f"\n=== {w['id']} — {world.get('title', '?')} ({len(world.get('levels', []))} niveaux)")
        if world.get('id') != w['id']:
            err(f"{w['file']} : id interne '{world.get('id')}' != manifest '{w['id']}'")
        seen = set()
        for lv in world.get('levels', []):
            n_before = len(errors)
            check_level_schema(w['id'], lv, seen)
            lid = f"{w['id']}/{lv.get('id')}"
            sol = lv.get('solution')
            if not sol:
                err(f"{lid} : champ 'solution' manquant (requis pour la validation)")
                continue
            # 1) la solution passe tous les tests
            for i, t in enumerate(lv.get('tests', [])):
                ok, e = run_test(sol, t)
                if not ok:
                    err(f"{lid} test#{i+1} : la solution echoue" + (f" ({e})" if e else ''))
            # 2) le code de depart ne passe PAS tous les tests
            start = lv.get('startCode', '')
            if lv.get('tests') and all(run_test(start, t)[0] for t in lv['tests']):
                err(f"{lid} : le code de depart passe deja les tests (niveau gratuit)")
            if len(errors) == n_before:
                print(f"  OK {lid}")

    print('\n' + ('TOUT PASSE' if not errors else f'{len(errors)} PROBLEME(S)'))
    sys.exit(0 if not errors else 1)

if __name__ == '__main__':
    main()
