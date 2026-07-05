# Recipes

Mobile-first GitHub-Pages-Rezeptsammlung.

## Datenmodell

Rezepte liegen in `recipes.json`. Neue Rezepte werden als Objekte mit diesen Feldern ergänzt:

```json
{
  "id": "eindeutiger-slug",
  "title": "Rezeptname",
  "description": "Kurze Beschreibung",
  "cuisine": "Italienisch",
  "diet": "vegetarisch | vegan | Fleisch | Fisch | ...",
  "course": "Vorspeise | Hauptspeise | Nachspeise | Snack | Frühstück | ...",
  "effort": "einfach | mittel | aufwendig",
  "time": "30 min",
  "servings": 2,
  "tags": ["Pasta", "schnell"],
  "ingredients": ["..."],
  "steps": ["..."]
}
```

## Validierung

Für reine Rezeptänderungen reicht der schnelle Schema-/Konsistenzcheck:

```bash
python3 scripts/validate_recipes.py
```

Der Validator prüft u. a. Pflichtfelder, Typen, eindeutige IDs, Slug-Format, nicht-leere Zutaten/Schritte und übliche Kategorien.

## GitHub Pages

Die Seite ist rein statisch und kann direkt aus dem Repository-Root über GitHub Pages veröffentlicht werden.
