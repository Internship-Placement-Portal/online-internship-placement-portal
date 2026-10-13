import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import app as svc

QS = [
    {"id": "a", "type": "mcq", "category": "logic", "marks": 2, "correctIndex": 1},
    {"id": "b", "type": "mcq", "category": "logic", "marks": 1, "correctIndex": 0},
    {"id": "c", "type": "coding", "category": "code", "marks": 5},
]
client = svc.app.test_client()


def post(body, headers=None):
    return client.post("/internal/analytics/score-test", json=body, headers=headers or {})


def test_scores_mcq_and_coding():
    r = post({"questions": QS, "answers": [
        {"questionId": "a", "selectedIndex": 1, "timeSpentSec": 4},
        {"questionId": "b", "selectedIndex": 3},
        {"questionId": "c", "codeAnswer": "print(1)"},
    ]}).get_json()
    assert r["score"] == 2 and r["maxScore"] == 3 and r["correctCount"] == 1
    assert r["accuracy"] == 50 and r["codingPending"] == 1
    assert r["categoryBreakdown"]["logic"] == {"correct": 1, "total": 2, "accuracy": 50}
    assert r["perQuestion"][2]["correct"] is None


def test_unanswered_scores_zero():
    r = post({"questions": QS, "answers": [{"questionId": "a"}, {"questionId": "b"}]}).get_json()
    assert r["score"] == 0 and r["accuracy"] == 0


def test_unknown_question_422_and_bad_body_400():
    assert post({"questions": QS, "answers": [{"questionId": "zzz"}]}).status_code == 422
    assert post({"answers": []}).status_code == 400


def test_token_enforced(monkeypatch):
    monkeypatch.setattr(svc, "TOKEN", "s3cret")
    body = {"questions": QS, "answers": []}
    assert post(body).status_code == 403
    assert post(body, {"X-Internal-Token": "s3cret"}).status_code == 200
