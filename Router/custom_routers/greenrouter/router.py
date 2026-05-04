"""
GreenKNNRouter
--------------
Routeur hybride combinant :
  1. KNN   → trouver les K voisins les plus proches dans l'historique
  2. Threshold → estimer la difficulté de la requête
  3. Score CO₂ → pénaliser les modèles selon leur empreinte carbone

Score d'utilité final (inspiré du tableau) :
    utility(m) = w_perf · perf(m) - w_co2 · co2_impact(m)

Le modèle sélectionné est celui qui maximise ce score d'utilité,
sous contrainte de la difficulté estimée par le threshold.

Flux :
    Query
      │
      ▼
  Embedding (Longformer)
      │
      ├──► KNN → score de performance attendu par modèle
      │
      ├──► Threshold → difficulté [0,1]
      │         • difficulté < seuil  → restreindre aux "petits modèles"
      │         • difficulté ≥ seuil  → autoriser tous les modèles
      │
      └──► Score CO₂ (statique, fourni dans co2_data.json)
                │
                ▼
          utility = w_perf · perf - w_co2 · co2_impact
                │
                ▼
          Modèle sélectionné
"""

from typing import Any, Dict, List, Optional
import os
import copy
import json

import numpy as np
import torch
import torch.nn as nn

from sklearn.neighbors import KNeighborsClassifier

from llmrouter.models.meta_router import MetaRouter
from llmrouter.utils import (
    load_model,
    get_longformer_embedding,
    call_api,
    generate_task_query,
    calculate_task_performance,
)


# ---------------------------------------------------------------------------
# Module d'estimation de difficulté
# ---------------------------------------------------------------------------

class DifficultyEstimator(nn.Module):
    """
    Réseau de neurones léger mlp qui estime la difficulté d'une requête.

    Entrée  : embedding de la requête  [batch_size, input_dim]
    Sortie  : score de difficulté      [batch_size, 1]  ∈ [0, 1]

    Architecture :
        Linear → ReLU → Dropout → Linear → ReLU → Linear → Sigmoid
    """

    def __init__(self, input_dim: int, hidden_dim: int = 128):
        super().__init__()
        self.network = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),
            nn.ReLU(),
            nn.Dropout(0.1),
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.ReLU(),
            nn.Linear(hidden_dim // 2, 1),
            nn.Sigmoid(),  # Score dans [0, 1]
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.network(x)


# ---------------------------------------------------------------------------
# Routeur principal
# ---------------------------------------------------------------------------

class GreenKNNRouter(MetaRouter):
    """
    GreenKNNRouter
    --------------
    Combine trois mécanismes de routage :

    (1) KNN   : pour chaque requête, retrouve les K requêtes historiques
                les plus similaires et calcule, pour chaque modèle,
                la performance moyenne observée sur ces voisins.

    (2) Threshold : estime la difficulté de la requête via un MLP.
                    Si difficulté < seuil  → on n'autorise que les
                    "petits modèles" (définis dans le YAML).
                    Si difficulté ≥ seuil  → tous les modèles sont
                    candidats. (on a parle de pas faire ca mais utiliser un score 
                    qui est entre, au lieu, pour le argmin)

    (3) CO₂  : chaque modèle a un coût carbone statique chargé depuis
               un fichier JSON. Ce coût est soustrait au score de
               performance dans la fonction d'utilité :

               utility(m) = w_perf · perf_knn(m) - w_co2 · co2(m)

               Le modèle avec la meilleure utilité est sélectionné.
    """

    def __init__(self, yaml_path: str):
        """
        Initialisation du GreenKNNRouter.

        Étapes :
          1. Chargement de la configuration via MetaRouter.
          2. Construction du classifieur KNN (sklearn).
          3. Construction du RN MLP d'estimation de difficulté.
          4. Chargement des données CO₂ statiques.
          5. Préparation des embeddings et labels pour le KNN.
        """
        # Le MLP sera créé ci-dessous on passe un modèle factice pour
        # satisfaire l'interface MetaRouter, puis on le remplace.
        dummy = nn.Identity()
        super().__init__(model=dummy, yaml_path=yaml_path)

        hparam = self.cfg["hparam"]

        # ------------------------------------------------------------------
        # (1) Classifieur KNN
        # ------------------------------------------------------------------
        knn_params = {
            k: hparam[k] # ca devrait etre la 
            for k in ("n_neighbors", "weights", "algorithm",
                      "metric", "p", "n_jobs", "leaf_size")
            if k in hparam
        }
        self.knn_model = KNeighborsClassifier(**knn_params)

        # ------------------------------------------------------------------
        # (2) MLP d'estimation de difficulté (pour avoir tous les donnees avant de KNN)
        # ------------------------------------------------------------------
        embedding_dim = hparam.get("embedding_dim", 768)
        hidden_dim    = hparam.get("hidden_dim", 128)
        self.difficulty_estimator = DifficultyEstimator(
            input_dim=embedding_dim,
            hidden_dim=hidden_dim,
        )
        # Remplacement du modèle factice par le vrai MLP
        self.model = self.difficulty_estimator

        # Paramètres du threshold
        self.threshold    = hparam.get("threshold", 0.5)
        self.small_models = hparam.get("small_models", [])

        # ------------------------------------------------------------------
        # (3) Données CO₂ statiques
        # ------------------------------------------------------------------

        project_root = os.path.dirname(
            os.path.dirname(os.path.dirname(__file__))
        )
        co2_path = os.path.join(
            project_root,
            self.cfg["data_path"].get("co2_data", ""),
        )
        self.co2_data: Dict[str, float] = {}
        if os.path.exists(co2_path):
            with open(co2_path, "r", encoding="utf-8") as f:
                self.co2_data = json.load(f)
            print(f"✅ Données CO₂ chargées depuis {co2_path}")
        else:
            print(f"⚠️  Fichier CO₂ introuvable : {co2_path}")
            print("   Les scores CO₂ seront considérés comme nuls.")

        # Poids de la fonction d'utilité
        self.w_perf = hparam.get("w_perf", 1.0)
        self.w_co2  = hparam.get("w_co2",  0.3)

       # ------------------------------------------------------------------
        # (4) Préparation des données d'entraînement pour le KNN
        # ------------------------------------------------------------------
        # On garde le meilleur modèle par requête (selon la performance)
        routing_best = self.routing_data_train.loc[
            self.routing_data_train.groupby("query")["performance"].idxmax()
        ].reset_index(drop=True)

        ids = routing_best["embedding_id"].tolist()
        self.query_embedding_list = [
            self.query_embedding_data[i].numpy() for i in ids
        ]
        self.model_name_list = routing_best["model_name"].tolist()

        # Aussi : stocker les perfs par (query_id, model) pour le scoring KNN
        # Structure : { embedding_id → { model_name → performance } }
        self._perf_lookup: Dict[int, Dict[str, float]] = {}
        for _, row in self.routing_data_train.iterrows():
            eid = int(row["embedding_id"])
            if eid not in self._perf_lookup:
                self._perf_lookup[eid] = {}
            self._perf_lookup[eid][row["model_name"]] = float(
                row["performance"]
            )

        # Mapping index KNN → embedding_id (utilisé dans _knn_perf_scores)
        self._idx_to_embedding_id = {
            i: int(row["embedding_id"])
            for i, (_, row) in enumerate(routing_best.iterrows())
        }

        # ------------------------------------------------------------------
        # (5) Chargement du MLP de difficulté si déjà entraîné
        # ------------------------------------------------------------------
        project_root = os.path.dirname(
            os.path.dirname(os.path.dirname(__file__))
        )
        diff_path = self.cfg["model_path"].get("difficulty_model_path", "")
        if diff_path:
            full_diff_path = os.path.join(project_root, diff_path)
            if os.path.exists(full_diff_path):
                self.difficulty_estimator.load_state_dict(
                    torch.load(full_diff_path, map_location="cpu")
                )
                print(f"✅ MLP de difficulté chargé depuis {full_diff_path}")
            else:
                print(f"⚠️  MLP non entraîné encore → difficulté sera ~0.5")
                print(f"   Lance d'abord : llmrouter train --router greenrouter")

        print("✅ GreenKNNRouter initialisé.")
        print(f"   Seuil de difficulté : {self.threshold}")
        print(f"   Petits modèles      : {self.small_models}")
        print(f"   w_perf={self.w_perf}, w_co2={self.w_co2}")

    # ------------------------------------------------------------------
    # Méthodes internes
    # ------------------------------------------------------------------

    def _get_candidate_models(self) -> List[str]:
        """Retourne la liste de tous les modèles candidats disponibles."""
        return list(self.llm_data.keys()) if self.llm_data else self.model_name_list

    def _estimate_difficulty(self, embedding: np.ndarray) -> float:
        """
        Estime la difficulté d'une requête à partir de son embedding.

        Args:
            embedding: vecteur numpy [embedding_dim]

        Returns:
            score de difficulté ∈ [0, 1]
        """
        self.difficulty_estimator.eval()
        with torch.no_grad():
            t = torch.tensor(embedding, dtype=torch.float32).unsqueeze(0)
            score = self.difficulty_estimator(t)
        return float(score.item())

    def _knn_perf_scores(
        self,
        embedding: np.ndarray,
        candidate_models: List[str],
    ) -> Dict[str, float]:
        """
        Calcule un score de performance estimé pour chaque modèle candidat
        en se basant sur les K voisins les plus proches.

        Pour chaque voisin k :
          - on récupère la performance de chaque modèle sur ce voisin
            (0.0 si non disponible)
        On fait ensuite la moyenne sur les K voisins.

        Args:
            embedding        : embedding de la requête courante [dim]
            candidate_models : liste des modèles à scorer

        Returns:
            dict { model_name → score_moyen_de_performance }
        """
        # Récupérer les indices des K voisins dans l'index d'entraînement
        distances, indices = self.knn_model.kneighbors(
            [embedding], n_neighbors=self.knn_model.n_neighbors
        )
        # indices : shape (1, K)  → on prend la première ligne
        neighbor_indices = indices[0]
        neighbor_distances = distances[0]

        # Calculer les poids (uniform ou distance)
        if self.knn_model.weights == "distance":
            # Éviter la division par zéro si distance = 0
            weights = np.where(
                neighbor_distances == 0,
                1e10,                       # voisin identique → poids très élevé
                1.0 / neighbor_distances,
            )
        else:
            weights = np.ones(len(neighbor_indices))

        weights = weights / weights.sum()  # normalisation

        # Accumuler les performances pondérées
        perf_scores: Dict[str, float] = {m: 0.0 for m in candidate_models}
        for w, idx in zip(weights, neighbor_indices):
            # idx est l'indice dans query_embedding_list
            # On retrouve l'embedding_id correspondant dans routing_data_train
            # (on suppose que l'ordre de query_embedding_list correspond
            # aux lignes de routing_best, donc on mappe via l'index direct)
            # Pour être robuste, on utilise _perf_lookup via l'embedding_id
            embedding_id = self._get_embedding_id_from_index(idx)
            if embedding_id is None:
                continue
            neighbor_perfs = self._perf_lookup.get(embedding_id, {})
            for model in candidate_models:
                perf_scores[model] += w * neighbor_perfs.get(model, 0.0)

        return perf_scores

    def _get_embedding_id_from_index(self, idx: int) -> Optional[int]:
        """
        Retrouve l'embedding_id correspondant à la position idx dans
        le tableau d'entraînement du KNN.

        Lors de la construction, query_embedding_list[i] correspond à
        routing_best.iloc[i]["embedding_id"].

        On stocke ce mapping à l'initialisation.
        """
        if hasattr(self, "_idx_to_embedding_id"):
            return self._idx_to_embedding_id.get(idx)
        return None

    def _compute_utility(
        self,
        perf_scores: Dict[str, float],
        candidate_models: List[str],
    ) -> Dict[str, float]:
        """
        Calcule le score d'utilité pour chaque modèle candidat.

        Formule (cf. tableau) :
            utility(m) = w_perf · perf(m) - w_co2 · co2_impact(m)

        Les scores CO₂ sont normalisés dans [0, 1] sur l'ensemble des
        candidats pour rendre w_co2 interprétable indépendamment de
        l'unité des données CO₂.

        Args:
            perf_scores      : { model → score de performance [0,1] }
            candidate_models : liste des modèles autorisés

        Returns:
            dict { model_name → score d'utilité }
        """
        # Récupérer les valeurs CO₂ brutes
        co2_raw = {
            m: self.co2_data.get(m, 0.0) for m in candidate_models
        }

        # Normalisation min-max du CO₂ sur les candidats
        co2_values = list(co2_raw.values())
        co2_min = min(co2_values) if co2_values else 0.0
        co2_max = max(co2_values) if co2_values else 1.0
        co2_range = co2_max - co2_min if co2_max != co2_min else 1.0

        utility: Dict[str, float] = {}
        for m in candidate_models:
            co2_norm = (co2_raw[m] - co2_min) / co2_range
            utility[m] = self.w_perf * perf_scores[m] - self.w_co2 * co2_norm

        return utility

    # ------------------------------------------------------------------
    # Interface publique
    # ------------------------------------------------------------------

    def route_single(self, query: Dict[str, Any]) -> Dict[str, Any]:
        """
        Route une seule requête.

        Étapes :
          1. Calcul de l'embedding de la requête (Longformer).
          2. Estimation de la difficulté via le MLP.
          3. Sélection des modèles candidats selon le threshold.
          4. Calcul des scores de performance KNN.
          5. Calcul du score d'utilité (perf - CO₂).
          6. Sélection du modèle maximisant l'utilité.

        Args:
            query : dict avec au moins la clé "query" (texte)

        Returns:
            dict enrichi avec :
              - "model_name"       : modèle sélectionné
              - "difficulty_score" : score de difficulté [0,1]
              - "utility_scores"   : dict { model → utilité }
              - "co2_scores"       : dict { model → CO₂ brut }
              - "perf_scores"      : dict { model → perf estimée }
        """
        # Chargement du KNN entraîné
        project_root = os.path.dirname(
            os.path.dirname(os.path.dirname(__file__))
        )
        load_knn_path = os.path.join(
            project_root, self.cfg["model_path"]["load_model_path"]
        )
        self.knn_model = load_model(load_knn_path)


        # (1) Embedding
        embedding = get_longformer_embedding(query["query"]).numpy()

        # (2) Difficulté
        difficulty = self._estimate_difficulty(embedding)

        # (3) Candidats selon le threshold
        all_models = self._get_candidate_models()
        if difficulty < self.threshold and self.small_models:
            # Requête facile → on restreint aux petits modèles
            candidates = [m for m in all_models if m in self.small_models]
            if not candidates:
                # Fallback si la liste small_models ne correspond à rien
                candidates = all_models
        else:
            # Requête difficile → tous les modèles sont autorisés
            candidates = all_models

        # (4) Score de performance KNN
        perf_scores = self._knn_perf_scores(embedding, candidates)

        # (5) Score d'utilité
        utility_scores = self._compute_utility(perf_scores, candidates)

        # (6) Sélection du meilleur modèle
        best_model = max(utility_scores, key=utility_scores.__getitem__)

        # Construction du résultat
        output = copy.copy(query)
        output["model_name"]      = best_model
        output["difficulty_score"] = difficulty
        output["threshold"]        = self.threshold
        output["perf_scores"]      = perf_scores
        output["co2_scores"]       = {
            m: self.co2_data.get(m, 0.0) for m in candidates
        }
        output["utility_scores"]   = utility_scores
        return output

    def route_batch(
        self,
        batch: Optional[Any] = None,
        task_name: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Route un lot de requêtes et appelle les APIs correspondantes.

        Pour chaque requête :
          1. Routage via route_single (KNN + Threshold + CO₂)
          2. Formatage de la requête selon la tâche (si fournie)
          3. Appel API du modèle sélectionné
          4. Calcul des métriques de performance (si ground truth dispo)

        Args:
            batch     : liste de dicts ou None (utilise self.query_data_test)
            task_name : nom de la tâche pour le formatage des prompts

        Returns:
            liste de dicts enrichis (voir route_single + champs API)
        """
        # Chargement des modèles une seule fois
        project_root = os.path.dirname(
            os.path.dirname(os.path.dirname(__file__))
        )
        load_knn_path = os.path.join(
            project_root, self.cfg["model_path"]["load_model_path"]
        )
        self.knn_model = load_model(load_knn_path)

        diff_path = self.cfg["model_path"].get("difficulty_model_path", "")
        if diff_path:
            full_diff_path = os.path.join(project_root, diff_path)
            if os.path.exists(full_diff_path):
                self.difficulty_estimator.load_state_dict(
                    torch.load(full_diff_path, map_location="cpu")
                )

        # Sélection des données à traiter
        if batch is not None:
            query_data = batch if isinstance(batch, list) else [batch]
        elif hasattr(self, "query_data_test") and self.query_data_test is not None:
            query_data = copy.copy(self.query_data_test)
        else:
            print("⚠️  Aucune donnée fournie pour le routage par lot.")
            return []

        results = []
        for row in query_data:
            # Normalisation en dict
            if isinstance(row, dict):
                row_copy = copy.copy(row)
                original_query = row_copy.get("query", "")
                row_task_name  = row_copy.get("task_name", task_name)
            else:
                row_copy       = {"query": str(row)}
                original_query = str(row)
                row_task_name  = task_name

            # --- Routage ---
            embedding  = get_longformer_embedding(original_query).numpy()
            difficulty = self._estimate_difficulty(embedding)
            all_models = self._get_candidate_models()

            if difficulty < self.threshold and self.small_models:
                candidates = [m for m in all_models if m in self.small_models]
                if not candidates:
                    candidates = all_models
            else:
                candidates = all_models

            perf_scores    = self._knn_perf_scores(embedding, candidates)
            utility_scores = self._compute_utility(perf_scores, candidates)
            best_model     = max(utility_scores, key=utility_scores.__getitem__)

            row_copy["model_name"]       = best_model
            row_copy["difficulty_score"] = difficulty
            row_copy["utility_scores"]   = utility_scores
            row_copy["perf_scores"]      = perf_scores
            row_copy["co2_scores"] = {
                m: self.co2_data.get(m, 0.0) for m in candidates
            }

            # --- Formatage du prompt ---
            if row_task_name:
                try:
                    formatted = generate_task_query(
                        row_task_name,
                        {
                            "query":   original_query,
                            "choices": row_copy.get("choices"),
                        },
                    )
                    row_copy["formatted_query"]    = formatted
                    query_text_for_execution = formatted
                except (ValueError, KeyError) as e:
                    print(f"⚠️  Formatage échoué ({e}). Requête originale utilisée.")
                    query_text_for_execution = original_query
            else:
                query_text_for_execution = original_query

            # --- Appel API ---
            api_model_name = best_model
            api_endpoint   = None
            service        = None

            if self.llm_data and best_model in self.llm_data:
                api_model_name = self.llm_data[best_model].get(
                    "model", best_model
                )
                api_endpoint = self.llm_data[best_model].get(
                    "api_endpoint", self.cfg.get("api_endpoint")
                )
                service = self.llm_data[best_model].get("service")

            if api_endpoint is None:
                api_endpoint = self.cfg.get("api_endpoint")

            if not api_endpoint:
                raise ValueError(
                    f"Endpoint API introuvable pour le modèle '{best_model}'. "
                    "Vérifiez 'api_endpoint' dans llm_data ou dans le YAML."
                )

            request = {
                "api_endpoint": api_endpoint,
                "query":        query_text_for_execution,
                "model_name":   best_model,
                "api_name":     api_model_name,
            }
            if service:
                request["service"] = service

            try:
                result            = call_api(request, max_tokens=1024, temperature=0.7)
                response          = result.get("response", "")
                prompt_tokens     = result.get("prompt_tokens", 0)
                completion_tokens = result.get("completion_tokens", 0)
                success           = "error" not in result
            except Exception as e:
                print(f"❌ Erreur API : {e}")
                response          = ""
                prompt_tokens     = 0
                completion_tokens = 0
                success           = False

            row_copy["response"]          = response
            row_copy["prompt_tokens"]     = prompt_tokens
            row_copy["completion_tokens"] = completion_tokens
            row_copy["input_token"]       = prompt_tokens
            row_copy["output_token"]      = completion_tokens
            row_copy["success"]           = success

            # --- Performance (si ground truth disponible) ---
            ground_truth = (
                row_copy.get("ground_truth")
                or row_copy.get("gt")
                or row_copy.get("answer")
            )
            if ground_truth:
                tp = calculate_task_performance(
                    prediction=response,
                    ground_truth=ground_truth,
                    task_name=row_task_name,
                    metric=row_copy.get("metric"),
                )
                if tp is not None:
                    row_copy["task_performance"] = tp

            results.append(row_copy)

        return results