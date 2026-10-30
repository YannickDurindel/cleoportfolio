# Cléo Beaufils · portfolio

Portfolio « la dépêche diplomatique ». Site statique en HTML, CSS et JS vanilla, sans backend, sans traceur ni cookie.

**En ligne :** https://yannickdurindel.github.io/cleoportfolio/

## Structure

```
index.html            squelette de la page et balises Open Graph
content.json          TOUT le texte du site (FR + EN)
assets/css/style.css  direction artistique
assets/js/main.js     rendu, cartes, horloges, animations
assets/js/map-dots.js carte en points générée (Natural Earth, domaine public)
assets/img/           og.jpg (1200×630), favicons, portrait cleo.jpg
assets/cv/            CV en PDF (FR / EN), générés depuis content.json par tools/cv.html
assets/dossiers/      travaux de recherche en PDF (mini-mémoire, essai)
tools/                pages et script de régénération de og.jpg, des favicons et des CV d'exemple
```

## Deux designs

- `/` : « la dépêche diplomatique » (`index.html`, `assets/`).
- `/convention/` : le profil rédigé comme un traité (`convention/`). Ses textes propres sont dans le bloc `convention` de `content.json`.
- `/meridien/` : la page ne défile pas, le défilement fait tourner un globe en points de Tours à Zhongli, change la palette et anime la typographie (`meridien/`). Textes propres dans le bloc `meridien` ; les chapitres de lieux y renvoient aux listes de `parcours` par `[liste, index]`. Le globe vient de `tools/build-globe-dots.py` (Natural Earth, domaine public).
- Tout le reste (parcours, dossiers, langues…) est partagé entre les trois designs.
- Le menu « Styles » en haut de chaque design mène aux deux autres, en gardant la langue.
- Après une modification de `content.json`, `main.js` ou du CSS, augmenter le `?v=` dans `index.html`, `assets/js/main.js` et `convention/` pour que les navigateurs rechargent.

## Remplacer le contenu

1. **Textes** : modifier `content.json`. Chaque champ traduisible a la forme `{ "fr": "…", "en": "…" }`.
   - `parcours.experience` / `parcours.education` : ajouter ou retirer des entrées librement.
   - `dossiers.items` : `url` peut pointer vers un PDF (`assets/dossiers/note.pdf`) ou un lien externe ; laissé vide, la carte s'affiche « en cours ».
   - `terrain.stays` : `place` renvoie à une clé de `places`. Pour ajouter une ville, créez-la dans `places` avec `lat`, `lon` et `tz`.
   - `langues.items` : `level` accepte `native`, `A1`, `A2`, `B1`, `B2`, `C1` ou `C2`.
   - `contact.emailParts` : `["prenom.nom", "domaine", "com"]`. L'adresse n'est assemblée qu'au clic.
2. **Photo** : déposer `assets/img/cleo.jpg` (portrait 4:5, environ 1200×1500), puis écrire `"photo": "assets/img/cleo.jpg"` dans `hero`.
3. **CV** : les PDF sont générés depuis `content.json` par `node tools/build-assets.mjs` (voir point 4).
4. **Aperçu e-mail / LinkedIn** : les balises `og:*` sont dans `index.html`. Pour régénérer l'image : `python3 -m http.server 8765` puis `node tools/build-assets.mjs` (Playwright nécessaire).
5. Un `git push` sur `main` redéploie automatiquement le site (`.github/workflows/deploy.yml`).

Test en local : `python3 -m http.server` puis http://localhost:8000. Ouvrir `index.html` directement ne marche pas, car le fichier `content.json` est chargé via `fetch`.

## Brancher le domaine cleobeaufils.com

1. Créer à la racine un fichier `CNAME` contenant uniquement `cleobeaufils.com`, puis commit et push. Le workflow le copie dans le site.
2. Chez le registrar, configurer le DNS :
   | Type | Nom | Valeur |
   |---|---|---|
   | A | @ | 185.199.108.153 |
   | A | @ | 185.199.109.153 |
   | A | @ | 185.199.110.153 |
   | A | @ | 185.199.111.153 |
   | AAAA | @ | 2606:50c0:8000::153 (et 8001, 8002, 8003) |
   | CNAME | www | yannickdurindel.github.io |
3. Dans GitHub, aller dans Settings → Pages → Custom domain, saisir `cleobeaufils.com`, puis cocher **Enforce HTTPS** une fois le certificat émis.
4. Dans `index.html`, remplacer `https://yannickdurindel.github.io/cleoportfolio/` par `https://cleobeaufils.com/` (balises `og:url`, `og:image`, `twitter:image` et `canonical`).

Tous les chemins sont relatifs : le site fonctionne aussi bien sous `/cleoportfolio/` qu'à la racine d'un domaine.

## Notes

- Site personnel, aucun emblème officiel (pas de Marianne, de bloc-marque ni d'armoiries).
- Respecte `prefers-reduced-motion`. Le sélecteur de langue se mémorise localement, et `?lang=en` force l'anglais (utile dans un e-mail).
