# IPP scoring service (Python / Flask)

Scores aptitude-test attempts for the Node API (SRS 2.5, 3.3). Stateless; contract matches `scoringService.js`.

    pip install -r requirements.txt
    python app.py                  # http://127.0.0.1:5001
    python -m pytest tests

Enable in the API with `SCORING_SERVICE_URL=http://127.0.0.1:5001` (and the same `SCORING_SERVICE_TOKEN` on both
sides). If the service is unset or unreachable, the API falls back to its built-in Node scorer.
