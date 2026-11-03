
from pathlib import Path

import joblib
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from collections import Counter

BASE_DIR = Path(__file__).resolve().parent
MODEL_FILE = BASE_DIR / "decision_tree_model.joblib"

app = FastAPI(title="DocuMind ML Service")

# Load the trained pipeline once when the service starts
if not MODEL_FILE.exists():
    raise RuntimeError(
        "Trained model not found. Run: python train_model.py"
    )

model = joblib.load(MODEL_FILE)


class PredictionRequest(BaseModel):
    text: str = Field(min_length=1, max_length=100000)


@app.get("/")
def home():
    return {"message": "DocuMind ML service is running"}



@app.post("/predict")
def predict(request: PredictionRequest):
    text = request.text.strip()

    if not text:
        raise HTTPException(
            status_code=400,
            detail="Please provide non-empty document text."
        )

    try:
        # Split the document into chunks of about 100 words
        words = text.split()
        chunk_size = 100

        chunks = [
            " ".join(words[i:i + chunk_size])
            for i in range(0, len(words), chunk_size)
            if len(words[i:i + chunk_size]) >= 10
        ]

        if not chunks:
            chunks = [text]

        # Predict each chunk using the trained pipeline
        all_probabilities = model.predict_proba(chunks)

        # Average the class probabilities across chunks
        average_probabilities = all_probabilities.mean(axis=0)

        best_index = average_probabilities.argmax()
        confidence = float(average_probabilities[best_index])

        predicted_subject = str(model.classes_[best_index])

        # Keep Unknown for low-confidence predictions
        # Diagnostic only: inspect the model's raw prediction.
        # Do not use this as the final production behavior.

        # Predict each chunk separately
        chunk_predictions = model.predict(chunks)

        # Count the predicted categories
        vote_counts = Counter(chunk_predictions.tolist())

        # Most frequently predicted category
        predicted_subject, votes = vote_counts.most_common(1)[0]

        return {
            "predicted_subject": str(predicted_subject),
            "model": "Decision Tree Classifier",
            "confidence": round(confidence, 3),
            "chunks_analyzed": len(chunks)
        }

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail="Prediction failed."
        ) from error
