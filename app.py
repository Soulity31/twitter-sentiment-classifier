import os
import torch
import joblib
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from fastapi.middleware.cors import CORSMiddleware

import shutil

ml_models = {}
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = BASE_DIR

# If model was placed in "New folder", restore it to main project directory
new_folder_model = os.path.join(BASE_DIR, "New folder", "model.safetensors")
root_model = os.path.join(BASE_DIR, "model.safetensors")
if os.path.exists(new_folder_model) and not os.path.exists(root_model):
    try:
        shutil.move(new_folder_model, root_model)
        print("Restored model.safetensors to project root")
    except Exception as e:
        print(f"Notice: {e}")

@asynccontextmanager
async def lifespan(app : FastAPI):
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Loading model artifacts on {device}")

    try:
        model_load_dir = MODEL_DIR
        if not os.path.exists(os.path.join(MODEL_DIR, "model.safetensors")):
            alt_dir = os.path.join(MODEL_DIR, "New folder")
            if os.path.exists(os.path.join(alt_dir, "model.safetensors")):
                model_load_dir = alt_dir

        ml_models["tokenizer"] = AutoTokenizer.from_pretrained(MODEL_DIR)
        ml_models["model"] = AutoModelForSequenceClassification.from_pretrained(model_load_dir).to(device)
        ml_models["model"].eval()
        ml_models["label_encoder"] = joblib.load(os.path.join(MODEL_DIR, "label_encoder.joblib"))
        ml_models["device"] = device
        print(f"Model loaded successfully from {model_load_dir}")
    except Exception as e:
        print(f"Error loading model artifacts: {e}")
        raise e
    yield
    ml_models.clear()

app = FastAPI(
    title="Tweet Intent Classification API",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"]
)

class PredictRequest(BaseModel):
    text: str

class PredictResponse(BaseModel):
    text: str
    intent: str
    confidence: float

@app.get("/")
def serve_index():
    return FileResponse(os.path.join(BASE_DIR, "index.html"))

@app.get("/styles.css")
def serve_styles():
    return FileResponse(os.path.join(BASE_DIR, "styles.css"))

@app.get("/app.js")
def serve_js():
    return FileResponse(os.path.join(BASE_DIR, "app.js"))

@app.get("/health")
def health_check():
    return {"status": "healthy", "device": ml_models.get("device", "unknown")}

@app.get("/labels")
def get_labels():
    encoder = ml_models.get("label_encoder")
    return {"labels": list(encoder.classes_) if encoder else []}

@app.post("/predict", response_model = PredictResponse)
def predict_intent(request: PredictRequest):
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty.")

    tokenizer = ml_models["tokenizer"]
    model = ml_models["model"]
    label_encoder = ml_models["label_encoder"]
    device = ml_models["device"]

    inputs = tokenizer(
        request.text,
        padding=True,
        truncation=True,
        max_length=35,
        return_tensors="pt"
    ).to(device)

    inputs.pop("token_type_ids", None)

    with torch.no_grad():
        outputs = model(**inputs)
        probabilties = torch.softmax(outputs.logits, dim=1)
        confidence, predicted_idx = torch.max(probabilties, dim=1)

    predicted_label = label_encoder.inverse_transform([predicted_idx.item()])[0]

    return PredictResponse(
        text=request.text,
        intent=str(predicted_label),
        confidence=round(confidence.item(), 4)
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)

