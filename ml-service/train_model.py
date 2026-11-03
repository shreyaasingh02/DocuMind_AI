
import pandas as pd
import joblib

from pathlib import Path
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.tree import DecisionTreeClassifier
from sklearn.pipeline import Pipeline
from sklearn.metrics import accuracy_score, classification_report

BASE_DIR = Path(__file__).resolve().parent
DATA_FILE = BASE_DIR / "training_data.csv"
MODEL_FILE = BASE_DIR / "decision_tree_model.joblib"

UNKNOWN_THRESHOLD = 0.15

# Load labeled examples
data = pd.read_csv(DATA_FILE)
X = data["text"].astype(str)
y = data["label"].astype(str)

# Keep some examples aside for evaluation
X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.25,
    random_state=42,
    stratify=y
)

# Build the text-processing and classification pipeline

# Improved text features + Decision Tree
model = Pipeline([
    ("vectorizer", TfidfVectorizer(
        lowercase=True,
        stop_words="english",
        ngram_range=(1, 2),
        sublinear_tf=True,
        max_features=5000
    )),
    ("classifier", DecisionTreeClassifier(
        max_depth=None,
        min_samples_split=4,
        min_samples_leaf=1,
        criterion="entropy",
        class_weight="balanced",
        random_state=42
    ))
])


# Train the model
model.fit(X_train, y_train)

print("\nClasses learned by the model:")
print(model.classes_)

print("\nTraining accuracy:")
print(model.score(X_train, y_train))

print("\nTest accuracy:")
print(model.score(X_test, y_test))

# Evaluate predictions on held-out examples
predictions = model.predict(X_test)
accuracy = accuracy_score(y_test, predictions)

print("\nTraining completed!")
print("Training examples:", len(X_train))
print("Testing examples:", len(X_test))
print(f"Test accuracy: {accuracy:.2%}")
print("\nClassification report:")
print(classification_report(
    y_test,
    predictions,
    zero_division=0
))

# Save the complete fitted pipeline
joblib.dump(model, MODEL_FILE)
print("\nModel saved to:", MODEL_FILE)

# Try a few example inputs
samples = [
    "Python algorithms and data structures",
    "A princess discovers a magical kingdom",
    "The French Revolution changed European politics",
    "A grocery list with bread and milk"
]


print("\nSample predictions:")

samples = {
    "Computer Science": "Python programming algorithms databases and computer networks",
    "Mathematics": "Algebra equations calculus derivatives and mathematical statistics",
    "Physics": "Force motion energy electricity and Newton laws",
    "Biology": "Cells DNA genetics plants and living organisms",
    "Literature": "Literary analysis poetry novels symbolism and Shakespearean drama",
    "Fiction": "A princess discovers a magical kingdom filled with dragons and spells",
    "History": "The French Revolution changed European politics and society",
    "Business": "Marketing strategy finance revenue customers and business management",
    "Machine Learning": "Supervised learning decision trees model training and prediction",
    "General": "A shopping list containing bread milk apples and household supplies",
}

for expected, text in samples.items():
    probabilities = model.predict_proba([text])[0]
    best_index = probabilities.argmax()
    predicted = model.classes_[best_index]
    score = probabilities[best_index]

    print(
        f"Expected: {expected:18} | "
        f"Predicted: {predicted:18} | "
        f"Score: {score:.2f}"
    )

