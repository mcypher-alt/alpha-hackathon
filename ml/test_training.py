"""Mathematical, split-isolation and artifact consistency checks."""
import json
import unittest
from pathlib import Path

import numpy as np

import train


class TrainingTests(unittest.TestCase):
    def test_ranking_metrics_include_ties(self):
        y = np.array([0, 1, 0, 1], dtype=float)
        p = np.array([0.1, 0.5, 0.5, 0.9])
        self.assertAlmostEqual(train.auc(y, p), 0.875)
        self.assertAlmostEqual(train.average_precision(y, p), 5 / 6)
        constant = np.ones(4) * .5
        self.assertAlmostEqual(train.auc(y, constant), .5)
        self.assertAlmostEqual(train.average_precision(y, constant), .5)

    def test_generation_is_reproducible_and_splits_are_separate(self):
        first = train.generate(train.SEEDS["train"], 200)
        repeat = train.generate(train.SEEDS["train"], 200)
        unseen = train.generate(train.SEEDS["test"], 200)
        self.assertEqual(first[0], repeat[0])
        np.testing.assert_array_equal(first[1], repeat[1])
        np.testing.assert_array_equal(first[2], repeat[2])
        self.assertFalse(np.array_equal(first[1], unseen[1]))
        self.assertEqual(len(set(train.SEEDS.values())), len(train.SEEDS))

    def test_exported_scaler_is_fitted_on_train_only(self):
        artifact = json.loads((Path(__file__).parent / "artifacts/risk-model.json").read_text(encoding="utf-8"))
        _, x, _ = train.generate(train.SEEDS["train"], train.SIZES["train"])
        np.testing.assert_allclose(artifact["mean"], x.mean(axis=0), atol=1e-10, rtol=0)
        np.testing.assert_allclose(artifact["scale"], x.std(axis=0), atol=1e-10, rtol=0)

    def test_hand_authored_intent_splits_have_no_exact_duplicate_text(self):
        corpus = json.loads((Path(__file__).parent / "intent_corpus.json").read_text(encoding="utf-8"))
        seen = set()
        for split in ["train", "validation", "test"]:
            texts = [text.lower() for rows in corpus[split].values() for text in rows]
            self.assertEqual(len(texts), len(set(texts)))
            self.assertFalse(seen.intersection(texts))
            seen.update(texts)


if __name__ == "__main__":
    unittest.main()
