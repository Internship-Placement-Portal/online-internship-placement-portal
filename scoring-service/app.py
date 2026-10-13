"""IPP scoring microservice (SRS 2.5 / 3.3, SAD: POST /internal/analytics/score-test).

Called by the Node API over internal REST. Stateless: Node sends the answers together with the answer key, so this
service never touches the database. Same contract as server/src/services/scoringService.js (nodeScorer).
"""
import hmac
import os

from flask import Flask, jsonify, request

app = Flask(__name__)
TOKEN = os.environ.get("SCORING_SERVICE_TOKEN", "")


def round1(n):
    return round(n * 10) / 10


def score_attempt(answers, questions):
    by_id = {str(q["id"]): q for q in questions}
    if any(str(a["questionId"]) not in by_id for a in answers):
        raise KeyError("unknown question")

    score = max_score = correct_count = mcq_count = coding_pending = 0
    time_per_question, breakdown, per_question = [], {}, []

    for a in answers:
        q = by_id[str(a["questionId"])]
        time_per_question.append({"question": q["id"], "seconds": a.get("timeSpentSec") or 0})
        cat = breakdown.setdefault(q["category"], {"correct": 0, "total": 0, "accuracy": 0})

        if q["type"] == "mcq":
            mcq_count += 1
            max_score += q["marks"]
            sel = a.get("selectedIndex")
            answered = isinstance(sel, int) and not isinstance(sel, bool)
            correct = answered and sel == q.get("correctIndex")
            if correct:
                score += q["marks"]
                correct_count += 1
                cat["correct"] += 1
            cat["total"] += 1
            per_question.append({
                "questionId": str(q["id"]), "correct": correct, "answered": answered,
                "selectedIndex": sel if answered else None, "correctIndex": q.get("correctIndex"),
            })
        else:  # coding answers are recorded but not auto-evaluated
            code = (a.get("codeAnswer") or "").strip()
            if code:
                coding_pending += 1
            per_question.append({
                "questionId": str(q["id"]), "correct": None, "answered": bool(code),
                "selectedIndex": None, "correctIndex": None,
            })

    for c in breakdown.values():
        c["accuracy"] = round1(c["correct"] / c["total"] * 100) if c["total"] else 0

    return {
        "score": score, "maxScore": max_score,
        "accuracy": round1(correct_count / mcq_count * 100) if mcq_count else 0,
        "correctCount": correct_count, "codingPending": coding_pending,
        "timePerQuestion": time_per_question, "categoryBreakdown": breakdown, "perQuestion": per_question,
    }


@app.get("/health")
def health():
    return jsonify(status="ok")


@app.post("/internal/analytics/score-test")
def score_test():
    if TOKEN and not hmac.compare_digest(request.headers.get("X-Internal-Token", ""), TOKEN):
        return jsonify(error="forbidden"), 403
    body = request.get_json(silent=True) or {}
    answers, questions = body.get("answers"), body.get("questions")
    if not isinstance(answers, list) or not isinstance(questions, list):
        return jsonify(error="answers and questions are required"), 400
    try:
        return jsonify(score_attempt(answers, questions))
    except KeyError:
        return jsonify(error="UNKNOWN_QUESTION"), 422


if __name__ == "__main__":
    app.run(host=os.environ.get("HOST", "127.0.0.1"), port=int(os.environ.get("PORT", "5001")))
