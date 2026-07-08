/* ============================================================
   errhints.js — explications françaises des erreurs Python
   (public : lycéen débutant). Détection sur le texte du
   traceback renvoyé par le harnais (dernière ligne).
   ============================================================ */
window.PyQuest = window.PyQuest || {};

PyQuest.ErrHints = (function () {
  const HINTS = {
    SyntaxError:      "Python n'arrive pas à lire cette ligne. Vérifie les parenthèses, les guillemets fermés, et le deux-points (:) à la fin des lignes if/for/while/def.",
    IndentationError: "Problème d'indentation : les espaces en début de ligne comptent ! Le code à l'intérieur d'un if/for/while/def doit être décalé (4 espaces).",
    TabError:         "Mélange de tabulations et d'espaces. Utilise uniquement des espaces (l'éditeur en met 4 avec la touche Tab).",
    NameError:        "Tu utilises un nom qui n'existe pas (encore). Faute de frappe ? Variable définie plus bas ? Texte oublié entre guillemets ?",
    TypeError:        "Mélange de types incompatibles — par exemple additionner du texte et un nombre. Convertis avec int(), float() ou str().",
    ValueError:       "La valeur n'a pas le bon format — souvent int(\"abc\") : on ne peut convertir en nombre que du texte qui ressemble à un nombre.",
    ZeroDivisionError:"Division par zéro : vérifie le dénominateur avant de diviser.",
    IndexError:       "Index hors limites : une liste de n éléments va de l'index 0 à n-1 (et -1 désigne le dernier).",
    KeyError:         "Cette clé n'existe pas dans le dictionnaire. Vérifie l'orthographe exacte (majuscules comprises).",
    AttributeError:   "Cette méthode/attribut n'existe pas pour ce type. Faute de frappe ? Ou la variable n'est pas du type que tu crois (ex: .append sur autre chose qu'une liste).",
    UnboundLocalError:"Tu utilises une variable dans une fonction avant de lui donner une valeur (dans cette fonction).",
    RecursionError:   "La fonction s'appelle elle-même sans fin. Il manque un cas d'arrêt.",
    ModuleNotFoundError: "Ce module n'est pas disponible ici. Les exercices se résolvent sans import.",
    ImportError:      "Cet import ne fonctionne pas ici. Les exercices se résolvent sans import.",
    EOFError:         "Ton programme lit avec input() mais aucune entrée n'est fournie. Déplie « ⌨ Entrées pour input() » au-dessus de la console et écris une ligne par input(). (Le bouton Valider, lui, fournit les entrées automatiquement.)",
  };

  /** Renvoie { type, advice } ou null. `errorText` = res.error du harnais. */
  function explain(errorText) {
    if (!errorText) return null;
    const lines = String(errorText).trim().split('\n');
    const last = lines[lines.length - 1];
    const m = last.match(/^([A-Za-z_]*(?:Error|Exception))\b/);
    const type = m ? m[1] : null;
    if (type && HINTS[type]) return { type, advice: HINTS[type] };
    return null;
  }

  return { explain };
})();
