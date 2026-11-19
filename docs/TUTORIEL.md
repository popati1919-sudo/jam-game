# Tutoriel — CityBuilder2D

Bienvenue, maire ! Le prototype se joue directement dans votre navigateur, sans installation.

## 1. Ouvrir le jeu

1. Ouvrez https://popati1919-sudo.github.io/jam-game/
2. Attendez que la carte isométrique apparaisse.
3. La partie commence avec 25 000 $ et la simulation en pause.

Si une ancienne version reste affichée après une mise à jour, faites **Ctrl + F5** pour forcer le rechargement.

## 2. Construire votre première rue

1. Dans le panneau **Construire**, cliquez sur **Route** (raccourci **R**).
2. Cliquez sur plusieurs cases de la carte pour tracer une rue.
3. Cliquez sur **Sélectionner** (raccourci **V**) pour quitter l'outil.

Chaque segment de route coûte 35 $. Pour le moment, les routes se posent case par case.

## 3. Créer des quartiers

Les zones doivent toucher une route par un côté.

- **Résidentiel** : crée des terrains où les habitants peuvent s'installer.
- **Commercial** : ajoute des emplois.
- **Industriel** : ajoute davantage d'emplois, mais peut réduire le bonheur.

Choisissez un type de zonage puis cliquez sur les cases libres adjacentes à une route.

## 4. Installer les services essentiels

Construisez ces bâtiments sur des cases libres :

| Bâtiment | Prix | Rôle |
|---|---:|---|
| Centrale électrique | 2 500 $ | Fournit l'électricité |
| Château d'eau | 1 800 $ | Fournit l'eau |
| Parc | 700 $ | Améliore le bonheur |
| École | 3 000 $ | Améliore le bonheur |
| Clinique | 4 000 $ | Améliore le bonheur |

Dans cette version, la croissance des habitants est meilleure lorsque la ville possède au moins une centrale électrique et un château d'eau.

## 5. Démarrer la simulation

1. Cliquez sur **▶** dans la barre supérieure pour retirer la pause.
2. Choisissez **1×**, **2×** ou **4×** pour régler la vitesse.
3. Surveillez la trésorerie, la population, les emplois et les jauges de services.
4. Cliquez de nouveau sur **Ⅱ** pour mettre la simulation en pause.

Un jour de jeu passe toutes les cinq secondes à vitesse 1×. Les vitesses supérieures accélèrent le nombre de jours simulés.

## 6. Sauvegarder et reprendre

- Cliquez sur **Sauvegarder** pour enregistrer la ville dans le stockage local de ce navigateur.
- Cliquez sur **Charger** pour reprendre la dernière sauvegarde de ce navigateur.
- **Nouvelle partie** efface la ville en cours après confirmation.

La sauvegarde est locale : elle ne se synchronise pas entre ordinateurs ou navigateurs. Ne supprimez pas les données du site si vous voulez la conserver.

## 7. Raccourcis clavier

| Touche | Action |
|---|---|
| V | Sélectionner |
| R | Construire une route |
| X | Démolir |

## 8. Conseils pour une ville stable

1. Commencez par relier quelques cases avec des routes.
2. Ajoutez du résidentiel près des routes.
3. Gardez une réserve d'argent pour les services.
4. Ajoutez des commerces et des industries pour créer des emplois.
5. Placez des parcs, une école et une clinique pour soutenir le bonheur.
6. Vérifiez régulièrement le solde journalier avant d'accélérer.

## 9. Limites connues du prototype 0.1

Cette première version propose une carte isométrique, la construction, le zonage, une économie simplifiée, des services, une simulation journalière et des sauvegardes locales.

Les voitures avec itinéraires, les embouteillages, les piétons, les bus, les intersections gérées, les incendies, la météo dynamique et les réseaux détaillés d'eau/électricité ne sont pas encore implémentés. Les indicateurs affichés sont ceux du modèle simplifié actuel.

## Dépannage rapide

- **Carte blanche ou chargement bloqué** : actualisez avec Ctrl + F5.
- **La simulation ne progresse pas** : cliquez sur ▶, car elle démarre en pause.
- **Impossible de zoner** : vérifiez qu'une route touche la case par un côté.
- **Fonds insuffisants** : démolissez une construction inutile ou attendez les revenus.
- **Sauvegarde introuvable** : utilisez le même navigateur et le même profil qu'au moment de l'enregistrement.
