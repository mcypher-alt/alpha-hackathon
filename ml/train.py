"""Rebuild the offline demonstration models. No bank data or remote services.

Only NumPy is required. All split seeds, data generation and export rules live here.
The synthetic outcome is stochastic; its metrics do not validate real credit risk.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent
AS_OF = datetime(2026, 10, 22, tzinfo=timezone.utc)
SEEDS = {"train": 20261022, "validation": 20261023, "calibration": 20261024, "threshold": 20261025, "test": 20261026}
SIZES = {"train": 24000, "validation": 4000, "calibration": 4000, "threshold": 4000, "test": 6000}
FEATURES = ["log_monthly_revenue", "profit_margin", "existing_debt_to_revenue", "requested_to_annual_revenue", "principal_payment_to_surplus", "business_age_years", "overdue_months", "tax_debt_to_revenue", "term_years"]


def sigmoid(x):
    return 1 / (1 + np.exp(-np.clip(x, -35, 35)))


def features(records: list[dict], as_of: datetime = AS_OF) -> np.ndarray:
    rows = []
    for r in records:
        rev = r["monthlyRevenue"]
        surplus = rev - r["monthlyExpenses"]
        age = max(0, (as_of - datetime.fromisoformat(r["registrationDate"].replace("Z", "+00:00"))).total_seconds() / 86400 / 365.25)
        rows.append([
            math.log1p(rev),
            np.clip(surplus / rev, -2, 1),
            min(r["currentDebtLoad"] / rev, 5),
            min(r["requestedAmount"] / (rev * 12), 10),
            min((r["requestedAmount"] / r["requestedTermMonths"]) / max(surplus, rev * 0.05), 20),
            min(age, 20),
            min(r.get("overdueDays", 0) / 30, 6),
            min(r.get("taxDebt", 0) / rev, 5),
            r["requestedTermMonths"] / 12,
        ])
    return np.asarray(rows, dtype=float)


def generate(seed: int, size: int):
    rng = np.random.default_rng(seed)
    revenue = np.exp(rng.normal(math.log(2_000_000), 1, size))
    margin = np.clip(rng.normal(0.23, 0.17, size), -0.35, 0.65)
    debt = revenue * np.clip(rng.lognormal(-2.65, 0.85, size), 0, 0.75)
    amount = revenue * np.clip(rng.lognormal(0.55, 0.9, size), 0.05, 15)
    term = rng.choice([6, 12, 24, 36, 60], size)
    age_days = rng.integers(30, 365 * 12, size)
    overdue = np.where(rng.random(size) < 0.84, 0, rng.integers(1, 100, size))
    taxes = np.where(rng.random(size) < 0.8, 0, revenue * rng.uniform(0.01, 0.4, size))
    records = [dict(monthlyRevenue=float(revenue[i]), monthlyExpenses=float(revenue[i] * (1 - margin[i])), currentDebtLoad=float(debt[i]), registrationDate=(AS_OF - timedelta(days=int(age_days[i]))).isoformat(), requestedAmount=float(amount[i]), requestedTermMonths=int(term[i]), productCode="A1", overdueDays=int(overdue[i]), taxDebt=float(taxes[i])) for i in range(size)]
    x = features(records)
    # A teaching simulation with unobserved factors and Bernoulli outcomes.
    latent = (-2.05 - 3.7 * x[:, 1] + 3.1 * x[:, 2] + 0.8 * x[:, 3]
              + 0.62 * x[:, 4] - 0.10 * x[:, 5] + 0.60 * x[:, 6]
              + 0.9 * x[:, 7] + 0.045 * x[:, 8] - 0.13 * (x[:, 0] - 14.5)
              + 0.35 * (x[:, 1] < 0) + rng.normal(0, 0.65, size))
    y = (rng.random(size) < sigmoid(latent)).astype(float)
    return records, x, y


def fit_logistic(x, y, regularization: float, iterations=1200):
    w = np.zeros(x.shape[1] + 1)
    w[0] = math.log(float(y.mean()) / (1 - float(y.mean())))
    design = np.column_stack([np.ones(len(x)), x])
    m = np.zeros_like(w)
    v = np.zeros_like(w)
    for step in range(1, iterations + 1):
        grad = design.T @ (sigmoid(design @ w) - y) / len(y)
        grad[1:] += regularization * w[1:]
        m = 0.9 * m + 0.1 * grad
        v = 0.999 * v + 0.001 * grad ** 2
        w -= 0.035 * (m / (1 - 0.9 ** step)) / (np.sqrt(v / (1 - 0.999 ** step)) + 1e-8)
    return w


def auc(y, p):
    order = np.argsort(p, kind="stable")
    ys, ps = y[order], p[order]
    positives, negatives = float(y.sum()), float((1 - y).sum())
    if positives == 0 or negatives == 0:
        return None
    rank_sum = 0.0
    start = 0
    for end in range(1, len(p) + 1):
        if end == len(p) or ps[end] != ps[start]:
            rank_sum += float(ys[start:end].sum()) * ((start + 1 + end) / 2)
            start = end
    return (rank_sum - positives * (positives + 1) / 2) / (positives * negatives)


def average_precision(y, p):
    order = np.argsort(-p, kind="stable")
    ys, ps = y[order], p[order]
    total = float(y.sum())
    if not total:
        return None
    tp, previous, result = 0.0, 0.0, 0.0
    for end in range(1, len(p) + 1):
        tp += ys[end - 1]
        if end == len(p) or ps[end] != ps[end - 1]:
            result += (tp - previous) / total * tp / end
            previous = tp
    return result


def metrics(y, p, threshold):
    pred = p >= threshold
    tp = int(np.sum((y == 1) & pred))
    fp = int(np.sum((y == 0) & pred))
    tn = int(np.sum((y == 0) & ~pred))
    fn = int(np.sum((y == 1) & ~pred))
    return dict(rows=len(y), positives=int(y.sum()), prevalence=float(y.mean()), roc_auc=auc(y, p), average_precision=average_precision(y, p), brier=float(np.mean((p - y) ** 2)), log_loss=float(-np.mean(y * np.log(np.clip(p, 1e-12, 1)) + (1 - y) * np.log(np.clip(1 - p, 1e-12, 1)))), threshold=float(threshold), confusion_matrix=[[tn, fp], [fn, tp]], precision=tp / max(tp + fp, 1), recall=tp / max(tp + fn, 1), accuracy=(tp + tn) / len(y))


def canonical(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode("utf-8")


def clean(value):
    if isinstance(value, dict):
        return {k: clean(v) for k, v in value.items()}
    if isinstance(value, list):
        return [clean(v) for v in value]
    if isinstance(value, (float, np.floating)):
        number = round(float(value), 12)
        return int(number) if number.is_integer() else number
    if isinstance(value, np.integer):
        return int(value)
    return value


def train_risk():
    splits = {name: generate(SEEDS[name], size) for name, size in SIZES.items()}
    _, train_x, train_y = splits["train"]
    mean, scale = train_x.mean(axis=0), train_x.std(axis=0)
    scale[scale < 1e-10] = 1
    design = {name: np.column_stack([np.ones(len(y)), (x - mean) / scale]) for name, (_, x, y) in splits.items()}
    candidates = []
    for penalty in [0.0001, 0.001, 0.01]:
        w = fit_logistic((train_x - mean) / scale, train_y, penalty)
        p = sigmoid(design["validation"] @ w)
        candidates.append((float(np.mean((p - splits["validation"][2]) ** 2)), penalty, w))
    _, penalty, w = min(candidates, key=lambda v: v[0])
    calibration_logits = design["calibration"] @ w
    cal_y = splits["calibration"][2]
    # Sigmoid (Platt) calibration fitted only on the calibration split.
    calibration = fit_logistic(calibration_logits[:, None], cal_y, 0.0001, 1500)
    if calibration[1] <= 0:
        raise RuntimeError("Calibration reversed risk order")
    predictions = {name: sigmoid(calibration[0] + calibration[1] * (dx @ w)) for name, dx in design.items()}
    threshold_y = splits["threshold"][2]
    threshold = max(np.linspace(.05, .75, 141), key=lambda t: float(np.mean(predictions["threshold"][threshold_y == 1] >= t)) + float(np.mean(predictions["threshold"][threshold_y == 0] < t)))
    model = clean(dict(version="risk-logistic-synthetic-v1", dataSource="synthetic", asOf=AS_OF.isoformat(), featureNames=FEATURES, mean=mean.tolist(), scale=scale.tolist(), intercept=w[0], coefficients=w[1:].tolist(), calibration=dict(intercept=calibration[0], slope=calibration[1]), reportingThreshold=float(threshold), l2=penalty))
    sha = hashlib.sha256(canonical(model)).hexdigest()
    report = {name: metrics(splits[name][2], predictions[name], threshold) for name in ["validation", "calibration", "threshold", "test"]}
    baseline = metrics(splits["test"][2], np.full(SIZES["test"], train_y.mean()), threshold)
    gold_records = [dict(monthlyRevenue=4500000, monthlyExpenses=3100000, currentDebtLoad=150000, registrationDate="2022-03-15T00:00:00+00:00", requestedAmount=3000000, requestedTermMonths=36, productCode="A1", overdueDays=0, taxDebt=0), dict(monthlyRevenue=600000, monthlyExpenses=590000, currentDebtLoad=140000, registrationDate="2026-04-01T00:00:00+00:00", requestedAmount=4000000, requestedTermMonths=12, productCode="A1", overdueDays=45, taxDebt=100000)]
    gold_x = (features(gold_records) - mean) / scale
    gold_p = sigmoid(calibration[0] + calibration[1] * (w[0] + gold_x @ w[1:]))
    card = clean(dict(name="Synthetic business risk teaching model", version=model["version"], sha256=sha, intendedUse="Offline hackathon demonstration of an end-to-end decision workflow; not a bank approval model", prohibitedClaims=["Validated bank PD", "Real client accuracy", "Fairness or regulatory compliance", "Actual FNS/BKI verification"], trainingData="Artificial independently generated business cohorts with noisy Bernoulli outcomes. No personal or banking records.", license="CC0-1.0 synthetic dataset; generated model parameters supplied with the project", outcome="Synthetic adverse event; no established mapping to real 12-month default", seeds=SEEDS, splitSizes=SIZES, numpyVersion=np.__version__, scaler="Mean and standard deviation fitted on train only", selection="L2 chosen by validation Brier; sigmoid fitted on separate calibration split; reporting threshold chosen on separate threshold split; test untouched until final report", validationLimit="All cohorts share the same synthetic generator. Test metrics only measure this simulation, not real-world credit quality. No temporal, external, protected-group or prospective validation.", inputNotes=dict(currentDebtLoad="Existing monthly debt payments in RUB", monthlyRevenue="RUB/month", monthlyExpenses="RUB/month excluding existing debt payments", principal_payment_to_surplus="Requested principal / term / max(monthly operating surplus, 5% revenue); not the actual annuity payment", productCode="Accepted for API compatibility; not a trained feature", asOf="Serving date determines business age; golden test date fixed"), featureNames=FEATURES, metrics=report, baselineTest=baseline, candidateValidationBrier=[dict(l2=p, brier=b) for b, p, _ in candidates], golden=[dict(input=r, probability=float(p), asOf=AS_OF.isoformat()) for r, p in zip(gold_records, gold_p)]))
    return model, card


def tokenize(text):
    return re.findall(r"[a-zа-я0-9]{2,}", text.lower().replace("ё", "е")[:1000])


def text_features(text):
    values = Counter()
    for word in tokenize(text):
        values["w:" + word] += 1
        if len(word) >= 3:
            padded = "^" + word + "$"
            for i in range(len(padded) - 2):
                values["c:" + padded[i:i + 3]] += 0.3
    return values


def intent_scores(text, model):
    extracted = text_features(text)
    indices = {f: i for i, f in enumerate(model["vocabulary"])}
    active = [(indices[f], min(count, 3)) for f, count in extracted.items() if f in indices]
    logits = np.asarray(model["logPrior"], dtype=float).copy()
    weights = np.asarray(model["logLikelihood"])
    for i, count in active:
        logits += count * weights[:, i]
    logits = logits / model["temperature"]
    probs = np.exp(logits - logits.max())
    probs /= probs.sum()
    order = np.argsort(-probs)
    best, runner = order[:2]
    word_hits = sum(1 for f in extracted if f.startswith("w:") and f in indices)
    known_chars = sum(1 for f in extracted if f.startswith("c:") and f in indices)
    all_chars = sum(1 for f in extracted if f.startswith("c:"))
    accepted = probs[best] >= model["confidenceThreshold"] and probs[best] - probs[runner] >= model["marginThreshold"] and word_hits >= 1 and known_chars / max(all_chars, 1) >= model["minKnownCharFraction"]
    return model["labels"][best] if accepted else "other", float(probs[best]), accepted


def train_intent():
    corpus_path = ROOT / "intent_corpus.json"
    corpus = json.loads(corpus_path.read_text(encoding="utf-8"))
    labels = list(corpus["train"])
    df = Counter()
    for texts in corpus["train"].values():
        for text in texts:
            df.update(text_features(text).keys())
    vocabulary = sorted(f for f, n in df.items() if n >= 2)
    indices = {f: i for i, f in enumerate(vocabulary)}
    counts = np.ones((len(labels), len(vocabulary)))
    for row, label in enumerate(labels):
        for text in corpus["train"][label]:
            for f, n in text_features(text).items():
                if f in indices:
                    counts[row, indices[f]] += min(n, 3)
    likelihood = np.log(counts / counts.sum(axis=1, keepdims=True))
    model = clean(dict(version="purpose-word-char-nb-v1", labels=labels, vocabulary=vocabulary, logLikelihood=likelihood.tolist(), logPrior=[-math.log(len(labels))] * len(labels), temperature=2.0, confidenceThreshold=0.55, marginThreshold=0.15, minKnownCharFraction=0.35))
    # Select abstention using validation only; preserve the test set for reporting.
    candidates = []
    for temp in [1.0, 2.0, 3.0]:
        for threshold in [.5, .6, .7, .8]:
            candidate = dict(model, temperature=temp, confidenceThreshold=threshold)
            correct = accepted = false_accept = 0
            for label, texts in corpus["validation"].items():
                for text in texts:
                    pred, _, keep = intent_scores(text, candidate)
                    accepted += int(keep)
                    correct += int(pred == label)
            for text in corpus["validation_unknown"]:
                false_accept += int(intent_scores(text, candidate)[2])
            candidates.append((correct - 2 * (accepted - correct) - 3 * false_accept, accepted, candidate))
    model = clean(max(candidates, key=lambda c: (c[0], c[1]))[2])
    report = {}
    for split in ["validation", "test"]:
        total = correct = accepted = accepted_correct = 0
        confusion = {label: {p: 0 for p in labels + ["other"]} for label in labels}
        for label, texts in corpus[split].items():
            for text in texts:
                pred, _, keep = intent_scores(text, model)
                total += 1
                accepted += int(keep)
                correct += int(pred == label)
                accepted_correct += int(keep and pred == label)
                confusion[label][pred] += 1
        unknown = corpus[split + "_unknown"]
        rejected = sum(not intent_scores(text, model)[2] for text in unknown)
        report[split] = dict(rows=total, correct=correct, accuracyIncludingAbstentions=correct / total, coverage=accepted / total, accuracyWhenAccepted=accepted_correct / max(accepted, 1), unknownRows=len(unknown), unknownAbstained=rejected, confusion=confusion)
    sha = hashlib.sha256(canonical(model)).hexdigest()
    card = clean(dict(version=model["version"], sha256=sha, corpusSha256=hashlib.sha256(canonical(corpus)).hexdigest(), hashEncoding="SHA256 of compact key-sorted UTF-8 JSON; semantic corpus hash is independent of Windows line endings", algorithm="Multinomial naive Bayes on word unigrams and weighted character trigrams; Laplace smoothing; validation-selected temperature and abstention threshold", license="CC0-1.0 authored corpus and generated parameters", trainRows=sum(map(len, corpus["train"].values())), vocabularySize=len(vocabulary), labels=labels + ["other"], dataSource="Small manually authored Russian examples, not production bank requests", limitation="28 known-purpose test examples and seven out-of-domain examples cannot establish general Russian-language accuracy. Ambiguous requests must be clarified. No LLM or remote API is used.", selection="Vocabulary/likelihoods fit on train only; temperature and confidence threshold on validation only; test used for reporting only", metrics=report))
    return model, card


def write_json(path, value):
    path.write_text(json.dumps(clean(value), ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out-dir", type=Path, default=ROOT / "artifacts")
    parser.add_argument("--no-ts", action="store_true", help="Do not update the bundled TypeScript weights")
    args = parser.parse_args()
    risk, risk_card = train_risk()
    intent, intent_card = train_intent()
    args.out_dir.mkdir(parents=True, exist_ok=True)
    for name, data in [("risk-model", risk), ("risk-model-card", risk_card), ("intent-model", intent), ("intent-model-card", intent_card)]:
        write_json(args.out_dir / (name + ".json"), data)
    if not args.no_ts:
        target = ROOT.parent / "server" / "src" / "ml" / "model-data.ts"
        target.parent.mkdir(parents=True, exist_ok=True)
        source = "// Generated by python ml/train.py. Do not edit weights by hand.\n"
        source += "export const RISK_MODEL = " + json.dumps(risk, ensure_ascii=False) + ";\n"
        source += "export const RISK_MODEL_SHA256 = " + json.dumps(risk_card["sha256"]) + ";\n"
        source += "export const RISK_GOLDEN = " + json.dumps(risk_card["golden"], ensure_ascii=False) + ";\n"
        source += "export const INTENT_MODEL = " + json.dumps(intent, ensure_ascii=False) + ";\n"
        source += "export const INTENT_MODEL_SHA256 = " + json.dumps(intent_card["sha256"]) + ";\n"
        target.write_text(source, encoding="utf-8", newline="\n")
    print(json.dumps(dict(riskVersion=risk["version"], riskSha256=risk_card["sha256"], syntheticTest=risk_card["metrics"]["test"], intentVersion=intent["version"], intentTest=intent_card["metrics"]["test"], output=str(args.out_dir)), ensure_ascii=False))


if __name__ == "__main__":
    main()
