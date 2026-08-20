# -*- coding: utf-8 -*-
# Garde-fou anti-regression : rejoue des solutions VOLONTAIREMENT FAUSSES
# (ou qui contournent la consigne) et exige qu'elles ECHOUENT.
#
# Pourquoi cet outil : validate_worlds.py verifie qu'une bonne solution passe.
# Il ne verifie pas qu'une mauvaise solution echoue. L'audit d'aout 2026 a
# montre que des bornes de notes fausses, un filtre sans sorted(), un `in`
# interdit par l'enonce et une recherche lineaire au lieu d'une dichotomie
# passaient tous les tests de leur niveau : l'eleve apprenait faux sans le
# savoir. Ce fichier fige ces cas pour qu'ils ne puissent plus revenir.
#
# Usage : py tools/check_cheats.py     (a lancer avec validate_worlds.py)
# Sortie : code 0 si toutes les triches sont bien refusees, 1 sinon.
import sys, io, json, os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from validate_worlds import run_test  # meme harnais que le jeu

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORLDS = os.path.join(ROOT, 'data', 'worlds')

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

# (fichier, id du niveau, ce que la triche represente, code de la triche)
TRICHES = [
    ('monde-1-fondamentaux.json', '1-1',
     "energie laissee a sa valeur de depart",
     'pseudo = "Alex"\nniveau = 1\nenergie = 0.0\nactif = True\n'),

    ('monde-1-fondamentaux.json', '1-3',
     "0 et 1 ecrits a la place de False et True",
     'x = 5\ny = 8\negal = 0\nplus_grand = 0\ndifferent = 1\n'),

    ('monde-1-fondamentaux.json', '1-4b',
     "print au lieu de return : la valeur n'est pas renvoyee",
     'def double(n):\n    print(2 * n)\n\n'
     'def perimetre(largeur, hauteur):\n    print(2 * (largeur + hauteur))\n'),

    ('monde-1-fondamentaux.json', '1-5',
     "bornes fausses : <= 10 et <= 14 au lieu de < 10 et < 14",
     'def mention(note):\n'
     '    if note <= 10:\n        return "Recalé"\n'
     '    elif note <= 14:\n        return "Passable"\n'
     '    else:\n        return "Bien"\n'),

    ('monde-2-structures-donnees.json', '2-6',
     "articles_chers sans sorted(), alors que l'enonce demande une liste triee",
     'def total_caisse(ventes):\n    return sum(ventes.values())\n\n'
     'def articles_chers(prix, seuil):\n'
     '    r = []\n'
     '    for a, p in prix.items():\n'
     '        if p >= seuil:\n            r.append(a)\n'
     '    return r\n'),

    ('monde-3-fonctions-recursivite.json', '3-5',
     "boucle au lieu de recursion, dans le monde de la recursivite",
     'def somme_recursive(n):\n'
     '    total = 0\n'
     '    for k in range(n + 1):\n        total = total + k\n'
     '    return total\n'),

    ('monde-3-fonctions-recursivite.json', '3-6',
     "factorielle iterative au lieu de recursive",
     'def factorielle(n):\n'
     '    r = 1\n'
     '    for k in range(1, n + 1):\n        r = r * k\n'
     '    return r\n'),

    ('monde-3-fonctions-recursivite.json', '3-8',
     "`cible in liste`, explicitement interdit par l'enonce",
     'def contient(liste, cible):\n    return cible in liste\n'),

    ('monde-4-algorithmique.json', '4-4',
     "fonction identite : elle renvoie la liste sans la trier",
     'def tri_insertion(liste):\n    return liste\n'),

    ('monde-4-algorithmique.json', '4-7',
     "recherche LINEAIRE au lieu de la dichotomie",
     'def recherche_dichotomique(liste, cible):\n'
     '    for i in range(len(liste)):\n'
     '        if liste[i] == cible:\n            return i\n'
     '    return -1\n'),

    ('monde-4-algorithmique.json', '4-8',
     "compteur d'etapes ecrit en dur",
     'def etapes_lineaire(liste, cible):\n'
     '    etapes = 0\n'
     '    for element in liste:\n'
     '        etapes = etapes + 1\n'
     '        if element == cible:\n            return etapes\n'
     '    return etapes\n\n'
     'def etapes_dicho(liste, cible):\n    return 10\n'),

    ('monde-4-algorithmique.json', '4-9',
     "chercher_joueur en `in` au lieu de la dichotomie exigee",
     'def chercher_joueur(classement, pseudo):\n'
     '    return pseudo in classement\n\n'
     'def meilleur_score(scores):\n'
     '    meilleur = scores[0]\n'
     '    for s in scores:\n'
     '        if s > meilleur:\n            meilleur = s\n'
     '    return meilleur\n'),
]


def niveau(fichier, lid):
    d = json.load(io.open(os.path.join(WORLDS, fichier), encoding='utf-8'))
    for lv in d['levels']:
        if lv['id'] == lid:
            return lv
    return None


def main():
    echecs = 0
    print("Triches qui doivent etre REFUSEES par les tests :\n")
    for fichier, lid, quoi, code in TRICHES:
        lv = niveau(fichier, lid)
        if lv is None:
            print("  [ERREUR] niveau introuvable : %s / %s" % (fichier, lid))
            echecs += 1
            continue
        resultats = [run_test(code, t) for t in lv['tests']]
        passe = all(r[0] for r in resultats)
        if passe:
            print("  [ECHEC] %-5s la triche PASSE : %s" % (lid, quoi))
            echecs += 1
        else:
            refuses = sum(1 for r in resultats if not r[0])
            print("  OK     %-5s refusee par %d test(s) sur %d — %s"
                  % (lid, refuses, len(resultats), quoi))

    print()
    if echecs:
        print("%d triche(s) passent encore : un eleve peut valider en apprenant faux." % echecs)
        sys.exit(1)
    print("Les %d triches sont bien refusees." % len(TRICHES))
    sys.exit(0)


if __name__ == '__main__':
    main()
