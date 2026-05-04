"""
GreenKNNRouterTrainer
----------------------
Entraîne les deux composants du GreenKNNRouter :

  Composant 1 — KNN (sklearn)
      Pas d'entraînement itératif : on ajuste simplement l'index KNN
      avec les embeddings historiques et le meilleur modèle par requête.

  Composant 2 — MLP d'estimation de difficulté (PyTorch)
      Entraîné de façon supervisée :
        label = 1 → requête facile (meilleur modèle ∈ small_models)
        label = 0 → requête difficile (meilleur modèle ∉ small_models)

      La loss utilisée est la Binary Cross-Entropy (BCELoss).
"""

import os
from typing import Dict, List, Optional, Tuple

import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset
from tqdm import tqdm

from llmrouter.models.base_trainer import BaseTrainer
from llmrouter.utils import save_model, load_model


class GreenKNNRouterTrainer(BaseTrainer):
    """
    Entraîneur pour GreenKNNRouter.

    Paramètres YAML utilisés (section hparam) :
        learning_rate : taux d'apprentissage du MLP  (défaut : 0.001)
        train_epoch   : nombre d'époques              (défaut : 10)
        batch_size    : taille des mini-batchs        (défaut : 32)
    """

    def __init__(self, router, device: str = "cpu"):
        """
        Initialise l'entraîneur.

        Args:
            router : instance de GreenKNNRouter déjà initialisée
            device : "cpu" ou "cuda"
        """
        # BaseTrainer attend (router, optimizer, device)
        super().__init__(router=router, optimizer=None, device=device)

        self.router = router
        self.device = device

        # Déplacer le MLP sur le bon device
        self.router.difficulty_estimator = (
            self.router.difficulty_estimator.to(device)
        )

        # Hyperparamètres d'entraînement
        hparam = router.cfg.get("hparam", {})
        self.learning_rate = hparam.get("learning_rate", 0.001)
        self.num_epochs    = hparam.get("train_epoch",   10)
        self.batch_size    = hparam.get("batch_size",    32)

        # Chemins
        project_root = os.path.dirname(
            os.path.dirname(os.path.dirname(__file__))
        )
        self.save_knn_path  = os.path.join(
            project_root,
            router.cfg["model_path"]["save_model_path"],
        )
        self.save_diff_path = os.path.join(
            project_root,
            router.cfg["model_path"].get("difficulty_model_path", ""),
        )
        ini_path = router.cfg["model_path"].get("ini_model_path", "")
        self.ini_knn_path = os.path.join(project_root, ini_path) if ini_path else ""

        # Optimiseur pour le MLP
        self.optimizer = optim.Adam(
            self.router.difficulty_estimator.parameters(),
            lr=self.learning_rate,
        )
        # Fonction de perte (classification binaire facile/difficile)
        self.criterion = nn.BCELoss()

        print("✅ GreenKNNRouterTrainer initialisé.")
        print(f"   Device         : {device}")
        print(f"   Learning rate  : {self.learning_rate}")
        print(f"   Époques        : {self.num_epochs}")
        print(f"   Batch size     : {self.batch_size}")

    # ------------------------------------------------------------------
    # Préparation des données
    # ------------------------------------------------------------------

    def _prepare_difficulty_labels(
        self,
    ) -> Tuple[List[np.ndarray], List[float]]:
        """
        Construit les paires (embedding, label_difficulté) pour le MLP.

        Nouvelle règle basée sur la performance réelle :
        - On calcule la performance MOYENNE de tous les modèles sur chaque requête
        - Si perf_moyenne >= 0.8 → requête facile → label = 0.0
            (même les petits modèles s'en sortent bien)
        - Si perf_moyenne < 0.8  → requête difficile → label = 1.0
            (les modèles ont du mal)

        C'est plus fiable que de regarder quel modèle a gagné.
        """
        embeddings: List[np.ndarray] = []
        labels: List[float] = []

        # Calculer la performance moyenne par requête sur TOUS les modèles
        perf_by_query = (
            self.router.routing_data_train
            .groupby("embedding_id")["performance"]
            .mean()
        )

        # Seuil : si perf moyenne >= 0.8 → facile, sinon difficile
        difficulty_threshold = self.router.cfg["hparam"].get(
            "label_difficulty_threshold", 0.8
        )

        for i, emb_id in enumerate(
            self.router.routing_data_train
            .drop_duplicates("embedding_id")
            .sort_values("embedding_id")["embedding_id"]
        ):
            if i >= len(self.router.query_embedding_list):
                break
            embedding = self.router.query_embedding_list[i]
            mean_perf = perf_by_query.get(emb_id, 0.5)

            # Perf élevée = requête facile (tous les modèles y arrivent)
            # Perf faible = requête difficile (les modèles ont du mal)
            label = 0.0 if mean_perf >= difficulty_threshold else 1.0

            embeddings.append(embedding)
            labels.append(label)

        n_easy = sum(1 for l in labels if l == 0.0)
        n_hard = sum(1 for l in labels if l == 1.0)
        print(f"📊 Données de difficulté (seuil perf={difficulty_threshold}) :")
        print(f"   Faciles (label=0) : {n_easy}")
        print(f"   Difficiles (label=1) : {n_hard}")

        return embeddings, labels
    # ------------------------------------------------------------------
    # Entraînement KNN
    # ------------------------------------------------------------------

    def _train_knn(self) -> None:
        """
        Ajuste l'index KNN avec les embeddings et labels historiques.

        Si un modèle pré-entraîné existe à ini_knn_path, on le charge
        en lieu et place d'un ajustement à partir de zéro.
        """
        print("\n── Entraînement KNN ──")

        if (
            self.ini_knn_path
            and os.path.exists(self.ini_knn_path)
            and self.ini_knn_path.endswith(".pkl")
        ):
            print(f"   Chargement depuis {self.ini_knn_path}")
            self.router.knn_model = load_model(self.ini_knn_path)
        else:
            print("   Ajustement de l'index KNN...")
            self.router.knn_model.fit(
                self.router.query_embedding_list,
                self.router.model_name_list,
            )

        # Construction du mapping index → embedding_id
        routing_best = self.router.routing_data_train.loc[
            self.router.routing_data_train.groupby("query")["performance"].idxmax()
        ].reset_index(drop=True)
        self.router._idx_to_embedding_id = {
            i: int(row["embedding_id"])
            for i, (_, row) in enumerate(routing_best.iterrows())
        }

        save_model(self.router.knn_model, self.save_knn_path)
        print(f"   ✅ KNN sauvegardé → {self.save_knn_path}")

    # ------------------------------------------------------------------
    # Entraînement MLP de difficulté
    # ------------------------------------------------------------------

    def _train_difficulty_mlp(
        self,
        embeddings: List[np.ndarray],
        labels: List[float],
    ) -> None:
        """
        Entraîne le MLP d'estimation de difficulté.

        Args:
            embeddings : liste d'arrays numpy [embedding_dim]
            labels     : liste de flottants (0.0 ou 1.0)
        """
        print("\n── Entraînement MLP de difficulté ──")

        # Conversion en tenseurs PyTorch
        X = torch.tensor(
            np.array(embeddings), dtype=torch.float32
        )
        y = torch.tensor(labels, dtype=torch.float32).unsqueeze(1)

        # DataLoader
        dataset = TensorDataset(X, y)
        loader  = DataLoader(
            dataset, batch_size=self.batch_size, shuffle=True
        )

        self.router.difficulty_estimator.train()

        for epoch in range(self.num_epochs):
            total_loss = 0.0
            n_batches  = 0

            bar = tqdm(
                loader,
                desc=f"  Époque {epoch + 1}/{self.num_epochs}",
                leave=False,
            )
            for X_batch, y_batch in bar:
                X_batch = X_batch.to(self.device)
                y_batch = y_batch.to(self.device)

                preds = self.router.difficulty_estimator(X_batch)
                loss  = self.criterion(preds, y_batch)

                self.optimizer.zero_grad()
                loss.backward()
                self.optimizer.step()

                total_loss += loss.item()
                n_batches  += 1
                bar.set_postfix({"loss": f"{loss.item():.4f}"})

            avg = total_loss / max(n_batches, 1)
            print(f"  Époque {epoch + 1:>3}/{self.num_epochs} — "
                  f"Loss moyenne : {avg:.4f}")

        # Sauvegarde des poids du MLP
        if self.save_diff_path:
            os.makedirs(os.path.dirname(self.save_diff_path), exist_ok=True)
            torch.save(
                self.router.difficulty_estimator.state_dict(),
                self.save_diff_path,
            )
            print(f"   ✅ MLP sauvegardé → {self.save_diff_path}")

    # ------------------------------------------------------------------
    # Point d'entrée principal
    # ------------------------------------------------------------------

    def train(self) -> None:
        """
        Lance l'entraînement complet :
          1. Ajustement de l'index KNN
          2. Entraînement du MLP de difficulté
        """
        print("\n" + "=" * 70)
        print("Entraînement GreenKNNRouter")
        print("=" * 70)

        # Étape 1 : KNN
        self._train_knn()

        # Étape 2 : MLP de difficulté
        embeddings, labels = self._prepare_difficulty_labels()
        if embeddings:
            self._train_difficulty_mlp(embeddings, labels)
        else:
            print("⚠️  Aucune donnée disponible pour entraîner le MLP.")

        print("\n✅ Entraînement terminé !")
        print("=" * 70)